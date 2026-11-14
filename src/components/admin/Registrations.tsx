"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EventRow, Registration, Status } from "@/lib/types";
import { authFetch, browserDb } from "@/lib/supabase/browser";
import { diffChange } from "@/lib/edit";
import { money } from "@/lib/validate";
import { STATUS_STYLE } from "@/components/StatusLookup";
import { registrantEmail } from "@/lib/email";
import { useRole } from "./AdminGate";
import Link from "next/link";
import { buildLines, choiceFields, choiceKey, filterLines, groupLines, registrantName, sumAmount } from "@/lib/report";
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
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {stats.groups.map((g) => <span key={g.name} className="rounded-full border border-slate-200 bg-white px-3 py-1">{g.name}: <b>{g.people}</b> · {money(cur, g.amount)}</span>)}
        {stats.edits > 0 && <button type="button" onClick={() => setStatus("edit")} className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 font-semibold text-purple-800">✏️ {stats.edits} edit request{stats.edits > 1 ? "s" : ""} waiting</button>}
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, church, code…" aria-label="Search registrations" className={`${input} max-w-xs`} />
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

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
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
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-xl font-bold">{reg.ref_code}</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${STATUS_STYLE[reg.status]}`}>{reg.status}</span>
            <button onClick={() => ref.current?.close()} aria-label="Close" className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900">×</button>
          </div>
          <p className="text-xs text-slate-500">{new Date(reg.created_at).toLocaleString()}</p>
        </div>

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
        {info && <p role="status" className="mt-2 text-sm text-green-700">{info}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => save({ status: "confirmed", admin_note: note || null })} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">Confirm</button>
          <button disabled={busy} onClick={() => save({ status: "rejected", admin_note: note || null })} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">Reject</button>
          <button disabled={busy} onClick={() => save({ status: "pending", admin_note: note || null })} className={btn}>Mark pending</button>
          <button disabled={busy} onClick={() => save({ admin_note: note || null })} className={btn}>Save note</button>
          {isAdmin && <div className="ml-auto"><ConfirmButton label="Delete" question={`Permanently delete ${reg.ref_code} and its receipt? This cannot be undone.`} onConfirm={remove} /></div>}
        </div>
        <button type="button" onClick={() => ref.current?.close()} className={`${btn} mt-4 w-full`}>Close</button>
      </div>
    </dialog>
  );
}
