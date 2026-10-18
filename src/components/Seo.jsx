import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'
import { SITE_NAME, SOCIAL_LINKS, FALLBACK_SITE_URL, DEFAULT_OG_IMAGE } from '../lib/siteConfig'
import { normalizePath } from '../lib/preload'
import { analyzeSearch } from '../lib/seoUrl'

const twitterHandle = '@' + SOCIAL_LINKS.twitter.split('/').filter(Boolean).pop()

export const DEFAULT_TITLE = `${SITE_NAME} – Adult, HD, MILF, Asian & Indian Movies Provider`

// RTA label (https://www.rtalabel.org): recognised by Google SafeSearch and by
// parental-control filters. The same label is also sent as an HTTP `Rating`
// header for every response (see netlify.toml).
const ADULT_RATING = 'RTA-5042-1996-1400-1577-RTA'

/**
 * @param {string} [title] - page title; ` | VEXN` is appended
 * @param {string} [rawTitle] - complete <title>, used as is (home page)
 * @param {string} [description]
 * @param {string} [image] - share image; pages without one use the site default
 * @param {string} [url] - overrides the auto-detected canonical URL
 * @param {string} [type] - og:type, e.g. 'website' | 'article' | 'video.movie'
 * @param {boolean} [noindex] - set true on admin/utility pages
 * @param {object|object[]} [jsonLd] - one or more schema.org objects to emit as JSON-LD
 */
export default function Seo({ title, rawTitle, description, image, url, type = 'website', noindex = false, jsonLd }) {
  const { pathname, search } = useLocation()
  const fullTitle = rawTitle || (title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE)
  // Tracking parameters are dropped from the canonical; sort/search/filter
  // variants keep their parameters but are never indexed (plan T4).
  const { search: canonicalSearch, variant } = analyzeSearch(search)
  // Always the production origin: the same page on a deploy preview must
  // point search engines at vexn.org, not at the preview host.
  const canonical = url || `${FALLBACK_SITE_URL}${normalizePath(pathname)}${canonicalSearch}`
  const keepOutOfIndex = noindex || variant
  const ldBlocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []
  const ogImage = image || DEFAULT_OG_IMAGE

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <meta name="robots" content={keepOutOfIndex ? 'noindex, follow' : 'index, follow'} />
      <meta name="rating" content={ADULT_RATING} />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={canonical} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={twitterHandle} />
      {ldBlocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  )
}
