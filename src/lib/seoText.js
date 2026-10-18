// Shortens text for a <meta name="description">: whole sentences when they
// fit, otherwise whole words with an ellipsis. Search engines cut descriptions
// at about 155–160 characters.
export function clipText(text, max = 160) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const head = clean.slice(0, max)
  const sentenceEnd = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '))
  if (sentenceEnd >= max * 0.5) return head.slice(0, sentenceEnd + 1)
  const wordEnd = head.slice(0, max - 1).lastIndexOf(' ')
  return `${head.slice(0, wordEnd > 0 ? wordEnd : max - 1).replace(/[\s,;:–—-]+$/, '')}…`
}
