import type { Answers, Attendee, EventConfig, Field } from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_QTY = 500;

export type Validated = {
  errors: Record<string, string>;
  answers: Answers;
  fees: Record<string, number>;
  attendees: Attendee[];
  total: number;
};

const asObject = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;

// Checks one set of answers; errors are stored under prefix + field id.
function checkFields(fields: Field[], raw: unknown, errors: Record<string, string>, prefix = ""): Answers {
  const inA = asObject(raw);
  const answers: Answers = {};
  for (const field of fields) {
    const key = prefix + field.id;
    const v = inA[field.id];
    if (field.type === "checkbox") {
      const checked = v === true;
      if (field.required && !checked) errors[key] = "Required";
      answers[field.id] = checked;
      continue;
    }
    const s = typeof v === "string" ? v.trim().slice(0, 2000) : "";
    if (!s) {
      if (field.required) errors[key] = "Required";
      continue;
    }
    if (field.type === "email" && !EMAIL.test(s)) errors[key] = "Enter a valid email";
    else if (field.type === "number" && !Number.isFinite(Number(s))) errors[key] = "Enter a number";
    else if (field.type === "tel" && !/^[+\d][\d\s-]{6,19}$/.test(s)) errors[key] = "Enter a valid phone number";
    else if ((field.type === "select" || field.type === "radio") && !(field.options ?? []).includes(s)) errors[key] = "Choose an option";
    answers[field.id] = s;
  }
  return answers;
}

// One slot per ticket, in fee-table order: [{item, n}] where n is 1-based within its category.
export const attendeeSlots = (config: EventConfig, fees: Record<string, number>) =>
  config.fees.enabled && config.attendees?.enabled && config.attendees.fields.length
    ? config.fees.items.flatMap((item) => Array.from({ length: fees[item.id] ?? 0 }, (_, i) => ({ item, n: i + 1 })))
    : [];

// Shared by the form (instant feedback) and the API (source of truth: totals are always recomputed here).
export function validateSubmission(config: EventConfig, rawAnswers: unknown, rawFees: unknown, rawAttendees?: unknown): Validated {
  const inF = asObject(rawFees);
  const errors: Record<string, string> = {};
  const answers = checkFields(config.sections.flatMap((s) => s.fields), rawAnswers, errors);

  const fees: Record<string, number> = {};
  let total = 0;
  if (config.fees.enabled) {
    for (const item of config.fees.items) {
      const q = Number(inF[item.id] ?? 0);
      if (!Number.isInteger(q) || q < 0 || q > MAX_QTY) {
        errors[`fee:${item.id}`] = `Quantity must be 0-${MAX_QTY}`;
        continue;
      }
      if (q > 0) fees[item.id] = q;
      total += q * item.price;
    }
    if (Object.keys(fees).length === 0) errors.fees = "Add at least one item";
  }
  // Attendee i answers slot i; the browser sends them in the same order. Extra entries are ignored.
  const inAtt = Array.isArray(rawAttendees) ? rawAttendees : [];
  const attendees = attendeeSlots(config, fees).map(({ item }, i) => ({
    item: item.id,
    answers: checkFields(config.attendees.fields, inAtt[i], errors, `att:${i}:`),
  }));
  return { errors, answers, fees, attendees, total: Math.round(total * 100) / 100 };
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
export function makeRefCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "REG-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const money = (currency: string, n: number) =>
  currency + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
