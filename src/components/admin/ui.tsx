"use client";

import { useState, type ReactNode } from "react";

export const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
export const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50";
export const btnDanger = "rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50";

export function Text({ label, value, onChange, textarea, type = "text", placeholder }: { label: string; value: string | number; onChange: (v: string) => void; textarea?: boolean; type?: string; placeholder?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {textarea ? (
        <textarea rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={input} />
      ) : (
        <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={input} />
      )}
    </label>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function Panel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-bold">{title}</h3>
        <div className="ml-auto flex gap-2">{actions}</div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

// On-page confirmation: some browsers (incl. embedded ones) block window.confirm/prompt.
// Pass `typeToConfirm` to require typing a word before the final button enables.
export function ConfirmButton({ label, question, confirmLabel = "Yes, delete", onConfirm, typeToConfirm }: { label: string; question: string; confirmLabel?: string; onConfirm: () => void; typeToConfirm?: string }) {
  const [armed, setArmed] = useState(false);
  const [typed, setTyped] = useState("");
  if (!armed) return <button type="button" className={btnDanger} onClick={() => setArmed(true)}>{label}</button>;
  const ready = !typeToConfirm || typed === typeToConfirm;
  return (
    <div role="alertdialog" aria-label={question} className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800">
      <span className="flex-1 min-w-48">{question}</span>
      {typeToConfirm && (
        <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Type ${typeToConfirm}`} aria-label={`Type ${typeToConfirm} to confirm`} className="w-32 rounded-md border border-red-300 bg-white px-2 py-1" />
      )}
      <button type="button" disabled={!ready} onClick={() => { setArmed(false); setTyped(""); onConfirm(); }} className="rounded-md bg-red-600 px-3 py-1 font-bold text-white disabled:opacity-40">{confirmLabel}</button>
      <button type="button" autoFocus={!typeToConfirm} onClick={() => { setArmed(false); setTyped(""); }} className={btn}>Cancel</button>
    </div>
  );
}

export const move =<T,>(arr: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};
