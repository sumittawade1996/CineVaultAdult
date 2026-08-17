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
    async function load() {
      const { data } = await supabase.from('movies').select(field)
      const list = single ? buildSingleTaxonomy(data || [], field) : buildTaxonomy(data || [], field)
      setItems(list)
      setLoading(false)
    }
    load()
  }, [field, single])

  return (
    <>
      <Seo title={title} description={description} />
      <div className="container">
        <div className="section-head"><h2>{title}</h2></div>
        <AdSlot slot="listingTop" />
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : items.length === 0 ? (
          <div className="empty-state">Nothing here yet.</div>
        ) : (
          <div className="taxonomy-grid">
            {items.map((item) => (
              <Link to={`${basePath}/${item.slug}`} key={item.slug} className="taxonomy-chip">
                <span>{item.name}</span>
                <span className="taxonomy-count">{item.count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
