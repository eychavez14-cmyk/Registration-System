"use client";

import type { EventConfig, FeeItem } from "@/lib/types";
import { newId } from "@/lib/defaults";
import { btn, btnDanger, move, Panel, Text, Toggle } from "./ui";
import { FieldsEditor } from "./FormBuilder";

export function FeesPayment({ config, onChange }: { config: EventConfig; onChange: (c: EventConfig) => void }) {
  const { fees, payment } = config;
  const setFees = (patch: Partial<EventConfig["fees"]>) => onChange({ ...config, fees: { ...fees, ...patch } });
  const setAttendees = (patch: Partial<EventConfig["attendees"]>) => onChange({ ...config, attendees: { ...config.attendees, ...patch } });
  const setPayment = (patch: Partial<EventConfig["payment"]>) => onChange({ ...config, payment: { ...payment, ...patch } });
  const setItem = (i: number, patch: Partial<FeeItem>) => setFees({ items: fees.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

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
            <FieldsEditor fields={config.attendees.fields} onChange={(fields) => setAttendees({ fields })} />
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
            <Toggle label="Require proof of payment upload" checked={payment.requireProof} onChange={(requireProof) => setPayment({ requireProof })} hint="Only when the total is above zero. PNG, JPG or PDF up to 5MB." />
            <Text label="Upload note" value={payment.proofNote} onChange={(proofNote) => setPayment({ proofNote })} />
          </>
        )}
      </Panel>
    </div>
  );
}
