import DOMPurify from 'dompurify'

// Article bodies are written as HTML in the admin (src/pages/AdminArticle.jsx) and shown on /article/<slug>.
// cleanArticleHtml keeps the writing tags (headings, paragraphs, lists, links, images, tables, quotes, code) and
// removes whatever can run or restyle the page: scripts, event handlers, javascript: links, iframes, forms and style
// attributes. The page's own <h1> is the article title, so an <h1> in the body becomes an <h2>; a link that opens a
// new tab gets rel="noopener".
//
// The admin cleans the HTML before it is saved, so the database only holds clean HTML, and the browser cleans it
// again whenever it renders an article. Building the site runs in Node without a DOM, where DOMPurify cannot run:
// there the stored (already cleaned) HTML is used as it is.
const purify = typeof window !== 'undefined' ? DOMPurify(window) : null
if (purify?.isSupported) {
  purify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      const rel = new Set((node.getAttribute('rel') || '').split(/\s+/).filter(Boolean))
      rel.add('noopener')
      node.setAttribute('rel', [...rel].join(' '))
    }
  })
}
const CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'select', 'textarea', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style'],
  ADD_ATTR: ['target'],
}

export const demoteH1 = (html) => String(html || '').replace(/<h1(?=[\s>])/gi, '<h2').replace(/<\/h1\s*>/gi, '</h2>')

export function cleanArticleHtml(html) {
  const raw = String(html || '')
  return demoteH1(purify?.isSupported ? purify.sanitize(raw, CONFIG) : raw)
}

// What the editor reports about a body: length, sections, links and images (plain counting, no DOM needed)
export function articleChecks(html) {
  const s = String(html || '')
  const text = s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim()
  const count = (re) => (s.match(re) || []).length
  const hrefs = [...s.matchAll(/<a\b[^>]*\bhref\s*=\s*"([^"]*)"/gi)].map((m) => m[1].trim())
  const internal = hrefs.filter((h) => h.startsWith('/') || /^https?:\/\/(?:www\.)?vexn\.org(?:\/|$)/i.test(h))
  const images = [...s.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0])
  return {
    words: text ? text.split(' ').length : 0,
    h1: count(/<h1[\s>]/gi),
    h2: count(/<h2[\s>]/gi),
    h3: count(/<h3[\s>]/gi),
    internalLinks: internal.length,
    externalLinks: hrefs.length - internal.length,
    images: images.length,
    imagesWithoutAlt: images.filter((tag) => !/\balt\s*=\s*"[^"]+"/i.test(tag)).length,
  }
}

// Advice for the editor: [{ ok, text }]. Lengths follow the rest of the site (src/lib/seoText.js, the category copy).
export function articleAdvice(form) {
  const c = articleChecks(form.content)
  const titleLen = (form.seo_title || form.title || '').length
  const descLen = (form.seo_description || form.excerpt || '').length
  return [
    { ok: c.words >= 600, text: `${c.words} words (aim for 600 or more; longer guides rank better)` },
    { ok: c.h2 >= 2, text: `${c.h2} H2 sections, ${c.h3} H3 (use H2 for each main section)` },
    { ok: c.h1 === 0, text: c.h1 ? 'An <h1> in the body becomes an <h2> on save (the page title is the H1)' : 'No <h1> in the body (the title is the H1)' },
    { ok: c.internalLinks >= 3, text: `${c.internalLinks} links to VEXN pages (link at least 3 categories, performers or channels)` },
    { ok: c.imagesWithoutAlt === 0, text: c.images ? `${c.images} images, ${c.imagesWithoutAlt} without alt text` : 'No images (optional)' },
    { ok: titleLen >= 30 && titleLen <= 60, text: `Search title ${titleLen} characters (30–60)` },
    { ok: descLen >= 140 && descLen <= 160, text: `Search description ${descLen} characters (140–160)` },
  ]
}
