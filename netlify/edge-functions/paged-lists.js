// /movies, /new and the weekly /new/<week> archives are prerendered as page 1. Asked for with ?page=2 and on,
// Netlify serves that same file, so its canonical and robots tags are rewritten for the page asked for
// (pagedCopy in lib/gate-common.js). Performer, category and channel pages get the same in taxonomy-gate.js.
// A request without ?page passes through untouched (the function returns before reading the response).
import { pagedCopy, withBody } from './lib/gate-common.js'

export default async (request, context) => {
  const url = new URL(request.url)
  if (!url.searchParams.has('page')) return
  const response = await context.next()
  if (response.status !== 200 || !(response.headers.get('content-type') || '').includes('text/html')) return response
  const body = await response.text()
  const paged = body.includes('__VEXN_PRELOAD__') ? pagedCopy(body, url) : null
  return withBody(response, paged ?? body)
}

export const config = { path: ['/movies', '/new', '/new/*'] }
