// QR codes hold the registration's status-page link, so a normal phone camera opens the status page
// and the check-in scanner pulls the registration number back out of it.
export const statusLink = (origin: string, slug: string, code: string) => `${origin}/e/${slug}/status?code=${code}`;

const CODE = /REG-[A-Z0-9]{6}/;
// Accepts a scanned link, a bare number, or a typed number in any case/with spaces.
export const extractCode = (text: string) => text.toUpperCase().replace(/\s+/g, "").match(CODE)?.[0] ?? null;

// Image URL for emails (Gmail blocks inline data images).
export const qrImageUrl = (origin: string, slug: string, code: string) => `${origin}/api/qr?slug=${encodeURIComponent(slug)}&code=${code}`;
