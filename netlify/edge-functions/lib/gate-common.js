// Pieces shared by the edge functions that answer 404/410 for URLs that do not exist
// (movie-gate.js for /movie/*, taxonomy-gate.js for /actor, /category, /channel, /article).
// This file is a helper module, not a function: it sits in a sub-folder and has no `config`.

export const FETCH_TIMEOUT_MS = 2000

export function supabaseGet(env, path, extraHeaders = {}) {
  return fetch(`${env.url}/rest/v1/${path}`, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}`, ...extraHeaders },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
}

// The app shell (the visitor sees the site's own "not found" page); a tiny page if it cannot be fetched.
export async function appShell(request) {
  try {
    const res = await fetch(new URL('/app.html', request.url), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (res.ok) return await res.text()
  } catch { /* fall through */ }
  return '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>Page not found | VEXN</title></head><body><h1>Page not found</h1><p><a href="/">VEXN home</a></p></body></html>'
}

// A 404/410 response with the shell as its body and `X-Robots-Tag: noindex`.
export async function statusPage(request, status) {
  return new Response(await appShell(request), {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex',
      'cache-control': 'public, max-age=300',
    },
  })
}

// A prerendered list page answers every ?page=N with the file of page 1 (the query is not part of the file name),
// so its canonical, og:url and robots tags are page 1's until the browser runs the app. For page 2 and on they are
// rewritten in the HTML itself, the way the app sets them (src/components/Seo.jsx, src/lib/seoUrl.js): canonical to
// its own ?page=N, noindex,follow. Returns the new HTML, or null when there is nothing to change.
export function pagedCopy(body, url) {
  const n = Number.parseInt(url.searchParams.get('page') || '', 10)
  if (!(n > 1)) return null
  return body
    .replace(/(<link[^>]*rel="canonical"[^>]*href=")([^"?]*)(")/, `$1$2?page=${n}$3`)
    .replace(/(<meta[^>]*property="og:url"[^>]*content=")([^"?]*)(")/, `$1$2?page=${n}$3`)
    .replace(/(<meta[^>]*name="robots"[^>]*content=")[^"]*(")/, '$1noindex, follow$2')
}

// The same response with another body (the length header would be wrong)
export function withBody(response, body) {
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(body, { status: response.status, headers })
}
