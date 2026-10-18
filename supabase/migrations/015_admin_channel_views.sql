-- 015_admin_channel_views.sql
-- Views per channel for the admin dashboard (/admin/dashboard).
--
-- public.page_views is insert-only for visitors and has no read policy, so the dashboard reads it
-- through these functions. Each one runs with the owner's rights but refuses anyone who is not in
-- public.admin_users (is_vexn_admin()), and is not executable by visitors at all.
--
-- What counts: a visit to /movie/<slug> counts for the channel the movie has NOW (a movie moved to
-- another channel moves its past views with it), and a visit to /channel/<slug> counts for that
-- channel. Rows marked as bots are left out; older rows carry no marker and are all counted. Views
-- of movies that no longer exist (removed or renamed slugs) are listed on their own line.

create or replace function public.admin_channel_views(p_days integer default 30)
returns table (channel text, videos bigint, movie_views bigint, channel_page_views bigint, total_views bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_vexn_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
  with pv as (
    select split_part(split_part(v.path, '?', 1), '/', 2) as kind,
           split_part(split_part(v.path, '?', 1), '/', 3) as slug
    from public.page_views v
    where coalesce(v.visitor_type, '') <> 'bot'
      and (v.status_code is null or v.status_code between 200 and 299)
      and (p_days is null or v.created_at >= now() - make_interval(days => p_days))
      and (v.path like '/movie/%' or v.path like '/channel/%')
  ),
  mv as (
    select m.channel as ch, count(*) as n
    from pv join public.movies m on pv.kind = 'movie' and m.slug = pv.slug
    group by m.channel
  ),
  cp as (
    select c.channel as ch, count(*) as n
    from pv
    join (select distinct m2.channel_slug, m2.channel from public.movies m2 where m2.channel is not null) c
      on pv.kind = 'channel' and c.channel_slug = pv.slug
    group by c.channel
  ),
  vids as (select m3.channel as ch, count(*) as n from public.movies m3 group by m3.channel),
  gone as (
    select count(*) as n from pv
    where pv.kind = 'movie' and not exists (select 1 from public.movies m4 where m4.slug = pv.slug)
  )
  select coalesce(vids.ch, '(no channel)')::text,
         vids.n::bigint,
         coalesce(mv.n, 0)::bigint,
         coalesce(cp.n, 0)::bigint,
         (coalesce(mv.n, 0) + coalesce(cp.n, 0))::bigint
  from vids
  left join mv on mv.ch is not distinct from vids.ch
  left join cp on cp.ch = vids.ch
  union all
  select '(removed or renamed videos)'::text, 0::bigint, gone.n::bigint, 0::bigint, gone.n::bigint
  from gone where gone.n > 0
  order by 5 desc, 1;
end;
$$;

-- The most viewed videos of one channel ('(no channel)' for videos that have none).
create or replace function public.admin_channel_top_movies(p_channel text, p_days integer default 30, p_limit integer default 10)
returns table (slug text, title text, views bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_vexn_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
  select m.slug, m.title, count(*)::bigint
  from public.page_views v
  join public.movies m on m.slug = split_part(split_part(v.path, '?', 1), '/', 3)
  where v.path like '/movie/%'
    and (m.channel = p_channel or (p_channel = '(no channel)' and m.channel is null))
    and coalesce(v.visitor_type, '') <> 'bot'
    and (v.status_code is null or v.status_code between 200 and 299)
    and (p_days is null or v.created_at >= now() - make_interval(days => p_days))
  group by m.slug, m.title
  order by 3 desc, 1
  limit greatest(1, least(coalesce(p_limit, 10), 50));
end;
$$;

-- Views per day (Indian time) of one channel: its videos plus its channel page. At most 365 days.
create or replace function public.admin_channel_daily(p_channel text, p_days integer default 30)
returns table (day date, views bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  n_days integer := least(coalesce(p_days, 90), 365);
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_vexn_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
  with hits as (
    select (v.created_at at time zone 'Asia/Kolkata')::date as d
    from public.page_views v
    where coalesce(v.visitor_type, '') <> 'bot'
      and (v.status_code is null or v.status_code between 200 and 299)
      and v.created_at >= now() - make_interval(days => n_days + 1)
      and (
        (v.path like '/movie/%' and exists (
           select 1 from public.movies m
           where m.slug = split_part(split_part(v.path, '?', 1), '/', 3)
             and (m.channel = p_channel or (p_channel = '(no channel)' and m.channel is null))))
        or (v.path like '/channel/%' and exists (
           select 1 from public.movies m
           where m.channel_slug = split_part(split_part(v.path, '?', 1), '/', 3) and m.channel = p_channel))
      )
  )
  select g::date, count(hits.d)::bigint
  from generate_series(today - (n_days - 1), today, interval '1 day') g
  left join hits on hits.d = g::date
  group by g
  order by g;
end;
$$;

revoke all on function public.admin_channel_views(integer) from public, anon;
revoke all on function public.admin_channel_top_movies(text, integer, integer) from public, anon;
revoke all on function public.admin_channel_daily(text, integer) from public, anon;
grant execute on function public.admin_channel_views(integer) to authenticated;
grant execute on function public.admin_channel_top_movies(text, integer, integer) to authenticated;
grant execute on function public.admin_channel_daily(text, integer) to authenticated;
