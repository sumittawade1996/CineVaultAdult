// Rules for hand-written intros and bios with [words](/path) links (src/lib/introLinks.js). Used by
// scripts/seed-copy.mjs (channel intros, performer bios) and scripts/seed-category-descriptions.mjs (category intros).
import { checkContent } from '../../src/lib/contentRules.js'
import { introLinkPaths, introParagraphs, plainIntro } from '../../src/lib/introLinks.js'

// Words hand-written copy must not use: superlatives nobody can check and "exclusive" (VEXN embeds from source sites).
// Owner decision 2026-11-11: "free" (VEXN costs nothing), "HD" (where most videos are) and "watch/stream online" are
// allowed here, as people search with them; generated movie copy keeps the stricter CLAIMS list (scripts/lib/movieCopy.mjs).
export const HAND_CLAIMS = /\b(?:best|hottest|top[- ]rated|most[- ]watched|trending|viral|must[- ]watch|incredible|stunning|sizzling|steamy|exclusive|updated daily|daily updates?|added daily)\b/i

const RAW_LINK = /\[[^[\]\n]+\]\([^()\s]+\)/g

// -> list of problems for one text
// claims / counts: off for the category intros, whose older wording predates those rules
export function copyProblems(text, { selfPath, minWords, maxWords, claims = true, counts = true }) {
  const problems = []
  const plain = plainIntro(text)
  const words = plain.split(/\s+/).filter(Boolean).length
  if (words < minWords || words > maxWords) problems.push(`${words} words (${minWords}–${maxWords})`)
  const links = introLinkPaths(text)
  const raw = text.match(RAW_LINK) || []
  if (raw.length !== links.length) problems.push(`a link that is not a VEXN page: ${raw.filter((r) => !introLinkPaths(r).length).join(' ')}`)
  if (links.includes(selfPath)) problems.push('links to its own page')
  const dup = links.filter((p, i) => links.indexOf(p) !== i)
  if (dup.length) problems.push(`links twice to ${[...new Set(dup)].join(', ')}`)
  if (/\[|\]/.test(plain)) problems.push('stray [ or ] (a link written wrongly?)')
  const hits = checkContent({ description: plain })
  if (hits.block.length || hits.review.length) problems.push(`content rules: ${[...hits.block, ...hits.review].map((h) => h.match).join(', ')}`)
  const claim = claims && plain.match(HAND_CLAIMS)
  if (claim) problems.push(`claim word "${claim[0]}"`)
  if (counts && /\b\d{2,}\s+(?:videos|titles|scenes|episodes)\b/i.test(plain)) problems.push('an exact count (goes stale)')
  if (introParagraphs(text).some((p) => p.length > 900)) problems.push('a paragraph over 900 characters (split it with a blank line)')
  return problems
}

