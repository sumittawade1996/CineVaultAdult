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
