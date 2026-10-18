-- 007_source_published_at.sql
-- Plan task T20: the date the source site published a video, as opposed to
-- created_at (when we imported it). Used for `uploadDate` in the movie
-- markup and `publication_date` in the video sitemap; both fall back to
-- created_at when this is null.
alter table public.movies add column if not exists source_published_at timestamptz;
comment on column public.movies.source_published_at is
  'When the source site published the video (not when we imported it). Used for uploadDate in the movie markup and publication_date in the video sitemap.';
