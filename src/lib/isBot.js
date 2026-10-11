// Visitors that aren't people: search/SEO/AI crawlers, link-preview fetchers,
// headless browsers and automation tools. Many of them (Googlebot, Meta's
// crawler, Ahrefs) execute JavaScript, so without this check they were logged
// as real page views — Netlify showed ~88% non-browser traffic while the
// page_views table still counted the JS-running share of it.
//
// Kept dependency-free so it can be unit-tested with plain node.
const BOT_UA = new RegExp(
  [
    'bot\\b', 'crawl', 'spider', 'slurp', 'scrape', 'fetch', 'externalagent',
    'facebookexternalhit', 'preview', 'headless', 'lighthouse', 'pagespeed',
    'gtmetrix', 'phantom', 'puppeteer', 'playwright', 'selenium',
    'python', 'curl', 'wget', 'httpclient', 'java/', 'go-http', 'node-fetch', 'axios',
    'ahrefs', 'semrush', 'dataforseo', 'mj12', 'petalbot', 'bytespider',
    // Claude desktop app's built-in browser (used for testing the site).
    'claude/',
  ].join('|'),
  'i'
)

export function isBotUserAgent(ua) {
  return !ua || BOT_UA.test(ua)
}

// `nav` is injectable so tests don't need a browser.
export function isBot(nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (!nav) return true
  // navigator.webdriver is true under Selenium/Puppeteer/Playwright.
  return nav.webdriver === true || isBotUserAgent(nav.userAgent)
}
