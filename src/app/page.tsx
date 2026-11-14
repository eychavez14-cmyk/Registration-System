import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { publicDb } from "@/lib/supabase/server";
import { Loading } from "@/components/Loading";

async function EventList() {
  await connection(); // always fresh: lists whatever is published right now
  const { data: events } = await publicDb().from("events").select("slug, title, is_open, config->header").eq("is_published", true).order("created_at", { ascending: false });
  return (
    <ul className="mt-8 space-y-3">
      {(events ?? []).map((e) => (
        <li key={e.slug}>
          <Link href={`/e/${e.slug}`} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-400">
            <span className="font-bold">{e.title}</span>
            {!e.is_open && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Closed</span>}
            <span className="block text-sm text-slate-500">{(e.header as { subtitle?: string })?.subtitle}</span>
          </Link>
        </li>
      ))}
      {!events?.length && <li className="text-slate-500">No open events yet.</li>}
    </ul>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">Events</h1>
      <p className="mt-1 text-slate-500">Choose an event to register.</p>
      <Suspense fallback={<Loading />}>
        <EventList />
      </Suspense>
      <Link href="/admin" className="mt-10 inline-block text-sm text-slate-400 hover:text-slate-700">Admin login</Link>
    </main>
  );
}
