import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Posters go through Netlify Image CDN only on Netlify builds (NETLIFY is
// set in their build environment); local builds keep the original URLs
// so `vite preview` still shows images. Baked in at build time so the
// server-rendered and hydrated markup agree.
const imageCdn = process.env.NETLIFY === 'true' || process.env.IMAGE_CDN === '1'

export default defineConfig({
  plugins: [react()],
  define: {
    __IMAGE_CDN__: JSON.stringify(imageCdn),
  },
  ssr: {
    // Ships CJS without named ESM exports, so it must be bundled into the
    // prerender build rather than imported from node_modules at runtime.
    noExternal: ['react-helmet-async'],
  },
})
