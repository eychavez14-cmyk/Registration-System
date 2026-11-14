import type { Answers, Attendee, EventConfig } from "./types";

const digits = (s: string) => s.replace(/\D/g, "").slice(-10); // last 10 digits: 0917…, +63917…, 917… all match

// Second check before someone can see/edit a registration: the email or mobile number they registered with.
export function contactMatches(config: EventConfig, answers: Answers, typed: string) {
  const t = typed.trim().toLowerCase();
  if (!t) return false;
  return config.sections.flatMap((s) => s.fields).some((f) => {
    const v = answers[f.id];
    if (typeof v !== "string" || !v) return false;
    if (f.type === "email") return v.trim().toLowerCase() === t;
    if (f.type === "tel") return digits(v).length >= 7 && digits(v) === digits(t);
    return false;
  });
}

export type Change = { label: string; from: string; to: string };
const show = (v: unknown) => (typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? "")) || "—";

// What a pending edit would change, in plain words for the approver.
export function diffChange(config: EventConfig, old: { answers: Answers; attendees: Attendee[] }, next: { answers: Answers; attendees: Attendee[] }): Change[] {
  const out: Change[] = [];
  for (const f of config.sections.flatMap((s) => s.fields))
    if (show(old.answers[f.id]) !== show(next.answers[f.id])) out.push({ label: f.label, from: show(old.answers[f.id]), to: show(next.answers[f.id]) });
  const seen: Record<string, number> = {};
  old.attendees.forEach((a, i) => {
    seen[a.item] = (seen[a.item] ?? 0) + 1;
    const who = `${config.fees.items.find((x) => x.id === a.item)?.label ?? "Delegate"} #${seen[a.item]}`;
    for (const f of config.attendees.fields) {
      const from = show(a.answers[f.id]), to = show(next.attendees[i]?.answers[f.id]);
      if (from !== to) out.push({ label: `${who} – ${f.label}`, from, to });
    }
  });
  return out;
}
