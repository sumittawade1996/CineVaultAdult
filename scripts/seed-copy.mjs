// node scripts/seed-copy.mjs
// Checks the hand-written channel intros (scripts/data/channel-intros.mjs), performer bios
// (scripts/data/performer-bios.mjs) and site pages (src/lib/pageCopy.js), and writes supabase/migrations/023_seed_site_copy.sql.
// Exits with an error (and writes nothing) when a rule fails. The category pages have their own script
// (scripts/seed-category-descriptions.mjs); `npm run check:copy` checks every link against the live site.
//
// Apply the SQL only after the code that renders the links is live (older code shows the [words](/path) syntax as is)
// and after 019_description_seo_titles.sql and 022_description_seo_descriptions.sql, which add the seo_title and
// seo_description columns the optional search titles and descriptions go into.
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { CHANNEL_INTROS, CHANNEL_SEO_DESCRIPTIONS, CHANNEL_SEO_TITLES } from './data/channel-intros.mjs'
import { PERFORMER_BIOS, PERFORMER_SEO_DESCRIPTIONS, PERFORMER_SEO_TITLES } from './data/performer-bios.mjs'
import { HAND_CLAIMS, copyProblems } from './lib/copyRules.mjs'
import { checkContent } from '../src/lib/contentRules.js'
import { PAGE_COPY_DEFAULTS, PAGE_COPY_PATHS } from '../src/lib/pageCopy.js'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const errors = []
const check = (kind, base, entries, limits) => {
  for (const [slug, text] of Object.entries(entries)) {
    if (!SLUG.test(slug)) errors.push(`${kind} ${slug}: bad slug`)
    for (const p of copyProblems(text, { selfPath: `${base}/${slug}`, ...limits })) errors.push(`${kind} ${slug}: ${p}`)
  }
}
check('channel', '/channel', CHANNEL_INTROS, { minWords: 40, maxWords: 260 })
check('performer', '/actor', PERFORMER_BIOS, { minWords: 20, maxWords: 200 })
// optional search titles: 30-53 characters (the site adds " | VEXN"), only for a page whose intro is here, all different
const seenTitles = new Set()
const checkTitles = (kind, titles, intros) => {
  for (const [slug, title] of Object.entries(titles)) {
    if (!intros[slug]) errors.push(`${kind} ${slug}: a search title without an intro`)
    if (title.length < 30 || title.length > 53) errors.push(`${kind} ${slug}: search title is ${title.length} characters (30-53)`)
    if (seenTitles.has(title.toLowerCase())) errors.push(`${kind} ${slug}: search title used twice`)
    seenTitles.add(title.toLowerCase())
    const claim = title.match(HAND_CLAIMS)
    if (claim) errors.push(`${kind} ${slug}: claim word "${claim[0]}" in the search title`)
    const hits = checkContent({ title })
    if (hits.block.length || hits.review.length) errors.push(`${kind} ${slug}: content rules in the search title`)
  }
}
checkTitles('channel', CHANNEL_SEO_TITLES, CHANNEL_INTROS)
checkTitles('performer', PERFORMER_SEO_TITLES, PERFORMER_BIOS)
// optional search descriptions: 140-160 characters, plain text, only for a page whose intro is here, all different
const seenDescriptions = new Set()
const checkDescriptions = (kind, descriptions, intros) => {
  for (const [slug, text] of Object.entries(descriptions)) {
    if (!intros[slug]) errors.push(`${kind} ${slug}: a search description without an intro`)
    if (text.length < 140 || text.length > 160) errors.push(`${kind} ${slug}: search description is ${text.length} characters (140-160)`)
    if (/\]\(\/|https?:\/\//.test(text)) errors.push(`${kind} ${slug}: links do not belong in a search description`)
    if (seenDescriptions.has(text.toLowerCase())) errors.push(`${kind} ${slug}: search description used twice`)
    seenDescriptions.add(text.toLowerCase())
    const claim = text.match(HAND_CLAIMS)
    if (claim) errors.push(`${kind} ${slug}: claim word "${claim[0]}" in the search description`)
    const hits = checkContent({ title: text })
    if (hits.block.length || hits.review.length) errors.push(`${kind} ${slug}: content rules in the search description`)
  }
}
checkDescriptions('channel', CHANNEL_SEO_DESCRIPTIONS, CHANNEL_INTROS)
checkDescriptions('performer', PERFORMER_SEO_DESCRIPTIONS, PERFORMER_BIOS)
// the four site pages (src/lib/pageCopy.js): the home search title is used as it is, the others get " | VEXN" added
for (const [slug, c] of Object.entries(PAGE_COPY_DEFAULTS)) {
  const max = slug === 'home' ? 60 : 53
  if (c.seo_title.length < 30 || c.seo_title.length > max) errors.push(`page ${slug}: search title is ${c.seo_title.length} characters (30-${max})`)
  if (c.seo_description.length < 140 || c.seo_description.length > 160) errors.push(`page ${slug}: search description is ${c.seo_description.length} characters (140-160)`)
  for (const p of copyProblems(c.intro, { selfPath: PAGE_COPY_PATHS[slug], minWords: 0, maxWords: 260 })) errors.push(`page ${slug}: ${p}`)
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const rows = (entries) => Object.entries(entries).map(([slug, text]) => `  (${q(slug)}, ${q(text)}, now())`).join(',\n')
// titles are set one by one, so a title written in the admin for another page is never cleared
const titleUpdates = (table, titles, column = 'seo_title') => Object.entries(titles).map(([slug, title]) => `update public.${table} set ${column} = ${q(title)} where slug = ${q(slug)};`).join('\n')
const sql = `-- 023_seed_site_copy.sql
-- Generated by scripts/seed-copy.mjs from scripts/data/channel-intros.mjs and scripts/data/performer-bios.mjs.
-- Re-running it overwrites the same rows. Apply it only once the code that renders [words](/path) links is live.

insert into public.channel_descriptions (slug, description, updated_at)
values
${rows(CHANNEL_INTROS)}
on conflict (slug) do update set description = excluded.description, updated_at = now();

insert into public.performer_descriptions (slug, description, updated_at)
values
${rows(PERFORMER_BIOS)}
on conflict (slug) do update set description = excluded.description, updated_at = now();

-- optional search titles (column added by 019_description_seo_titles.sql)
${titleUpdates('channel_descriptions', CHANNEL_SEO_TITLES)}
${titleUpdates('performer_descriptions', PERFORMER_SEO_TITLES)}

-- optional search descriptions (column added by 022_description_seo_descriptions.sql)
${titleUpdates('channel_descriptions', CHANNEL_SEO_DESCRIPTIONS, 'seo_description')}
${titleUpdates('performer_descriptions', PERFORMER_SEO_DESCRIPTIONS, 'seo_description')}

-- the four site pages (table added by 021_page_copy.sql): only rows that do not exist yet, so wording already
-- edited in Admin > Site content > Site pages is kept
insert into public.page_copy (slug, heading, seo_title, seo_description, intro)
values
${Object.entries(PAGE_COPY_DEFAULTS).map(([slug, c]) => `  (${q(slug)}, ${q(c.heading)}, ${q(c.seo_title)}, ${q(c.seo_description)}, ${q(c.intro)})`).join(',\n')}
on conflict (slug) do nothing;
`
writeFileSync('supabase/migrations/023_seed_site_copy.sql', sql)
// the seed was 022 until the search-description column took that number (it has to exist before the seed runs)
if (existsSync('supabase/migrations/022_seed_site_copy.sql')) unlinkSync('supabase/migrations/022_seed_site_copy.sql')
console.log(`${Object.keys(CHANNEL_INTROS).length} channel intros and ${Object.keys(PERFORMER_BIOS).length} performer bios ok → supabase/migrations/023_seed_site_copy.sql`)
