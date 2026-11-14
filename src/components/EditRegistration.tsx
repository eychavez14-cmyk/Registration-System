"use client";

import { useState } from "react";
import type { Answers, Attendee, EventConfig } from "@/lib/types";
import { attendeeSlots, validateSubmission } from "@/lib/validate";
import { FieldInput, inputClass } from "./RegistrationForm";

// Registrant edits their own answers. Step 1 proves who they are; step 2 edits; changes wait for staff approval.
export function EditRegistration({ slug, code, config, onDone }: { slug: string; code: string; config: EventConfig; onDone: () => void }) {
  const [contact, setContact] = useState("");
  const [data, setData] = useState<{ answers: Answers; attendees: Attendee[]; fees: Record<string, number>; pending: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (body: object) => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/edit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, code, contact, ...body }) }).catch(() => null);
    const out = res ? await res.json() : { error: "Network error, please try again" };
    setBusy(false);
    return { ok: !!res?.ok, out };
  };

  if (!data)
    return (
      <form className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4" onSubmit={async (e) => {
        e.preventDefault();
        const r = await call({ action: "open" });
        if (r.ok) setData(r.out); else setMsg({ ok: false, text: r.out.error });
      }}>
        <p className="text-sm font-semibold">Edit my registration</p>
        <p className="text-xs text-slate-500">To protect your details, enter the email address or mobile number you registered with.</p>
        <input value={contact} onChange={(e) => setContact(e.target.value)} required placeholder="Email or mobile number" aria-label="Email or mobile number" className={inputClass} autoComplete="email" />
        {msg && <p role="alert" className="text-sm text-red-600">{msg.text}</p>}
        <div className="flex gap-2">
          <button disabled={busy} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? "Checking…" : "Continue"}</button>
          <button type="button" onClick={onDone} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
        </div>
      </form>
    );

  if (msg?.ok)
    return (
      <div className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">
        <p className="font-semibold">✓ Your update was sent.</p>
        <p>The organizers will review it. Your changes appear once they approve them.</p>
        <button type="button" onClick={onDone} className="mt-2 underline">Close</button>
      </div>
    );

  const slots = attendeeSlots(config, data.fees);
  const setAns = (id: string, v: string | boolean) => setData({ ...data, answers: { ...data.answers, [id]: v } });
  const setAtt = (i: number, id: string, v: string | boolean) =>
    setData({ ...data, attendees: data.attendees.map((a, j) => (j === i ? { ...a, answers: { ...a.answers, [id]: v } } : a)) });

  return (
    <form noValidate className="mt-4 space-y-5 rounded-xl border border-slate-200 p-4" onSubmit={async (e) => {
      e.preventDefault();
      const attendees = slots.map((_, i) => data.attendees[i]?.answers ?? {});
      const v = validateSubmission(config, data.answers, data.fees, attendees);
      setErrors(v.errors);
      if (Object.keys(v.errors).length) return setMsg({ ok: false, text: "Please fix the highlighted fields." });
      const r = await call({ action: "submit", answers: data.answers, attendees });
      if (r.ok) setMsg({ ok: true, text: "" });
      else { setErrors(r.out.errors ?? {}); setMsg({ ok: false, text: r.out.error }); }
    }}>
      <div>
        <p className="text-sm font-semibold">Edit my registration</p>
        <p className="text-xs text-slate-500">Changes are reviewed by the organizers before they take effect. To change the number of delegates or the amount paid, please contact the organizers.</p>
        {data.pending && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">You already have an update waiting for approval. Sending again replaces it.</p>}
      </div>
      {config.sections.map((s) => (
        <fieldset key={s.id}>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{s.title}</legend>
          <div className="grid gap-3">
            {s.fields.map((f) => <FieldInput key={f.id} field={f} name={`edit-${f.id}`} value={data.answers[f.id]} error={errors[f.id]} onChange={(v) => setAns(f.id, v)} />)}
          </div>
        </fieldset>
      ))}
      {slots.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{config.attendees.title}</legend>
          <div className="space-y-3">
            {slots.map(({ item, n }, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-sm font-bold">{item.label} #{n}</p>
                <div className="grid gap-3">
                  {config.attendees.fields.map((f) => (
                    <FieldInput key={f.id} field={f} name={`edit-att-${i}-${f.id}`} value={data.attendees[i]?.answers[f.id]} error={errors[`att:${i}:${f.id}`]} onChange={(v) => setAtt(i, f.id, v)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      )}
      {msg && !msg.ok && <p role="alert" className="text-sm text-red-600">{msg.text}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? "Sending…" : "Send update for approval"}</button>
        <button type="button" onClick={onDone} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}
