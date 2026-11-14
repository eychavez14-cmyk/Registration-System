"use client";

import { FIELD_TYPES, type EventConfig, type Field, type Section } from "@/lib/types";
import { newId } from "@/lib/defaults";
import { btn, btnDanger, ConfirmButton, input, move, Panel, Text, Toggle } from "./ui";

const TYPE_LABEL: Record<Field["type"], string> = {
  text: "Short text", email: "Email", tel: "Phone", number: "Number", textarea: "Paragraph",
  select: "Dropdown", radio: "Multiple choice", checkbox: "Checkbox", date: "Date",
};

// Question list editor, used for form sections and for per-delegate questions.
export function FieldsEditor({ fields, onChange }: { fields: Field[]; onChange: (f: Field[]) => void }) {
  return (
    <>
      {fields.map((f, fi) => {
        const setField = (patch: Partial<Field>) => onChange(fields.map((x, j) => (j === fi ? { ...x, ...patch } : x)));
        const hasOptions = f.type === "select" || f.type === "radio";
        return (
          <div key={f.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
              <Text label="Question" value={f.label} onChange={(label) => setField({ label })} />
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Type</span>
                <select value={f.type} onChange={(e) => setField({ type: e.target.value as Field["type"], options: f.options ?? ["Option 1", "Option 2"] })} className={input}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </label>
            </div>
            {f.type !== "checkbox" && !hasOptions && <Text label="Placeholder" value={f.placeholder ?? ""} onChange={(placeholder) => setField({ placeholder })} />}
            {hasOptions && (
              <Text label="Options (one per line)" textarea value={(f.options ?? []).join("\n")}
                onChange={(v) => setField({ options: v.split("\n").map((o) => o.trimStart()).filter((o, i, a) => o || i === a.length - 1) })} />
            )}
            <div className="flex flex-wrap items-center gap-4">
              <Toggle label="Required" checked={f.required} onChange={(required) => setField({ required })} />
              <Toggle label="Half width" checked={!!f.half} onChange={(half) => setField({ half })} />
              <div className="ml-auto flex gap-2">
                <button type="button" className={btn} aria-label="Move field up" onClick={() => onChange(move(fields, fi, -1))}>↑</button>
                <button type="button" className={btn} aria-label="Move field down" onClick={() => onChange(move(fields, fi, 1))}>↓</button>
                <button type="button" className={btnDanger} onClick={() => onChange(fields.filter((_, j) => j !== fi))}>Remove</button>
              </div>
            </div>
          </div>
        );
      })}
      {/* Field ids are the keys answers are stored under, so they're fixed at creation. */}
      <button type="button" className={btn} onClick={() => onChange([...fields, { id: `field_${newId()}`, label: "New question", type: "text", required: false, half: true }])}>+ Add field</button>
    </>
  );
}

export function FormBuilder({ config, onChange, hasRegistrations }: { config: EventConfig; onChange: (c: EventConfig) => void; hasRegistrations: boolean }) {
  const setSections = (sections: Section[]) => onChange({ ...config, sections });
  const setSection = (i: number, s: Section) => setSections(config.sections.map((x, j) => (j === i ? s : x)));

  return (
    <div className="space-y-4">
      {config.sections.map((s, si) => (
        <Panel
          key={s.id}
          title={`Section ${si + 1}`}
          actions={
            <>
              <button type="button" className={btn} aria-label="Move section up" onClick={() => setSections(move(config.sections, si, -1))}>↑</button>
              <button type="button" className={btn} aria-label="Move section down" onClick={() => setSections(move(config.sections, si, 1))}>↓</button>
              <ConfirmButton label="Delete" onConfirm={() => setSections(config.sections.filter((_, j) => j !== si))}
                question={`Delete section "${s.title}" and its fields?${hasRegistrations ? " Answers already submitted stay in each registration's details but leave the CSV export." : ""} Takes effect when you save.`} />
            </>
          }
        >
          <Text label="Section title" value={s.title} onChange={(title) => setSection(si, { ...s, title })} />
          <FieldsEditor fields={s.fields} onChange={(fields) => setSection(si, { ...s, fields })} />
        </Panel>
      ))}
      <button type="button" className={btn} onClick={() => setSections([...config.sections, { id: newId(), title: "New section", fields: [] }])}>+ Add section</button>
    </div>
  );
}
