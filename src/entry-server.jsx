import { StrictMode } from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { HelmetProvider } from 'react-helmet-async'
import { PassThrough } from 'node:stream'
import App from './App'
import { PreloadProvider } from './lib/preload'

// Build-time only: scripts/prerender.mjs calls this once per public URL
// and writes the result to dist/. A stream is used instead of
// renderToString because the route components are React.lazy — the
// stream waits for their chunks to load before emitting the page.
export function render(url, preload) {
  const helmetContext = {}
  return new Promise((resolve, reject) => {
    const stream = renderToPipeableStream(
      <StrictMode>
        <HelmetProvider context={helmetContext}>
          <StaticRouter location={url}>
            <PreloadProvider value={preload}>
              <App />
            </PreloadProvider>
          </StaticRouter>
        </HelmetProvider>
      </StrictMode>,
      {
        onAllReady() {
          const sink = new PassThrough()
          let html = ''
          sink.on('data', (chunk) => { html += chunk })
          sink.on('end', () => resolve({ html, helmet: helmetContext.helmet }))
          stream.pipe(sink)
        },
        onError: reject,
      }
    )
  })
}
