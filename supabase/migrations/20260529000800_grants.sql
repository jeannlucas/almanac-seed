-- Schema usage. Supabase grants this by default for new projects, but being
-- explicit avoids surprises on restored / cloned databases.
grant usage on schema public to anon, authenticated;

-- Owner-side CRUD. RLS policies (migration 000600) restrict rows; these grants
-- make the tables visible to the authenticated role in the first place.
grant select, insert, update, delete on table public.projects   to authenticated;
grant select, insert, update, delete on table public.pages      to authenticated;
grant select, insert, update, delete on table public.pins       to authenticated;
grant select, insert, update, delete on table public.comments   to authenticated;

-- profiles: authenticated reads display info of any user (full_name / avatar_url).
-- The existing profiles_select_self policy is replaced by a broader policy so
-- the owner can see who authored each pin/comment in the sidebar. Writes are
-- still controlled by the handle_new_user trigger only.
grant select on table public.profiles to authenticated;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

-- anon: no direct table grants. The /share/[token] flow goes through three
-- SECURITY DEFINER RPCs (get_project_by_share_token, add_pin_via_share_token,
-- add_comment_via_share_token) that were already granted EXECUTE in 000700
-- and run with the function owner's privileges.
