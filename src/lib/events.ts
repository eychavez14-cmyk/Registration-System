import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { publicDb } from "./supabase/server";
import type { EventRow } from "./types";
import { withDefaults } from "./defaults";

export const getPublishedEvent = cache(async (slug: string) => {
  const { data } = await publicDb().from("events").select("*").eq("slug", slug).eq("is_published", true).maybeSingle<EventRow>();
  if (!data) notFound();
  return { ...data, config: withDefaults(data.config) };
});
