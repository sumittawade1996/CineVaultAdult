-- Run this in Supabase SQL Editor against your EXISTING database
-- (the one already powering vxn.co.in). It's safe to re-run.

alter table movies add column if not exists actors text;   -- comma-separated cast names
alter table movies add column if not exists channel text;  -- e.g. "Netflix", "Theatrical", "YouTube Originals"

-- Rebuild the search index so it also matches on actor names.
-- (Generated columns can't be altered in place, so we drop + recreate.)
alter table movies drop column if exists search_vector;
alter table movies add column search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title,'') || ' ' ||
      coalesce(keywords,'') || ' ' ||
      coalesce(tags,'') || ' ' ||
      coalesce(actors,'') || ' ' ||
      coalesce(channel,'')
    )
  ) stored;

drop index if exists idx_movies_search;
create index idx_movies_search on movies using gin (search_vector);

create index if not exists idx_movies_channel on movies (channel);
