import type { Answers, Condition, EventConfig, FeeItem, Field } from "./types";

// Conditional logic shared by the form, the API (source of truth) and the summaries.
// A condition whose question was deleted is ignored: the question shows and the special price doesn't apply,
// so a stale rule can never hide a required question for good.

const mainFields = (config: EventConfig) => config.sections.flatMap((s) => s.fields);
const exists = (config: EventConfig, id: string) => mainFields(config).some((f) => f.id === id);

const matches = (c: Condition, answers: Answers) => {
  const v = answers[c.fieldId];
  return typeof v === "string" && c.values.includes(v);
};

export const isShown = (config: EventConfig, f: Field, answers: Answers) =>
  !f.showIf || !exists(config, f.showIf.fieldId) || matches(f.showIf, answers);

// Main-form answers to questions that are actually shown. Walked in order, so a question only reacts to
// shown questions above it (if B is hidden, A that depends on B is hidden too).
export function shownIds(config: EventConfig, raw: Answers): Set<string> {
  const seen: Answers = {};
  const ids = new Set<string>();
  for (const f of mainFields(config)) {
    if (!isShown(config, f, seen)) continue;
    ids.add(f.id);
    if (raw[f.id] !== undefined) seen[f.id] = raw[f.id];
  }
  return ids;
}

export function visibleAnswers(config: EventConfig, raw: Answers): Answers {
  const ids = shownIds(config, raw);
  return Object.fromEntries(Object.entries(raw).filter(([k]) => ids.has(k)));
}

export const priceOf = (config: EventConfig, item: FeeItem, answers: Answers) =>
  item.priceRules?.find((r) => exists(config, r.when.fieldId) && matches(r.when, answers))?.price ?? item.price;

// Questions a rule can point at: dropdown / multiple choice on the main form.
export const ruleSources = (fields: Field[]) => fields.filter((f) => (f.type === "select" || f.type === "radio") && f.options?.length);
