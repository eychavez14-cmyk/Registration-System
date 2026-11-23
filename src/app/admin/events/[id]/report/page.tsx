"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { browserDb } from "@/lib/supabase/browser";
import { withDefaults } from "@/lib/defaults";
import { money } from "@/lib/validate";
import { downloadCsv } from "@/lib/csv";
import { buildLines, choiceFields, choiceKey, filterLines, groupLines, sumAmount, type Line } from "@/lib/report";
import type { EventRow, Registration, Status } from "@/lib/types";
import { loadAll } from "@/components/admin/Registrations";
import { btn, input, Panel, Text, Toggle } from "@/components/admin/ui";

type Settings = {
  title: string;
  notes: string;
  statuses: Status[];
  groupBy: string; // "category" or a dropdown question key
  filters: Record<string, string>;
  columns: string[];
  showPeople: boolean;
};

type Col = { key: string; label: string; get: (l: Line) => string; num?: boolean };

// Saved per event on this device, so each admin/moderator keeps their own preferred layout.
const storageKey = (id: string) => `report-settings:${id}`;

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [rows, setRows] = useState<Registration[] | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    browserDb().from("events").select("*").eq("id", id).maybeSingle<EventRow>().then(({ data }) => {
      if (!data) return setError("Event not found");
      const ev = { ...data, config: withDefaults(data.config) };
      setEvent(ev);
      const defaults: Settings = {
        title: `${ev.title} — Registration Report`, notes: "", statuses: ["confirmed"], groupBy: "category", filters: {},
        columns: ["ref", "person", ...ev.config.sections.flatMap((x) => x.fields).filter((f) => /church/i.test(f.label)).map((f) => `reg:${f.id}`), "amount", "status"],
        showPeople: true,
      };
      let saved: Partial<Settings> = {};
      try { saved = JSON.parse(localStorage.getItem(storageKey(id)) ?? "{}"); } catch { /* storage blocked: use defaults */ }
      setS({ ...defaults, ...saved });
    });
    loadAll(id).then(setRows, (e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (s) try { localStorage.setItem(storageKey(id), JSON.stringify(s)); } catch { /* fine */ }
  }, [s, id]);

  const config = event?.config;
  const cols = useMemo<Col[]>(() => {
    if (!config) return [];
    const display = (v: unknown) => (typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? ""));
    return [
      { key: "ref", label: "Registration #", get: (l) => l.reg.ref_code },
      { key: "person", label: "Name", get: (l) => l.person },
      { key: "category", label: "Category", get: (l) => l.category },
      { key: "qty", label: "Qty", get: (l) => String(l.qty), num: true },
      { key: "amount", label: "Amount paid", get: (l) => money(config.fees.currency, l.amount), num: true },
      { key: "status", label: "Status", get: (l) => l.reg.status },
      { key: "checkin", label: "Checked in", get: (l) => (l.reg.checkin?.[l.key] ? new Date(l.reg.checkin[l.key]).toLocaleString() : "") },
      { key: "submitted", label: "Submitted", get: (l) => new Date(l.reg.created_at).toLocaleDateString() },
      ...config.attendees.fields.filter((f) => f.type !== "text").map((f) => ({ key: `att:${f.id}`, label: `${f.label} (delegate)`, get: (l: Line) => display(l.personAnswers[f.id]) })),
      ...config.sections.flatMap((x) => x.fields).map((f) => ({ key: `reg:${f.id}`, label: f.label, get: (l: Line) => display(l.reg.answers[f.id]) })),
    ];
  }, [config]);

  if (error) return <p className="p-10 text-center text-sm text-red-600">{error}</p>;
  if (!event || !config || !rows || !s) return <p className="p-10 text-center text-sm text-slate-500">Loading report…</p>;

  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });
  const lines = filterLines(buildLines(config, rows), config, s.filters).filter((l) => s.statuses.includes(l.reg.status));
  const groups = groupLines(lines, config, s.groupBy);
  const shown = cols.filter((c) => s.columns.includes(c.key)).sort((a, b) => s.columns.indexOf(a.key) - s.columns.indexOf(b.key));
  const choices = choiceFields(config);
  const groupLabel = s.groupBy === "category" ? "Category" : choices.find((c) => choiceKey(c) === s.groupBy)?.field.label ?? "Group";
  const cur = config.fees.currency;
  const activeFilters = choices.filter((c) => s.filters[choiceKey(c)]).map((c) => `${c.field.label}: ${s.filters[choiceKey(c)]}`);

  const csv = () => downloadCsv(
    [[groupLabel, ...shown.map((c) => c.label)], ...groups.flatMap((g) => g.lines.map((l) => [g.name, ...shown.map((c) => (c.key === "amount" ? l.amount : c.get(l)))]))],
    `${event.slug}-report.csv`,
  );

  return (
    <main className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] print:block print:p-0">
      {/* Settings: never printed */}
      <aside className="space-y-4 print:hidden">
        <Link href={`/admin/events/${id}`} className="text-xs text-slate-500 hover:underline">← Back to dashboard</Link>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700">🖨 Print / Save PDF</button>
          <button onClick={csv} className={`${btn} flex-1`}>⬇ Download CSV</button>
        </div>
        <Panel title="Report">
          <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
          <Text label="Notes (printed under the title)" textarea value={s.notes} onChange={(notes) => set({ notes })} />
        </Panel>
        <Panel title="Include">
          {(["confirmed", "pending", "rejected"] as Status[]).map((st) => (
            <Toggle key={st} label={st === "confirmed" ? "Confirmed (paid)" : st === "pending" ? "Pending (not yet verified)" : "Rejected"} checked={s.statuses.includes(st)}
              onChange={(on) => set({ statuses: on ? [...s.statuses, st] : s.statuses.filter((x) => x !== st) })} />
          ))}
          {choices.map((c) => (
            <label key={choiceKey(c)} className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">{c.field.label}{c.scope === "att" && " (delegate)"}</span>
              <select value={s.filters[choiceKey(c)] ?? ""} onChange={(e) => set({ filters: { ...s.filters, [choiceKey(c)]: e.target.value } })} className={input}>
                <option value="">All</option>
                {(c.field.options ?? []).map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          ))}
        </Panel>
        <Panel title="Layout">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Group by</span>
            <select value={s.groupBy} onChange={(e) => set({ groupBy: e.target.value })} className={input}>
              <option value="category">Registration category</option>
              {choices.map((c) => <option key={choiceKey(c)} value={choiceKey(c)}>{c.field.label}{c.scope === "att" && " (delegate)"}</option>)}
            </select>
          </label>
          <Toggle label="List the people in each group" checked={s.showPeople} onChange={(showPeople) => set({ showPeople })} />
          {s.showPeople && (
            <div className="text-sm">
              <p className="mb-1 font-medium text-slate-700">Columns</p>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {cols.map((c) => (
                  <label key={c.key} className="flex items-center gap-2">
                    <input type="checkbox" checked={s.columns.includes(c.key)} className="h-4 w-4 accent-blue-600"
                      onChange={(e) => set({ columns: e.target.checked ? [...s.columns, c.key] : s.columns.filter((k) => k !== c.key) })} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </Panel>
        <p className="text-xs text-slate-500">These settings are remembered on this device.</p>
      </aside>

      {/* The report itself */}
      <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-800 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-extrabold">{s.title}</h1>
          <p className="text-slate-600">{event.title}{config.header.subtitle && ` · ${config.header.subtitle}`}{config.header.venue && ` · ${config.header.venue}`}</p>
          <p className="mt-1 text-xs text-slate-500">
            Generated {new Date().toLocaleString()} · Including: {s.statuses.length ? s.statuses.join(", ") : "nothing (tick a status)"}
            {activeFilters.length > 0 && ` · Filtered by ${activeFilters.join(", ")}`}
          </p>
          {s.notes.trim() && <p className="mt-3 whitespace-pre-line">{s.notes}</p>}
        </header>

        <section className="mt-5 break-inside-avoid">
          <h2 className="mb-2 text-base font-bold">Summary by {groupLabel.toLowerCase()}</h2>
          <div className="overflow-x-auto print:overflow-visible"><table className="w-full border-collapse">
            <thead><tr className="border-b-2 border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-2">{groupLabel}</th><th className="px-2 py-2 text-right">People</th><th className="px-2 py-2 text-right">Registrations</th><th className="py-2 pl-2 text-right">Amount</th>
            </tr></thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.name} className="border-b border-slate-100">
                  <td className="py-2 pr-2 font-medium">{g.name}</td><td className="px-2 py-2 text-right">{g.people}</td><td className="px-2 py-2 text-right">{g.registrations}</td><td className="py-2 pl-2 text-right">{money(cur, g.amount)}</td>
                </tr>
              ))}
              {!groups.length && <tr><td colSpan={4} className="py-4 text-center text-slate-500">No registrations match these settings.</td></tr>}
            </tbody>
            <tfoot><tr className="border-t-2 border-slate-300 font-extrabold">
              <td className="py-2 pr-2">Total</td>
              <td className="px-2 py-2 text-right">{groups.reduce((t, g) => t + g.people, 0)}</td>
              <td className="px-2 py-2 text-right">{new Set(lines.map((l) => l.reg.id)).size}</td>
              <td className="py-2 pl-2 text-right">{money(cur, sumAmount(lines))}</td>
            </tr></tfoot>
          </table></div>
        </section>

        {s.showPeople && groups.map((g) => (
          <section key={g.name} className="mt-7">
            <h2 className="mb-2 flex flex-wrap items-baseline gap-x-3 border-b border-slate-200 pb-1 text-base font-bold">
              {g.name}<span className="text-xs font-semibold text-slate-500">{g.people} {g.people === 1 ? "person" : "people"} · {money(cur, g.amount)}</span>
            </h2>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse text-xs sm:text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-8 py-1.5 pr-2">#</th>
                  {shown.map((c) => <th key={c.key} className={`px-2 py-1.5 ${c.num ? "text-right" : ""}`}>{c.label}</th>)}
                </tr></thead>
                <tbody>
                  {g.lines.map((l, i) => (
                    <tr key={`${l.reg.id}:${l.key}:${l.categoryId}`} className="break-inside-avoid border-t border-slate-100 align-top">
                      <td className="py-1.5 pr-2 text-slate-400">{i + 1}</td>
                      {shown.map((c) => <td key={c.key} className={`px-2 py-1.5 ${c.num ? "text-right whitespace-nowrap" : ""} ${c.key === "ref" ? "font-mono" : ""}`}>{c.get(l)}</td>)}
                    </tr>
                  ))}
                </tbody>
                {shown.some((c) => c.key === "amount") && (
                  <tfoot><tr className="border-t border-slate-300 font-bold">
                    <td colSpan={shown.findIndex((c) => c.key === "amount") + 1} className="py-1.5 pr-2 text-right">Subtotal</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{money(cur, g.amount)}</td>
                    {shown.slice(shown.findIndex((c) => c.key === "amount") + 1).map((c) => <td key={c.key} />)}
                  </tr></tfoot>
                )}
              </table>
            </div>
          </section>
        ))}
      </article>
    </main>
  );
}
