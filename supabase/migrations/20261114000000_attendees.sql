-- Per-delegate answers: [{ "item": "<fee item id>", "answers": { "<field id>": "..." } }, ...]
alter table public.registrations add column if not exists attendees jsonb not null default '[]'::jsonb;
