// Which "install VEXN as an app" help to offer this visitor (pure, so it can be tested without a browser).
//
//   'prompt'  Chrome, Edge and other Chromium browsers fired `beforeinstallprompt`: a button can open the
//             browser's own install dialog.
//   'ios'     iPhone and iPad have no install dialog; the visitor has to use Share > Add to Home Screen,
//             so the button shows those two steps.
//   null      nothing to offer: already running as an installed app, an in-app browser (Instagram, Facebook,
//             WeChat ... cannot add to the home screen), or a browser that cannot install sites.
export function installMode({ userAgent = '', platform = '', maxTouchPoints = 0, standalone = false, hasPrompt = false } = {}) {
  if (standalone) return null
  if (hasPrompt) return 'prompt'
  // iPadOS 13+ reports itself as a Mac, so a touch screen on "MacIntel" is an iPad
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
  const inApp = /FBAN|FBAV|Instagram|Line\/|Snapchat|MicroMessenger|Twitter/i.test(userAgent)
  return ios && !inApp ? 'ios' : null
}
