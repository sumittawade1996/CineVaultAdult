import { createContext, useContext } from 'react'
import { useLocation } from 'react-router-dom'

// Prerendered pages embed the data they were built with (see
// scripts/prerender.mjs) so the first client render matches the server
// HTML exactly and hydrates without a skeleton flash. The data is only
// handed out while the URL still matches: after any client-side
// navigation, pages fetch from Supabase as they always did.
const PreloadContext = createContext(null)

export function normalizePath(path) {
  const trimmed = path.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export function PreloadProvider({ value, children }) {
  return <PreloadContext.Provider value={value}>{children}</PreloadContext.Provider>
}

export function usePreload() {
  const preload = useContext(PreloadContext)
  const { pathname, search } = useLocation()
  if (!preload || !preload.data) return null
  return normalizePath(preload.path) === normalizePath(pathname) + search ? preload.data : null
}
