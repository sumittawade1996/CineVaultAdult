-- 013_movie_source.sql
-- Plan task T22: "Eporner" was being used as the channel of ~730 videos, but it is
-- the site the player comes from (the source), not a studio. This adds a
-- `source` column for that fact and clears the channel where it only named the
-- source, so the channel list shows studios and collections only.
--
--   source   where the embedded player is hosted: Eporner, PornHub, ...
--   channel  studio or collection (Nuru Massage, Brazzers, AI Movie, JAV Movies, ...); may be empty
--
-- The updated_at trigger is switched off for the bulk update so the sitemap's
-- lastmod dates do not all jump to today for a label change.

alter table public.movies add column if not exists source text;

alter table public.movies disable trigger trg_movies_updated_at;

update public.movies set source = case
  when trailer_url ~* '^https?://(www\.)?eporner\.com/' then 'Eporner'
  when trailer_url ~* '^https?://([a-z]+\.)?pornhub\.' then 'PornHub'
  when trailer_url ~* '^https?://(www\.)?superporn\.com/' then 'SuperPorn'
  when trailer_url ~* '^https?://(www\.)?luluvdo\.com/' then 'Luluvdo'
  when trailer_url ~* 'youtu(\.be|be\.com)' then 'YouTube'
end
where source is null;

-- Channel values that only named the source site.
update public.movies set channel = null where channel in ('Eporner', 'PornHub', 'YouTube');

alter table public.movies enable trigger trg_movies_updated_at;
