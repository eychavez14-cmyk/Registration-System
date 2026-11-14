import { test } from "node:test";
import assert from "node:assert/strict";
import { registrationSummary } from "./summary.ts";
import { validateSubmission } from "./validate.ts";
import { defaultConfig } from "./defaults.ts";

const cfg = defaultConfig();
const [senior, regular] = cfg.fees.items;

test("summary lists answers, numbered delegates and payment", () => {
  const v = validateSubmission(
    cfg,
    { church: "UPC", pastor: "Rev. A", first_name: "Juan", last_name: "Cruz", mobile: "09123456789" },
    { [senior.id]: 1, [regular.id]: 2 },
    [{ full_name: "Lola" }, { full_name: "Ben" }, { full_name: "Carlo" }],
  );
  const g = registrationSummary(cfg, v);
  assert.deepEqual(g.map((x) => x.title), ["Church Information", "Contact Information", "Delegate Details", "Payment"]);
  assert.equal(g[1].rows.some(([l]) => l === "Email Address"), false); // empty answers are left out
  assert.deepEqual(g[2].rows, [["Senior/PWD #1", "Lola"], ["Regular Delegate #1", "Ben"], ["Regular Delegate #2", "Carlo"]]);
  assert.deepEqual(g[3].rows.at(-1), ["Total", "₱2,200.00"]);
});

test("no payment group when fees are off", () => {
  const c = defaultConfig();
  c.fees.enabled = false;
  const g = registrationSummary(c, { answers: { church: "UPC" }, fees: {}, attendees: [], total: 0 });
  assert.deepEqual(g.map((x) => x.title), ["Church Information"]);
});
