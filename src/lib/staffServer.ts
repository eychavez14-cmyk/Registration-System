import "server-only";
import { serviceDb } from "./supabase/server";
import type { Role } from "./staff";

// Who is calling (from the Bearer token) and their role; null if not staff.
export async function getStaff(req: Request): Promise<{ id: string; role: Role } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  const db = serviceDb();
  const { data } = await db.auth.getUser(token);
  if (!data.user) return null;
  const { data: row } = await db.from("admins").select("*").eq("user_id", data.user.id).maybeSingle();
  return row ? { id: data.user.id, role: row.role ?? "admin" } : null; // rows from before roles existed are admins
}
