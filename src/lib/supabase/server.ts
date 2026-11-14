import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Anon client: respects RLS, so it only ever sees published events.
export const publicDb = () => createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

// Service-role client: bypasses RLS. Only used in API routes after validating input.
export const serviceDb = () => createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
