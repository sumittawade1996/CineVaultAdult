import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buildTaxonomy, buildSingleTaxonomy } from '../lib/taxonomy'
import { usePreload } from '../lib/preload'
import Seo from '../components/Seo'
import AdSlot from '../components/AdSlot'

const TILE_COUNT = 20

export default function TaxonomyList({ field, single, title, basePath, description, withImages }) {
  const pre = usePreload()
  const [items, setItems] = useState(pre?.items ?? [])
  const [loading, setLoading] = useState(!pre)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const selectFields = withImages ? `${field}, poster_url, rating` : field
      let query = supabase.from('movies').select(selectFields)
      if (withImages) query = query.order('rating', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
      const [{ data }, overridesRes] = await Promise.all([
        query,
        withImages ? supabase.from('category_image_overrides').select('slug, image_url') : Promise.resolve({ data: null }),
      ])
      if (cancelled) return
      const list = single ? buildSingleTaxonomy(data || [], field) : buildTaxonomy(data || [], field)
      const overrides = new Map((overridesRes.data || []).map((o) => [o.slug, o.image_url]))
      const withOverrides = overrides.size ? list.map((item) => (overrides.has(item.slug) ? { ...item, poster: overrides.get(item.slug) } : item)) : list
      setItems(withOverrides)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [field, single, withImages])

  const tiles = withImages ? items.slice(0, TILE_COUNT) : []
  const chips = withImages ? items.slice(TILE_COUNT) : items

  return (
    <>
      <Seo title={title} description={description} />
      <div className="container">
        <div className="page-head">
          <div>
            <h1>{title}</h1>
            {!loading && <p className="page-sub">{items.length.toLocaleString()} {items.length === 1 ? 'entry' : 'entries'}</p>}
          </div>
        </div>
        <AdSlot slot="listingTop" />
        {loading ? (
          <div className="taxonomy-grid" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <div className="taxonomy-chip skeleton-shimmer" key={i} style={{ minHeight: 48 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <h2>Nothing here yet</h2>
            <p>Entries appear automatically once movies are added.</p>
          </div>
        ) : (
          <>
            {tiles.length > 0 && (
              <div className="taxonomy-tile-grid">
                {tiles.map((item) => (
                  <Link to={`${basePath}/${item.slug}`} key={item.slug} className="taxonomy-tile">
                    {item.poster && <img src={item.poster} alt="" loading="lazy" decoding="async" />}
                    <div className="taxonomy-tile-overlay">
                      <span>{item.name}</span>
                      <span className="taxonomy-count" aria-label={`${item.count} movies`}>{item.count}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {chips.length > 0 && (
              <div className="taxonomy-grid">
                {chips.map((item) => (
                  <Link to={`${basePath}/${item.slug}`} key={item.slug} className="taxonomy-chip">
                    <span>{item.name}</span>
                    <span className="taxonomy-count" aria-label={`${item.count} movies`}>{item.count}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
