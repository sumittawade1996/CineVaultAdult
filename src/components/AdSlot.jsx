import { useEffect, useRef, useState } from 'react'
import { AD_SLOTS } from '../lib/adSlots'

const MOBILE_BREAKPOINT = 768

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isMobile
}

// Renders one named ad placement. Looks up its config in
// src/lib/adSlots.js — if the resolved html is still null, shows a
// visible placeholder box instead so layout/spacing stays correct
// while you wait on approval.
//
// Performance: the actual ad markup isn't injected until the slot is
// about to scroll into view (IntersectionObserver), so ad scripts on
// far-down-the-page slots don't compete with the initial page load.
//
// When real code IS present, it's injected via the DOM directly (not
// dangerouslySetInnerHTML) so any <script> tags inside the snippet
// actually execute — most ad networks' code won't run otherwise.
export default function AdSlot({ slot, className = '' }) {
  const wrapperRef = useRef(null)
  const contentRef = useRef(null)
  const [inView, setInView] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const config = AD_SLOTS[slot]
  const isMobile = useIsMobile()

  // Resolve which markup applies to this screen size.
  const resolvedHtml = config
    ? isMobile
      ? config.mobileHtml ?? (config.desktopOnly ? null : config.html)
      : config.desktopHtml ?? (config.mobileOnly ? null : config.html)
    : null

  const suppressed =
    !config || (config.desktopOnly && isMobile) || (config.mobileOnly && !isMobile)

  useEffect(() => {
    if (suppressed || !wrapperRef.current) return
    const el = wrapperRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [suppressed])

  useEffect(() => {
    if (!inView || !contentRef.current || !resolvedHtml) return
    contentRef.current.innerHTML = resolvedHtml
    contentRef.current.querySelectorAll('script').forEach((oldScript) => {
      const newScript = document.createElement('script')
      Array.from(oldScript.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value))
      newScript.textContent = oldScript.textContent
      oldScript.replaceWith(newScript)
    })
  }, [inView, resolvedHtml])

  useEffect(() => {
    if (config?.dismissible && sessionStorage.getItem(`ad-dismissed-${slot}`) === '1') {
      setDismissed(true)
    }
  }, [config, slot])

  if (suppressed || dismissed) return null

  const formatClass = config.format ? `ad-slot--${config.format}` : ''
  const wrapperClass = `ad-slot-wrap ${formatClass} ${className}`.trim()

  function dismiss() {
    setDismissed(true)
    sessionStorage.setItem(`ad-dismissed-${slot}`, '1')
  }

  return (
    <div className={wrapperClass} ref={wrapperRef}>
      {config.dismissible && (
        <button className="ad-slot-close" aria-label="Dismiss ad" onClick={dismiss}>
          ×
        </button>
      )}
      {resolvedHtml ? (
        <div className="ad-slot-live" ref={contentRef} aria-label={config.label} />
      ) : (
        <div className="ad-slot" role="complementary" aria-label={config.label} ref={contentRef}>
          {config.label} — ad slot{isMobile ? ' (mobile)' : ''}
        </div>
      )}
    </div>
  )
}
