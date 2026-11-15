// Hand-written intros (channel intros, performer bios, category intros) can link to other VEXN pages:
//   [Angela White](/actor/angela-white) and [big tits videos](/category/big-tits)
// Only paths on this site become links (actor, category, channel, movie, article and weekly pages, and the
// lists); anything else keeps its words as plain text, so a pasted outside address never becomes a link.
// A blank line starts a new paragraph: the page shows the first one above the videos and the rest below them.
// Search descriptions and Open Graph text use the plain wording (plainIntro).
const LINK = /\[([^[\]\n]{1,90})\]\(([^()\s]{1,200})\)/g
const SITE_PATH = /^\/(?:(?:actor|category|channel|movie|article|new)\/[a-z0-9-]+|actors|categories|channels|movies|new|articles)$/

// -> [{ text }, { text, to }, ...] in reading order
export function introParts(text) {
  const s = String(text || '')
  const parts = []
  let last = 0
  for (const m of s.matchAll(LINK)) {
    if (m.index > last) parts.push({ text: s.slice(last, m.index) })
    const to = m[2].replace(/(.)\/+$/, '$1')
    parts.push(SITE_PATH.test(to) ? { text: m[1], to } : { text: m[1] })
    last = m.index + m[0].length
  }
  if (last < s.length) parts.push({ text: s.slice(last) })
  return parts
}

export const plainIntro = (text) => String(text || '').replace(LINK, '$1').replace(/\s+/g, ' ').trim()

export const introParagraphs = (text) => String(text || '').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)

// The pages an intro links to (for checks before saving)
export const introLinkPaths = (text) => introParts(text).filter((p) => p.to).map((p) => p.to)
