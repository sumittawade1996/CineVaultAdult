// The push key arrives as URL-safe base64; the browser's push API wants bytes. Kept on its own so it can be tested without a browser.
export function keyToBytes(base64url) {
  const padded = base64url + '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
