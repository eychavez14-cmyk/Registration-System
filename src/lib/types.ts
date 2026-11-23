export const FIELD_TYPES = ["text", "email", "tel", "number", "textarea", "select", "radio", "checkbox", "date"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export type Field = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string[]; // select / radio
  half?: boolean; // half-width on desktop
  description?: string; // small help text under the question
  showIf?: Condition; // only shown (and only required) when an earlier dropdown/multiple-choice answer matches
};

// "This answer is one of these options"; points at a main-form dropdown/multiple-choice question.
export type Condition = { fieldId: string; values: string[] };

export type Section = { id: string; title: string; description?: string; fields: Field[] };

export type EmailText = { subject: string; heading: string; message: string; freeMessage?: string }; // freeMessage: used instead of message when the total is ₱0 (received email only)

// description: small text under the name on the form. priceRules: special prices by answer (first match wins).
export type FeeItem = { id: string; label: string; price: number; description?: string; priceRules?: { when: Condition; price: number }[] };

export type EventConfig = {
  header: { subtitle: string; venue: string };
  intro: { enabled: boolean; seconds: number }; // opening animation on the registration form
  theme: {
    primary: string;
    headerBg: string;
    headerText: string;
    pageBg: string;
    font: string;
    bannerUrl: string; // image, GIF or video (mp4/webm)
    overlayColor: string; // tint over the banner
    overlayOpacity: number; // 0-100
    bannerPosX: number; // 0-100: which part of the banner stays in view (like CSS background-position)
    bannerPosY: number;
    footerBg: string;
    footerText: string;
    logoUrls: string[];
  };
  sections: Section[];
  fees: { enabled: boolean; title: string; currency: string; items: FeeItem[] };
  // Per-person questions, repeated once per ticket bought (e.g. 2 Regular Delegates -> 2 boxes).
  attendees: { enabled: boolean; title: string; fields: Field[] };
  payment: {
    enabled: boolean;
    instructions: string;
    accountName: string;
    accountNumber: string;
    requireProof: boolean;
    proofNote: string;
    qrUrl: string; // optional payment QR image (e.g. GCash), downloadable on the form
  };
  // Emails to the registrant. Texts may use {event} {ref} {name} {total}.
  emails: { enabled: boolean; fromName: string; received: EmailText; confirmed: EmailText; rejected: EmailText };
  successMessage: string;
  successNextSteps: string; // "What happens next" box on the success screen
  successNextStepsFree: string; // same box for ₱0 registrations (empty = use successNextSteps)
  footer: string;
};

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  is_published: boolean;
  is_open: boolean;
  config: EventConfig;
  created_at: string;
};

export type Status = "pending" | "confirmed" | "rejected";

export type Answers = Record<string, string | boolean>;
export type Attendee = { item: string; answers: Answers }; // item = FeeItem id

export type Registration = {
  id: string;
  event_id: string;
  ref_code: string;
  answers: Answers;
  fees: Record<string, number>;
  attendees: Attendee[];
  checkin: Record<string, string>; // delegate index (or "main") -> check-in time
  total: number;
  receipt_path: string | null;
  status: Status;
  admin_note: string | null;
  created_at: string;
  // Registrant-submitted edit waiting for staff approval (null when none).
  pending_change: { answers: Answers; attendees: Attendee[]; receipt_path?: string; submitted_at: string } | null; // receipt_path: replacement proof of payment
};
