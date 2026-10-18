-- 005_removed_movies.sql
-- Plan task T3: movies that were removed must answer 410 Gone (or a 301 to a
-- close hub page) instead of the app shell with HTTP 200. The edge function
-- netlify/edge-functions/movie-gate.js reads this table.

create table if not exists public.removed_movies (
  slug text primary key,
  -- Optional same-site path (a performer, channel or category page) to 301 to.
  -- Leave null to answer 410 Gone.
  redirect_to text check (redirect_to is null or redirect_to ~ '^/[^/]'),
  reason text,
  removed_at timestamptz not null default now()
);

alter table public.removed_movies enable row level security;

-- Slugs are not secret and the edge function reads them with the anon key.
create policy "Public read removed_movies" on public.removed_movies
  for select using (true);
create policy "Admin insert removed_movies" on public.removed_movies
  for insert to authenticated with check (public.is_vexn_admin());
create policy "Admin update removed_movies" on public.removed_movies
  for update to authenticated
  using (public.is_vexn_admin()) with check (public.is_vexn_admin());
create policy "Admin delete removed_movies" on public.removed_movies
  for delete to authenticated using (public.is_vexn_admin());

revoke insert, update, delete, truncate, references, trigger on public.removed_movies from anon;
revoke truncate, references, trigger on public.removed_movies from authenticated;

-- A slug that is added back to movies must stop being "removed", otherwise the
-- edge function would answer 410 for a live video.
create or replace function public.clear_removed_movie()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.removed_movies where slug = new.slug;
  return new;
end;
$$;

revoke all on function public.clear_removed_movie() from public, anon, authenticated;

drop trigger if exists movies_clear_removed on public.movies;
create trigger movies_clear_removed
  after insert or update of slug on public.movies
  for each row execute function public.clear_removed_movie();
