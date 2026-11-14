import { serviceDb } from "@/lib/supabase/server";
import { getStaff } from "@/lib/staffServer";
import type { Registration } from "@/lib/types";

// Staff (admins and moderators) approve or reject a registrant's pending edit.
// Runs server-side because moderators may not write answers directly (only status/note/check-in).
export async function POST(req: Request) {
  if (!(await getStaff(req))) return Response.json({ error: "Not allowed" }, { status: 403 });
  const { registrationId, action } = await req.json().catch(() => ({}));
  const db = serviceDb();
  const { data: reg } = await db.from("registrations").select("*").eq("id", registrationId ?? "").maybeSingle<Registration>();
  if (!reg) return Response.json({ error: "Registration not found" }, { status: 404 });
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
