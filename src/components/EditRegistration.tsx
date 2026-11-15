"use client";

import { useState } from "react";
import type { Answers, Attendee, EventConfig } from "@/lib/types";
import { attendeeSlots, validateSubmission } from "@/lib/validate";
import { FieldInput, inputClass } from "./RegistrationForm";
import { shrinkImage } from "@/lib/shrink";

// Registrant edits their own answers. Step 1 proves who they are; step 2 edits; changes wait for staff approval.
export function EditRegistration({ slug, code, config, onDone }: { slug: string; code: string; config: EventConfig; onDone: () => void }) {
  const [contact, setContact] = useState("");
  const [data, setData] = useState<{ answers: Answers; attendees: Attendee[]; fees: Record<string, number>; pending: boolean; hasReceipt: boolean; receiptUrl: string | null; pendingReceiptUrl: string | null } | null>(null);
  const [file, setFile] = useState<File | null>(null); // replacement proof of payment
  const [preparing, setPreparing] = useState(false);
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
      let receiptPath: string | undefined;
      if (file) {
        // Same path as the registration form: get a one-time upload link, send the file straight to storage.
        setBusy(true);
        const res = await fetch("/api/upload-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, type: file.type, size: file.size }) }).catch(() => null);
        const up = res ? await res.json() : { error: "Network error, please try again" };
        const { browserDb } = await import("@/lib/supabase/browser"); // only needed when a file is uploaded
        const sent = res?.ok && !(await browserDb().storage.from("receipts").uploadToSignedUrl(up.path, up.token, file, { contentType: file.type })).error;
        setBusy(false);
        if (!sent) return setMsg({ ok: false, text: res?.ok ? "Receipt upload failed, please try again." : up.error });
        receiptPath = up.path;
      }
      const r = await call({ action: "submit", answers: data.answers, attendees, receiptPath });
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
      {config.payment.enabled && (
        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Proof of payment</legend>
          <p className="mb-2 text-xs text-slate-600">{data.hasReceipt ? "We have your receipt on file. Upload a new one only if you need to replace it." : "No receipt on file yet. You can upload one here."}</p>
          {data.receiptUrl && <ReceiptPreview url={data.receiptUrl} label="Your receipt on file" />}
          {data.pendingReceiptUrl && <ReceiptPreview url={data.pendingReceiptUrl} label="New receipt waiting for approval" />}
          <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-300 p-3 text-center text-sm hover:bg-slate-50">
            <input type="file" accept="image/png,image/jpeg,application/pdf" className="sr-only" onChange={async (e) => {
              const picked = e.target.files?.[0];
              if (!picked) return;
              setPreparing(true);
              const f = await shrinkImage(picked);
              setPreparing(false);
              if (f.size > 5 * 1024 * 1024) return setMsg({ ok: false, text: "File must be 5MB or smaller" });
              setMsg(null);
              setFile(f);
            }} />
            <span className="font-semibold text-slate-700">{preparing ? "Preparing image…" : file ? `New receipt: ${file.name}` : data.hasReceipt ? "Replace receipt / screenshot" : "Upload receipt / screenshot"}</span>
            <span className="text-xs text-slate-400">PNG, JPG or PDF (Max 5MB)</span>
          </label>
          {file && <button type="button" onClick={() => setFile(null)} className="mt-1 text-xs text-slate-500 underline">Keep my current receipt instead</button>}
        </fieldset>
      )}
      {msg && !msg.ok && <p role="alert" className="text-sm text-red-600">{msg.text}</p>}
      <div className="flex gap-2">
        <button disabled={busy || preparing} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? "Sending…" : "Send update for approval"}</button>
        <button type="button" onClick={onDone} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}

// Thumbnail of an uploaded receipt (signed link from the server); PDFs open in a new tab.
function ReceiptPreview({ url, label }: { url: string; label: string }) {
  const isPdf = /\.pdf(\?|$)/i.test(url);
  return (
    <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <p className="mb-1 text-xs font-semibold text-slate-600">{label}</p>
      {isPdf ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[var(--primary)] underline">📄 Open PDF receipt</a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" title="Open full size">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="max-h-56 rounded-md border border-slate-200 bg-white object-contain" />
        </a>
      )}
      <p className="mt-1 text-[11px] text-slate-400">Tap to open full size. This link expires in 10 minutes.</p>
    </div>
  );
}
