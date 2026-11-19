"use client";

import { useState } from "react";
import type { EventConfig, FeeItem } from "@/lib/types";
import { uploadAsset } from "@/lib/upload";
import { newId } from "@/lib/defaults";
import { btn, btnDanger, move, Panel, Text, Toggle } from "./ui";
import { ConditionEditor, FieldsEditor } from "./FormBuilder";
import { ruleSources } from "@/lib/rules";

export function FeesPayment({ eventId, config, onChange }: { eventId: string; config: EventConfig; onChange: (c: EventConfig) => void }) {
  const [uploading, setUploading] = useState(false);
  const [qrError, setQrError] = useState("");
  const { fees, payment } = config;
  const setFees = (patch: Partial<EventConfig["fees"]>) => onChange({ ...config, fees: { ...fees, ...patch } });
  const setAttendees = (patch: Partial<EventConfig["attendees"]>) => onChange({ ...config, attendees: { ...config.attendees, ...patch } });
  const setPayment = (patch: Partial<EventConfig["payment"]>) => onChange({ ...config, payment: { ...payment, ...patch } });
  const setItem = (i: number, patch: Partial<FeeItem>) => setFees({ items: fees.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const sources = ruleSources(config.sections.flatMap((s) => s.fields)); // questions a special price / delegate question can depend on

  return (
    <div className="space-y-4">
      <Panel title="Fees / tickets">
        <Text label="Table title" value={fees.title} onChange={(title) => setFees({ title })} />
        {fees.items.map((item, i) => (
          <div key={item.id} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="min-w-40 flex-1"><Text label="Category" value={item.label} onChange={(label) => setItem(i, { label })} /></div>
            <div className="w-28"><Text label="Price" type="number" value={item.price} onChange={(v) => setItem(i, { price: Math.max(0, Number(v) || 0) })} /></div>
            <button type="button" className={btn} aria-label="Move up" onClick={() => setFees({ items: move(fees.items, i, -1) })}>↑</button>
            <button type="button" className={btn} aria-label="Move down" onClick={() => setFees({ items: move(fees.items, i, 1) })}>↓</button>
            <button type="button" className={btnDanger} onClick={() => setFees({ items: fees.items.filter((_, j) => j !== i) })}>Remove</button>
            <div className="w-full"><Text label="Description (optional, shown under the category name)" value={item.description ?? ""} onChange={(description) => setItem(i, { description })} /></div>
            <div className="w-full space-y-2">
              <p className="text-sm font-medium text-slate-700">Special prices <span className="font-normal text-slate-500">(e.g. Section 1 → 0 makes <b>this category</b> free for them; other categories keep their own prices)</span></p>
              {(item.priceRules ?? []).map((r, ri) => {
                const rules = item.priceRules ?? [];
                const setRule = (patch: Partial<typeof r>) => setItem(i, { priceRules: rules.map((x, k) => (k === ri ? { ...x, ...patch } : x)) });
                return (
                  <div key={ri} className="flex flex-wrap items-start gap-2 rounded-lg border border-slate-200 bg-white p-2">
                    <div className="min-w-48 flex-1"><ConditionEditor label="When the answer to" sources={sources} value={r.when} onChange={(when) => when && setRule({ when })} /></div>
                    <div className="w-28"><Text label="Price" type="number" value={r.price} onChange={(v) => setRule({ price: Math.max(0, Number(v) || 0) })} /></div>
                    <button type="button" className={`${btnDanger} mt-6`} onClick={() => setItem(i, { priceRules: rules.filter((_, k) => k !== ri) })}>Remove</button>
                  </div>
                );
              })}
              {sources.length ? (
                <button type="button" className={btn} onClick={() => setItem(i, { priceRules: [...(item.priceRules ?? []), { when: { fieldId: sources[0].id, values: [] }, price: 0 }] })}>+ Add special price</button>
              ) : (
                <p className="text-xs text-slate-500">To set special prices, first add a Dropdown or Multiple choice question (e.g. Section) in Form fields.</p>
              )}
            </div>
          </div>
        ))}
        <button type="button" className={btn} onClick={() => setFees({ items: [...fees.items, { id: newId(), label: "New category", price: 0 }] })}>+ Add category</button>
      </Panel>

      <Panel title="Delegate details">
        <Toggle label="Ask details for each delegate" checked={config.attendees.enabled} onChange={(enabled) => setAttendees({ enabled })}
          hint="One box per ticket: 2 Regular Delegates shows 2 boxes. Shown under the fee table." />
        {config.attendees.enabled && (
          <>
            <Text label="Section title" value={config.attendees.title} onChange={(title) => setAttendees({ title })} />
            <FieldsEditor fields={config.attendees.fields} onChange={(fields) => setAttendees({ fields })} sourcesFor={() => sources} />
          </>
        )}
      </Panel>

      <Panel title="Payment">
        <Toggle label="Show payment instructions" checked={payment.enabled} onChange={(enabled) => setPayment({ enabled })} />
        {payment.enabled && (
          <>
            <Text label="Instructions" textarea value={payment.instructions} onChange={(instructions) => setPayment({ instructions })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label="Account name" value={payment.accountName} onChange={(accountName) => setPayment({ accountName })} />
              <Text label="Account number" value={payment.accountNumber} onChange={(accountNumber) => setPayment({ accountNumber })} />
            </div>
            <div className="text-sm">
              <p className="mb-1 font-medium text-slate-700">Payment QR code (optional)</p>
              <p className="mb-2 text-xs text-slate-500">Upload your GCash/bank QR image. Registrants see it on the form with a <b>Download QR code</b> button.</p>
              {payment.qrUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={payment.qrUrl} alt="Payment QR code" className="mb-2 h-40 w-40 rounded-lg border border-slate-200 bg-white object-contain p-1" />
              )}
              <div className="flex gap-2">
                <label className={`${btn} cursor-pointer`}>
                  {uploading ? "Uploading…" : payment.qrUrl ? "Replace QR image" : "Upload QR image"}
                  <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setUploading(true);
                    setQrError("");
                    const r = await uploadAsset(eventId, file);
                    setUploading(false);
                    if ("error" in r) setQrError(r.error);
                    else setPayment({ qrUrl: r.url });
                  }} />
                </label>
                {payment.qrUrl && <button type="button" className={btnDanger} onClick={() => setPayment({ qrUrl: "" })}>Remove</button>}
              </div>
              {qrError && <p role="alert" className="mt-1 text-sm text-red-600">{qrError}</p>}
            </div>
            <Toggle label="Require proof of payment upload" checked={payment.requireProof} onChange={(requireProof) => setPayment({ requireProof })} hint="Only when the total is above zero. PNG, JPG or PDF up to 5MB." />
            <Text label="Upload note" value={payment.proofNote} onChange={(proofNote) => setPayment({ proofNote })} />
          </>
        )}
      </Panel>
    </div>
  );
}
