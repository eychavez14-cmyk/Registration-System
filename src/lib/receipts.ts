import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// A receipt path sent by a browser is only trusted if it's a file we issued for this event,
// it was really uploaded, and no other registration already uses it.
export async function checkReceipt(db: SupabaseClient, eventId: string, path: string): Promise<string | null> {
  const [folder, name, extra] = path.split("/");
  if (folder !== eventId || !name || extra) return "Receipt upload not found, please upload again";
  const { data: found } = await db.storage.from("receipts").list(folder, { search: name, limit: 1 });
  if (!found?.some((f) => f.name === name)) return "Receipt upload not found, please upload again";
  const { count } = await db.from("registrations").select("id", { count: "exact", head: true }).eq("receipt_path", path);
  if (count) return "This receipt was already used, please upload it again";
  return null;
}
