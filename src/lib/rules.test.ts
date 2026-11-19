import { test } from "node:test";
import assert from "node:assert/strict";
import { priceOf, visibleAnswers } from "./rules.ts";
import { validateSubmission } from "./validate.ts";
import { defaultConfig } from "./defaults.ts";
import { buildLines } from "./report.ts";
import type { EventConfig, Registration } from "./types.ts";

// Section 1 ministers are free; Section 3 ministers get a discount; non-ministers always pay.
// "Bus" is only asked of Section 2, and "seat" only of those who ride the bus.
function cfg(): EventConfig {
  const c = defaultConfig();
  c.sections[0].fields.push(
    { id: "section", label: "Section", type: "select", required: true, options: ["Section 1", "Section 2", "Section 3"] },
    { id: "bus", label: "Riding the bus?", type: "radio", required: true, options: ["Yes", "No"], showIf: { fieldId: "section", values: ["Section 2"] } },
    { id: "seat", label: "Seat preference", type: "text", required: true, showIf: { fieldId: "bus", values: ["Yes"] } },
  );
  c.fees.items = [
    { id: "min", label: "Minister", price: 2000, priceRules: [{ when: { fieldId: "section", values: ["Section 1"] }, price: 0 }, { when: { fieldId: "section", values: ["Section 3"] }, price: 1500 }] },
    { id: "non", label: "Non-Minister", price: 4000 },
  ];
  return c;
}
const base = { church: "UPC", pastor: "Rev", first_name: "Juan", last_name: "Cruz", mobile: "09171234567" };
const people = [{ full_name: "A" }, { full_name: "B" }];

test("special price applies only to the category it is set on", () => {
  const c = cfg();
  const [min, non] = c.fees.items;
  assert.equal(priceOf(c, min, { section: "Section 1" }), 0);
  assert.equal(priceOf(c, min, { section: "Section 3" }), 1500);
  assert.equal(priceOf(c, min, { section: "Section 2" }), 2000);
  assert.equal(priceOf(c, non, { section: "Section 1" }), 4000);
});

test("server total uses the rules; a free registration totals 0", () => {
  const c = cfg();
  const free = validateSubmission(c, { ...base, section: "Section 1" }, { min: 2 }, people);
  assert.deepEqual(free.errors, {});
  assert.equal(free.total, 0);
  const mixed = validateSubmission(c, { ...base, section: "Section 1" }, { min: 1, non: 1 }, people);
  assert.equal(mixed.total, 4000);
});

test("report gives a free delegate ₱0 and the paying one the whole amount", () => {
  const c = cfg();
  const v = validateSubmission(c, { ...base, section: "Section 1" }, { min: 1, non: 1 }, people);
  const reg = { id: "R", ref_code: "REG-X", status: "pending", answers: v.answers, fees: v.fees, attendees: v.attendees, total: v.total } as unknown as Registration;
  assert.deepEqual(buildLines(c, [reg]).map((l) => [l.category, l.amount]), [["Minister", 0], ["Non-Minister", 4000]]);
});

test("hidden questions are not required and their answers are dropped, including chained ones", () => {
  const c = cfg();
  const s1 = validateSubmission(c, { ...base, section: "Section 1", bus: "Yes", seat: "front" }, { min: 1 }, people);
  assert.deepEqual(s1.errors, {});
  assert.equal(s1.answers.bus, undefined);
  assert.equal(s1.answers.seat, undefined); // seat depends on bus, which is hidden
  const s2 = validateSubmission(c, { ...base, section: "Section 2" }, { min: 1 }, people);
  assert.equal(s2.errors.bus, "Required");
  const s2bus = validateSubmission(c, { ...base, section: "Section 2", bus: "Yes" }, { min: 1 }, people);
  assert.equal(s2bus.errors.seat, "Required");
  assert.deepEqual(visibleAnswers(c, { section: "Section 1", bus: "Yes", seat: "x" }), { section: "Section 1" });
});

test("rules pointing at a deleted question are ignored", () => {
  const c = cfg();
  c.sections[0].fields = c.sections[0].fields.filter((f) => f.id !== "section");
  assert.equal(priceOf(c, c.fees.items[0], { section: "Section 1" }), 2000);
  const v = validateSubmission(c, { ...base }, { min: 1 }, people);
  assert.equal(v.errors.bus, "Required"); // condition source gone, so the question shows
});

test("delegate questions can depend on a main-form answer", () => {
  const c = cfg();
  c.attendees.fields.push({ id: "shirt", label: "Shirt size", type: "text", required: true, showIf: { fieldId: "section", values: ["Section 1"] } });
  assert.equal(validateSubmission(c, { ...base, section: "Section 3" }, { min: 1 }, people).errors["att:0:shirt"], undefined);
  assert.equal(validateSubmission(c, { ...base, section: "Section 1" }, { min: 1 }, people).errors["att:0:shirt"], "Required");
});
