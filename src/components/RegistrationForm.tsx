"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Answers, Attendee, EventRow, Field } from "@/lib/types";
import { attendeeSlots, money, validateSubmission } from "@/lib/validate";
import { browserDb } from "@/lib/supabase/browser";
import { shrinkImage } from "@/lib/shrink";
import { registrationSummary } from "@/lib/summary";
import { summaryPng } from "@/lib/summaryImage";
import { QrCode } from "./QrCode";

export type Done = { ref_code: string; total: number; answers: Answers; fees: Record<string, number>; attendees: Attendee[]; at: string; emailedTo: string | null };
// sampleDone: admin preview of the success screen
type Props = { event: Pick<EventRow, "slug" | "title" | "config" | "is_open">; preview?: boolean; sampleDone?: Done };

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
      {title && (
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <span className="h-6 w-1.5 rounded-full bg-[var(--primary)]" />
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

// `name` must be unique per input: delegate boxes repeat the same fields.
export function FieldInput({ field, value, error, onChange, name = field.id }: { field: Field; value: string | boolean | undefined; error?: string; onChange: (v: string | boolean) => void; name?: string }) {
  const id = `f-${name}`;
  const label = (
    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
      {field.label} {field.required && <span className="text-red-500">*</span>}
    </span>
  );
  const desc = field.description?.trim() ? <span id={`${id}-desc`} className="mb-1.5 block whitespace-pre-line text-xs text-slate-500">{field.description}</span> : null;
  const str = typeof value === "string" ? value : "";
  const common = { id, name, required: field.required, "aria-invalid": !!error, "aria-describedby": desc ? `${id}-desc` : undefined, placeholder: field.placeholder, className: inputClass };
  let control: ReactNode;
  if (field.type === "checkbox")
    return (
      <div className={field.half ? "" : "@xl:col-span-2"}>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" id={id} checked={value === true} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
          <span>{field.label} {field.required && <span className="text-red-500">*</span>}</span>
        </label>
        {desc && <div className="ml-6 mt-1">{desc}</div>}
        {error &&<p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  else if (field.type === "textarea") control = <textarea {...common} rows={3} value={str} onChange={(e) => onChange(e.target.value)} />;
  else if (field.type === "select")
    control = (
      <select {...common} value={str} onChange={(e) => onChange(e.target.value)}>
        <option value="">{field.placeholder || "Select…"}</option>
        {(field.options ?? []).map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  else if (field.type === "radio")
    control = (
      <div role="radiogroup" className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
        {(field.options ?? []).map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm">
            <input type="radio" name={name} checked={str === o} onChange={() => onChange(o)} className="h-4 w-4 accent-[var(--primary)]" />
            {o}
          </label>
        ))}
      </div>
    );
  else control = <input {...common} type={field.type} value={str} onChange={(e) => onChange(e.target.value)} />;

  return (
    <div className={field.half ? "" : "@xl:col-span-2"}>
      {field.type === "radio" ? <div>{label}</div> : <label htmlFor={id}>{label}</label>}
      {desc}
      {control}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function RegistrationForm({ event, preview, sampleDone }: Props) {
  const { config } = event;
  const { fees: feeCfg, payment } = config;
  const [answers, setAnswers] = useState<Answers>({});
  const [att, setAtt] = useState<Record<string, Answers>>({}); // keyed "itemId:n", so lowering a quantity drops the last boxes
  const [qty, setQty] = useState<Record<string, number>>({});
  const [file, setFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<Done | null>(sampleDone ?? null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<"" | "yes" | "failed">("");

  const total = feeCfg.enabled ? feeCfg.items.reduce((s, i) => s + (qty[i.id] ?? 0) * i.price, 0) : 0;
  const count = feeCfg.enabled ? feeCfg.items.reduce((s, i) => s + (qty[i.id] ?? 0), 0) : 0;
  const slots = attendeeSlots(config, qty);
  const needsProof =payment.enabled && payment.requireProof && total > 0;
  const setQ = (id: string, n: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(500, Math.floor(n) || 0)) }));
  // The QR lives on another domain (Supabase), where a plain download link just opens it, so fetch it as a file first.
  const downloadPaymentQr = async () => {
    try {
      const blob = await fetch(payment.qrUrl).then((r) => (r.ok ? r.blob() : Promise.reject()));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `payment-qr.${blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch {
      window.open(payment.qrUrl, "_blank"); // fallback: open it so they can long-press to save
    }
  };

  if (!event.is_open && !preview)
    return <Card title="Registration closed"><p className="text-sm text-slate-600">Registration for this event is no longer accepting entries.</p></Card>;

  if (done) {
    const groups = registrationSummary(config, done);
    const statusPath = `/e/${event.slug}/status?code=${done.ref_code}`;
    const saveImage = async () => {
      setSaving(true);
      setMessage("");
      try {
        const blob = await summaryPng({ title: event.title, config, refCode: done.ref_code, date: done.at, groups, statusUrl: location.origin + statusPath });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${done.ref_code}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000); // some phones read the file after click() returns
      } catch {
        setMessage("Couldn't create the image. Please take a screenshot instead.");
      } finally {
        setSaving(false);
      }
    };
    const copyNumber = async () => {
      try {
        await navigator.clipboard.writeText(done.ref_code);
      } catch {
        // Messenger/Facebook in-app browsers often block the clipboard API; the old copy command still works there.
        const t = document.createElement("textarea");
        t.value = done.ref_code;
        document.body.appendChild(t);
        t.select();
        const ok = document.execCommand("copy");
        t.remove();
        if (!ok) return setCopied("failed");
      }
      setCopied("yes");
      setTimeout(() => setCopied(""), 2500);
    };
    const actionBtn = "flex-1 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60";
    return (
      <div className="mx-auto max-w-2xl">
        <Card title="Registration received">
          <p className="whitespace-pre-line text-sm text-slate-600">{config.successMessage}</p>
          <div className="my-5 rounded-xl bg-slate-50 p-4 text-center">
            <div className="mb-3 flex justify-center"><QrCode value={location.origin + statusPath} size={150} label={`QR code for ${done.ref_code}`} /></div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registration number</p>
            <p className="mt-1 select-all font-mono text-3xl font-bold tracking-widest text-[var(--primary)]">{done.ref_code}</p>
            <button type="button" onClick={copyNumber} className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 print:hidden">
              {copied === "yes" ? "✓ Copied!" : copied === "failed" ? "Couldn't copy: press and hold the number to copy it" : "📋 Copy registration number"}
            </button>
            <p className="mt-2 text-xs text-slate-500">Submitted {done.at} · Pending verification</p>
            <p className="mt-1 text-xs font-medium text-slate-600">Show this QR code (or your registration number) at check-in.</p>
            {done.emailedTo && <p className="mt-1 text-xs font-medium text-green-700">A copy was emailed to {done.emailedTo}</p>}
            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <button type="button" onClick={() => window.print()} className={`${actionBtn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>🖨 Print</button>
              <button type="button" onClick={saveImage} disabled={saving} className={`${actionBtn} bg-[var(--primary)] text-white hover:brightness-110`}>{saving ? "Creating image…" : "⬇ Save as image"}</button>
            </div>
            {message && <p role="alert" className="mt-2 text-sm text-red-700 print:hidden">{message}</p>}
          </div>
          {config.successNextSteps.trim() && (
            <div className="mb-6 rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/5 p-4">
              <p className="text-sm font-bold text-slate-800">What happens next</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                {config.successNextSteps.split("\n").filter((l) => l.trim()).map((l, i) => <li key={i}>{l}</li>)}
              </ul>
              <Link href={statusPath} className="mt-3 inline-block rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:brightness-110 print:hidden">🔎 Check registration status</Link>
            </div>
          )}
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.title} className="break-inside-avoid">
                <h3 className="border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{g.title}</h3>
                <dl className="mt-2 space-y-1 text-sm">
                  {g.rows.map(([label, value], i) => (
                    <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className={`break-words ${label === "Total" && g.title === "Payment" ? "font-extrabold text-[var(--primary)]" : "font-medium"}`}>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          {!config.successNextSteps.trim() && <Link href={statusPath} className="mt-4 inline-block text-sm font-semibold text-[var(--primary)] underline print:hidden">Check registration status</Link>}
        </Card>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview) return;
    setMessage("");
    const attendees = slots.map((s) => att[`${s.item.id}:${s.n}`] ?? {});
    const v = validateSubmission(config, answers, qty, attendees);
    if (needsProof && !file) v.errors.proof = "Please upload your proof of payment";
    setErrors(v.errors);
    if (Object.keys(v.errors).length) {
      setMessage("Please fix the highlighted fields.");
      document.querySelector("[aria-invalid=true], .field-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    try {
      let receiptPath: string | null = null;
      if (file && payment.enabled) {
        const res = await fetch("/api/upload-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: event.slug, type: file.type, size: file.size }) });
        const up = await res.json();
        if (!res.ok) throw new Error(up.error);
        const { error } = await browserDb().storage.from("receipts").uploadToSignedUrl(up.path, up.token, file, { contentType: file.type });
        if (error) throw new Error("Receipt upload failed, please try again");
        receiptPath = up.path;
      }
      const res = await fetch("/api/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: event.slug, answers, fees: qty, attendees, receiptPath }) });
      const out = await res.json();
      if (!res.ok) {
        setErrors(out.errors ?? {});
        throw new Error(out.error);
      }
      setDone({ ref_code: out.ref_code, total: out.total, answers: v.answers, fees: v.fees, attendees: v.attendees, at: new Date().toLocaleString(), emailedTo: out.emailedTo ?? null });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setMessage(err instanceof Error && err.message ? err.message : "Something went wrong, please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="@container"><form onSubmit={submit} noValidate className="grid gap-6 @4xl:grid-cols-[1fr_340px] items-start">
      <div className="space-y-6 min-w-0">
        {config.sections.map((s) => (
          <Card key={s.id} title={s.title}>
            {s.description?.trim() && <p className="-mt-2 mb-4 whitespace-pre-line text-sm text-slate-600">{s.description}</p>}
            <div className="grid gap-4 @xl:grid-cols-2">
              {s.fields.map((f) => (
                <FieldInput key={f.id} field={f} value={answers[f.id]} error={errors[f.id]} onChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))} />
              ))}
            </div>
          </Card>
        ))}
        {feeCfg.enabled && (
          <Card title={feeCfg.title}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2 font-semibold">Category</th>
                    <th className="py-2 px-2 font-semibold">Fee</th>
                    <th className="py-2 px-2 font-semibold text-center">Quantity</th>
                    <th className="py-2 pl-2 font-semibold text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {feeCfg.items.map((i) => (
                    <tr key={i.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-2">
                        <span className="font-medium">{i.label}</span>
                        {i.description?.trim() && <span className="mt-0.5 block whitespace-pre-line text-xs text-slate-500">{i.description}</span>}
                      </td>
                      <td className="py-3 px-2 text-slate-600">{money(feeCfg.currency, i.price)}</td>
                      <td className="py-3 px-2">
                        <div className="mx-auto flex w-fit items-center rounded-lg border border-slate-300">
                          <button type="button" aria-label={`Fewer ${i.label}`} onClick={() => setQ(i.id, (qty[i.id] ?? 0) - 1)} className="px-3 py-1.5 text-slate-500 hover:text-slate-900">−</button>
                          <input aria-label={`${i.label} quantity`} inputMode="numeric" value={qty[i.id] ?? 0} onChange={(e) => setQ(i.id, Number(e.target.value))} className="w-10 text-center outline-none" />
                          <button type="button" aria-label={`More ${i.label}`} onClick={() => setQ(i.id, (qty[i.id] ?? 0) + 1)} className="px-3 py-1.5 text-slate-500 hover:text-slate-900">+</button>
                        </div>
                      </td>
                      <td className="py-3 pl-2 text-right font-semibold">{money(feeCfg.currency, (qty[i.id] ?? 0) * i.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errors.fees && <p className="field-error mt-2 text-xs text-red-600">{errors.fees}</p>}
          </Card>
        )}
        {slots.length > 0 && (
          <Card title={config.attendees.title}>
            <div className="space-y-4">
              {slots.map(({ item, n }, i) => {
                const key = `${item.id}:${n}`;
                return (
                  <fieldset key={key} className="rounded-xl border border-slate-200 p-4">
                    <legend className="px-1 text-sm font-bold text-slate-700">{item.label} #{n}</legend>
                    <div className="grid gap-4 @xl:grid-cols-2">
                      {config.attendees.fields.map((f) => (
                        <FieldInput key={f.id} field={f} name={`att-${i}-${f.id}`} value={att[key]?.[f.id]} error={errors[`att:${i}:${f.id}`]}
                          onChange={(v) => setAtt((a) => ({ ...a, [key]: { ...a[key], [f.id]: v } }))} />
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      <aside className="space-y-4 @4xl:sticky @4xl:top-4">
        <Card>
          {feeCfg.enabled && (
            <>
              <h2 className="text-lg font-bold">Payment Summary</h2>
              <div className="mt-3 space-y-1 text-sm">
                {feeCfg.items.filter((i) => qty[i.id]).map((i) => (
                  <div key={i.id} className="flex justify-between text-slate-600"><span>{i.label} × {qty[i.id]}</span><span>{money(feeCfg.currency, qty[i.id] * i.price)}</span></div>
                ))}
                <div className="flex justify-between text-slate-600"><span>Total items ({count})</span><span>{money(feeCfg.currency, total)}</span></div>
              </div>
              <div className="mt-4 flex items-baseline justify-between border-t border-slate-200 pt-4">
                <span className="font-bold">Total Amount</span>
                <span className="text-2xl font-extrabold text-[var(--primary)]">{money(feeCfg.currency, total)}</span>
              </div>
            </>
          )}

          {payment.enabled && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">Payment Instructions</p>
              <p className="mt-2 whitespace-pre-line text-slate-600">{payment.instructions}</p>
              {(payment.accountName || payment.accountNumber) && (
                <dl className="mt-3 space-y-1 rounded-lg bg-white p-3">
                  <div className="flex justify-between gap-2"><dt className="text-xs text-slate-500">ACCOUNT NAME</dt><dd className="font-mono font-bold">{payment.accountName}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-xs text-slate-500">ACCOUNT NUMBER</dt><dd className="font-mono font-bold text-[var(--primary)]">{payment.accountNumber}</dd></div>
                </dl>
              )}
              {payment.qrUrl && (
                <div className="mt-3 flex flex-col items-center gap-2 rounded-lg bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={payment.qrUrl} alt="Payment QR code" className="h-44 w-44 object-contain" />
                  <button type="button" onClick={downloadPaymentQr} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">⬇ Download QR code</button>
                </div>
              )}
            </div>
          )}

          {payment.enabled && (payment.requireProof || total > 0) && (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Proof of Payment {needsProof && <span className="text-red-500">*</span>}</p>
              {payment.proofNote && <p className="mt-1 text-xs text-amber-700">⚠️ {payment.proofNote}</p>}
              <label className={`mt-2 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-4 text-center text-sm hover:bg-slate-50 ${errors.proof ? "field-error border-red-400" : "border-slate-300"}`}>
                <input type="file" accept="image/png,image/jpeg,application/pdf" className="sr-only" onChange={async (e) => {
                  const picked = e.target.files?.[0];
                  if (!picked) return;
                  setPreparing(true);
                  const f = await shrinkImage(picked); // size limit applies after shrinking, so big phone photos still fit
                  setPreparing(false);
                  if (f.size > 5 * 1024 * 1024) { setFile(null); setErrors((x) => ({ ...x, proof: "File must be 5MB or smaller" })); return; }
                  setErrors((x) => { const next = { ...x }; delete next.proof; return next; });
                  setFile(f);
                }} />
                <span className="font-semibold text-slate-700">{preparing ? "Preparing image…" : file ? file.name : "Click to upload Receipt / Screenshot"}</span>
                <span className="text-xs text-slate-400">PNG, JPG or PDF (Max 5MB)</span>
              </label>
              {errors.proof && <p className="mt-1 text-xs text-red-600">{errors.proof}</p>}
            </div>
          )}

          {message && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}
          <button disabled={busy || preview || preparing} className="mt-5 w-full rounded-xl bg-[var(--primary)] px-4 py-3 font-bold text-white shadow hover:brightness-110 disabled:opacity-60">
            {busy ? "Submitting…" : preview ? "Complete Registration (preview)" : "Complete Registration"}
          </button>
        </Card>
      </aside>
    </form></div>
  );
}
