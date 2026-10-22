// When the "new-video alerts" prompt may appear. Pure, so it can be tested without a browser.
//
// A website cannot sign anyone up silently: the browser always asks the visitor "Allow notifications?" and a
// "Block" there is permanent for that site. So the prompt is a soft question of our own first (Yes / Not now);
// only "Yes" opens the browser's question, and "Not now" leaves the browser's permission untouched, so we
// can ask again later.
export const DISMISS_DAYS = 14

// visits: page loads in this browser; standalone: running as the installed app; ageOk: the 18+ screen was
// accepted; dismissedAt: ms timestamp of "Not now" (or 0); optedOut: the visitor turned the alerts off
// themselves, which is never asked again.
export function shouldPrompt({ visits = 0, standalone = false, ageOk = false, dismissedAt = 0, optedOut = false, now = Date.now() } = {}) {
  if (!ageOk || optedOut) return false
  if (!standalone && visits < 2) return false // never on a first visit
  if (dismissedAt && now - dismissedAt < DISMISS_DAYS * 86400 * 1000) return false
  return true
}
