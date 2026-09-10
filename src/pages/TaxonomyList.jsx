import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buildTaxonomy, buildSingleTaxonomy } from '../lib/taxonomy'
import Seo from '../components/Seo'
import AdSlot from '../components/AdSlot'

export default function TaxonomyList({ field, single, title, basePath, description }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('movies').select(field)
      if (cancelled) return
      const list = single ? buildSingleTaxonomy(data || [], field) : buildTaxonomy(data || [], field)
      setItems(list)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [field, single])

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
          <div className="taxonomy-grid">
            {items.map((item) => (
              <Link to={`${basePath}/${item.slug}`} key={item.slug} className="taxonomy-chip">
                <span>{item.name}</span>
                <span className="taxonomy-count" aria-label={`${item.count} movies`}>{item.count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
