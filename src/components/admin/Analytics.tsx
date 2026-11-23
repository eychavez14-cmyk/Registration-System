"use client";

import { useMemo, useState } from "react";
import type { EventConfig } from "@/lib/types";
import { money } from "@/lib/validate";
import { choiceFields, choiceKey, groupLines, isCheckedIn, overTime, payBreakdown, statusTotals, type Line } from "@/lib/report";
import { input } from "./ui";

// Dashboard analytics. Everything is computed from the same per-person "lines" as the list and the report,
// after the dashboard's dropdown filters, so the numbers always agree. Rejected registrations never count as
// people or money (they're listed separately).

const card = "min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4";
const label = "text-xs font-semibold uppercase tracking-wide text-slate-500";
const plural = (n: number, one: string, many = one + "s") => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export function Analytics({ config, lines }: { config: EventConfig; lines: Line[] }) {
  const cur = config.fees.currency;
  const active = useMemo(() => lines.filter((l) => l.reg.status !== "rejected"), [lines]);
  const s = useMemo(() => statusTotals(lines), [lines]);
  const pay = useMemo(() => payBreakdown(config, active), [config, active]);
  const confirmedLines = active.filter((l) => l.reg.status === "confirmed");
  const arrived = confirmedLines.filter(isCheckedIn).reduce((n, l) => n + l.qty, 0);
  const people = s.confirmed.people + s.pending.people;
  const regs = s.confirmed.registrations + s.pending.registrations;

  return (
    <div className="space-y-4">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={card}>
          <p className={label}>People registered</p>
          <p className="mt-1 text-2xl font-extrabold">{people.toLocaleString()}</p>
          <p className="text-xs text-slate-500">in {plural(regs, "registration")}</p>
        </div>
        <div className={card}>
          <p className={label}>Collected</p>
          <p className="mt-1 break-words text-xl font-extrabold text-green-700 sm:text-2xl">{money(cur, s.confirmed.amount)}</p>
          <p className="text-xs text-slate-500">confirmed · {plural(s.confirmed.people, "person", "people")}</p>
        </div>
        <div className={card}>
          <p className={label}>Awaiting verification</p>
          <p className="mt-1 break-words text-xl font-extrabold text-amber-700 sm:text-2xl">{money(cur, s.pending.amount)}</p>
          <p className="text-xs text-slate-500">pending · {plural(s.pending.people, "person", "people")}</p>
        </div>
        <div className={card}>
          <p className={label}>Expected total</p>
          <p className="mt-1 break-words text-xl font-extrabold sm:text-2xl">{money(cur, s.confirmed.amount + s.pending.amount)}</p>
          <p className="text-xs text-slate-500">collected + awaiting</p>
        </div>
      </div>

      {/* Registrations by status: one bar, labelled, so colour is never the only cue */}
      <StatusBar s={s} />

      {(pay.free.people > 0 || pay.discounted.people > 0) && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {([
            ["Paid in full", pay.paid, "border-green-200 bg-green-50 text-green-900"],
            ["Discounted", pay.discounted, "border-amber-200 bg-amber-50 text-amber-900"],
            ["Free", pay.free, "border-sky-200 bg-sky-50 text-sky-900"],
          ] as const).filter(([name, k]) => name === "Paid in full" || k.people > 0).map(([name, k, style]) => (
            <div key={name} className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${style}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{name}</p>
              <p className="mt-1 text-lg font-extrabold sm:text-xl">{plural(k.people, "person", "people")}</p>
              {name !== "Free" && <p className="break-words text-sm font-medium opacity-80">{money(cur, k.amount)}</p>}
            </div>
          ))}
        </div>
      )}

      {s.confirmed.people > 0 && (
        <div className={card}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={label}>Check-in</p>
            <p className="text-sm"><b>{arrived.toLocaleString()}</b> of {plural(s.confirmed.people, "confirmed person", "confirmed people")} checked in · <b>{pct(arrived, s.confirmed.people)}%</b></p>
          </div>
          <Meter value={arrived} max={s.confirmed.people} label="Checked in" />
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Breakdown config={config} active={active} />
        <OverTime active={active} />
      </div>
    </div>
  );
}

function Meter({ value, max, label: name }: { value: number; max: number; label: string }) {
  return (
    <div role="meter" aria-label={name} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-green-600" style={{ width: `${pct(value, max)}%` }} />
    </div>
  );
}

function StatusBar({ s }: { s: ReturnType<typeof statusTotals> }) {
  const parts = [
    ["Confirmed", s.confirmed, "bg-green-600"],
    ["Pending", s.pending, "bg-amber-400"],
    ["Rejected", s.rejected, "bg-red-500"],
  ] as const;
  const total = parts.reduce((n, [, t]) => n + t.registrations, 0);
  if (!total) return null;
  return (
    <div className={card}>
      <p className={label}>Registrations by status</p>
      <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {parts.filter(([, t]) => t.registrations).map(([name, t, color]) => (
          <div key={name} className={color} style={{ width: `${(t.registrations / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map(([name, t, color]) => (
          <li key={name} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden />
            {name}: <b>{t.registrations.toLocaleString()}</b>
            <span className="text-slate-500">({plural(t.people, "person", "people")}{name === "Rejected" && t.people ? ", not counted" : ""})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// People, registrations, money and check-in per fee category or per answer to any dropdown question.
function Breakdown({ config, active }: { config: EventConfig; active: Line[] }) {
  const options = useMemo(() => [{ key: "category", name: "Fee category" }, ...choiceFields(config).map((c) => ({ key: choiceKey(c), name: c.field.label + (c.scope === "att" ? " (delegate)" : "") }))], [config]);
  const [by, setBy] = useState(options[1]?.key ?? "category"); // a Section-type question is usually the most useful
  const groups = groupLines(active, config, options.some((o) => o.key === by) ? by : "category");
  const totalPeople = groups.reduce((n, g) => n + g.people, 0);
  const maxPeople = Math.max(1, ...groups.map((g) => g.people));
  if (!active.length) return null;
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={label}>Breakdown</p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">by</span>
          <select value={by} onChange={(e) => setBy(e.target.value)} className={`${input} w-auto py-1`}>
            {options.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
          </select>
        </label>
      </div>
      <ul className="mt-3 space-y-3">
        {groups.map((g) => {
          const confirmed = g.lines.filter((l) => l.reg.status === "confirmed");
          const cPeople = confirmed.reduce((n, l) => n + l.qty, 0);
          const inPeople = confirmed.filter(isCheckedIn).reduce((n, l) => n + l.qty, 0);
          return (
            <li key={g.name} className="text-sm">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="min-w-0 flex-1 break-words font-semibold">{g.name}</span>
                <span><b>{g.people.toLocaleString()}</b> <span className="text-slate-500">({pct(g.people, totalPeople)}%)</span></span>
                <span className="font-medium">{money(config.fees.currency, g.amount)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100" aria-hidden>
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${(g.people / maxPeople) * 100}%` }} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {plural(g.registrations, "registration")}
                {cPeople > 0 && ` · ${inPeople}/${cPeople} confirmed checked in`}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const fmtDay = (day: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, opts);

// People registered per day (per week for long sign-up periods). Tap or hover a bar to read it.
function OverTime({ active }: { active: Line[] }) {
  const { unit, buckets } = useMemo(() => overTime(active), [active]);
  const [hover, setHover] = useState<number | null>(null);
  if (buckets.length < 2) return null; // one day of data is just the totals above
  const max = Math.max(1, ...buckets.map((b) => b.people));
  const busiest = buckets.reduce((a, b) => (b.people > a.people ? b : a));
  const recent = buckets.slice(-(unit === "day" ? 7 : 1)).reduce((n, b) => n + b.people, 0);
  const shown = hover === null ? null : buckets[hover];
  const period = (d: string) => (unit === "day" ? fmtDay(d, { weekday: "short", month: "short", day: "numeric" }) : `Week of ${fmtDay(d)}`);
  return (
    <div className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={label}>People registered per {unit}</p>
        <p className="text-xs text-slate-500">
          Busiest: <b className="text-slate-700">{period(busiest.day)}</b> ({busiest.people}) · {unit === "day" ? "Last 7 days" : "This week"}: <b className="text-slate-700">{recent}</b>
        </p>
      </div>
      <p className="mt-2 h-5 text-sm" aria-live="polite">
        {shown ? <><b>{period(shown.day)}</b>: {plural(shown.people, "person", "people")} in {plural(shown.registrations, "registration")}</> : <span className="text-slate-400">Tap or hover a bar for details</span>}
      </p>
      <div className="relative mt-1">
        <span className="absolute -top-0.5 left-0 text-[10px] text-slate-400">{max}</span>
        <div className="flex h-32 items-end gap-0.5 border-b border-slate-200 pt-3" onMouseLeave={() => setHover(null)}>
          {buckets.map((b, i) => (
            // Hit area is the full column height, not just the bar, so short bars are easy to tap.
            <button key={b.day} type="button" aria-label={`${period(b.day)}: ${b.people} people`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)}
              className="flex h-full min-w-0 flex-1 items-end justify-center">
              <span className={`block w-full max-w-8 rounded-t-[3px] ${hover === i ? "bg-blue-800" : "bg-blue-600"}`} style={{ height: b.people ? `${Math.max(4, (b.people / max) * 100)}%` : 0 }} />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{fmtDay(buckets[0].day)}</span>
        <span>{fmtDay(buckets[buckets.length - 1].day)}</span>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-slate-500">Show as table</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-slate-500"><tr><th className="py-1">{unit === "day" ? "Day" : "Week"}</th><th className="py-1 text-right">People</th><th className="py-1 text-right">Registrations</th></tr></thead>
          <tbody>
            {buckets.filter((b) => b.people).reverse().map((b) => (
              <tr key={b.day} className="border-t border-slate-100"><td className="py-1">{period(b.day)}</td><td className="py-1 text-right">{b.people}</td><td className="py-1 text-right">{b.registrations}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
