create table public.comments (
  id uuid primary key default extensions.gen_random_uuid(),
  pin_id uuid not null references public.pins(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index comments_pin_id_idx on public.comments (pin_id);
create index comments_parent_id_idx on public.comments (parent_id);

alter table public.comments enable row level security;
