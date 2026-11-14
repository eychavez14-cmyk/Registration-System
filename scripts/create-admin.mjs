// Creates (or promotes) an admin login.
// Usage: npm run create-admin -- you@example.com "your-password"
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- you@example.com "password (8+ chars)"');
  process.exit(1);
}
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
let user = data?.user;
if (error?.code === "email_exists") {
  // Existing account: find it, reset its password, then promote it.
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (user) ({ error } = await db.auth.admin.updateUserById(user.id, { password }));
}
if (error || !user) {
  console.error("Failed:", error?.message ?? "user not found");
  process.exit(1);
}
const { error: e2 } = await db.from("admins").upsert({ user_id: user.id });
if (e2) {
  console.error("Failed to grant admin:", e2.message);
  process.exit(1);
}
console.log(`Admin ready: ${email}`);
