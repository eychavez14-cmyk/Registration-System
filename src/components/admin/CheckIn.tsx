"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventRow, Registration } from "@/lib/types";
import { browserDb } from "@/lib/supabase/browser";
import { extractCode } from "@/lib/qr";
import { money } from "@/lib/validate";
import { STATUS_STYLE } from "@/components/StatusLookup";
import { loadAll } from "./Registrations";
import { QrScanner } from "./QrScanner";
import { btn, input } from "./ui";

type Person = { key: string; label: string; name: string };

// Who can be checked in on a registration: each delegate, or the registrant if there's no delegate list.
function people(reg: Registration, event: EventRow): Person[] {
  const { config } = event;
  const a = reg.answers;
  const registrant = [a.first_name, a.last_name].filter((x) => typeof x === "string" && x).join(" ") || "Registrant";
  if (!reg.attendees?.length) return [{ key: "main", label: "Registrant", name: registrant }];
  const seen: Record<string, number> = {};
  return reg.attendees.map((p, i) => {
    seen[p.item] = (seen[p.item] ?? 0) + 1;
    const item = config.fees.items.find((x) => x.id === p.item)?.label ?? "Delegate";
    const name = config.attendees.fields.map((f) => p.answers[f.id]).filter((v) => typeof v === "string" && v).join(" · ");
    return { key: String(i), label: `${item} #${seen[p.item]}`, name: name || "—" };
  });
}

// Short confirmation sound + vibration so volunteers don't have to look at the screen.
function feedback(ok: boolean) {
  try {
    navigator.vibrate?.(ok ? 80 : [60, 60, 60]);
    const ac = new AudioContext();
    const o = ac.createOscillator();
    o.frequency.value = ok ? 880 : 220;
    o.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.12);
  } catch { /* sound is optional */ }
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function CheckIn({ event }: { event: EventRow }) {
  const [rows, setRows] = useState<Registration[] | null>(null);
  const [open, setOpen] = useState<Registration | null>(null);
  const [scanning, setScanning] = useState(false);
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadAll(event.id).then(setRows, (e) => setNotice({ ok: false, text: e.message })); }, [event.id]);

  const stats = useMemo(() => {
    const ok = (rows ?? []).filter((r) => r.status === "confirmed");
    const expected = ok.reduce((s, r) => s + Math.max(1, r.attendees?.length ?? 0), 0);
    const arrived = ok.reduce((s, r) => s + Object.keys(r.checkin ?? {}).length, 0);
    return { expected, arrived };
  }, [rows]);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2 || extractCode(q)) return [];
    const text = (r: Registration) => [r.ref_code, ...Object.values(r.answers), ...(r.attendees ?? []).flatMap((a) => Object.values(a.answers))].join(" ").toLowerCase();
    return (rows ?? []).filter((r) => text(r).includes(needle)).slice(0, 8);
  }, [rows, q]);

  async function find(code: string) {
    setNotice(null);
    // Always fetch fresh: another volunteer may have checked them in a moment ago.
    const { data } = await browserDb().from("registrations").select("*, events(title)").eq("ref_code", code).maybeSingle();
    if (!data) {
      feedback(false);
      return setNotice({ ok: false, text: `No registration found with number ${code}.` });
    }
    if (data.event_id !== event.id) {
      feedback(false);
      return setNotice({ ok: false, text: `${code} is registered for a different event: ${data.events?.title ?? "another event"}.` });
    }
    const { events: _ignored, ...reg } = data;
    void _ignored;
    feedback(true);
    setOpen(reg as Registration);
    setScanning(false);
  }

  async function update(reg: Registration, patch: Partial<Registration>, done: string) {
    setBusy(true);
    const db = browserDb();
    // Merge with the latest check-ins so two volunteers scanning the same group don't overwrite each other.
    const { data: latest } = await db.from("registrations").select("checkin").eq("id", reg.id).single();
    const body = patch.checkin ? { ...patch, checkin: { ...latest?.checkin, ...patch.checkin } } : patch;
    for (const [k, v] of Object.entries(body.checkin ?? {})) if (!v) delete body.checkin![k]; // "" = undo
    const { data, error } = await db.from("registrations").update(body).eq("id", reg.id).select("*").single();
    setBusy(false);
    if (error) return setNotice({ ok: false, text: error.message });
    const fresh = data as Registration;
    setOpen(fresh);
    setRows((all) => all?.map((r) => (r.id === fresh.id ? fresh : r)) ?? null);
    setNotice({ ok: true, text: done });
  }

  const now = () => new Date().toISOString();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checked in</p>
          <p className="text-2xl font-extrabold">{stats.arrived} <span className="text-base font-semibold text-slate-400">/ {stats.expected} confirmed</span></p>
        </div>
        <div className="ml-auto h-2 w-40 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div className="h-full bg-green-500 transition-all" style={{ width: `${stats.expected ? (100 * stats.arrived) / stats.expected : 0}%` }} />
        </div>
      </div>

      {!open && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          {scanning ? (
            <>
              <QrScanner onCode={find} onError={(text) => { setScanning(false); setNotice({ ok: false, text }); }} />
              <button type="button" className={`${btn} w-full`} onClick={() => setScanning(false)}>Stop camera</button>
            </>
          ) : (
            <button type="button" onClick={() => { setNotice(null); setScanning(true); }} className="w-full rounded-xl bg-blue-600 px-4 py-4 text-lg font-bold text-white hover:bg-blue-700">📷 Scan QR code</button>
          )}
          <form onSubmit={(e) => { e.preventDefault(); const code = extractCode(q); if (code) find(code); }} className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="…or type a registration number or name" aria-label="Registration number or name" className={input} autoCapitalize="characters" />
            <button className={btn}>Find</button>
          </form>
          {matches.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {matches.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => find(r.ref_code)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50">
                    <span className="font-mono font-semibold">{r.ref_code}</span>
                    <span className="flex-1 truncate">{people(r, event).map((p) => p.name).join(", ")}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {notice && <p role={notice.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm font-medium ${notice.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{notice.text}</p>}

      {open && (() => {
        const list = people(open, event);
        const ci = open.checkin ?? {};
        const remaining = list.filter((p) => !ci[p.key]);
        const church = event.config.sections.flatMap((s) => s.fields).find((f) => /church/i.test(f.label));
        return (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xl font-bold">{open.ref_code}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${STATUS_STYLE[open.status]}`}>{open.status}</span>
              <span className="ml-auto text-sm text-slate-500">{money(event.config.fees.currency, Number(open.total))}</span>
            </div>
            {church && open.answers[church.id] && <p className="text-sm text-slate-600">{church.label}: <b>{String(open.answers[church.id])}</b></p>}

            {open.status === "rejected" && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">⛔ This registration was rejected. Don&apos;t check in — send them to the registration desk.{open.admin_note && <span className="block font-normal">Note: {open.admin_note}</span>}</p>}
            {open.status === "pending" && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">⚠️ Payment not confirmed yet. Check their receipt, then use “Confirm & check in”.</p>}

            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {list.map((p) => (
                <li key={p.key} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.label}</p>
                  </div>
                  {ci[p.key] ? (
                    <>
                      <span className="text-sm font-semibold text-green-700">✓ {time(ci[p.key])}</span>
                      <button type="button" disabled={busy} className="text-xs text-slate-400 underline hover:text-slate-700" onClick={() => update(open, { checkin: { [p.key]: "" } }, `Undid check-in for ${p.name}.`)}>Undo</button>
                    </>
                  ) : open.status === "confirmed" ? (
                    <button type="button" disabled={busy} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50" onClick={() => update(open, { checkin: { [p.key]: now() } }, `${p.name} checked in.`)}>Check in</button>
                  ) : (
                    <span className="text-xs text-slate-400">Not checked in</span>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2">
              {open.status === "confirmed" && remaining.length > 0 && (
                <button type="button" disabled={busy} className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                  onClick={() => update(open, { checkin: Object.fromEntries(remaining.map((p) => [p.key, now()])) }, `Checked in ${remaining.length} ${remaining.length === 1 ? "person" : "people"}.`)}>
                  ✓ Check in {remaining.length > 1 ? `all ${remaining.length}` : ""}
                </button>
              )}
              {open.status === "pending" && (
                <button type="button" disabled={busy} className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                  onClick={() => update(open, { status: "confirmed", checkin: Object.fromEntries(remaining.map((p) => [p.key, now()])) }, `Confirmed and checked in ${remaining.length} ${remaining.length === 1 ? "person" : "people"}.`)}>
                  Confirm & check in {remaining.length > 1 ? `all ${remaining.length}` : ""}
                </button>
              )}
              {open.status === "confirmed" && remaining.length === 0 && <p className="flex-1 rounded-xl bg-green-50 p-3 text-center font-semibold text-green-800">✓ Everyone on this registration is checked in</p>}
              <button type="button" className={`${btn} flex-1 py-3`} onClick={() => { setOpen(null); setNotice(null); setQ(""); setScanning(true); }}>📷 Scan next</button>
            </div>
          </div>
        );
      })()}

      {!rows && <p className="text-center text-sm text-slate-500">Loading registrations…</p>}
    </div>
  );
}
