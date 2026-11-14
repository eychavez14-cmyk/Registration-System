import type { EventConfig } from "./types";
import type { EmailKind } from "./email";

// Fake registration built from this event's own questions, so the preview matches the real thing.
export function sampleRegistration(config: EventConfig, kind: EmailKind) {
  const answers: Record<string, string> = { first_name: "Juan", last_name: "Dela Cruz" };
  for (const f of config.sections.flatMap((s) => s.fields)) {
    if (answers[f.id] || f.type === "checkbox") continue;
    answers[f.id] = f.options?.[0] ?? (f.type === "email" ? "juan@example.com" : f.placeholder?.replace(/^e\.g\.\s*/i, "") || "Sample answer");
  }
  const item = config.fees.enabled ? config.fees.items[0] : undefined;
  const attendee = Object.fromEntries(config.attendees.fields.map((f) => [f.id, f.options?.[0] ?? f.placeholder?.replace(/^e\.g\.\s*/i, "") ?? "Sample"]));
  return {
    ref_code: "REG-SAMPLE",
    answers,
    fees: item ? { [item.id]: 1 } : {},
    attendees: item && config.attendees.enabled ? [{ item: item.id, answers: attendee }] : [],
    total: item?.price ?? 0,
    admin_note: kind === "confirmed" ? "Payment verified. See you there!" : kind === "rejected" ? "We couldn't read your receipt. Please register again with a clearer photo." : null,
  };
}
