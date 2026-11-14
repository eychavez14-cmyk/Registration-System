-- Event-day check-in: { "<delegate index>": "<ISO time>", ... } ("main" when a registration has no delegate list).
alter table public.registrations add column if not exists checkin jsonb not null default '{}'::jsonb;

-- Staff (admins and moderators) may record check-ins from the browser, in addition to status and note.
grant update (checkin) on public.registrations to authenticated;
