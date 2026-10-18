import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { restoreScroll } from './pageScroll.js'

// Where the visitor was on each page they passed through (kept in memory for this tab, keyed by the
// history entry, so the same page opened twice is remembered separately).
const positions = new Map()
const MAX_REMEMBERED = 200

// The browser keeps the scroll position when the app swaps one page for another, so a page opened from
// the middle of a long list used to open at that same height, and going back never returned to the
// place in the list. Now:
//   opening a link   -> the new page starts at the top (a movie page scrolls to its player itself,
//                       see MovieDetail; paging inside one page, ?page=2, is handled by that page)
//   Back / Forward   -> the position remembered for that history entry is restored
//   first load       -> untouched
export function useScrollBehavior() {
  const { pathname, key } = useLocation()
  const navigationType = useNavigationType()
  const keyRef = useRef(key)
  keyRef.current = key // set while rendering, so a scroll that follows a page change is filed under the new page

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        positions.set(keyRef.current, window.scrollY)
        if (positions.size > MAX_REMEMBERED) positions.delete(positions.keys().next().value)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (navigationType === 'PUSH') {
      if (!pathname.startsWith('/movie/')) window.scrollTo(0, 0)
      return undefined
    }
    const remembered = navigationType === 'POP' ? positions.get(key) : undefined
    return remembered > 0 ? restoreScroll(remembered) : undefined
  }, [pathname, key, navigationType])
}
