// Breadcrumb trails (plan T13/T21): a visible "Home › Category › Page" line
// and the matching schema.org BreadcrumbList.

import { slugify } from './slugify.js'
import { ATTRIBUTE_TAGS } from './indexing.js'
import { FALLBACK_SITE_URL } from './siteConfig.js'

// Home › first topic tag › movie title. Attribute tags (hd, 4k, pornstar, ...)
// make poor middle steps, so the first real topic tag is used; a movie with
// no usable tag falls back to the Movies list.
export function movieCrumbs(movie, tags = []) {
  const topic = tags.find((t) => !ATTRIBUTE_TAGS.has(slugify(t)))
  return [
    { name: 'Home', to: '/' },
    topic ? { name: topic, to: `/category/${slugify(topic)}` } : { name: 'Movies', to: '/movies' },
    { name: movie.title, to: `/movie/${movie.slug}` },
  ]
}

export function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${FALLBACK_SITE_URL}${item.to}`,
    })),
  }
}
