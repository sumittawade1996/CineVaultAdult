-- 019_description_seo_titles.sql
-- An optional search title for channel and performer pages, edited in Admin > Site content (category pages
-- have had one since 009). Empty means the page builds its own: "Free <name> Porn Videos and Full Scenes" for a
-- channel, "Free <name> Porn Videos and Scenes" for a performer (src/pages/TaxonomyDetail.jsx).
-- Safe to apply before or after the code that reads it: the pages read these rows with select('*').
alter table public.channel_descriptions add column if not exists seo_title text;
alter table public.performer_descriptions add column if not exists seo_title text;
