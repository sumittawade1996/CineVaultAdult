// Pure helpers for scripts/check-dead-embeds.mjs (plan T18): which source a
// trailer_url points at, and what the source's API says about the video.

// -> { source: 'eporner' | 'pornhub', code } | null (other hosts are not checked)
export function sourceOf(trailerUrl) {
  const url = String(trailerUrl || '').trim()
  let m = url.match(/^https?:\/\/(?:www\.)?eporner\.com\/embed\/([A-Za-z0-9]+)/i)
  if (m) return { source: 'eporner', code: m[1] }
  m = url.match(/^https?:\/\/(?:www\.)?pornhub\.(?:com|org)\/embed\/([A-Za-z0-9]+)/i)
  if (m) return { source: 'pornhub', code: m[1] }
  return null
}

export const apiUrl = ({ source, code }) =>
  source === 'eporner'
    ? `https://www.eporner.com/api/v2/video/id/?id=${encodeURIComponent(code)}&format=json`
    : `https://www.pornhub.com/webmasters/video_by_id?id=${encodeURIComponent(code)}`

// 'ok'    the source still lists the video
// 'dead'  the source says it has no such video (removed or never existed)
// 'error' anything else: rate limit, outage, unexpected body. Never treated as dead.
export function classify(source, status, bodyText) {
  if (status !== 200) return 'error'
  let body
  try {
    body = JSON.parse(bodyText)
  } catch {
    return 'error'
  }
  if (source === 'eporner') {
    if (Array.isArray(body)) return body.length === 0 ? 'dead' : 'error'
    return body && typeof body === 'object' && body.id ? 'ok' : 'error'
  }
  if (source === 'pornhub') {
    if (body && body.video && body.video.video_id) return 'ok'
    // code 2002 = "No video with this ID."
    if (body && String(body.code) === '2002') return 'dead'
    return 'error'
  }
  return 'error'
}
