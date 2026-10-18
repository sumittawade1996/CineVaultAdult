-- 009_category_descriptions.sql
-- Plan task T12: a place for hand-written category (tag) page copy, so each
-- hub page has its own text instead of one template. Rows are keyed by the
-- category slug (the part after /category/). Read by the category page and by
-- scripts/prerender.mjs and scripts/generate-sitemap.mjs.

create table if not exists public.category_descriptions (
  slug text primary key,
  title text,                 -- optional H1 override, e.g. "Indian Videos"
  intro text,                 -- 70–150 words, written by a person
  seo_title text,             -- 30–53 characters; " | VEXN" is added by the page
  seo_description text,       -- 140–160 characters
  faq jsonb not null default '[]'::jsonb,   -- [{ "q": "...", "a": "..." }]
  is_indexable boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.category_descriptions enable row level security;

create policy "Public read category_descriptions" on public.category_descriptions
  for select to anon, authenticated using (true);
create policy "Admin insert category_descriptions" on public.category_descriptions
  for insert to authenticated with check (public.is_vexn_admin());
create policy "Admin update category_descriptions" on public.category_descriptions
  for update to authenticated
  using (public.is_vexn_admin()) with check (public.is_vexn_admin());
create policy "Admin delete category_descriptions" on public.category_descriptions
  for delete to authenticated using (public.is_vexn_admin());

revoke insert, update, delete, truncate, references, trigger on public.category_descriptions from anon;
revoke truncate, references, trigger on public.category_descriptions from authenticated;

create or replace function public.set_category_descriptions_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists category_descriptions_set_updated_at on public.category_descriptions;
create trigger category_descriptions_set_updated_at
  before update on public.category_descriptions
  for each row execute function public.set_category_descriptions_updated_at();
