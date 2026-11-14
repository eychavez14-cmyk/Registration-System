import { serviceDb } from "@/lib/supabase/server";
import { notifyRegistrant } from "@/lib/mailer";
import { withDefaults } from "@/lib/defaults";
import { getStaff } from "@/lib/staffServer";
import type { EventRow, Registration } from "@/lib/types";

// Staff (admins and moderators): emails a registrant about their current status (confirmed / rejected).
export async function POST(req: Request) {
  if (!(await getStaff(req))) return Response.json({ error: "Not allowed" }, { status: 403 });
  const db = serviceDb();

  const { registrationId } = await req.json().catch(() => ({}));
  const { data: reg } = await db.from("registrations").select("*, events(*)").eq("id", registrationId ?? "").maybeSingle<Registration & { events: EventRow }>();
  if (!reg) return Response.json({ error: "Registration not found" }, { status: 404 });
  if (reg.status !== "confirmed" && reg.status !== "rejected") return Response.json({ error: "Only confirmed or rejected registrations get an email" }, { status: 400 });

  const event = { ...reg.events, config: withDefaults(reg.events.config) };
  const result = await notifyRegistrant(reg.status, event, reg, new URL(req.url).origin);
  return result.sent ? Response.json({ to: result.to }) : Response.json({ error: result.reason }, { status: 422 });
}
