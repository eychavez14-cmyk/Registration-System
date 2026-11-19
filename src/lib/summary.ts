import type { Answers, Attendee, EventConfig } from "./types";
import { money } from "./validate.ts";
import { priceOf } from "./rules.ts";

export type SummaryGroup = { title: string; rows: [label: string, value: string][] };
type Submitted = { answers: Answers; fees: Record<string, number>; attendees: Attendee[]; total: number };

const show = (v: string | boolean | undefined) => (typeof v === "boolean" ? (v ? "Yes" : "No") : v ?? "");

// What the registrant sees on the success screen, prints, and saves as an image (one source for all three).
export function registrationSummary(config: EventConfig, r: Submitted): SummaryGroup[] {
  const groups: SummaryGroup[] = config.sections
    .map((s) => ({ title: s.title, rows: s.fields.map((f): [string, string] => [f.label, show(r.answers[f.id])]).filter(([, v]) => v) }))
    .filter((g) => g.rows.length);

  if (r.attendees.length) {
    const seen: Record<string, number> = {};
    groups.push({
      title: config.attendees.title,
      rows: r.attendees.map((a) => {
        const item = config.fees.items.find((i) => i.id === a.item);
        seen[a.item] = (seen[a.item] ?? 0) + 1;
        const details = config.attendees.fields.map((f) => show(a.answers[f.id])).filter(Boolean).join(" · ");
        return [`${item?.label ?? "Delegate"} #${seen[a.item]}`, details || "—"];
      }),
    });
  }

  if (config.fees.enabled) {
    const cur = config.fees.currency;
    groups.push({
      title: "Payment",
      rows: [
        ...config.fees.items.filter((i) => r.fees[i.id]).map((i): [string, string] => [`${i.label} × ${r.fees[i.id]}`, money(cur, r.fees[i.id] * priceOf(config, i, r.answers))]),
        ["Total", money(cur, r.total)],
      ],
    });
  }
  return groups;
}
