import type { EventConfig } from "./types";

export const FONTS = ["Inter", "Poppins", "Montserrat", "Roboto", "Lato", "Nunito", "Playfair Display"];

export const newId = () => Math.random().toString(36).slice(2, 10);

// Starting point for every new event; mirrors a typical church conference form.
export const defaultConfig = (): EventConfig => ({
  header: { subtitle: "November 21, 2026 • 8 AM - 4 PM", venue: "Venue name, City" },
  intro: { enabled: true, seconds: 3 },
  theme: {
    primary: "#2563eb",
    headerBg: "#0f172a",
    headerText: "#ffffff",
    pageBg: "#f1f5f9",
    font: "Inter",
    bannerUrl: "",
    overlayColor: "#000000",
    overlayOpacity: 35,
    logoUrls: [],
  },
  sections: [
    {
      id: newId(),
      title: "Church Information",
      fields: [
        { id: "church", label: "Church Name", type: "text", required: true, placeholder: "e.g. UPC Batangas City", half: true },
        { id: "pastor", label: "Name of Pastor", type: "text", required: true, placeholder: "e.g. Rev. John Doe", half: true },
      ],
    },
    {
      id: newId(),
      title: "Contact Information",
      fields: [
        { id: "first_name", label: "First Name", type: "text", required: true, placeholder: "Juan", half: true },
        { id: "last_name", label: "Last Name", type: "text", required: true, placeholder: "Dela Cruz", half: true },
        { id: "mobile", label: "Mobile Number", type: "tel", required: true, placeholder: "09123456789", half: true },
        { id: "email", label: "Email Address", type: "email", required: false, placeholder: "hello@example.com", half: true },
      ],
    },
  ],
  fees: {
    enabled: true,
    title: "Delegate Registration",
    currency: "₱",
    items: [
      { id: newId(), label: "Senior/PWD", price: 600 },
      { id: newId(), label: "Regular Delegate", price: 800 },
    ],
  },
  attendees: {
    enabled: true,
    title: "Delegate Details",
    fields: [{ id: "full_name", label: "Full name", type: "text", required: true, placeholder: "e.g. Juan Dela Cruz", half: true }],
  },
  payment: {
    enabled: true,
    instructions: "Please send your payment to the following G-Cash account, then upload your proof of payment below.",
    accountName: "Account Name",
    accountNumber: "09xxxxxxxxx",
    requireProof: true,
    proofNote: "Only ONE (1) file is accepted. Merge multiple receipts into a single image or PDF if needed.",
  },
  emails: {
    enabled: true,
    fromName: "", // blank = event name
    received: {
      subject: "Registration received – {event} ({ref})",
      heading: "Registration received",
      message: "Hi {name}, thank you for registering! We have received your registration and will verify your payment soon. Keep your registration number to check your status.",
    },
    confirmed: {
      subject: "Registration confirmed – {event} ({ref})",
      heading: "You're confirmed!",
      message: "Hi {name}, your registration has been confirmed. We look forward to seeing you!",
    },
    rejected: {
      subject: "Registration update – {event} ({ref})",
      heading: "Registration not confirmed",
      message: "Hi {name}, unfortunately we couldn't confirm your registration. Please see the note below or contact the organizers.",
    },
  },
  successMessage: "Thank you for registering! Your registration has been received.",
  successNextSteps: [
    "We'll review your payment and confirm your registration within 24–48 hours. You'll receive an email as soon as it's approved.",
    "Can't find our email? Please check your Spam or Promotions folder.",
    "You can also check your status anytime: copy your registration number above and paste it on the Registration Status page.",
  ].join("\n"),
  footer: "Registration System",
});

// Fills settings added in later versions so events saved earlier keep working.
export const withDefaults = (c: Partial<EventConfig>): EventConfig => {
  const d = defaultConfig();
  return {
    ...d, ...c,
    header: { ...d.header, ...c.header }, intro: { ...d.intro, ...c.intro }, theme: { ...d.theme, ...c.theme }, fees: { ...d.fees, ...c.fees, enabled: true }, // events are always paid; the on/off switch was removed
    attendees: { ...d.attendees, ...c.attendees }, payment: { ...d.payment, ...c.payment }, emails: {
      ...d.emails, ...c.emails,
      received: { ...d.emails.received, ...c.emails?.received },
      confirmed: { ...d.emails.confirmed, ...c.emails?.confirmed },
      rejected: { ...d.emails.rejected, ...c.emails?.rejected },
    },
  };
};
