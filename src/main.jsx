import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.jsx'
import { PreloadProvider, normalizePath } from './lib/preload'
import './index.css'

const container = document.getElementById('root')
const preload = window.__VEXN_PRELOAD__ || null

const app = (
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <PreloadProvider value={preload}>
          <App />
        </PreloadProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
)

// Prerendered pages ship their markup in the HTML and are hydrated in
// place. Everything served from the SPA shell (admin, search results,
// paginated and unknown URLs) renders from scratch as before.
const prerendered =
  preload &&
  container.hasChildNodes() &&
  !window.location.search &&
  normalizePath(preload.path) === normalizePath(window.location.pathname)

if (prerendered) {
  hydrateRoot(container, app)
} else {
  container.replaceChildren()
  createRoot(container).render(app)
}

// Makes the site installable as an app and gives it an offline page (public/sw.js). Production only,
// so the dev server and its hot reload are never affected.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
  })
}
