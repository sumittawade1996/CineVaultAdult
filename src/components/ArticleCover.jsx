import { useEffect, useRef, useState } from 'react'

// Article cover image. Most covers are video thumbnails loaded from the source site, and they disappear when the
// source removes the video (three did by Nov 2026). A cover that fails to load is replaced by the site's default
// image, and if that fails too the image is left out, so a reader never sees a broken-image icon. A failure that
// happened before the page hydrated (React attaches onError late) is caught by the check after mount.
export const DEFAULT_COVER = '/og-default.png'

export default function ArticleCover({ src, alt, ...props }) {
  const [current, setCurrent] = useState(src)
  const ref = useRef(null)

  useEffect(() => { setCurrent(src) }, [src])

  const fail = () => setCurrent((now) => (now === DEFAULT_COVER ? null : DEFAULT_COVER))

  useEffect(() => {
    const img = ref.current
    if (img && img.complete && img.naturalWidth === 0) fail()
  }, [current])

  if (!current) return null
  return <img ref={ref} src={current} alt={alt} onError={fail} {...props} />
}
