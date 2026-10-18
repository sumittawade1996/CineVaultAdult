// Which site hosts a video's player: the `source` column (migration 013).
// The same mapping the migration used for the existing rows; the admin forms
// call it so new videos get a source without anyone typing it.
const HOSTS = [
  [/^https?:\/\/(www\.)?eporner\.com\//i, 'Eporner'],
  [/^https?:\/\/([a-z]+\.)?pornhub\./i, 'PornHub'],
  [/^https?:\/\/(www\.)?superporn\.com\//i, 'SuperPorn'],
  [/^https?:\/\/(www\.)?luluvdo\.com\//i, 'Luluvdo'],
  [/youtu(\.be|be\.com)/i, 'YouTube'],
]

export function sourceFromUrl(url) {
  const value = String(url || '').trim()
  for (const [re, name] of HOSTS) if (re.test(value)) return name
  return null
}
