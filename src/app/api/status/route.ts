import { serviceDb } from "@/lib/supabase/server";

// Lookup by reference code only, returning just enough to confirm status (no contact details).
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const code = (params.get("code") ?? "").trim().toUpperCase();
  const slug = params.get("slug") ?? "";
  if (!/^REG-[A-Z0-9]{6}$/.test(code)) return Response.json({ error: "Enter a valid registration number, e.g. REG-AB12CD" }, { status: 400 });

  const { data } = await serviceDb()
    .from("registrations")
    .select("ref_code, status, total, created_at, admin_note, answers, events!inner(slug)")
    .eq("ref_code", code)
    .eq("events.slug", slug)
    .maybeSingle();
  if (!data) return Response.json({ error: "No registration found with that code" }, { status: 404 });

  const a = data.answers as Record<string, unknown>;
  const name = [a.first_name, a.last_name].filter((x) => typeof x === "string").join(" ");
  return Response.json({
    ref_code: data.ref_code, status: data.status, total: data.total, created_at: data.created_at,
    note: data.admin_note, name: name.replace(/(\S)\S*/g, "$1***"), // masked so a guessed code leaks little
  });
}
