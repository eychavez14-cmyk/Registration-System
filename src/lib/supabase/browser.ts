import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export const browserDb = () =>
  (client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!));

export const assetUrl = (path: string) => browserDb().storage.from("assets").getPublicUrl(path).data.publicUrl;

// fetch() to our own API routes as the signed-in user.
export async function authFetch(url: string, init: RequestInit = {}) {
  const { data } = await browserDb().auth.getSession();
  return fetch(url, { ...init, headers: { "content-type": "application/json", ...init.headers, authorization: `Bearer ${data.session?.access_token ?? ""}` } });
}
