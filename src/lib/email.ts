import type { EventConfig, Registration } from "./types";
import { registrationSummary } from "./summary.ts";
import { money } from "./validate.ts";

export type EmailKind = "received" | "confirmed" | "rejected";

// Registrant answers go into HTML, so everything user-supplied is escaped.
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// The first email-type question on the form is where emails go.
export function registrantEmail(config: EventConfig, answers: Registration["answers"]) {
  const field = config.sections.flatMap((s) => s.fields).find((f) => f.type === "email");
  const v = field && answers[field.id];
  return typeof v === "string" && v ? v : null;
}

export const PLACEHOLDERS = ["{event}", "{ref}", "{name}", "{total}"];

// Replaces {event} {ref} {name} {total}; unknown {words} are left as typed. One line only (safe for subjects).
const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

type Input = { kind: EmailKind; title: string; config: EventConfig; reg: Pick<Registration, "ref_code" | "answers" | "fees" | "attendees" | "total" | "admin_note">; statusUrl: string; qrUrl?: string };

// qrUrl: hosted QR image (Gmail blocks inline images); shown on received/confirmed emails for check-in.
export function buildEmail({ kind, title, config, reg, statusUrl, qrUrl }: Input) {
  const { theme, header } = config;
  const a = reg.answers;
  const name = [a.first_name, a.last_name].filter((x) => typeof x === "string" && x).join(" ") || "there";
  const vars = { event: title, ref: reg.ref_code, name, total: money(config.fees.currency, Number(reg.total)) };
  const tpl = config.emails[kind];
  const copy = { subject: oneLine(fill(tpl.subject, vars)), heading: fill(tpl.heading, vars), message: fill(tpl.message, vars) };
  const groups = registrationSummary(config, { ...reg, attendees: reg.attendees ?? [], total: Number(reg.total) });
  const rows = groups
    .map((g) => `<tr><td colspan="2" style="padding:18px 0 6px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;letter-spacing:.05em;color:#64748b;text-transform:uppercase">${esc(g.title)}</td></tr>` +
      g.rows.map(([l, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top;width:40%">${esc(l)}</td><td style="padding:4px 0;color:#0f172a;font-weight:600">${esc(v)}</td></tr>`).join(""))
    .join("");
  const note = reg.admin_note && kind !== "received"
    ? `<p style="margin:16px 0 0;padding:12px 14px;background:#f8fafc;border-left:4px solid ${theme.primary};color:#334155"><b>Note from the organizers:</b><br>${esc(reg.admin_note).replace(/\n/g, "<br>")}</p>`
    : "";
  const sub = [header.subtitle, header.venue].filter(Boolean).map(esc).join("<br>");

  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:${theme.headerBg};color:${theme.headerText};padding:24px 28px"><div style="font-size:22px;font-weight:700">${esc(title)}</div>${sub ? `<div style="font-size:14px;opacity:.85;margin-top:4px">${sub}</div>` : ""}</td></tr>
<tr><td style="padding:24px 28px">
<h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">${esc(copy.heading)}</h1>
<p style="margin:0;color:#334155">${esc(copy.message).replace(/\n/g, "<br>")}</p>${note}
<div style="margin:20px 0;padding:16px;background:#f8fafc;border-radius:10px;text-align:center">
${qrUrl && kind !== "rejected" ? `<img src="${esc(qrUrl)}" width="180" height="180" alt="Check-in QR code" style="display:block;margin:0 auto 10px;border:0"><div style="margin-bottom:10px;font-size:13px;color:#334155">Show this QR code at check-in</div>` : ""}
<div style="font-size:12px;font-weight:700;letter-spacing:.05em;color:#64748b">REGISTRATION NUMBER</div>
<div style="font-family:Consolas,Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:.1em;color:${theme.primary}">${esc(reg.ref_code)}</div></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}</table>
<p style="margin:24px 0 0;text-align:center"><a href="${esc(statusUrl)}" style="display:inline-block;background:${theme.primary};color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">Check your registration status</a></p>
</td></tr>
<tr><td style="padding:14px 28px;background:${theme.footerBg};color:${theme.footerText};font-size:12px;text-align:center">${esc(config.footer).replace(/\n/g, "<br>")}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    title, "", copy.heading, copy.message,
    reg.admin_note && kind !== "received" ? `\nNote from the organizers: ${reg.admin_note}` : "",
    `\nRegistration number: ${reg.ref_code}`,
    ...groups.flatMap((g) => ["", g.title.toUpperCase(), ...g.rows.map(([l, v]) => `${l}: ${v}`)]),
    "", `Check your registration status: ${statusUrl}`,
  ].join("\n");

  return { subject: copy.subject, html, text };
}

// Display name in the inbox ("Name <upcnsld@gmail.com>"); blank falls back to the event name.
export const fromName = (event: { title: string; config: EventConfig }) =>
  (event.config.emails.fromName.trim() || event.title).replace(/[\r\n"<>]/g, " ").trim().slice(0, 60);
