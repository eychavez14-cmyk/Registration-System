import { serviceDb } from "@/lib/supabase/server";
import { makeRefCode, validateSubmission } from "@/lib/validate";
import type { EventRow } from "@/lib/types";
import { withDefaults } from "@/lib/defaults";
import { notifyRegistrant } from "@/lib/mailer";
import { checkReceipt } from "@/lib/receipts";

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
    const problem = await checkReceipt(db, event.id, body.receiptPath);
    if (problem) return Response.json({ error: problem }, { status: 400 });
    receipt = body.receiptPath;
  }
  if (needsProof && !receipt) return Response.json({ error: "Please upload your proof of payment" }, { status: 400 });

  for (let attempt = 0; attempt < 5; attempt++) {
    const ref_code = makeRefCode();
    const { error } = await db.from("registrations").insert({
      event_id: event.id, ref_code, answers: v.answers, fees: v.fees, attendees: v.attendees, total: v.total, receipt_path: receipt,
    });
    if (!error) {
      // Attach the uploaded receipt so the registrant has a copy (best effort: no attachment if the download fails).
      const attachments = [];
      if (receipt) {
        const { data: file } = await db.storage.from("receipts").download(receipt);
        if (file) attachments.push({ filename: `receipt-${ref_code}.${receipt.split(".").pop()}`, content: Buffer.from(await file.arrayBuffer()), contentType: file.type });
      }
      // Awaited so serverless hosts don't cut it off; notifyRegistrant never throws.
      const email = await notifyRegistrant("received", { ...event, config }, { ref_code, answers: v.answers, fees: v.fees, attendees: v.attendees, total: v.total, admin_note: null }, new URL(req.url).origin, attachments);
      return Response.json({ ref_code, total: v.total, emailedTo: email.sent ? email.to : null });
    }
    if (error.code !== "23505") break; // only retry on ref_code collision
  }
  return Response.json({ error: "Could not save your registration, please try again" }, { status: 500 });
}
