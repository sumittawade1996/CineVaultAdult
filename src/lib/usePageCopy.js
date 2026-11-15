import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { mergePageCopy } from './pageCopy'

// The wording of a site page (home, categories, channels, actors; src/lib/pageCopy.js): the row the build put in
// the page, then the database's current row. While loading, or before the page_copy table exists, the defaults show.
export function usePageCopy(slug, preloaded) {
  const [row, setRow] = useState(preloaded ?? null)
  useEffect(() => {
    let cancelled = false
    supabase.from('page_copy').select('*').eq('slug', slug).maybeSingle().then(({ data }) => {
      if (!cancelled && data) setRow(data)
    })
    return () => { cancelled = true }
  }, [slug])
  return mergePageCopy(slug, row)
}
