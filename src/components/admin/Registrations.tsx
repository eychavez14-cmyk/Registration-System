"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Answers, EventConfig, EventRow, Registration, Status } from "@/lib/types";
import { authFetch, browserDb } from "@/lib/supabase/browser";
import { diffChange } from "@/lib/edit";
import { attendeeSlots, money, validateSubmission } from "@/lib/validate";
import { isShown, shownIds, visibleAnswers } from "@/lib/rules";
import { FieldInput } from "@/components/RegistrationForm";
import { STATUS_STYLE } from "@/components/StatusLookup";
import { registrantEmail } from "@/lib/email";
import { useRole } from "./AdminGate";
import Link from "next/link";
import { buildLines, choiceFields, choiceKey, filterLines, groupLines, payBreakdown, registrantName, sumAmount } from "@/lib/report";
import { btn, ConfirmButton, input } from "./ui";

const PAGE = 1000; // Supabase returns at most 1000 rows per request

export async function loadAll(eventId: string) {
  const rows: Registration[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await browserDb().from("registrations").select("*").eq("event_id", eventId).order("created_at", { ascending: false }).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as Registration[]));
    if (data.length < PAGE) return rows;
  }
}

const display = (v: unknown) => (typeof v === "boolean" ? (v ? "Yes" : "No") : v == null || v === "" ? "—" : String(v));

// Check-in progress, e.g. "2/3" people (registrations without a delegate list count as 1).
const checkinCount = (r: Registration) => Object.keys(r.checkin ?? {}).length;
const checkinText = (r: Registration) => (checkinCount(r) ? `${checkinCount(r)}/${Math.max(1, r.attendees?.length ?? 0)}` : "");

export function Registrations({ event }: { event: EventRow }) {
  const { config } = event;
  const [rows, setRows] = useState<Registration[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | Status | "edit">("");
  const [filters, setFilters] = useState<Record<string, string>>({}); // dropdown question filters
  const [open, setOpen] = useState<Registration | null>(null);

  const reload = () => loadAll(event.id).then(setRows, (e) => setError(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [event.id]);

  const choices = useMemo(() => choiceFields(config), [config]);
  // Statistics and the table both come from the filtered "lines" (one per person), so they always match.
  const lines = useMemo(() => filterLines(buildLines(config, rows ?? []), config, filters), [config, rows, filters]);

  const filtered = useMemo(() => {
    const ids = new Set(lines.map((l) => l.reg.id));
    const needle = q.trim().toLowerCase();
    const text = (r: Registration) => [r.ref_code, ...Object.values(r.answers), ...(r.attendees ?? []).flatMap((a) => Object.values(a.answers))].join(" ").toLowerCase();
    return (rows ?? []).filter((r) => ids.has(r.id) && (!status || (status === "edit" ? !!r.pending_change : r.status === status)) && (!needle || text(r).includes(needle)));
  }, [rows, lines, q, status]);

  const stats = useMemo(() => {
    const regs = new Map(lines.map((l) => [l.reg.id, l.reg]));
    const active = lines.filter((l) => l.reg.status !== "rejected");
    return {
      count: regs.size,
      by: (s: Status) => [...regs.values()].filter((r) => r.status === s).length,
      expected: sumAmount(active),
      confirmed: sumAmount(lines, "confirmed"),
      groups: groupLines(active, config, "category"),
      pay: payBreakdown(config, active),
      edits: (rows ?? []).filter((r) => r.pending_change).length,
    };
  }, [lines, config, rows]);

  const cur = config.fees.currency;
  const filtering = Object.values(filters).some(Boolean);
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!rows) return <p className="text-sm text-slate-500">Loading registrations…</p>;

  return (
    <div className="space-y-5">
      {choices.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
          <p className="w-full text-xs font-semibold uppercase tracking-wide text-slate-500">Filter the dashboard</p>
          {choices.map((c) => (
            <label key={choiceKey(c)} className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">{c.field.label}{c.scope === "att" && " (delegate)"}</span>
              <select value={filters[choiceKey(c)] ?? ""} onChange={(e) => setFilters({ ...filters, [choiceKey(c)]: e.target.value })} className={`${input} max-w-56`}>
                <option value="">All</option>
                {(c.field.options ?? []).map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          ))}
          {filtering && <button type="button" className={btn} onClick={() => setFilters({})}>Clear filters</button>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Registrations", stats.count],
          ["Pending", stats.by("pending")],
          ["Confirmed", stats.by("confirmed")],
          ["Rejected", stats.by("rejected")],
          ["Expected", money(cur, stats.expected)],
          ["Confirmed paid", money(cur, stats.confirmed)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 break-words text-lg font-extrabold sm:text-xl">{value}</p>
          </div>
        ))}
      </div>
      {/* Only when someone registered free or discounted; otherwise everyone paid in full and this adds nothing. */}
      {(stats.pay.free.people > 0 || stats.pay.discounted.people > 0) && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {([
            ["Paid in full", stats.pay.paid, "border-green-200 bg-green-50 text-green-900"],
            ["Discounted", stats.pay.discounted, "border-amber-200 bg-amber-50 text-amber-900"],
            ["Free", stats.pay.free, "border-sky-200 bg-sky-50 text-sky-900"],
          ] as const).filter(([label, k]) => label === "Paid in full" || k.people > 0).map(([label, k, style]) => (
            <div key={label} className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${style}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
              <p className="mt-1 text-lg font-extrabold sm:text-xl">{k.people} {k.people === 1 ? "person" : "people"}</p>
              {label !== "Free" && <p className="break-words text-sm font-medium opacity-80">{money(cur, k.amount)}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        {stats.groups.map((g) => <span key={g.name} className="rounded-full border border-slate-200 bg-white px-3 py-1">{g.name}: <b>{g.people}</b> · {money(cur, g.amount)}</span>)}
        {stats.edits > 0 && <button type="button" onClick={() => setStatus("edit")} className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 font-semibold text-purple-800">✏️ {stats.edits} edit request{stats.edits > 1 ? "s" : ""} waiting</button>}
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, church, code…" aria-label="Search registrations" className={`${input} min-w-0 flex-1 basis-48 sm:max-w-xs`} />
        <select value={status} onChange={(e) => setStatus(e.target.value as Status | "edit" | "")} aria-label="Filter by status" className={`${input} max-w-44`}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="rejected">Rejected</option>
          <option value="edit">Edit requested</option>
        </select>
        <button className={btn} onClick={reload}>Refresh</button>
        <Link href={`/admin/events/${event.id}/report`} className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700">📊 Create report</Link>
      </div>

      {/* Phones and tablets: one card per registration (no sideways scrolling). */}
      <ul className="space-y-2 lg:hidden">
        {filtered.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => setOpen(r)} className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left text-sm hover:bg-slate-50">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono font-bold">{r.ref_code}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                {r.pending_change && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">✏️ edit</span>}
                <span className="ml-auto font-semibold">{money(cur, Number(r.total))}</span>
              </div>
              <p className="mt-1 break-words font-medium">{registrantName(config, r.answers)}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {new Date(r.created_at).toLocaleString()} · {r.receipt_path ? "📎 Receipt" : "No receipt"}
                {checkinCount(r) > 0 && <span className="font-semibold text-green-700"> · ✓ Checked in {checkinText(r)}</span>}
              </p>
            </button>
          </li>
        ))}
        {!filtered.length && <li className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No registrations{rows.length ? " match" : " yet"}.</li>}
      </ul>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="p-3">Submitted</th><th className="p-3">Reference</th><th className="p-3">Name</th><th className="p-3 text-right">Total</th><th className="p-3">Receipt</th><th className="p-3">Check-in</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3 whitespace-nowrap text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-3 font-mono"><button className="hover:underline">{r.ref_code}</button></td>
                <td className="p-3">{registrantName(config, r.answers)}</td>
                <td className="p-3 text-right">{money(cur, Number(r.total))}</td>
                <td className="p-3">{r.receipt_path ? "📎" : "—"}</td>
                <td className={`p-3 whitespace-nowrap ${checkinCount(r) ? "font-semibold text-green-700" : "text-slate-400"}`}>{checkinCount(r) ? `✓ ${checkinText(r)}` : "—"}</td>
                <td className="p-3 whitespace-nowrap">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                  {r.pending_change && <span className="ml-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">✏️ edit</span>}
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} className="p-6 text-center text-slate-500">No registrations{rows.length ? " match" : " yet"}.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <Detail
          key={open.id}
          reg={open}
          event={event}
          onClose={() => setOpen(null)}
          onSaved={(r) => { setRows((all) => (r ? all!.map((x) => (x.id === r.id ? r : x)) : all!.filter((x) => x.id !== open.id))); setOpen(r); }}
        />
      )}
    </div>
  );
}

function Detail({ reg, event, onClose, onSaved }: { reg: Registration; event: EventRow; onClose: () => void; onSaved: (r: Registration | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState(reg.admin_note ?? "");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [newReceipt, setNewReceipt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [editing, setEditing] = useState(false);
  const { config } = event;
  const isAdmin = useRole() === "admin";
  const [emailIt, setEmailIt] = useState(config.emails.enabled && !!registrantEmail(config, reg.answers));
  const known = new Set(config.sections.flatMap((s) => s.fields.map((f) => f.id)));

  useEffect(() => {
    ref.current?.showModal();
    if (reg.receipt_path) browserDb().storage.from("receipts").createSignedUrl(reg.receipt_path, 600).then(({ data }) => setReceipt(data?.signedUrl ?? null));
  }, [reg.receipt_path]);
  // Staff can preview a replacement receipt before approving it (private bucket: short-lived link).
  useEffect(() => {
    const p = reg.pending_change?.receipt_path;
    if (p) browserDb().storage.from("receipts").createSignedUrl(p, 600).then(({ data }) => setNewReceipt(data?.signedUrl ?? null));
  }, [reg.pending_change?.receipt_path]);

  async function save(patch: Partial<Registration>) {
    setBusy(true);
    setError("");
    setInfo("");
    const db = browserDb();
    const { data, error } = await db.from("registrations").update(patch).eq("id", reg.id).select("*").single();
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    onSaved(data as Registration);
    if (emailIt && (patch.status === "confirmed" || patch.status === "rejected")) {
      const { data: s } = await db.auth.getSession();
      const res = await fetch("/api/notify", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s.session?.access_token}` }, body: JSON.stringify({ registrationId: reg.id }) }).catch(() => null);
      const out = res ? await res.json() : { error: "Network error" };
      if (res?.ok) setInfo(`Status saved and emailed to ${out.to}`);
      else setError(`Status saved, but no email was sent: ${out.error}`);
    }
    setBusy(false);
  }

  // Approve/reject a registrant's edit (server-side: moderators can't write answers directly).
  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setError("");
    setInfo("");
    const res = await authFetch("/api/change", { method: "POST", body: JSON.stringify({ registrationId: reg.id, action }) }).catch(() => null);
    const out = res ? await res.json() : { error: "Network error" };
    setBusy(false);
    if (!res?.ok) return setError(out.error);
    onSaved(out.registration as Registration);
    setInfo(action === "approve" ? "Changes approved and applied." : "Changes rejected; the registration stays as it was.");
  }

  async function remove() {
    const db = browserDb();
    const { error } = await db.from("registrations").delete().eq("id", reg.id);
    if (error) return setError(error.message);
    if (reg.receipt_path) await db.storage.from("receipts").remove([reg.receipt_path]);
    onSaved(null);
    onClose();
  }

  return (
    // Clicking the dimmed area outside the box closes it (the click lands on the <dialog> itself, not its content).
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }} className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-2xl p-0 backdrop:bg-black/40">
      <div className="max-h-[85vh] overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
        {/* Pinned while scrolling so Close is always reachable */}
        <div className="sticky top-0 z-10 -mx-5 mb-1 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 truncate font-mono text-lg font-bold sm:text-xl">{reg.ref_code}</h2>
            {isAdmin && !editing && <button type="button" onClick={() => { setEditing(true); setInfo(""); }} className={`${btn} ml-auto shrink-0`}>✏️ Edit</button>}
            <button onClick={() => ref.current?.close()} aria-label="Close" className={`${isAdmin && !editing ? "" : "ml-auto"} flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900`}>×</button>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className={`rounded-full px-2 py-0.5 font-bold uppercase ${STATUS_STYLE[reg.status]}`}>{reg.status}</span>
            {new Date(reg.created_at).toLocaleString()}
          </p>
        </div>

        {editing ? (
          <AdminEdit reg={reg} config={config} onCancel={() => setEditing(false)} onSaved={(r) => { onSaved(r); setEditing(false); setInfo("Changes saved."); ref.current?.firstElementChild?.scrollTo({ top: 0 }); }} />
        ) : (<>
        {info && <p role="status" className="mt-3 rounded-lg bg-green-50 p-2 text-sm text-green-800">{info}</p>}
        {config.sections.map((s) => (
          <div key={s.id} className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{s.title}</h3>
            <dl className="mt-1 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              {s.fields.map((f) => <div key={f.id}><dt className="text-slate-500">{f.label}</dt><dd className="font-medium break-words">{display(reg.answers[f.id])}</dd></div>)}
            </dl>
          </div>
        ))}
        {Object.keys(reg.answers).some((k) => !known.has(k)) && (
          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Removed fields</h3>
            <dl className="mt-1 text-sm">{Object.entries(reg.answers).filter(([k]) => !known.has(k)).map(([k, v]) => <div key={k}><dt className="text-slate-500">{k}</dt><dd>{display(v)}</dd></div>)}</dl>
          </div>
        )}

        {Object.keys(reg.fees).length > 0 && (
          <div className="mt-4 text-sm">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Items</h3>
            {Object.entries(reg.fees).map(([id, qty]) => {
              const item = config.fees.items.find((i) => i.id === id);
              return <p key={id}>{item?.label ?? "Removed item"} × {qty}</p>;
            })}
            <p className="mt-1 font-bold">Total: {money(config.fees.currency, Number(reg.total))}</p>
          </div>
        )}

        {(reg.attendees ?? []).length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{config.attendees.title}</h3>
            <ol className="mt-1 space-y-2 text-sm">
              {reg.attendees.map((a, i) => {
                const item = config.fees.items.find((x) => x.id === a.item);
                // Show current questions first, then answers to questions removed since.
                const rest = Object.entries(a.answers).filter(([k]) => !config.attendees.fields.some((f) => f.id === k));
                return (
                  <li key={i} className="rounded-lg bg-slate-50 p-2">
                    <p className="text-xs font-semibold text-slate-500">{i + 1}. {item?.label ?? "Removed category"}</p>
                    <dl className="grid gap-x-4 sm:grid-cols-2">
                      {config.attendees.fields.map((f) => <div key={f.id}><dt className="text-slate-500">{f.label}</dt><dd className="font-medium break-words">{display(a.answers[f.id])}</dd></div>)}
                      {rest.map(([k, v]) => <div key={k}><dt className="text-slate-500">{k}</dt><dd className="break-words">{display(v)}</dd></div>)}
                    </dl>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {reg.receipt_path && (
          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Proof of payment</h3>
            {!receipt ? <p className="text-sm text-slate-500">Loading…</p> : reg.receipt_path.endsWith(".pdf") ? (
              <a href={receipt} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">Open PDF receipt</a>
            ) : (
              <a href={receipt} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receipt} alt="Proof of payment" className="mt-1 max-h-80 rounded-lg border border-slate-200" />
              </a>
            )}
          </div>
        )}

        {reg.pending_change && (() => {
          const changes = diffChange(config, { answers: reg.answers, attendees: reg.attendees ?? [] }, reg.pending_change);
          return (
            <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm">
              <p className="font-bold text-purple-900">✏️ Edit requested by the registrant</p>
              <p className="text-xs text-purple-800">Sent {new Date(reg.pending_change.submitted_at).toLocaleString()}. Nothing changes until you approve.</p>
              <table className="mt-2 w-full text-left text-xs">
                <thead><tr className="text-purple-800"><th className="py-1 pr-2">Question</th><th className="py-1 pr-2">Now</th><th className="py-1">Requested</th></tr></thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.label} className="border-t border-purple-200 align-top">
                      <td className="py-1 pr-2 font-medium">{c.label}</td><td className="py-1 pr-2 text-slate-500 line-through">{c.from}</td><td className="py-1 font-semibold">{c.to}</td>
                    </tr>
                  ))}
                  {reg.pending_change.receipt_path && (
                    <tr className="border-t border-purple-200 align-top">
                      <td className="py-1 pr-2 font-medium">Proof of payment</td><td className="py-1 pr-2 text-slate-500">{reg.receipt_path ? "Current file" : "None"}</td>
                      <td className="py-1 font-semibold">{newReceipt ? <a href={newReceipt} target="_blank" rel="noreferrer" className="text-purple-800 underline">Replaced, view new file ↗</a> : "Replaced (loading…)"}</td>
                    </tr>
                  )}
                  {!changes.length && !reg.pending_change.receipt_path && <tr><td colSpan={3} className="py-1 text-slate-500">No visible differences.</td></tr>}
                </tbody>
              </table>
              {reg.pending_change.receipt_path && (
                // Side by side so staff can judge the new receipt before approving.
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[["Current receipt", reg.receipt_path, receipt], ["New receipt (requested)", reg.pending_change.receipt_path, newReceipt]].map(([label, path, url]) => (
                    <div key={label} className="rounded-lg border border-purple-200 bg-white p-2">
                      <p className="mb-1 text-xs font-bold text-purple-900">{label}</p>
                      {!path ? <p className="text-xs text-slate-500">None</p>
                        : !url ? <p className="text-xs text-slate-500">Loading…</p>
                        : path.endsWith(".pdf") ? <a href={url} target="_blank" rel="noreferrer" className="text-sm text-purple-800 underline">📄 Open PDF</a>
                        : (
                          <a href={url} target="_blank" rel="noreferrer" title="Open full size">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={label!} className="max-h-64 w-full rounded-md object-contain" />
                          </a>
                        )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <button disabled={busy} onClick={() => decide("approve")} className="rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Approve changes</button>
                <button disabled={busy} onClick={() => decide("reject")} className={btn}>Reject changes</button>
              </div>
            </div>
          );
        })()}

        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium">Note (shown to the registrant on the status page)</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={input} />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={emailIt} onChange={(e) => setEmailIt(e.target.checked)} disabled={!registrantEmail(config, reg.answers)} className="h-4 w-4 accent-blue-600" />
          {registrantEmail(config, reg.answers) ? `Email the registrant (${registrantEmail(config, reg.answers)}) when I confirm or reject` : "No email address on this registration"}
        </label>
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {/* The current status's button is greyed out so it can't be sent (or emailed) twice. */}
          <button disabled={busy || reg.status === "confirmed"} onClick={() => save({ status: "confirmed", admin_note: note || null })} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{reg.status === "confirmed" ? "✓ Confirmed" : "Confirm"}</button>
          <button disabled={busy || reg.status === "rejected"} onClick={() => save({ status: "rejected", admin_note: note || null })} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{reg.status === "rejected" ? "✓ Rejected" : "Reject"}</button>
          <button disabled={busy || reg.status === "pending"} onClick={() => save({ status: "pending", admin_note: note || null })} className={`${btn} disabled:cursor-not-allowed disabled:opacity-40`}>{reg.status === "pending" ? "✓ Pending" : "Mark pending"}</button>
          <button disabled={busy} onClick={() => save({ admin_note: note || null })} className={btn}>Save note</button>
          {isAdmin && <div className="ml-auto"><ConfirmButton label="Delete" question={`Permanently delete ${reg.ref_code} and its receipt? This cannot be undone.`} onConfirm={remove} /></div>}
        </div>
        </>)}
        <button type="button" onClick={() => ref.current?.close()} className={`${btn} mt-4 w-full`}>Close</button>
      </div>
    </dialog>
  );
}

// Admin-only: change a registration's answers, delegates, quantities and amount. The server re-validates everything.
function AdminEdit({ reg, config, onSaved, onCancel }: { reg: Registration; config: EventConfig; onSaved: (r: Registration) => void; onCancel: () => void }) {
  const cur = config.fees.currency;
  const [answers, setAnswers] = useState<Answers>(reg.answers);
  const [qty, setQty] = useState<Record<string, number>>(reg.fees ?? {});
  // Delegate details keyed "itemId:n" like the registration form, so changing one quantity keeps everyone else's details.
  const [att, setAtt] = useState<Record<string, Answers>>(() => {
    const seen: Record<string, number> = {};
    return Object.fromEntries((reg.attendees ?? []).map((a) => [`${a.item}:${(seen[a.item] = (seen[a.item] ?? 0) + 1)}`, a.answers]));
  });
  // null = follow the prices; a string = an amount the admin typed (discount, partial payment...).
  const [amount, setAmount] = useState<string | null>(() => (validateSubmission(config, reg.answers, reg.fees).total === Number(reg.total) ? null : String(reg.total)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const slots = attendeeSlots(config, qty);
  const attendees = slots.map((s) => att[`${s.item.id}:${s.n}`] ?? {});
  const v = validateSubmission(config, answers, qty, attendees);
  const shown = shownIds(config, answers);
  const vis = visibleAnswers(config, answers);

  async function submit() {
    setErrors(v.errors);
    if (Object.keys(v.errors).length) return setError("Please fix the highlighted fields.");
    if (amount !== null && !(Number(amount) >= 0)) return setError("Amount must be 0 or more.");
    setBusy(true);
    setError("");
    const res = await authFetch("/api/change", { method: "POST", body: JSON.stringify({ registrationId: reg.id, action: "set", answers, fees: qty, attendees, total: amount === null ? null : Number(amount) }) }).catch(() => null);
    const out = res ? await res.json() : { error: "Network error" };
    setBusy(false);
    if (!res?.ok) { setErrors(out.errors ?? {}); return setError(out.error); }
    onSaved(out.registration as Registration);
  }

  const heading = "text-xs font-bold uppercase tracking-wide text-slate-500";
  return (
    <div className="mt-4 space-y-5">
      {config.sections.map((s) => (
        <fieldset key={s.id}>
          <legend className={`${heading} mb-2`}>{s.title}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.fields.filter((f) => shown.has(f.id)).map((f) => (
              <FieldInput key={f.id} field={f} name={`admin-${f.id}`} value={answers[f.id]} error={errors[f.id]} onChange={(val) => setAnswers((a) => ({ ...a, [f.id]: val }))} />
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset>
        <legend className={`${heading} mb-2`}>Items</legend>
        <div className="space-y-2">
          {config.fees.items.map((i) => (
            <label key={i.id} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1">{i.label}</span>
              <span className="w-20 shrink-0">
                <input type="number" min={0} inputMode="numeric" value={qty[i.id] ?? 0} aria-label={`${i.label} quantity`}
                  onChange={(e) => setQty((q) => ({ ...q, [i.id]: Math.max(0, Math.floor(Number(e.target.value)) || 0) }))} className={`${input} text-center`} />
              </span>
            </label>
          ))}
          {errors.fees && <p className="text-xs text-red-600">{errors.fees}</p>}
        </div>
        <label className="mt-3 block w-40 text-sm">
          <span className="mb-1 block font-medium">Amount ({cur})</span>
          <input type="number" min={0} step="0.01" inputMode="decimal" value={amount ?? v.total} onChange={(e) => setAmount(e.target.value)} className={`${input} w-40`} />
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Prices add up to {money(cur, v.total)}.{" "}
          {amount === null ? "The amount follows the prices." : <button type="button" onClick={() => setAmount(null)} className="font-semibold text-blue-600 underline">Use {money(cur, v.total)}</button>}
        </p>
      </fieldset>

      {slots.length > 0 && (
        <fieldset>
          <legend className={`${heading} mb-2`}>{config.attendees.title}</legend>
          <div className="space-y-3">
            {slots.map(({ item, n }, i) => {
              const key = `${item.id}:${n}`;
              return (
                <div key={key} className="rounded-lg border border-slate-200 p-3">
                  <p className="mb-2 text-sm font-bold">{item.label} #{n}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {config.attendees.fields.filter((f) => isShown(config, f, vis)).map((f) => (
                      <FieldInput key={f.id} field={f} name={`admin-att-${i}-${f.id}`} value={att[key]?.[f.id]} error={errors[`att:${i}:${f.id}`]}
                        onChange={(val) => setAtt((a) => ({ ...a, [key]: { ...a[key], [f.id]: val } }))} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={submit} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
        <button type="button" disabled={busy} onClick={onCancel} className={btn}>Cancel</button>
      </div>
    </div>
  );
}
