// Which category / performer / channel pages belong in the search index
// (plan T10). Used by TaxonomyDetail (the `noindex` tag) and by
// scripts/generate-sitemap.mjs (which leaves the same pages out of the
// sitemap), so the page and the sitemap can never disagree.
//
//  - Label tags describe quality, source or format, not a topic (HD, 4K, a
//    studio or app name, "Web Series"). As pages they list large, overlapping
//    slices of the catalogue (`hd` alone is 40% of the site), so they stay out
//    of the index. The list is LABEL_TAGS in categories.js, the same one the
//    importer and the tag report use, so there is one list to keep.
//  - A spelling variant of a controlled tag (TAG_ALIASES) redirects to the real
//    category and is never indexed itself.
//  - Every other tag is a free tag: its page is indexed once it is big enough.
//  - The catch-all channel ("VEXN": everything that has no studio or app) is a
//    label for most of the catalogue, not something a visitor searches for.
//  - Small pages read as thin/doorway pages, so each type needs a minimum
//    number of titles first.
import { LABEL_TAGS, TAG_ALIASES } from './categories.js'
import { checkContent } from './contentRules.js'

// A video whose title, address, tags, keywords or description hit a blocked theme
// (src/lib/contentRules.js) is held: it stays on the site but is kept out of the search index and
// the sitemaps until someone decides what to do with it. The movie page and the sitemap script
// both use this, so they cannot disagree.
export const isHeldMovie = (movie) => checkContent(movie).block.length > 0

// Kept under its old name: breadcrumbs.js and related.js use it to skip non-topic tags.
export const ATTRIBUTE_TAGS = LABEL_TAGS

// Channels that hold whatever has no studio or app. Not indexed, and not used to relate videos.
export const CATCH_ALL_CHANNELS = new Set(['vexn'])

// Minimum titles before a page may be indexed, by taxonomy field.
export const MIN_INDEXABLE_TITLES = { tags: 10, actors: 5, channel: 3 }

// A weekly archive (/new/2026-w41) needs this many additions to be indexed.
export const MIN_INDEXABLE_WEEK_TITLES = 5
export const isIndexableWeek = (count) => count >= MIN_INDEXABLE_WEEK_TITLES

// field: 'tags' (categories) | 'actors' | 'channel'
export function isIndexableTaxonomy(field, slug, count) {
  if (field === 'tags' && (LABEL_TAGS.has(slug) || TAG_ALIASES.has(slug))) return false
  if (field === 'channel' && CATCH_ALL_CHANNELS.has(slug)) return false
  return count >= (MIN_INDEXABLE_TITLES[field] ?? 3)
}
