-- 021_page_copy.sql
-- The wording of the home page and the /categories, /channels and /actors lists (heading, search title, search
-- description, intro), edited in Admin > Site content > Site pages. The defaults live in src/lib/pageCopy.js; an
-- empty field or a missing row shows those, so the pages work before and after this table has rows.
-- Visitors read it; signed-in admins (public.admin_users) write it, the same way 009 and 014 set up the other copy.

create table if not exists public.page_copy (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  heading text,
  seo_title text,
  seo_description text,
  intro text,
  updated_at timestamptz not null default now()
);

alter table public.page_copy enable row level security;

create policy "Public read page_copy" on public.page_copy
  for select to anon, authenticated using (true);
create policy "Admin insert page_copy" on public.page_copy
  for insert to authenticated with check (public.is_vexn_admin());
create policy "Admin update page_copy" on public.page_copy
  for update to authenticated
  using (public.is_vexn_admin()) with check (public.is_vexn_admin());
create policy "Admin delete page_copy" on public.page_copy
  for delete to authenticated using (public.is_vexn_admin());

grant select on public.page_copy to anon, authenticated;
grant insert, update, delete on public.page_copy to authenticated;
