import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLines, choiceFields, choiceKey, filterLines, groupLines, sumAmount } from "./report.ts";
import { defaultConfig } from "./defaults.ts";
import type { Registration } from "./types.ts";

const cfg = defaultConfig();
const [senior, regular] = cfg.fees.items; // 600, 800
cfg.sections[0].fields.push({ id: "section", label: "Section", type: "select", required: false, options: ["Section 1", "Section 2"] });
cfg.attendees.fields.push({ id: "gender", label: "Gender", type: "radio", required: false, options: ["Male", "Female"] });

const reg = (id: string, status: Registration["status"], section: string, people: [string, string, string][], total: number): Registration => ({
  id, event_id: "e", ref_code: `REG-${id}`, status, total, receipt_path: null, admin_note: null, created_at: "", checkin: {}, pending_change: null,
  answers: { first_name: "Reg", last_name: id, section },
  fees: people.reduce((f, [item]) => ({ ...f, [item]: (f[item] ?? 0) + 1 }), {} as Record<string, number>),
  attendees: people.map(([item, full_name, gender]) => ({ item, answers: { full_name, gender } })),
});

const regs = [
  reg("A", "confirmed", "Section 1", [[senior.id, "Lola", "Female"], [regular.id, "Ben", "Male"]], 1400),
  reg("B", "pending", "Section 2", [[regular.id, "Carla", "Female"]], 800),
  reg("C", "rejected", "Section 1", [[regular.id, "Dan", "Male"]], 800),
];

test("one line per delegate, amounts add up to what each registration paid", () => {
  const lines = buildLines(cfg, regs);
  assert.equal(lines.length, 4);
  assert.deepEqual(lines.filter((l) => l.reg.id === "A").map((l) => [l.person, l.category, l.amount]), [["Lola", "Senior/PWD", 600], ["Ben", "Regular Delegate", 800]]);
  assert.equal(sumAmount(lines), 3000);
  assert.equal(sumAmount(lines, "confirmed"), 1400);
});

test("amounts follow the real total even if prices changed after registering", () => {
  const discounted = reg("D", "confirmed", "Section 1", [[senior.id, "X", "Male"], [regular.id, "Y", "Male"]], 700); // paid half
  assert.deepEqual(buildLines(cfg, [discounted]).map((l) => l.amount), [300, 400]);
});

test("filters on registration and delegate dropdowns", () => {
  const lines = buildLines(cfg, regs);
  const keys = choiceFields(cfg).map(choiceKey);
  assert.deepEqual(keys, ["reg:section", "att:gender"]);
  assert.equal(filterLines(lines, cfg, { "reg:section": "Section 1" }).length, 3);
  assert.deepEqual(filterLines(lines, cfg, { "reg:section": "Section 1", "att:gender": "Female" }).map((l) => l.person), ["Lola"]);
});

test("groups by category or dropdown, in the event's order, with totals", () => {
  const ok = buildLines(cfg, regs).filter((l) => l.reg.status !== "rejected");
  assert.deepEqual(groupLines(ok, cfg, "category").map((g) => [g.name, g.people, g.amount]), [["Senior/PWD", 1, 600], ["Regular Delegate", 2, 1600]]);
  assert.deepEqual(groupLines(ok, cfg, "att:gender").map((g) => [g.name, g.people, g.registrations]), [["Male", 1, 1], ["Female", 2, 2]]);
});
