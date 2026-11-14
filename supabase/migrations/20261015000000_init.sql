-- Events: each has its own slug, form fields, fees, payment info and theme (all in `config`).
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  is_published boolean not null default false,
  is_open boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  ref_code text not null unique,
  answers jsonb not null default '{}'::jsonb,
  fees jsonb not null default '{}'::jsonb,
  total numeric(12,2) not null default 0,
  receipt_path text,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  admin_note text,
  created_at timestamptz not null default now()
);
create index registrations_event_id_idx on public.registrations(event_id, created_at desc);

-- Only users listed here can use the admin side (a signed-up user is not an admin by default).
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.admins enable row level security;

create policy "public reads published events" on public.events
  for select using (is_published or public.is_admin());
create policy "admins manage events" on public.events
  for all using (public.is_admin()) with check (public.is_admin());

-- Public submissions and status lookups go through the server (service role), never straight from the browser.
create policy "admins manage registrations" on public.registrations
  for all using (public.is_admin()) with check (public.is_admin());

create policy "users see own admin row" on public.admins
  for select using (user_id = auth.uid());

-- Storage: public bucket for logos/banners, private bucket for payment receipts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('assets', 'assets', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml']),
  ('receipts', 'receipts', false, 5242880, array['image/png','image/jpeg','application/pdf']);

create policy "admins upload assets" on storage.objects
  for insert with check (bucket_id = 'assets' and public.is_admin());
create policy "admins change assets" on storage.objects
  for update using (bucket_id = 'assets' and public.is_admin());
create policy "admins delete assets" on storage.objects
  for delete using (bucket_id = 'assets' and public.is_admin());
create policy "admins read receipts" on storage.objects
  for select using (bucket_id = 'receipts' and public.is_admin());
create policy "admins delete receipts" on storage.objects
  for delete using (bucket_id = 'receipts' and public.is_admin());
