// The one "watch" shortcut the header and the homepage show. It used to be personalised ("Continue watching" and
// "More <favourite>" for returning visitors, from a record of the last video kept in the visitor's browser); the
// owner asked for the plain "Watch Indian movies" button only, so the record is no longer kept and any record
// left in a browser by the old version is deleted.

const OLD_KEY = 'vexn:watch:v1'

export const INDIAN_SHORTCUT = {
  kind: 'default',
  to: '/category/indian',
  label: 'Watch Indian movies',
  short: 'Indian',
}

export function forgetWatchHistory() {
  try { localStorage.removeItem(OLD_KEY) } catch { /* storage blocked: nothing to delete */ }
}
