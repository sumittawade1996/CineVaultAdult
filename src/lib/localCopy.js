// `npm run dev` only: the copy written in scripts/data/ (channel intros, performer bios, category pages) is shown in
// place of the database rows, so new text can be read on the local site before it is saved to the database (at
// deploy, from the SQL that scripts/seed-copy.mjs and scripts/seed-category-descriptions.mjs write). Production
// builds drop this branch (import.meta.env.DEV is false there), so the live site always shows the database.
// Set VITE_LOCAL_COPY=off in .env.local to see the database text while developing.
export async function localCopy(field, slug) {
  if (import.meta.env.DEV && import.meta.env.VITE_LOCAL_COPY !== 'off') {
    if (field === 'channel') {
      const { CHANNEL_INTROS, CHANNEL_SEO_TITLES = {}, CHANNEL_SEO_DESCRIPTIONS = {} } = await import('../../scripts/data/channel-intros.mjs')
      return CHANNEL_INTROS[slug] ? { bio: CHANNEL_INTROS[slug], seoTitle: CHANNEL_SEO_TITLES[slug], seoDescription: CHANNEL_SEO_DESCRIPTIONS[slug] } : null
    }
    if (field === 'actors') {
      const { PERFORMER_BIOS, PERFORMER_SEO_TITLES = {}, PERFORMER_SEO_DESCRIPTIONS = {} } = await import('../../scripts/data/performer-bios.mjs')
      return PERFORMER_BIOS[slug] ? { bio: PERFORMER_BIOS[slug], seoTitle: PERFORMER_SEO_TITLES[slug], seoDescription: PERFORMER_SEO_DESCRIPTIONS[slug] } : null
    }
    if (field === 'tags') {
      const { CATEGORIES } = await import('../../scripts/data/category-descriptions.mjs')
      const copy = CATEGORIES.find((c) => c.slug === slug)
      return copy ? { catDesc: copy } : null
    }
  }
  return null
}
