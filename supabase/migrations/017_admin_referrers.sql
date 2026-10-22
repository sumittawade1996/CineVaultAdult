-- 017_admin_referrers.sql
-- Top referring sites for the admin dashboard (/admin/dashboard).
--
-- public.page_views is insert-only for visitors and has no read policy, so the dashboard reads it through
-- this function, like the channel views in 015. It runs with the owner's rights but refuses anyone who is not
-- in public.admin_users (is_vexn_admin()), and is not executable by visitors at all.
--
-- What counts: one row per referring site (www. and m. removed, lower case). A visit with no referrer is
-- listed as '(direct)': typed addresses, bookmarks, apps and links from pages that hide their address.
-- Visits that come from vexn.org itself (moving between our own pages) are left out. Rows marked as bots are
-- left out; older rows carry no marker and are all counted. Visitors = distinct session ids (older rows carry
-- none, so that column can be lower than expected). Only visits the site answered with a 2xx count.

create or replace function public.admin_referrers(p_days integer default 30, p_limit integer default 100)
returns table (site text, visits bigint, visitors bigint)
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
  with r as (
    select
      case
        when nullif(btrim(v.referrer), '') is null then '(direct)'
        else lower(regexp_replace(regexp_replace(btrim(v.referrer), '^[a-z-]+://(www\.|m\.)?', '', 'i'), '[/?#:].*$', ''))
      end as ref_site,
      v.session_id
    from public.page_views v
    where coalesce(v.visitor_type, '') <> 'bot'
      and (v.status_code is null or v.status_code between 200 and 299)
      and (p_days is null or v.created_at >= now() - make_interval(days => p_days))
  )
  select r.ref_site::text, count(*)::bigint, count(distinct r.session_id)::bigint
  from r
  where r.ref_site not in ('vexn.org', '')
  group by r.ref_site
  order by 2 desc, 1
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.admin_referrers(integer, integer) from public, anon;
grant execute on function public.admin_referrers(integer, integer) to authenticated;
