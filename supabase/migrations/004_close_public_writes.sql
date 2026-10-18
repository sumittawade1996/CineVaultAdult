-- 004_close_public_writes.sql
-- Part 2 of closing public write access (plan task T1).
-- RUN THIS ONLY AFTER the new admin login (Supabase Auth) is deployed and an
-- admin user exists in public.admin_users, because the old admin pages wrote
-- with the public anon key and will stop working once this runs.
--
-- Before: anyone with the public key could insert and update every row of
-- movies and articles. After: anon can only read; admins write through the
-- policies created in 003_admin_policies.sql.

drop policy if exists "Public insert movies"   on public.movies;
drop policy if exists "Public update movies"   on public.movies;
drop policy if exists "Public insert articles" on public.articles;
drop policy if exists "Public update articles" on public.articles;

-- Visitors (anon): read only.
revoke insert, update, delete, truncate, references, trigger
  on public.movies, public.articles from anon;

-- Signed-in users keep insert/update/delete (still gated by the admin policies)
-- but lose the rights that no admin screen needs.
revoke truncate, references, trigger
  on public.movies, public.articles from authenticated;
