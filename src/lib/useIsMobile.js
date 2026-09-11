import { useEffect, useState } from 'react'

export const MOBILE_BREAKPOINT = 768

// Always starts as `false` so the first client render matches the
// prerendered HTML; the real value arrives in the effect. Anything
// whose layout depends on it must reserve space with CSS media queries
// rather than this hook.
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isMobile
}
