create table public.projects (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'archived', 'published')),
  share_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects (owner_id);

alter table public.projects enable row level security;
