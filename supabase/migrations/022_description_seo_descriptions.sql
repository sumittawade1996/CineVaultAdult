-- 022_description_seo_descriptions.sql
-- An optional search description (meta description, 140-160 characters) for a channel and a performer, edited in
-- Admin > Site content next to the intro and the search title. Empty: the page uses the first sentences of the intro
-- (src/pages/TaxonomyDetail.jsx). Categories already have their own (category_descriptions.seo_description).
-- Safe on the live site before the code that reads it: older code selects these rows with '*' and ignores the column.
alter table public.channel_descriptions add column if not exists seo_description text;
alter table public.performer_descriptions add column if not exists seo_description text;
