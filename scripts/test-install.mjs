// node scripts/test-install.mjs
import assert from 'node:assert/strict'
import { installMode } from '../src/lib/installMode.js'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1'
const IPHONE_INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0'
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'
const DESKTOP_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0'

const cases = [
  // the browser offered its install event: a button can open the install dialog
  () => assert.equal(installMode({ userAgent: ANDROID_CHROME, hasPrompt: true }), 'prompt'),
  () => assert.equal(installMode({ userAgent: DESKTOP_FIREFOX, hasPrompt: true }), 'prompt'),
  // already running as an installed app: nothing to offer, even if the event is still around
  () => assert.equal(installMode({ userAgent: ANDROID_CHROME, hasPrompt: true, standalone: true }), null),
  () => assert.equal(installMode({ userAgent: IPHONE, standalone: true }), null),
  // iPhone and iPad: show the two manual steps
  () => assert.equal(installMode({ userAgent: IPHONE }), 'ios'),
  () => assert.equal(installMode({ userAgent: IPHONE_CHROME }), 'ios'),
  () => assert.equal(installMode({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 5 }), 'ios'),
  // a real Mac (no touch screen) is not an iPad
  () => assert.equal(installMode({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 0 }), null),
  // in-app browsers cannot add to the home screen
  () => assert.equal(installMode({ userAgent: IPHONE_INSTAGRAM }), null),
  // browsers that cannot install a site and fired no event
  () => assert.equal(installMode({ userAgent: ANDROID_CHROME }), null),
  () => assert.equal(installMode({ userAgent: DESKTOP_FIREFOX }), null),
  () => assert.equal(installMode(), null),
]

let failed = 0
cases.forEach((run, i) => {
  try { run() } catch (err) { failed++; console.log(`  FAIL #${i + 1}: ${err.message.split('\n').slice(0, 3).join(' | ')}`) }
})
console.log(`${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
