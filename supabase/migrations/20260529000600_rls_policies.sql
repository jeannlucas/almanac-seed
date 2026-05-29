-- projects: owner-only access; public reads go through share RPC, not RLS.

create policy projects_select_owner
  on public.projects for select
  using (owner_id = auth.uid());

create policy projects_insert_owner
  on public.projects for insert
  with check (owner_id = auth.uid());

create policy projects_update_owner
  on public.projects for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy projects_delete_owner
  on public.projects for delete
  using (owner_id = auth.uid());

-- pages: tied to the project's owner. Public share reads go through RPC.

create policy pages_select_owner
  on public.pages for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = pages.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy pages_insert_owner
  on public.pages for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = pages.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy pages_update_owner
  on public.pages for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = pages.project_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = pages.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy pages_delete_owner
  on public.pages for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = pages.project_id
        and p.owner_id = auth.uid()
    )
  );

-- pins: author_id is nullable (set null on user delete). Predicates that
-- compare author_id to auth.uid() therefore must guard with `is not null`.

create policy pins_select_owner
  on public.pins for select
  using (
    exists (
      select 1
      from public.pages pg
      join public.projects p on p.id = pg.project_id
      where pg.id = pins.page_id
        and p.owner_id = auth.uid()
    )
  );

create policy pins_insert_owner
  on public.pins for insert
  with check (
    author_id is not null
    and author_id = auth.uid()
    and exists (
      select 1
      from public.pages pg
      join public.projects p on p.id = pg.project_id
      where pg.id = pins.page_id
        and p.owner_id = auth.uid()
    )
  );

create policy pins_update_author_or_owner
  on public.pins for update
  using (
    (author_id is not null and author_id = auth.uid())
    or exists (
      select 1
      from public.pages pg
      join public.projects p on p.id = pg.project_id
      where pg.id = pins.page_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    (author_id is not null and author_id = auth.uid())
    or exists (
      select 1
      from public.pages pg
      join public.projects p on p.id = pg.project_id
      where pg.id = pins.page_id
        and p.owner_id = auth.uid()
    )
  );

create policy pins_delete_author
  on public.pins for delete
  using (author_id is not null and author_id = auth.uid());

-- comments: same shape as pins.

create policy comments_select_owner
  on public.comments for select
  using (
    exists (
      select 1
      from public.pins pn
      join public.pages pg on pg.id = pn.page_id
      join public.projects p on p.id = pg.project_id
      where pn.id = comments.pin_id
        and p.owner_id = auth.uid()
    )
  );

create policy comments_insert_owner
  on public.comments for insert
  with check (
    author_id is not null
    and author_id = auth.uid()
    and exists (
      select 1
      from public.pins pn
      join public.pages pg on pg.id = pn.page_id
      join public.projects p on p.id = pg.project_id
      where pn.id = comments.pin_id
        and p.owner_id = auth.uid()
    )
  );

create policy comments_update_author
  on public.comments for update
  using (author_id is not null and author_id = auth.uid())
  with check (author_id is not null and author_id = auth.uid());

create policy comments_delete_author
  on public.comments for delete
  using (author_id is not null and author_id = auth.uid());
