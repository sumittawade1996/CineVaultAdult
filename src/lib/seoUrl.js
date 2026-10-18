// Decides how a URL's query string affects canonicals and indexing (plan T4).
//
//  - Tracking parameters (utm_*, fbclid, X's s/t, ...) never make a different
//    page: they are dropped, so the canonical is the clean URL and the page
//    stays indexable.
//  - `page` is pagination: `?page=1` is the same as no parameter; `?page=n`
//    (n > 1) is kept and canonical to itself.
//  - Anything else (q, sort, filters) makes a variant of the listing. Variants
//    keep their own parameters in the canonical and are marked noindex,follow
//    by <Seo>, so they are crawled for links but never indexed.

const TRACKING_PARAM = /^(utm_[a-z0-9_]+|fbclid|gclid|msclkid|igshid|mc_cid|mc_eid|ref|ref_src|ref_url|s|t)$/i

export function analyzeSearch(search = '') {
  const kept = new Map()
  let variant = false
  for (const [key, value] of new URLSearchParams(search)) {
    if (TRACKING_PARAM.test(key)) continue
    if (key === 'page') {
      const n = Number.parseInt(value, 10)
      if (n > 1) kept.set('page', String(n))
      else kept.delete('page')
      continue
    }
    kept.set(key, value)
    variant = true
  }
  const qs = new URLSearchParams([...kept.entries()].sort((a, b) => a[0].localeCompare(b[0]))).toString()
  return { search: qs ? `?${qs}` : '', variant }
}
