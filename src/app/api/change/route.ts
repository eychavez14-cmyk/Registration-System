import { serviceDb } from "@/lib/supabase/server";
import { getStaff } from "@/lib/staffServer";
import { withDefaults } from "@/lib/defaults";
import { validateSubmission } from "@/lib/validate";
import type { Registration } from "@/lib/types";

// Staff (admins and moderators) approve or reject a registrant's pending edit; admins can also edit a registration directly ("set").
// Runs server-side because the browser may not write answers directly (only status/note/check-in).
export async function POST(req: Request) {
  const staff = await getStaff(req);
  if (!staff) return Response.json({ error: "Not allowed" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const { registrationId, action } = body;
  const db = serviceDb();
  const { data: reg } = await db.from("registrations").select("*").eq("id", registrationId ?? "").maybeSingle<Registration>();
  if (!reg) return Response.json({ error: "Registration not found" }, { status: 404 });

  if (action === "set") {
    if (staff.role !== "admin") return Response.json({ error: "Only admins can edit registrations" }, { status: 403 });
    const { data: event } = await db.from("events").select("config").eq("id", reg.event_id).single();
    const v = validateSubmission(withDefaults(event?.config ?? {}), body.answers, body.fees, body.attendees);
    if (Object.keys(v.errors).length) return Response.json({ error: "Please fix the highlighted fields", errors: v.errors }, { status: 400 });
    // Amount: what the prices add up to, unless the admin typed a different amount (discount, partial payment...).
    const total = body.total == null ? v.total : Number(body.total);
    if (!Number.isFinite(total) || total < 0) return Response.json({ error: "Amount must be 0 or more" }, { status: 400 });
    const { data, error } = await db.from("registrations")
      .update({ answers: v.answers, fees: v.fees, attendees: v.attendees, total: Math.round(total * 100) / 100 })
      .eq("id", reg.id).select("*").single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ registration: data });
  }

  if (!reg.pending_change) return Response.json({ error: "There's no pending edit on this registration" }, { status: 400 });
  if (action !== "approve" && action !== "reject") return Response.json({ error: "Unknown action" }, { status: 400 });

  const newReceipt = reg.pending_change.receipt_path;
  const patch = action === "approve"
    ? { answers: reg.pending_change.answers, attendees: reg.pending_change.attendees, pending_change: null, ...(newReceipt && { receipt_path: newReceipt }) }
    : { pending_change: null };
  const { data, error } = await db.from("registrations").update(patch).eq("id", reg.id).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  // Tidy storage only after the database change succeeded: approve drops the old file, reject drops the unused new one.
  const unused = action === "approve" ? newReceipt && reg.receipt_path : newReceipt;
  if (unused) await db.storage.from("receipts").remove([unused]);
  return Response.json({ registration: data });
}
