import { test } from "node:test";
import assert from "node:assert/strict";
import { contactMatches, diffChange } from "./edit.ts";
import { defaultConfig } from "./defaults.ts";

const cfg = defaultConfig();
const [senior] = cfg.fees.items;
const answers = { church: "UPC", first_name: "Maria", last_name: "Santos", mobile: "0917 123 4567", email: "Maria@Example.com" };

test("registrant proves who they are with their email or mobile", () => {
  assert.equal(contactMatches(cfg, answers, "maria@example.com "), true);
  assert.equal(contactMatches(cfg, answers, "+63 917-123-4567"), true);
  assert.equal(contactMatches(cfg, answers, "09171234567"), true);
  assert.equal(contactMatches(cfg, answers, "09999999999"), false);
  assert.equal(contactMatches(cfg, answers, "other@example.com"), false);
  assert.equal(contactMatches(cfg, answers, ""), false);
  assert.equal(contactMatches(cfg, answers, "UPC"), false); // other answers don't count
});

test("lists exactly what an edit changes", () => {
  const old = { answers, attendees: [{ item: senior.id, answers: { full_name: "Lola Santos" } }] };
  const next = { answers: { ...answers, church: "UPC Batangas" }, attendees: [{ item: senior.id, answers: { full_name: "Lola R. Santos" } }] };
  assert.deepEqual(diffChange(cfg, old, next), [
    { label: "Church Name", from: "UPC", to: "UPC Batangas" },
    { label: "Senior/PWD #1 – Full name", from: "Lola Santos", to: "Lola R. Santos" },
  ]);
  assert.deepEqual(diffChange(cfg, old, old), []);
});
