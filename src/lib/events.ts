import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { publicDb } from "./supabase/server";
import type { EventRow } from "./types";
import { withDefaults } from "./defaults";

// Cached so event pages can be prerendered: the very first HTML already has the event's logo and colors
// (no "Loading…" wait). Admin saves refresh it immediately via /api/revalidate (tag event:<slug>).
async function loadPublishedEvent(slug: string) {
  "use cache";
  cacheTag(`event:${slug}`, "events");
  cacheLife("hours"); // safety net if a refresh is ever missed
  const { data } = await publicDb().from("events").select("*").eq("slug", slug).eq("is_published", true).maybeSingle<EventRow>();
  return data ? { ...data, config: withDefaults(data.config) } : null;
}

export async function getPublishedEvent(slug: string) {
  const event = await loadPublishedEvent(slug);
  if (!event) notFound();
  return event;
}

// Slugs to prerender at build time; events published later are prerendered after their first visit.
export async function publishedSlugs() {
  "use cache";
  cacheTag("events");
  cacheLife("hours");
  const { data } = await publicDb().from("events").select("slug").eq("is_published", true);
  return (data ?? []).map((e) => e.slug as string);
}
