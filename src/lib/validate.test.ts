// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSubmission, makeRefCode } from "./validate.ts";
import { defaultConfig } from "./defaults.ts";

const cfg = defaultConfig();
const [senior, regular] = cfg.fees.items;
const good = { church: "UPC", pastor: "Rev. A", first_name: "Juan", last_name: "Cruz", mobile: "09123456789" };

test("valid submission computes total on the server side", () => {
  const r = validateSubmission(cfg, good, { [senior.id]: 2, [regular.id]: 1 }, [{ full_name: "A" }, { full_name: "B" }, { full_name: "C" }]);
  assert.deepEqual(r.errors, {});
  assert.equal(r.total, 2000);
  assert.deepEqual(r.fees, { [senior.id]: 2, [regular.id]: 1 });
});

test("rejects missing required, bad email, bad qty, unknown fields", () => {
  const r = validateSubmission(cfg, { ...good, church: " ", email: "nope", hacker: "x" }, { [senior.id]: -1, total: 1 });
  assert.equal(r.errors.church, "Required");
  assert.equal(r.errors.email, "Enter a valid email");
  assert.ok(r.errors[`fee:${senior.id}`]);
  assert.ok(r.errors.fees);
  assert.equal("hacker" in r.answers, false);
});

test("select must match an option", () => {
  const c = defaultConfig();
  c.fees.enabled = false;
  c.sections[0].fields.push({ id: "size", label: "Size", type: "select", required: true, options: ["S", "M"] });
  assert.equal(validateSubmission(c, { ...good, size: "XL" }, {}).errors.size, "Choose an option");
  assert.deepEqual(validateSubmission(c, { ...good, size: "M" }, {}).errors, {});
});

test("phone numbers", () => {
  const ok = (mobile: string) => !validateSubmission(cfg, { ...good, mobile }, { [senior.id]: 1 }, [{ full_name: "A" }]).errors.mobile;
  assert.equal(ok("09123456789"), true);
  assert.equal(ok("+63 912 345 6789"), true);
  assert.equal(ok("call me"), false);
});

test("one delegate box per ticket, each validated", () => {
  const fees = { [senior.id]: 1, [regular.id]: 2 };
  const r = validateSubmission(cfg, good, fees, [{ full_name: "Lola" }, { full_name: " " }, { full_name: "Ben", hacker: "x" }, { full_name: "extra" }]);
  assert.equal(r.attendees.length, 3);
  assert.deepEqual(r.attendees.map((a) => a.item), [senior.id, regular.id, regular.id]);
  assert.equal(r.errors["att:1:full_name"], "Required");
  assert.deepEqual(r.attendees[2].answers, { full_name: "Ben" }); // unknown keys dropped
});

test("no delegate boxes when turned off or no fees", () => {
  const c = defaultConfig();
  c.attendees.enabled = false;
  assert.deepEqual(validateSubmission(c, good, { [c.fees.items[0].id]: 2 }).attendees, []);
});

test("ref codes are unambiguous", () => {
  assert.match(makeRefCode(), /^REG-[A-HJKMNP-Z2-9]{6}$/);
});
