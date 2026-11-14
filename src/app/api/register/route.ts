import { serviceDb } from "@/lib/supabase/server";
import { makeRefCode, validateSubmission } from "@/lib/validate";
import type { EventRow } from "@/lib/types";
import { withDefaults } from "@/lib/defaults";
import { notifyRegistrant } from "@/lib/mailer";

// shortcut: no rate limiting or captcha; add Vercel Firewall rules or Turnstile if spam shows up.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid request" }, { status: 400 });

  const db = serviceDb();
  const { data: event } = await db.from("events").select("*").eq("slug", body.slug).eq("is_published", true).maybeSingle<EventRow>();
  if (!event) return Response.json({ error: "Event not found" }, { status: 404 });
  if (!event.is_open) return Response.json({ error: "Registration is closed" }, { status: 403 });

  const config = withDefaults(event.config);
  const v = validateSubmission(config, body.answers, body.fees, body.attendees);
  if (Object.keys(v.errors).length) return Response.json({ error: "Please fix the highlighted fields", errors: v.errors }, { status: 400 });

  let receipt: string | null = null;
  const needsProof = config.payment.enabled && config.payment.requireProof && v.total > 0;
  if (typeof body.receiptPath === "string" && body.receiptPath) {
    // Must be a file we issued for this event, and it must actually have been uploaded.
    const [folder, name, extra] = body.receiptPath.split("/");
    const { data: found } = folder === event.id && name && !extra
      ? await db.storage.from("receipts").list(folder, { search: name, limit: 1 })
      : { data: null };
    if (!found?.some((f) => f.name === name)) return Response.json({ error: "Receipt upload not found, please upload again" }, { status: 400 });
    const { count } = await db.from("registrations").select("id", { count: "exact", head: true }).eq("receipt_path", body.receiptPath);
    if (count) return Response.json({ error: "This receipt was already used, please upload it again" }, { status: 400 });
    receipt = body.receiptPath;
  }
  if (needsProof && !receipt) return Response.json({ error: "Please upload your proof of payment" }, { status: 400 });

  for (let attempt = 0; attempt < 5; attempt++) {
    const ref_code = makeRefCode();
    const { error } = await db.from("registrations").insert({
      event_id: event.id, ref_code, answers: v.answers, fees: v.fees, attendees: v.attendees, total: v.total, receipt_path: receipt,
    });
    if (!error) {
      // Awaited so serverless hosts don't cut it off; notifyRegistrant never throws.
      const email = await notifyRegistrant("received", { ...event, config }, { ref_code, answers: v.answers, fees: v.fees, attendees: v.attendees, total: v.total, admin_note: null }, new URL(req.url).origin);
      return Response.json({ ref_code, total: v.total, emailedTo: email.sent ? email.to : null });
    }
    if (error.code !== "23505") break; // only retry on ref_code collision
  }
  return Response.json({ error: "Could not save your registration, please try again" }, { status: 500 });
}
