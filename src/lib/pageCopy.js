// Wording of the home page and the /categories, /channels and /actors lists. The live text is in the database
// (table page_copy, migration 021) and is edited in Admin > Site content > Site pages; these defaults fill any empty
// field (and every field before the table exists), and scripts/seed-copy.mjs writes them into the table.
//
//   heading          the page's H1
//   seo_title        the search title. The home page uses it as it is; the list pages get " | VEXN" added.
//   seo_description  the search description (140-160 characters)
//   intro            the text under the heading; links as [words](/category/milf) (src/lib/introLinks.js)
export const PAGE_COPY_DEFAULTS = {
  home: {
    heading: `Adult, HD, MILF, Asian & Indian Movies Provider`,
    seo_title: `VEXN – Adult, HD, MILF, Asian & Indian Movies Provider`,
    seo_description: `Adult movies provider with HD, MILF, Asian and Indian videos by category, performer and channel, plus desi, lesbian, massage and 4K. Newest first. 18+ only.`,
    intro: `Top performers and the latest additions.`,
  },
  categories: {
    heading: `Categories`,
    seo_title: `Free Porn Categories – Desi, MILF, Big Tits and More`,
    seo_description: `Free porn categories on VEXN: Desi bhabhi and Indian videos, MILF and mature, big tits and brunette, lesbian, massage, JAV and more. Newest first.`,
    intro: `Categories sort the VEXN library by what happens on screen and who is in it. The biggest are [Big Tits](/category/big-tits), [MILF](/category/milf), [Brunette](/category/brunette) and [Big Ass](/category/big-ass). For Indian videos start with [Indian](/category/indian), [Desi](/category/desi) and [Bhabhi](/category/bhabhi), and for Japanese features see [Japanese](/category/japanese) and [JAV](/category/jav). Each category page lists its videos newest first, with the runtime and cast of every title, and links the categories that most often go with it. Studios and apps have their own [channels](/channels), and performers are listed under [actors](/actors).`,
  },
  channels: {
    heading: `Channels`,
    seo_title: `Free Porn Channels – Brazzers, Ullu, Vixen and More`,
    seo_description: `Free Brazzers, Adult Time, Vixen and Bangbros scenes plus Ullu, Fliz and Rabbit web series: every VEXN channel and studio, newest videos first.`,
    intro: `Channels group VEXN videos by the studio or app they come from. Studio channels include [Brazzers](/channel/brazzers), [Adult Time](/channel/adult-time), [Vixen](/channel/vixen), [Tushy](/channel/tushy), [Bangbros](/channel/bangbros) and [Reality Kings](/channel/reality-kings). [Nuru Massage](/channel/nuru-massage) and [JAV Movies](/channel/jav-movies) collect oiled massage scenes and full-length Japanese features, and Hindi web series from [Ullu](/channel/ullu), [Fliz Movies](/channel/fliz-movies) and [Rabbit Movies](/channel/rabbit-movies) are filed episode by episode. Videos with no studio sit in the VEXN channel. Each channel page lists its videos newest first, with the cast, tags and runtime of every title.`,
  },
  actors: {
    heading: `Actors`,
    seo_title: `Free Pornstar Videos – Angela White, Lana Rhoades`,
    seo_description: `Free videos of Angela White, Lana Rhoades, Dani Daniels and every other performer on VEXN, with the cast, tags and runtime on each video page.`,
    intro: `Performers are listed by how many of their videos are on VEXN, so the most credited names come first: [Angela White](/actor/angela-white), [Dani Daniels](/actor/dani-daniels), [Lana Rhoades](/actor/lana-rhoades), [Alyx Star](/actor/alyx-star), [Kendra Sunderland](/actor/kendra-sunderland) and [Lauren Phillips](/actor/lauren-phillips) lead the list. Each performer page shows their videos newest first, how long they run, the channels they appear on and the co-stars they work with most. To browse by theme instead, see the [categories](/categories).`,
  },
}

// The address of each page (for links in the admin)
export const PAGE_COPY_PATHS = { home: '/', categories: '/categories', channels: '/channels', actors: '/actors' }

// A row from page_copy (or nothing) merged over the defaults, field by field: an empty field keeps the default.
export function mergePageCopy(slug, row) {
  const base = PAGE_COPY_DEFAULTS[slug] || {}
  const out = {}
  for (const key of ['heading', 'seo_title', 'seo_description', 'intro']) out[key] = (row && typeof row[key] === 'string' && row[key].trim()) || base[key] || ''
  return out
}
