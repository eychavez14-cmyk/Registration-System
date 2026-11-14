import { serviceDb } from "@/lib/supabase/server";
import { getStaff } from "@/lib/staffServer";
import { displayLogin, toLoginEmail, validLogin, type Role } from "@/lib/staff";

// Admin-only user management. Uses the service key because creating logins needs Supabase's admin API.
const ROLES: Role[] = ["admin", "moderator"];
const deny = () => Response.json({ error: "Only admins can manage users" }, { status: 403 });
const bad = (error: string) => Response.json({ error }, { status: 400 });

async function adminCount() {
  const { count } = await serviceDb().from("admins").select("user_id", { count: "exact", head: true }).eq("role", "admin");
  return count ?? 0;
}

export async function GET(req: Request) {
  const me = await getStaff(req);
  if (me?.role !== "admin") return deny();
  const db = serviceDb();
  const [{ data: rows }, { data: users }] = await Promise.all([db.from("admins").select("*"), db.auth.admin.listUsers({ perPage: 1000 })]);
  const byId = new Map(users.users.map((u) => [u.id, u]));
  const list = (rows ?? []).map((r) => {
    const u = byId.get(r.user_id);
    return { id: r.user_id, login: displayLogin(u?.email ?? "?"), role: (r.role ?? "admin") as Role, lastSignIn: u?.last_sign_in_at ?? null, me: r.user_id === me.id };
  });
  return Response.json({ users: list.sort((a, b) => a.role.localeCompare(b.role) || a.login.localeCompare(b.login)) });
}

export async function POST(req: Request) {
  const me = await getStaff(req);
  if (me?.role !== "admin") return deny();
  const { login, password, role } = await req.json().catch(() => ({}));
  if (typeof login !== "string" || !validLogin(login.trim())) return bad("Username must be 3–30 letters, numbers, dots, dashes or underscores (or a valid email)");
  if (typeof password !== "string" || password.length < 8) return bad("Password must be at least 8 characters");
  if (!ROLES.includes(role)) return bad("Choose a role");

  const db = serviceDb();
  const { data, error } = await db.auth.admin.createUser({ email: toLoginEmail(login), password, email_confirm: true });
  if (error) return bad(error.code === "email_exists" ? "That username or email is already taken" : error.message);
  const { error: e2 } = await db.from("admins").insert({ user_id: data.user.id, role });
  if (e2) {
    await db.auth.admin.deleteUser(data.user.id); // don't leave a login without a role
    return bad(e2.message);
  }
  return Response.json({ ok: true });
}

export async function PATCH(req: Request) {
  const me = await getStaff(req);
  if (me?.role !== "admin") return deny();
  const { id, role, password } = await req.json().catch(() => ({}));
  if (typeof id !== "string") return bad("Missing user");
  const db = serviceDb();
  if (role !== undefined) {
    if (!ROLES.includes(role)) return bad("Choose a role");
    if (id === me.id && role !== "admin") return bad("You can't remove your own admin role");
    const { error } = await db.from("admins").update({ role }).eq("user_id", id);
    if (error) return bad(error.message);
  }
  if (password !== undefined) {
    if (typeof password !== "string" || password.length < 8) return bad("Password must be at least 8 characters");
    const { error } = await db.auth.admin.updateUserById(id, { password });
    if (error) return bad(error.message);
  }
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const me = await getStaff(req);
  if (me?.role !== "admin") return deny();
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string") return bad("Missing user");
  if (id === me.id) return bad("You can't remove yourself");
  const { data: row } = await serviceDb().from("admins").select("*").eq("user_id", id).maybeSingle();
  if (row?.role === "admin" && (await adminCount()) <= 1) return bad("There must always be at least one admin");
  const { error } = await serviceDb().auth.admin.deleteUser(id); // admins row goes with it (on delete cascade)
  return error ? bad(error.message) : Response.json({ ok: true });
}
