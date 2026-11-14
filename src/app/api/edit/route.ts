import { serviceDb } from "@/lib/supabase/server";
import { withDefaults } from "@/lib/defaults";
import { contactMatches, diffChange } from "@/lib/edit";
import { validateSubmission } from "@/lib/validate";
import { checkReceipt } from "@/lib/receipts";
import type { EventRow, Registration } from "@/lib/types";

// Registrant self-service edits. Needs the registration number AND the email/mobile they registered with.
// Edits never apply directly: they are stored as pending_change until staff approve them.
// shortcut: no rate limit on contact guesses; the number (887M combinations) + exact contact makes guessing impractical.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  if (!body || !/^REG-[A-Z0-9]{6}$/.test(code)) return Response.json({ error: "Enter a valid registration number" }, { status: 400 });

  const db = serviceDb();
  const { data } = await db.from("registrations").select("*, events!inner(*)").eq("ref_code", code).eq("events.slug", String(body.slug ?? "")).maybeSingle<Registration & { events: EventRow }>();
  const config = data && withDefaults(data.events.config);
  // Same message for "no such number" and "wrong contact", so neither can be probed.
  if (!data || !config || !contactMatches(config, data.answers, String(body.contact ?? "")))
    return Response.json({ error: "That email or mobile number doesn't match this registration." }, { status: 403 });

  if (body.action === "open")
    return Response.json({ answers: data.answers, attendees: data.attendees ?? [], fees: data.fees, pending: !!data.pending_change, hasReceipt: !!data.receipt_path });

  if (body.action === "submit") {
    // Same validation as a new registration; delegate count and amounts stay as registered.
    const v = validateSubmission(config, body.answers, data.fees, body.attendees);
    if (Object.keys(v.errors).length) return Response.json({ error: "Please fix the highlighted fields", errors: v.errors }, { status: 400 });

    // Optional replacement proof of payment (uploaded via /api/upload-url first).
    let receipt: string | undefined;
    if (typeof body.receiptPath === "string" && body.receiptPath) {
      const problem = await checkReceipt(db, data.event_id, body.receiptPath);
      if (problem) return Response.json({ error: problem }, { status: 400 });
      receipt = body.receiptPath;
    }
    // Compare question by question (stored key order can differ), the same way approvers see it.
    if (!receipt && !diffChange(config, { answers: data.answers, attendees: data.attendees ?? [] }, v).length) return Response.json({ error: "Nothing was changed." }, { status: 400 });

    const { error } = await db.from("registrations").update({ pending_change: { answers: v.answers, attendees: v.attendees, receipt_path: receipt, submitted_at: new Date().toISOString() } }).eq("id", data.id);
    if (error) return Response.json({ error: "Couldn't save your update, please try again" }, { status: 500 });
    // A newer edit replaces the older one; its unused replacement file goes too.
    const old = data.pending_change?.receipt_path;
    if (old && old !== receipt) await db.storage.from("receipts").remove([old]);
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
