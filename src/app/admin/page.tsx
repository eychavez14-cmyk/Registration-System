"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { browserDb } from "@/lib/supabase/browser";
import { defaultConfig } from "@/lib/defaults";
import { useRole } from "@/components/admin/AdminGate";
import type { EventRow } from "@/lib/types";

const suffix = () => Math.random().toString(36).slice(2, 6);

type Row = Pick<EventRow, "id" | "slug" | "title" | "is_published" | "is_open" | "created_at"> & { registrations: { count: number }[] };

export default function AdminHome() {
  const router = useRouter();
  const isAdmin = useRole() === "admin";
  const [events, setEvents] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    browserDb().from("events").select("id, slug, title, is_published, is_open, created_at, registrations(count)").order("created_at", { ascending: false })
      .then(({ data }) => setEvents((data as Row[]) ?? []));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const slug = (title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "event") + "-" + suffix();
    const { data, error } = await browserDb().from("events").insert({ title, slug, config: defaultConfig() }).select("id").single();
    if (error) return setError(error.message);
    router.push(`/admin/events/${data.id}`);
  }

  async function duplicate(id: string) {
    const db = browserDb();
    const { data: src } = await db.from("events").select("title, slug, config").eq("id", id).single();
    if (!src) return;
    const { data, error } = await db.from("events").insert({ title: `${src.title} (copy)`, slug: `${src.slug}-copy-${suffix()}`, config: src.config }).select("id").single();
    if (error) return setError(error.message);
    router.push(`/admin/events/${data.id}`);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">Events</h1>
        {isAdmin && <form onSubmit={create} className="ml-auto flex gap-2">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New event name" aria-label="New event name" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">+ New event</button>
        </form>}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {!events ? (
        <p className="mt-6 text-sm text-slate-500">Loading…</p>
      ) : events.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No events yet. Create one to get started.</p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 p-4">
              <Link href={`/admin/events/${e.id}`} className="min-w-0 flex-1">
                <span className="block font-bold hover:underline">{e.title}</span>
                <span className="block truncate text-xs text-slate-500">/e/{e.slug}</span>
              </Link>
              <span className="text-sm text-slate-600">{e.registrations[0]?.count ?? 0} registrations</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.is_published ? (e.is_open ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700") : "bg-amber-100 text-amber-800"}`}>
                {e.is_published ? (e.is_open ? "Live" : "Closed") : "Draft"}
              </span>
              {isAdmin && <button onClick={() => duplicate(e.id)} className="text-xs text-slate-500 hover:text-slate-900">Duplicate</button>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
