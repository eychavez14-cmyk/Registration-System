"use client";

import { useEffect, useState } from "react";
import { Card, inputClass } from "./RegistrationForm";
import { money } from "@/lib/validate";
import { statusLink } from "@/lib/qr";
import { QrCode } from "./QrCode";
import { EditRegistration } from "./EditRegistration";
import type { EventConfig } from "@/lib/types";

type Result = { ref_code: string; status: "pending" | "confirmed" | "rejected"; total: number; created_at: string; note: string | null; name: string; editPending?: boolean };

export const STATUS_STYLE = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export function StatusLookup({ slug, currency, initialCode, config }: { slug: string; currency: string; initialCode: string; config: EventConfig }) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookup(c: string) {
    const res = await fetch(`/api/status?slug=${encodeURIComponent(slug)}&code=${encodeURIComponent(c)}`).catch(() => null);
    const out = res ? await res.json() : { error: "Network error, please try again" };
    return res?.ok ? { result: out as Result, error: "" } : { result: null, error: out.error as string };
  }
  const show = (r: { result: Result | null; error: string }) => {
    setResult(r.result);
    setError(r.error);
    setBusy(false);
  };

  async function search() {
    setBusy(true);
    show(await lookup(code));
  }

  useEffect(() => {
    if (initialCode) lookup(initialCode).then(show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-lg">
      <Card title="Check Registration Status">
        <form onSubmit={(e) => { e.preventDefault(); search(); }} className="flex gap-2">
          <label htmlFor="code" className="sr-only">Registration number</label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste your registration number, e.g. REG-AB12CD" className={`${inputClass} font-mono uppercase`} />
          <button disabled={busy} className="rounded-lg bg-[var(--primary)] px-4 text-sm font-bold text-white disabled:opacity-60">{busy ? "…" : "Search"}</button>
        </form>
        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        {result && result.status !== "rejected" && (
          <div className="mt-5 flex flex-col items-center gap-1 text-center">
            <QrCode value={statusLink(location.origin, slug, result.ref_code)} size={170} label={`QR code for ${result.ref_code}`} />
            <p className="text-xs font-medium text-slate-600">Show this QR code at check-in</p>
          </div>
        )}
        {result && (
          <dl className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Registration number</dt><dd className="font-mono font-bold">{result.ref_code}</dd></div>
            {result.name && <div className="flex justify-between"><dt className="text-slate-500">Name</dt><dd>{result.name}</dd></div>}
            <div className="flex justify-between"><dt className="text-slate-500">Submitted</dt><dd>{new Date(result.created_at).toLocaleString()}</dd></div>
            {result.total > 0 && <div className="flex justify-between"><dt className="text-slate-500">Total</dt><dd>{money(currency, Number(result.total))}</dd></div>}
            <div className="flex justify-between items-center"><dt className="text-slate-500">Status</dt><dd className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase ${STATUS_STYLE[result.status]}`}>{result.status}</dd></div>
            {result.note && <p className="border-t border-slate-200 pt-2 text-slate-600">{result.note}</p>}
          </dl>
        )}
        {result?.editPending && !editing && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">✏️ Your requested changes are waiting for the organizers&apos; approval.</p>}
        {result && (editing
          ? <EditRegistration slug={slug} code={result.ref_code} config={config} onDone={() => { setEditing(false); lookup(result.ref_code).then(show); }} />
          : <button type="button" onClick={() => setEditing(true)} className="mt-4 text-sm font-semibold text-[var(--primary)] underline">✏️ Edit my registration</button>)}
      </Card>
    </div>
  );
}
