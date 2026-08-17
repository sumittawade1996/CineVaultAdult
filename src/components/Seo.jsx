import { Helmet } from 'react-helmet-async'
import { SITE_NAME, SOCIAL_LINKS, FALLBACK_SITE_URL } from '../lib/siteConfig'

const twitterHandle = '@' + SOCIAL_LINKS.twitter.split('/').filter(Boolean).pop()

/**
 * @param {string} [title]
 * @param {string} [description]
 * @param {string} [image]
 * @param {string} [url] - overrides the auto-detected canonical URL
 * @param {string} [type] - og:type, e.g. 'website' | 'article' | 'video.movie'
 * @param {boolean} [noindex] - set true on admin/utility pages
 * @param {object|object[]} [jsonLd] - one or more schema.org objects to emit as JSON-LD
 */
export default function Seo({ title, description, image, url, type = 'website', noindex = false, jsonLd }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Movies, Trailers & Reviews`
  const canonical =
    url || (typeof window !== 'undefined' ? window.location.href.split('#')[0] : FALLBACK_SITE_URL)
  const ldBlocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}
      <meta property="og:url" content={canonical} />
      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:site" content={twitterHandle} />
      {ldBlocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  )
}
