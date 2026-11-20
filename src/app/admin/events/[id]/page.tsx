"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch, browserDb } from "@/lib/supabase/browser";
import { withDefaults } from "@/lib/defaults";
import { useRole } from "@/components/admin/AdminGate";
import type { EventConfig, EventRow, Field } from "@/lib/types";
import { EventShell } from "@/components/EventShell";
import { RegistrationForm } from "@/components/RegistrationForm";
import { Registrations } from "@/components/admin/Registrations";
import { CheckIn } from "@/components/admin/CheckIn";
import { FormBuilder } from "@/components/admin/FormBuilder";
import { FeesPayment } from "@/components/admin/FeesPayment";
import { DesignEditor } from "@/components/admin/DesignEditor";
import { EmailEditor } from "@/components/admin/EmailEditor";
import { sampleRegistration } from "@/lib/sample";
import { ConfirmButton, Panel, Text, Toggle } from "@/components/admin/ui";

const TABS = { registrations: "Registration Dashboard", checkin: "Check-In", form: "Form fields", fees: "Fees & payment", design: "Design", emails: "Emails", settings: "Settings" } as const;
type Tab = keyof typeof TABS;

// Drop blank select/radio options left over from editing.
const cleanFields = (fields: Field[]) => fields.map((f) => (f.options ? { ...f, options: f.options.map((o) => o.trim()).filter(Boolean) } : f));
const clean = (c: EventConfig): EventConfig => ({
  ...c,
  sections: c.sections.map((s) => ({ ...s, fields: cleanFields(s.fields) })),
  attendees: { ...c.attendees, fields: cleanFields(c.attendees.fields) },
});

export default function EventEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isAdmin = useRole() === "admin";
  const [saved, setSaved] = useState<EventRow | null>(null);
  const [draft, setDraft] = useState<EventRow | null>(null);
  const [tab, setTab] = useState<Tab>("registrations");
  const [previewPage, setPreviewPage] = useState<"form" | "success">("form");
  const [hasRegs, setHasRegs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const db = browserDb();
    db.from("events").select("*").eq("id", id).maybeSingle<EventRow>().then(({ data }) => {
      if (!data) return router.replace("/admin");
      const row = { ...data, config: withDefaults(data.config) };
      setSaved(row);
      setDraft(row);
    });
    db.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", id).then(({ count }) => setHasRegs(!!count));
  }, [id, router]);

  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!draft || !saved) return <p className="p-10 text-center text-sm text-slate-500">Loading…</p>;

  const setConfig = (config: EventConfig) => setDraft({ ...draft, config });

  async function save() {
    setBusy(true);
    setMsg("");
    const row = { title: draft!.title.trim() || "Untitled event", slug: draft!.slug, is_published: draft!.is_published, is_open: draft!.is_open, config: clean(draft!.config) };
    const { data, error } = await browserDb().from("events").update(row).eq("id", id).select("*").maybeSingle<EventRow>();
    setBusy(false);
    if (error) return setMsg(error.code === "23505" ? "That link is already used by another event." : error.code === "23514" ? "Link can only use lowercase letters, numbers and dashes." : error.message);
    // No row back = the event was deleted (e.g. in another tab) or the session lost admin access.
    if (!data) return setMsg("This event no longer exists or you're signed out. Go back to All events.");
    // Refresh the public page cache (old link too, in case it was renamed) so visitors see the change now.
    const refreshed = await refreshPublicPage([saved!.slug, data.slug]);
    setSaved({ ...data, config: withDefaults(data.config) });
    setDraft({ ...data, config: withDefaults(data.config) });
    setMsg(refreshed ? "Saved ✓" : "Saved ✓ (the public page may take up to an hour to update)");
  }

  const refreshPublicPage = (slugs: string[]) =>
    authFetch("/api/revalidate", { method: "POST", body: JSON.stringify({ slugs }) }).then((r) => r.ok, () => false);

  async function remove() {
    const db = browserDb();
    const { error } = await db.from("events").delete().eq("id", id);
    if (error) return setMsg(error.message);
    // Best effort: tidy uploaded files (Supabase lists up to 1000 per call).
    for (const bucket of ["receipts", "assets"]) {
      const { data } = await db.storage.from(bucket).list(id, { limit: 1000 });
      if (data?.length) await db.storage.from(bucket).remove(data.map((f) => `${id}/${f.name}`));
    }
    await refreshPublicPage([saved!.slug]);
    router.replace("/admin");
  }

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/e/${saved.slug}` : "";
  const showPreview = tab === "form" || tab === "fees" || tab === "design";

  return (
    <main className="w-full flex-1 px-4 sm:px-6 py-6">
      {/* Pinned on larger screens only: on phones the wrapped tabs would cover a third of the screen. */}
      <div className="z-10 -mx-4 sm:sticky sm:top-0 sm:-mx-6 mb-4 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/95 px-4 sm:px-6 py-3 backdrop-blur">
        <div className="min-w-0">
          <Link href="/admin" className="text-xs text-slate-500 hover:underline">← All events</Link>
          <h1 className="truncate text-xl font-extrabold">{saved.title}</h1>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${saved.is_published ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{saved.is_published ? (saved.is_open ? "Live" : "Closed") : "Draft"}</span>
        {saved.is_published && <a href={publicUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Open form ↗</a>}
        <div className="ml-auto flex items-center gap-3">
          {msg && <span role="status" className={`text-sm ${msg.startsWith("Saved") ? "text-green-700" : "text-red-600"}`}>{msg}</span>}
          {isAdmin && dirty && <button onClick={() => { setDraft(saved); setMsg(""); }} className="text-sm text-slate-500 hover:text-slate-900">Discard</button>}
          {isAdmin && <button onClick={save} disabled={!dirty || busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40">{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>}
        </div>
        <nav className="flex w-full flex-wrap gap-1" aria-label="Event sections">
          {(Object.keys(TABS) as Tab[]).filter((t) => isAdmin || t === "registrations" || t === "checkin").map((t) => (
            <button key={t} onClick={() => setTab(t)} aria-current={tab === t} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-white shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900"}`}>{TABS[t]}</button>
          ))}
        </nav>
      </div>

      {tab === "registrations" && <Registrations event={saved} />}
      {tab === "checkin" && <CheckIn event={saved} />}

      {showPreview && (
        <div className="grid gap-6 xl:grid-cols-[460px_1fr] items-start">
          <div className="min-w-0">
            {tab === "form" && <FormBuilder config={draft.config} onChange={setConfig} hasRegistrations={hasRegs} />}
            {tab === "fees" && <FeesPayment eventId={id} config={draft.config} onChange={setConfig} />}
            {tab === "design" && <DesignEditor eventId={id} config={draft.config} onChange={setConfig} />}
          </div>
          <div className="min-w-0 xl:sticky xl:top-36">
            <div className="mb-2 flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live preview {dirty && "(unsaved)"}</p>
              <div className="ml-auto flex gap-1 text-xs" role="tablist" aria-label="Preview page">
                {(["form", "success"] as const).map((p) => (
                  <button key={p} type="button" role="tab" aria-selected={previewPage === p} onClick={() => setPreviewPage(p)}
                    className={`rounded-md px-2.5 py-1 font-medium ${previewPage === p ? "bg-white shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900"}`}>{p === "form" ? "Form" : "Success page"}</button>
                ))}
              </div>
            </div>
            <div className="pointer-events-auto max-h-[calc(100vh-11rem)] overflow-y-auto rounded-2xl border border-slate-300 shadow-sm">
              <EventShell event={draft} tab="form">
                {/* key remounts the form so switching pages resets its state */}
                <RegistrationForm key={previewPage} event={draft} preview
                  sampleDone={previewPage === "success" ? { ...sampleRegistration(draft.config, "received"), ref_code: "REG-SAMPLE", at: new Date().toLocaleString(), emailedTo: draft.config.emails.enabled ? "juan@example.com" : null } : undefined} />
              </EventShell>
            </div>
          </div>
        </div>
      )}

      {tab === "emails" && <EmailEditor title={draft.title} config={draft.config} onChange={setConfig} />}

      {tab === "settings" && (
        <div className="max-w-xl space-y-4">
          <Panel title="Event">
            <Text label="Event name" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
            <Text label="Link" value={draft.slug} onChange={(slug) => setDraft({ ...draft, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
            <p className="-mt-2 text-xs text-slate-500">Public form: {publicUrl.replace(saved.slug, draft.slug)}</p>
            <Toggle label="Published" checked={draft.is_published} onChange={(is_published) => setDraft({ ...draft, is_published })} hint="Draft events are only visible to admins." />
            <Toggle label="Accepting registrations" checked={draft.is_open} onChange={(is_open) => setDraft({ ...draft, is_open })} hint="Turn off to close the form; the status page keeps working." />
          </Panel>
          <Panel title="Danger zone">
            <ConfirmButton label="Delete event and all registrations" typeToConfirm="DELETE" onConfirm={remove}
              question={`This permanently deletes "${saved.title}", ALL its registrations and uploaded receipts. This cannot be undone.`} />
          </Panel>
        </div>
      )}
    </main>
  );
}
