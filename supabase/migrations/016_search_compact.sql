-- 016_search_compact.sql
-- People type a performer's name without the space ("miamalkova", "brandilove"); the full-text
-- search (search_vector) only matches whole words, so those searches found nothing. This adds the
-- title and cast with everything except letters and digits removed, so the movies page can fall
-- back to a plain substring match on it when the normal search comes back empty.
-- Generated, so it follows the title and actors columns by itself.

alter table public.movies
  add column if not exists search_compact text
  generated always as (lower(regexp_replace(coalesce(title, '') || ' ' || coalesce(actors, ''), '[^a-zA-Z0-9]', '', 'g'))) stored;
