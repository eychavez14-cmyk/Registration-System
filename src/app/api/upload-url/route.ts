import { serviceDb } from "@/lib/supabase/server";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "application/pdf": "pdf" };
const MAX = 5 * 1024 * 1024;

// Hands out a one-time signed URL so the browser uploads the receipt straight to Supabase
// (Vercel functions cap request bodies at 4.5MB, so files can't pass through here).
export async function POST(req: Request) {
  const { slug, type, size } = await req.json().catch(() => ({}));
  const ext = TYPES[type];
  if (!ext) return Response.json({ error: "Only PNG, JPG or PDF files are accepted" }, { status: 400 });
  if (typeof size !== "number" || size > MAX) return Response.json({ error: "File must be 5MB or smaller" }, { status: 400 });

  const db = serviceDb();
  const { data: event } = await db.from("events").select("id").eq("slug", slug).eq("is_published", true).eq("is_open", true).maybeSingle();
  if (!event) return Response.json({ error: "Registration is closed" }, { status: 404 });

  const path = `${event.id}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await db.storage.from("receipts").createSignedUploadUrl(path);
  if (error) return Response.json({ error: "Upload failed, please try again" }, { status: 500 });
  return Response.json({ path, token: data.token });
}
