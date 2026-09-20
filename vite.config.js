import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Posters go through Netlify Image CDN only on Netlify builds (NETLIFY is
// set in their build environment); local builds keep the original URLs
// so `vite preview` still shows images. Baked in at build time so the
// server-rendered and hydrated markup agree.
const imageCdn = process.env.NETLIFY === 'true' || process.env.IMAGE_CDN === '1'

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  define: {
    __IMAGE_CDN__: JSON.stringify(imageCdn),
  },
  ssr: {
    // Ships CJS without named ESM exports, so it must be bundled into the
    // prerender build rather than imported from node_modules at runtime.
    noExternal: ['react-helmet-async'],
  },
  build: {
    rollupOptions: isSsrBuild
      ? {}
      : {
          output: {
            // Vendor libraries change far less often than app code. Splitting
            // them into their own chunk means a deploy that only touches app
            // code doesn't force visitors to re-download React/Supabase/etc —
            // the vendor chunk keeps its own cache-busted filename and stays
            // cached across deploys where its contents are unchanged.
            // SSR-only: the prerender build (`vite build --ssr ...`)
            // externalizes react/react-dom by default, which conflicts with
            // also putting them in manualChunks — so this only applies to
            // the client build.
            manualChunks: {
              vendor: ['react', 'react-dom', 'react-router-dom', 'react-helmet-async'],
              supabase: ['@supabase/supabase-js'],
            },
          },
        },
  },
}))
