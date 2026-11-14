import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { buildEmail, fromName, registrantEmail, type EmailKind } from "./email";
import type { EventRow, Registration } from "./types";
import { qrImageUrl } from "./qr";

let transport: Transporter | undefined;

type Result = { sent: true; to: string } | { sent: false; reason: string };

// Emails the registrant. Never throws: a failed email must not break a registration or a status change.
export async function notifyRegistrant(kind: EmailKind, event: Pick<EventRow, "slug" | "title" | "config">, reg: Pick<Registration, "ref_code" | "answers" | "fees" | "attendees" | "total" | "admin_note">, origin: string): Promise<Result> {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!event.config.emails.enabled) return { sent: false, reason: "Emails are turned off for this event" };
  if (!user || !pass) return { sent: false, reason: "Email isn't set up yet (GMAIL_USER / GMAIL_APP_PASSWORD)" };
  const to = registrantEmail(event.config, reg.answers);
  if (!to) return { sent: false, reason: "No email address on this registration" };

  const statusUrl = `${origin}/e/${event.slug}/status?code=${reg.ref_code}`;
  const qrUrl = qrImageUrl(origin, event.slug, reg.ref_code);
  const { subject, html, text } = buildEmail({ kind, title: event.title, config: event.config, reg, statusUrl, qrUrl });
  try {
    transport ??= nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    await transport.sendMail({ from: { name: fromName(event), address: user }, to, subject, html, text });
    return { sent: true, to };
  } catch (e) {
    console.error("Email failed:", e);
    return { sent: false, reason: e instanceof Error && /Invalid login|Username and Password/i.test(e.message) ? "Gmail rejected the login. Check the app password." : "Email could not be sent" };
  }
}
