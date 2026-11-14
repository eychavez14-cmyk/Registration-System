import type { Metadata } from "next";
import { Suspense } from "react";
import { EventShell } from "@/components/EventShell";
import { RegistrationForm } from "@/components/RegistrationForm";
import { Loading } from "@/components/Loading";
import { getPublishedEvent } from "@/lib/events";

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const event = await getPublishedEvent((await params).slug);
  return { title: event.title, description: [event.config.header.subtitle, event.config.header.venue].filter(Boolean).join(" · ") };
}

// Fetched per request (inside Suspense) so admin edits show up immediately.
async function Event({ params }: Pick<PageProps<"/e/[slug]">, "params">) {
  const event = await getPublishedEvent((await params).slug);
  return (
    <EventShell event={event} tab="form" intro>
      <RegistrationForm event={event} />
    </EventShell>
  );
}

export default function EventPage({ params }: PageProps<"/e/[slug]">) {
  return (
    <Suspense fallback={<Loading text="Loading registration details…" />}>
      <Event params={params} />
    </Suspense>
  );
}
