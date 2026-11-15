import { revalidateTag } from "next/cache";
import { getStaff } from "@/lib/staffServer";

// Admin saved/published/deleted an event: drop its cached page so the next visit shows the change.
export async function POST(req: Request) {
  if ((await getStaff(req))?.role !== "admin") return Response.json({ error: "Not allowed" }, { status: 403 });
  const { slugs } = await req.json().catch(() => ({}));
  if (!Array.isArray(slugs)) return Response.json({ error: "Missing slugs" }, { status: 400 });
  // expire: 0 = no stale copy; the next visitor gets the fresh page.
  for (const s of slugs) if (typeof s === "string" && s) revalidateTag(`event:${s}`, { expire: 0 });
  revalidateTag("events", { expire: 0 }); // list of prerendered events (publish/unpublish/rename)
  return Response.json({ ok: true });
}
