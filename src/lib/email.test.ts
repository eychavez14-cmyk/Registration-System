import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEmail, fromName, registrantEmail } from "./email.ts";
import { defaultConfig } from "./defaults.ts";

const cfg = defaultConfig();
const [senior] = cfg.fees.items;
const reg = {
  ref_code: "REG-ABC234",
  answers: { church: "UPC", first_name: "<script>alert(1)</script>", email: "maria@example.com" },
  fees: { [senior.id]: 1 },
  attendees: [{ item: senior.id, answers: { full_name: 'Lola "Mama" <b>Santos</b>' } }],
  total: 600,
  admin_note: "Receipt <img src=x> unreadable",
};

test("finds the registrant's email from the first email question", () => {
  assert.equal(registrantEmail(cfg, reg.answers), "maria@example.com");
  assert.equal(registrantEmail(cfg, { church: "UPC" }), null);
});

test("escapes everything the registrant or admin typed", () => {
  const { html } = buildEmail({ kind: "rejected", title: "Conf & Co", config: cfg, reg, statusUrl: "https://x.test/e/a/status?code=REG-ABC234" });
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<b>Santos</b>"), false);
  assert.equal(html.includes("<img src=x>"), false);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("Conf &amp; Co"));
});

test("custom texts fill placeholders; subject stays one line; message is escaped", () => {
  const c = defaultConfig();
  c.emails.received = { subject: "Hi {name}!\r\nBcc: evil@x.test", heading: "{event} — {ref}", message: "Total {total}\n<b>{unknown}</b>" };
  const e = buildEmail({ kind: "received", title: "LM", config: c, reg: { ...reg, answers: { first_name: "Maria", last_name: "Santos" } }, statusUrl: "https://x.test" });
  assert.equal(e.subject, "Hi Maria Santos! Bcc: evil@x.test"); // no line break = no header injection
  assert.ok(e.html.includes("LM — REG-ABC234"));
  assert.ok(e.html.includes("Total ₱600.00<br>&lt;b&gt;{unknown}&lt;/b&gt;"));
});

test("from name: custom, else event title, cleaned", () => {
  const c = defaultConfig();
  assert.equal(fromName({ title: "LM Conference", config: c }), "LM Conference");
  c.emails.fromName = 'NSLD "Youth" <Ministry>\n';
  assert.equal(fromName({ title: "LM Conference", config: c }), "NSLD  Youth   Ministry");
});

test("subject, number, note and status link per kind", () => {
  const ok = buildEmail({ kind: "confirmed", title: "LM Conf", config: cfg, reg, statusUrl: "https://x.test/s" });
  assert.equal(ok.subject, "Registration confirmed – LM Conf (REG-ABC234)");
  assert.ok(ok.html.includes("REG-ABC234") && ok.html.includes("https://x.test/s") && ok.text.includes("Note from the organizers"));
  const rec = buildEmail({ kind: "received", title: "LM Conf", config: cfg, reg, statusUrl: "https://x.test/s" });
  assert.equal(rec.text.includes("Note from the organizers"), false); // notes only on confirm/reject
  assert.ok(rec.text.includes("Total: ₱600.00"));
});

test("free (₱0) registrations get the no-payment received message", () => {
  const args = { kind: "received" as const, title: "Conf", config: cfg, statusUrl: "#" };
  assert.ok(buildEmail({ ...args, reg: { ...reg, total: 0 } }).html.includes("No payment is needed"));
  assert.ok(buildEmail({ ...args, reg }).html.includes("verify your payment"));
  const blank = { ...cfg, emails: { ...cfg.emails, received: { ...cfg.emails.received, freeMessage: "" } } };
  assert.ok(buildEmail({ ...args, config: blank, reg: { ...reg, total: 0 } }).html.includes("verify your payment")); // empty = normal message
});
