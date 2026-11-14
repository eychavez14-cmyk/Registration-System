-- Staff roles: 'admin' (everything) and 'moderator' (view registrations, confirm/reject, notes).
alter table public.admins add column if not exists role text not null default 'admin'
  check (role in ('admin', 'moderator'));

-- is_admin() now means full admin only; is_staff() = admin or moderator.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and role = 'admin')
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- Events: staff can see every event (drafts too); only admins can change them (existing "admins manage events").
drop policy if exists "public reads published events" on public.events;
create policy "public reads published events" on public.events
  for select using (is_published or public.is_staff());

-- Registrations: staff read and update; only admins delete.
drop policy if exists "admins manage registrations" on public.registrations;
drop policy if exists "staff read registrations" on public.registrations;
drop policy if exists "staff update registrations" on public.registrations;
drop policy if exists "admins delete registrations" on public.registrations;
create policy "staff read registrations" on public.registrations
  for select using (public.is_staff());
create policy "staff update registrations" on public.registrations
  for update using (public.is_staff()) with check (public.is_staff());
create policy "admins delete registrations" on public.registrations
  for delete using (public.is_admin());

-- From the browser, only the status and the note can ever be changed (answers, totals and receipts are locked).
revoke update on public.registrations from anon, authenticated;
grant update (status, admin_note) on public.registrations to authenticated;

-- Receipts: staff can view them.
drop policy if exists "admins read receipts" on storage.objects;
drop policy if exists "staff read receipts" on storage.objects;
create policy "staff read receipts" on storage.objects
  for select using (bucket_id = 'receipts' and public.is_staff());
