import type { Metadata } from "next";
import { Suspense } from "react";
import { EventShell } from "@/components/EventShell";
import { StatusLookup } from "@/components/StatusLookup";
import { Loading } from "@/components/Loading";
import { getPublishedEvent } from "@/lib/events";

export async function generateMetadata({ params }: PageProps<"/e/[slug]/status">): Promise<Metadata> {
  return { title: `Registration Status · ${(await getPublishedEvent((await params).slug)).title}` };
}

async function Status({ params, searchParams }: PageProps<"/e/[slug]/status">) {
  const event = await getPublishedEvent((await params).slug);
  const code = (await searchParams).code;
  return (
    <EventShell event={event} tab="status">
      <StatusLookup slug={event.slug} currency={event.config.fees.currency} initialCode={typeof code === "string" ? code : ""} />
    </EventShell>
  );
}

export default function StatusPage(props: PageProps<"/e/[slug]/status">) {
  return (
    <Suspense fallback={<Loading />}>
      <Status {...props} />
    </Suspense>
  );
}
