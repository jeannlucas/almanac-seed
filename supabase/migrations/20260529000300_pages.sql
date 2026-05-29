create table public.pages (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  html text not null,
  version int not null default 1,
  created_at timestamptz not null default now()
);

create index pages_project_id_idx on public.pages (project_id);

alter table public.pages enable row level security;
