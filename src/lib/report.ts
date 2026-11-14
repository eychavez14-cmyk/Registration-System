import type { Answers, EventConfig, Field, Registration, Status } from "./types";

// One "line" per person (or per category when there are no delegate details): the unit the dashboard
// statistics, filters and the report all count, so they always agree.
export type Line = {
  reg: Registration;
  categoryId: string;
  category: string;
  qty: number;
  amount: number; // share of what this registration paid
  person: string;
  personAnswers: Answers; // delegate answers ({} when the line is the registrant)
  key: string; // delegate index, or "main"
};

export const registrantName = (config: EventConfig, a: Answers) =>
  [a.first_name, a.last_name].filter((x) => typeof x === "string" && x).join(" ") ||
  String(config.sections.flatMap((s) => s.fields).map((f) => a[f.id]).find((v) => typeof v === "string" && v) ?? "—");

export function buildLines(config: EventConfig, regs: Registration[]): Line[] {
  const items = new Map(config.fees.items.map((i) => [i.id, i]));
  return regs.flatMap((reg) => {
    const fees = Object.entries(reg.fees ?? {}).filter(([, q]) => q > 0);
    const name = registrantName(config, reg.answers);
    let lines: Omit<Line, "amount">[];
    if (reg.attendees?.length) {
      lines = reg.attendees.map((a, i) => ({
        reg, categoryId: a.item, category: items.get(a.item)?.label ?? "Removed category", qty: 1,
        person: config.attendees.fields.filter((f) => f.type === "text").map((f) => a.answers[f.id]).filter((v) => typeof v === "string" && v).join(" ") || name,
        personAnswers: a.answers, key: String(i),
      }));
    } else if (fees.length) {
      lines = fees.map(([id, q]) => ({ reg, categoryId: id, category: items.get(id)?.label ?? "Removed category", qty: q, person: name, personAnswers: {}, key: "main" }));
    } else {
      lines = [{ reg, categoryId: "", category: "—", qty: 1, person: name, personAnswers: {}, key: "main" }];
    }
    // Split the real amount paid by current prices, so the lines always add up to reg.total even if prices changed later.
    const weights = lines.map((l) => (items.get(l.categoryId)?.price ?? 0) * l.qty);
    const sum = weights.reduce((s, w) => s + w, 0);
    const total = Number(reg.total) || 0;
    return lines.map((l, i) => ({ ...l, amount: Math.round((sum ? (total * weights[i]) / sum : total / lines.length) * 100) / 100 }));
  });
}

// Dropdown / multiple-choice questions you can filter and group by.
export type ChoiceField = { scope: "reg" | "att"; field: Field };
export const choiceFields = (config: EventConfig): ChoiceField[] => [
  ...config.sections.flatMap((s) => s.fields).filter((f) => f.type === "select" || f.type === "radio").map((field) => ({ scope: "reg" as const, field })),
  ...(config.attendees.enabled ? config.attendees.fields : []).filter((f) => f.type === "select" || f.type === "radio").map((field) => ({ scope: "att" as const, field })),
];
export const choiceKey = (c: ChoiceField) => `${c.scope}:${c.field.id}`;
export const lineValue = (line: Line, c: ChoiceField) => String((c.scope === "reg" ? line.reg.answers : line.personAnswers)[c.field.id] ?? "") || "(no answer)";

// filters: { "reg:fieldId": "Option" } — empty value means "any".
export function filterLines(lines: Line[], config: EventConfig, filters: Record<string, string>) {
  const active = choiceFields(config).filter((c) => filters[choiceKey(c)]);
  return lines.filter((l) => active.every((c) => lineValue(l, c) === filters[choiceKey(c)]));
}

export type Group = { name: string; people: number; registrations: number; amount: number; lines: Line[] };

// groupBy: "category" or a choiceKey. Groups follow the event's own order (fee items / dropdown options).
export function groupLines(lines: Line[], config: EventConfig, groupBy: string): Group[] {
  const choice = choiceFields(config).find((c) => choiceKey(c) === groupBy);
  const nameOf = (l: Line) => (choice ? lineValue(l, choice) : l.category);
  const order = choice ? [...(choice.field.options ?? []), "(no answer)"] : config.fees.items.map((i) => i.label);
  const map = new Map<string, Line[]>();
  for (const l of lines) map.set(nameOf(l), [...(map.get(nameOf(l)) ?? []), l]);
  const rank = (n: string) => (order.indexOf(n) === -1 ? order.length : order.indexOf(n));
  return [...map.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, ls]) => ({
      name, lines: ls,
      people: ls.reduce((s, l) => s + l.qty, 0),
      registrations: new Set(ls.map((l) => l.reg.id)).size,
      amount: Math.round(ls.reduce((s, l) => s + l.amount, 0) * 100) / 100,
    }));
}

export const sumAmount = (lines: Line[], status?: Status) =>
  Math.round(lines.filter((l) => !status || l.reg.status === status).reduce((s, l) => s + l.amount, 0) * 100) / 100;
