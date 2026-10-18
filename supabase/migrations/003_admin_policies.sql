-- 003_admin_policies.sql
-- Part 1 of closing public write access (plan task T1). ADDITIVE: it does not
-- remove anything, so it is safe to run at any time. The old public policies
-- are removed in 004_close_public_writes.sql once the new admin login is live.
--
-- Model: only users listed in public.admin_users (Supabase Auth user ids) may
-- insert, update or delete movies and articles. Everybody else can only read.

create table if not exists public.admin_users (
  user_id uuid primary key,          -- auth.users.id of an admin
  note text,
  created_at timestamptz not null default now()
);

-- RLS on with no policies: the table cannot be read or written through the API.
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

-- True when the caller is a listed admin. SECURITY DEFINER so it can read
-- admin_users; it only ever answers about the caller's own user id.
create or replace function public.is_vexn_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_vexn_admin() from public;
grant execute on function public.is_vexn_admin() to authenticated;

-- movies: admin write access
create policy "Admin insert movies" on public.movies
  for insert to authenticated with check (public.is_vexn_admin());
create policy "Admin update movies" on public.movies
  for update to authenticated
  using (public.is_vexn_admin()) with check (public.is_vexn_admin());
create policy "Admin delete movies" on public.movies
  for delete to authenticated using (public.is_vexn_admin());

-- articles: admin write access, and admins can also read unpublished drafts
create policy "Admin read all articles" on public.articles
  for select to authenticated using (public.is_vexn_admin());
create policy "Admin insert articles" on public.articles
  for insert to authenticated with check (public.is_vexn_admin());
create policy "Admin update articles" on public.articles
  for update to authenticated
  using (public.is_vexn_admin()) with check (public.is_vexn_admin());
create policy "Admin delete articles" on public.articles
  for delete to authenticated using (public.is_vexn_admin());

-- After creating the admin user in Supabase (Authentication > Users), add it:
--   insert into public.admin_users (user_id, note)
--   select id, 'owner' from auth.users where email = 'you@example.com';
