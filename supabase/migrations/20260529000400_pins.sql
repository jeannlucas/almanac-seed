create table public.pins (
  id uuid primary key default extensions.gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  anchor jsonb not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index pins_page_id_idx on public.pins (page_id);

alter table public.pins enable row level security;
