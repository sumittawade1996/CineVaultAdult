-- 012_footer_partners_details.sql
-- The footer shows each partner as a short list entry; the new /partners page
-- shows everything about a partner. This adds the free-text field for that page:
--   details  longer text (blank line = new paragraph); optional, the page works without it
-- The short `description` column from 011 stays the one-line summary.
--
-- Fill it in:  update public.footer_partners set details = '...' where name = 'Name';

alter table public.footer_partners add column if not exists details text;
