-- 008_page_views_and_function_hardening.sql
-- Plan tasks T2, T2b and the database part of T16.

-- ---- T2: page_views is write-only for the public --------------------------
-- Visitors can add a row; nobody can read, change or delete rows through the
-- public API (the data is read in the Supabase dashboard / SQL editor).
revoke select, update, delete, truncate, references, trigger
  on public.page_views from anon, authenticated;

-- ---- T16: richer, still privacy-light columns -----------------------------
alter table public.page_views
  add column if not exists session_id text,       -- random per browser tab, no cookie
  add column if not exists visitor_type text,     -- browser | bot | unknown
  add column if not exists country text,          -- from the CDN edge, ISO code
  add column if not exists device text,           -- mobile | tablet | desktop
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists status_code smallint;  -- 404 when the not-found page was shown

-- ---- T2: bounded inserts ---------------------------------------------------
drop policy if exists "anyone can insert a pageview" on public.page_views;
drop policy if exists "insert pageview (bounded)" on public.page_views;
create policy "insert pageview (bounded)" on public.page_views
  for insert to anon, authenticated
  with check (
    path is not null and length(path) between 1 and 300 and path like '/%'
    and (referrer is null or length(referrer) <= 2000)
    and (session_id is null or length(session_id) <= 64)
    and (visitor_type is null or visitor_type in ('browser', 'bot', 'unknown'))
    and (country is null or length(country) <= 8)
    and (device is null or device in ('mobile', 'tablet', 'desktop'))
    and (utm_source is null or length(utm_source) <= 100)
    and (utm_medium is null or length(utm_medium) <= 100)
    and (utm_campaign is null or length(utm_campaign) <= 150)
    and (status_code is null or status_code between 100 and 599)
  );

-- ---- T2b: advisor items ----------------------------------------------------
-- These three functions only use pg_catalog functions (and public.slugify,
-- already schema-qualified), so an empty search_path is safe.
alter function public.set_updated_at() set search_path = '';
alter function public.slugify(text) set search_path = '';
alter function public.text_list_to_slugs(text) set search_path = '';

-- An empty, unreferenced backup copy of movies (0 rows, no dependents).
drop table if exists public.movie_bkp;

-- Optional later hardening (needs SUPABASE_SERVICE_ROLE_KEY in Netlify's
-- environment so the /api/pv edge function can write without the public
-- policy): revoke insert on public.page_views from anon, authenticated;
--         drop policy "insert pageview (bounded)" on public.page_views;
