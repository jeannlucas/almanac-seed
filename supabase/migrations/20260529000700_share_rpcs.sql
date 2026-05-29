-- Server-side resolution of share_token without exposing tables to anon.
-- All three functions run as SECURITY DEFINER and validate the token.

create or replace function public.get_project_by_share_token(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'project', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'status', p.status,
      'share_token', p.share_token,
      'created_at', p.created_at
    ),
    'pages', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', pg.id,
            'project_id', pg.project_id,
            'html', pg.html,
            'version', pg.version,
            'created_at', pg.created_at
          )
          order by pg.created_at
        )
        from public.pages pg
        where pg.project_id = p.id
      ),
      '[]'::jsonb
    ),
    'pins', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', pn.id,
            'page_id', pn.page_id,
            'author_id', pn.author_id,
            'anchor', pn.anchor,
            'resolved', pn.resolved,
            'created_at', pn.created_at
          )
          order by pn.created_at
        )
        from public.pins pn
        join public.pages pg on pg.id = pn.page_id
        where pg.project_id = p.id
      ),
      '[]'::jsonb
    ),
    'comments', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'pin_id', c.pin_id,
            'author_id', c.author_id,
            'parent_id', c.parent_id,
            'body', c.body,
            'created_at', c.created_at,
            'edited_at', c.edited_at
          )
          order by c.created_at
        )
        from public.comments c
        join public.pins pn on pn.id = c.pin_id
        join public.pages pg on pg.id = pn.page_id
        where pg.project_id = p.id
          and c.deleted_at is null
      ),
      '[]'::jsonb
    ),
    'profiles', coalesce(
      (
        select jsonb_agg(distinct jsonb_build_object(
          'id', pr.id,
          'full_name', pr.full_name,
          'avatar_url', pr.avatar_url
        ))
        from public.profiles pr
        where pr.id in (
          select pn.author_id from public.pins pn
          join public.pages pg on pg.id = pn.page_id
          where pg.project_id = p.id and pn.author_id is not null
          union
          select c.author_id from public.comments c
          join public.pins pn on pn.id = c.pin_id
          join public.pages pg on pg.id = pn.page_id
          where pg.project_id = p.id and c.author_id is not null
        )
      ),
      '[]'::jsonb
    )
  )
  from public.projects p
  where p.share_token = p_token;
$$;

revoke all on function public.get_project_by_share_token(text) from public;
grant execute on function public.get_project_by_share_token(text) to anon, authenticated;

-- Insert a pin (+ first comment) by a logged-in user via share token.
create or replace function public.add_pin_via_share_token(
  p_token text,
  p_page_id uuid,
  p_anchor jsonb,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_pin_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'comment body required' using errcode = '22023';
  end if;

  select pg.project_id
    into v_project_id
    from public.pages pg
    join public.projects p on p.id = pg.project_id
   where pg.id = p_page_id
     and p.share_token = p_token;

  if v_project_id is null then
    raise exception 'invalid share token or page' using errcode = '42501';
  end if;

  insert into public.pins (page_id, author_id, anchor)
  values (p_page_id, v_uid, p_anchor)
  returning id into v_pin_id;

  insert into public.comments (pin_id, author_id, body)
  values (v_pin_id, v_uid, p_body);

  return v_pin_id;
end;
$$;

revoke all on function public.add_pin_via_share_token(text, uuid, jsonb, text) from public;
grant execute on function public.add_pin_via_share_token(text, uuid, jsonb, text) to authenticated;

-- Insert a comment on an existing pin via share token.
create or replace function public.add_comment_via_share_token(
  p_token text,
  p_pin_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match int;
  v_comment_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'comment body required' using errcode = '22023';
  end if;

  select 1
    into v_match
    from public.pins pn
    join public.pages pg on pg.id = pn.page_id
    join public.projects p on p.id = pg.project_id
   where pn.id = p_pin_id
     and p.share_token = p_token;

  if v_match is null then
    raise exception 'invalid share token or pin' using errcode = '42501';
  end if;

  insert into public.comments (pin_id, author_id, body)
  values (p_pin_id, v_uid, p_body)
  returning id into v_comment_id;

  return v_comment_id;
end;
$$;

revoke all on function public.add_comment_via_share_token(text, uuid, text) from public;
grant execute on function public.add_comment_via_share_token(text, uuid, text) to authenticated;
