"use client";

import { useState } from "react";
import type { EventConfig, EmailText } from "@/lib/types";
import { buildEmail, fromName, PLACEHOLDERS, type EmailKind } from "@/lib/email";
import { Panel, Text, Toggle } from "./ui";
import { sampleRegistration } from "@/lib/sample";

const KINDS: { kind: EmailKind; label: string; when: string }[] = [
  { kind: "received", label: "Received", when: "Sent right after someone registers." },
  { kind: "confirmed", label: "Confirmed", when: "Sent when you click Confirm on a registration." },
  { kind: "rejected", label: "Rejected", when: "Sent when you click Reject on a registration." },
];

export function EmailEditor({ title, config, onChange }: { title: string; config: EventConfig; onChange: (c: EventConfig) => void }) {
  const [kind, setKind] = useState<EmailKind>("received");
  const emails = config.emails;
  const set = (patch: Partial<EventConfig["emails"]>) => onChange({ ...config, emails: { ...emails, ...patch } });
  const setText = (k: EmailKind, patch: Partial<EmailText>) => set({ [k]: { ...emails[k], ...patch } });
  const emailField = config.sections.flatMap((s) => s.fields).find((f) => f.type === "email");
  const preview = buildEmail({ kind, title, config, reg: sampleRegistration(config, kind), statusUrl: "#", qrUrl: "/api/qr?slug=sample&code=REG-SAMPLE" });

  return (
    <div className="grid gap-6 xl:grid-cols-[460px_1fr] items-start">
      <div className="min-w-0 space-y-4">
        <Panel title="Sending">
          <Toggle label="Email registrants" checked={emails.enabled} onChange={(enabled) => set({ enabled })}
            hint="When they register, and when you confirm or reject them (you can untick it per registration)." />
          {emails.enabled && !emailField && <p className="text-sm text-amber-700">⚠️ Your form has no Email question, so no emails can be sent. Add one in Form fields.</p>}
          {emails.enabled && emailField && (
            <p className="text-sm text-slate-600">Emails go to the answer of <b>{emailField.label}</b>.{!emailField.required && <span className="text-amber-700"> It&apos;s optional, so some registrants may not get emails. Tick Required in Form fields to fix that.</span>}</p>
          )}
          <Text label="From name (what registrants see as the sender)" value={emails.fromName} placeholder={title} onChange={(fromName) => set({ fromName })} />
          <p className="-mt-2 text-xs text-slate-500">Leave blank to use the event name. The address is always your Gmail account.</p>
        </Panel>

        <div className="flex gap-1" role="tablist" aria-label="Which email">
          {KINDS.map((k) => (
            <button key={k.kind} type="button" role="tab" aria-selected={kind === k.kind} onClick={() => setKind(k.kind)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${kind === k.kind ? "bg-white shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900"}`}>{k.label}</button>
          ))}
        </div>
        <Panel title={`${KINDS.find((k) => k.kind === kind)!.label} email`}>
          <p className="-mt-1 text-xs text-slate-500">{KINDS.find((k) => k.kind === kind)!.when}</p>
          <Text label="Subject" value={emails[kind].subject} onChange={(subject) => setText(kind, { subject })} />
          <Text label="Heading" value={emails[kind].heading} onChange={(heading) => setText(kind, { heading })} />
          <Text label="Message" textarea value={emails[kind].message} onChange={(message) => setText(kind, { message })} />
          <p className="text-xs text-slate-500">
            You can type {PLACEHOLDERS.map((p, i) => <span key={p}>{i > 0 && ", "}<code className="rounded bg-slate-100 px-1">{p}</code></span>)}: they become the event name, registration number, registrant&apos;s name and total.
            {kind !== "received" && " Your note on the registration is added below the message."} The registration details and a status button are always included.
          </p>
        </Panel>
      </div>

      <div className="min-w-0 xl:sticky xl:top-36">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Live preview (sample registration)</p>
        <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
          <dl className="border-b border-slate-200 px-4 py-3 text-sm">
            <div className="flex gap-2"><dt className="w-16 shrink-0 text-slate-500">From</dt><dd className="font-medium">{fromName({ title, config })} &lt;your Gmail&gt;</dd></div>
            <div className="flex gap-2"><dt className="w-16 shrink-0 text-slate-500">Subject</dt><dd className="font-semibold break-words">{preview.subject}</dd></div>
          </dl>
          {/* sandbox: preview HTML runs no scripts and can't navigate the admin page */}
          <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="h-[calc(100vh-16rem)] min-h-96 w-full" />
        </div>
      </div>
    </div>
  );
}
