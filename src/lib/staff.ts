export type Role = "admin" | "moderator";

// Supabase logins need an email, so a plain username is stored as username@staff.local (never emailed).
export const USERNAME_DOMAIN = "staff.local";
export const toLoginEmail = (id: string) => (id.includes("@") ? id.trim().toLowerCase() : `${id.trim().toLowerCase()}@${USERNAME_DOMAIN}`);
export const displayLogin = (email: string) => email.replace(`@${USERNAME_DOMAIN}`, "");
export const validLogin = (id: string) => (id.includes("@") ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id) : /^[a-z0-9._-]{3,30}$/i.test(id));
