import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePreload } from '../lib/preload'
import Seo from '../components/Seo'
import AdSlot from '../components/AdSlot'
import { FALLBACK_SITE_URL } from '../lib/siteConfig'

export default function ArticleDetail() {
  const { slug } = useParams()
  const pre = usePreload()
  const [article, setArticle] = useState(pre?.article ?? null)
  const [notFound, setNotFound] = useState(false)
  const silentRefresh = useRef(!!pre)

  useEffect(() => {
    let cancelled = false
    if (silentRefresh.current) {
      silentRefresh.current = false
    } else {
      setArticle(null)
      setNotFound(false)
    }
    async function load() {
      const { data } = await supabase.from('articles').select('*').eq('slug', slug).single()
      if (cancelled) return
      if (!data) setNotFound(true)
      else setArticle(data)
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  if (notFound) {
    return (
      <div className="container empty-state">
        Article not found. <Link to="/articles">Back to all articles →</Link>
      </div>
    )
  }
  if (!article) {
    return (
      <div className="container" style={{ maxWidth: 760, padding: '48px 24px' }}>
        <div className="skeleton-line skeleton-shimmer" style={{ width: '40%', height: 14, marginBottom: 12 }} />
        <div className="skeleton-line skeleton-shimmer" style={{ width: '85%', height: 32, marginBottom: 20 }} />
        <div className="skeleton-shimmer" style={{ aspectRatio: '16/9', borderRadius: 10, marginBottom: 20 }} />
        <div className="skeleton-line skeleton-shimmer" style={{ width: '100%', height: 14, marginBottom: 8 }} />
        <div className="skeleton-line skeleton-shimmer" style={{ width: '95%', height: 14, marginBottom: 8 }} />
        <div className="skeleton-line skeleton-shimmer" style={{ width: '90%', height: 14 }} />
      </div>
    )
  }

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.seo_description || article.excerpt || undefined,
    image: article.cover_image_url || undefined,
    author: article.author ? { '@type': 'Person', name: article.author } : undefined,
    datePublished: article.created_at || undefined,
    mainEntityOfPage: `${FALLBACK_SITE_URL}/article/${article.slug}`,
  }

  return (
    <>
      <Seo
        title={article.seo_title || article.title}
        description={article.seo_description || article.excerpt}
        image={article.cover_image_url}
        type="article"
        jsonLd={articleJsonLd}
      />
      <div className="container" style={{ maxWidth: 760, padding: '48px 24px' }}>
        <div className="hero-eyebrow">{article.author}</div>
        <h1 className="detail-title">{article.title}</h1>
        {article.cover_image_url && (
          <img
            src={article.cover_image_url}
            alt={article.title}
            width="1200"
            height="675"
            style={{ width: '100%', height: 'auto', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10, margin: '20px 0', border: '1px solid var(--line)' }}
          />
        )}
        <AdSlot slot="midArticle" />
        <div
          style={{ color: 'var(--text)', lineHeight: 1.8, fontSize: 16 }}
          dangerouslySetInnerHTML={{ __html: article.content || '' }}
        />
        <AdSlot slot="inArticle" />
      </div>
    </>
  )
}
