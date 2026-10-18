// Central place for site-wide constants — social links, site name, etc.
// Edit these values any time; every component that shows a social link
// or the site name pulls from here so you only change it in one place.

export const SITE_NAME = 'VEXN'

// Channel for a video that belongs to no studio or app. The admin forms use it when the field is
// empty; it is a catch-all, so src/lib/indexing.js keeps its page out of the index.
export const DEFAULT_CHANNEL = 'VEXN'

export const SOCIAL_LINKS = {
  twitter: 'https://x.com/dezzymodel',
  telegram: 'https://t.me/Vexonvxh',
}

// Used for canonical URLs / structured data when window isn't available
// (falls back to this at build time; overridden by SITE_URL env var).
export const FALLBACK_SITE_URL = 'https://vexn.org'

// Share image (1200x630, public/og-default.png) for every page that has no
// image of its own: link cards on X, Telegram, WhatsApp and search results.
export const DEFAULT_OG_IMAGE = `${FALLBACK_SITE_URL}/og-default.png`

// "N watching now" badge in the navbar = this base number + the real
// live Supabase Presence count. Common social-proof pattern — just be
// aware it means the number isn't 100% literal concurrent visitors.
// Set to 0 to show only the real count.
export const BASE_VIEWER_COUNT = 15900
