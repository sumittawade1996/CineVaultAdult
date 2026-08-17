import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Seo from '../components/Seo'
import AdSlot from '../components/AdSlot'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 20

export default function Articles() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') || 1))
  const [articles, setArticles] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, count } = await supabase
        .from('articles')
        .select('*', { count: 'exact' })
        .eq('published', true)
        .order('created_at', { ascending: false })
        .range(from, to)
      setArticles(data || [])
      setTotal(count || 0)
      setLoading(false)
    }
    load()
  }, [page])

  function goToPage(nextPage) {
    const next = new URLSearchParams(params)
    next.set('page', String(nextPage))
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <Seo title="Articles" description="Reviews, news, and deep dives on the movies you care about." />
      <div className="container">
        <div className="section-head"><h2>Articles</h2></div>
        <AdSlot slot="articlesInFeed" />
        {loading ? (
          <div className="article-grid" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="article-card skeleton-card" key={i}>
                <div className="skeleton-shimmer" style={{ aspectRatio: '16/9' }} />
                <div className="pad">
                  <div className="skeleton-line skeleton-shimmer" style={{ width: '80%', height: 16, marginBottom: 8 }} />
                  <div className="skeleton-line skeleton-shimmer" style={{ width: '60%', height: 12 }} />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="empty-state">No articles published yet.</div>
        ) : (
          <>
            <div className="article-grid">
              {articles.map((a) => (
                <Link to={`/article/${a.slug}`} className="article-card" key={a.id}>
                  {a.cover_image_url && <img src={a.cover_image_url} alt={a.title} loading="lazy" width="640" height="360" />}
                  <div className="pad">
                    <h3>{a.title}</h3>
                    <p>{a.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
          </>
        )}
      </div>
    </>
  )
}
