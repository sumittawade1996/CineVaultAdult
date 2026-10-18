// Scroll helpers for page changes inside the app.
//
// A freshly opened page keeps changing height for a few seconds: posters load, lists arrive, ad slots
// fill and then collapse when they stay empty. On a short page the browser also clamps the scroll
// position whenever the page shrinks. A single scroll call is therefore not enough to leave a page where
// it was put, so both helpers apply their target again at a few moments, and only while the visitor
// has not scrolled, touched or pressed a key themselves.
const STOP_EVENTS = ['wheel', 'touchstart', 'keydown', 'mousedown']

function repeatUntilTouched(times, step) {
  let done = false
  const timers = []
  const stop = () => {
    done = true
    timers.forEach(clearTimeout)
    STOP_EVENTS.forEach((e) => window.removeEventListener(e, stop))
  }
  STOP_EVENTS.forEach((e) => window.addEventListener(e, stop, { passive: true }))
  times.forEach((ms, i) => {
    timers.push(setTimeout(() => {
      if (done) return
      step(i)
      if (i === times.length - 1) stop()
    }, ms))
  })
  return stop
}

// Puts an element at the top of the screen and keeps it there while the page settles. getEl() is called
// each time (a re-render can replace the element). With no element the page starts at the top.
// Returns a function that stops it.
export function pinToTop(getEl, { offset = 72, at = [0, 250, 700, 1500, 3300], tolerance = 8 } = {}) {
  return repeatUntilTouched(at, (i) => {
    const el = getEl()
    if (!el) {
      if (i === 0) window.scrollTo(0, 0)
    } else if (Math.abs(el.getBoundingClientRect().top - offset) > tolerance) {
      el.scrollIntoView({ block: 'start' }) // the element's CSS scroll-margin-top keeps it clear of the sticky header
    }
  })
}

// Returns to a remembered scroll position (Back and Forward). The page may not be tall enough yet, so
// it goes as far as it can and tries again as the content arrives.
export function restoreScroll(y, { at = [0, 120, 300, 700, 1500, 3000], tolerance = 4 } = {}) {
  return repeatUntilTouched(at, () => {
    const reachable = Math.max(0, Math.min(y, document.documentElement.scrollHeight - window.innerHeight))
    if (Math.abs(window.scrollY - reachable) > tolerance) window.scrollTo(0, reachable)
  })
}
