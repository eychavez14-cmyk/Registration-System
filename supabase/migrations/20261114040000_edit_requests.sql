-- Registrant edits waiting for staff approval: { answers, attendees, submitted_at } or null.
-- Written and applied only by the server (service role), so no browser permissions are added.
alter table public.registrations add column if not exists pending_change jsonb;
