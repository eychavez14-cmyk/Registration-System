import type { Metadata } from "next";
import { Suspense } from "react";
import { EventShell } from "@/components/EventShell";
import { RegistrationForm } from "@/components/RegistrationForm";
import { getPublishedEvent, publishedSlugs } from "@/lib/events";

// Prerender every published event so visitors get the page (logo, colors) instantly.
// Cache Components needs at least one entry; the placeholder just renders "not found".
export async function generateStaticParams() {
  const slugs = await publishedSlugs();
  return (slugs.length ? slugs : ["__none__"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const event = await getPublishedEvent((await params).slug);
  return { title: event.title, description: [event.config.header.subtitle, event.config.header.venue].filter(Boolean).join(" · ") };
}

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
    // Only seen on the very first visit to a newly published event (before it's prerendered): plain dark screen.
    <Suspense fallback={<div className="fixed inset-0 bg-black" aria-label="Loading" />}>
      <Event params={params} />
    </Suspense>
  );
}
