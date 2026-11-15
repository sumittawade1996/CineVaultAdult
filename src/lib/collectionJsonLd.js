// schema.org CollectionPage + ItemList for a page that lists other pages: the /categories, /channels and /actors
// lists, and a performer, category or channel page (its videos). Google shows no rich result for it; it states
// what the page is and what it lists, in the order on the page. `items`: [{ to: '/movie/slug', name }]; a video can also
// bring { minutes, thumbnail, uploadDate }, and with a thumbnail and a date it is listed as a VideoObject (title,
// runtime, picture, date), the fields Google reads for a video.
import { FALLBACK_SITE_URL } from './siteConfig.js'

export const MAX_LISTED = 100 // the /actors list has hundreds of names; the count is still the full one

export function collectionJsonLd({ path, name, description, items = [], total }) {
  const url = `${FALLBACK_SITE_URL}${path}`
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#page`,
    url,
    name,
    ...(description ? { description } : {}),
    isPartOf: { '@type': 'WebSite', name: 'VEXN', url: `${FALLBACK_SITE_URL}/` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total ?? items.length,
      itemListElement: items.slice(0, MAX_LISTED).map((item, i) => {
        const itemUrl = `${FALLBACK_SITE_URL}${item.to}`
        if (!item.thumbnail || !item.uploadDate) return { '@type': 'ListItem', position: i + 1, url: itemUrl, name: item.name }
        return {
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'VideoObject',
            '@id': itemUrl,
            url: itemUrl,
            name: item.name,
            thumbnailUrl: item.thumbnail,
            uploadDate: item.uploadDate,
            ...(item.minutes ? { duration: `PT${item.minutes}M` } : {}),
          },
        }
      }),
    },
  }
}
