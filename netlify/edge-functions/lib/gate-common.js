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
