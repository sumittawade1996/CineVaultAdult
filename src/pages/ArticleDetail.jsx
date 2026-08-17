import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Seo from '../components/Seo'
import AdSlot from '../components/AdSlot'
import { FALLBACK_SITE_URL } from '../lib/siteConfig'

export default function ArticleDetail() {
  const { slug } = useParams()
  const [article, setArticle] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('articles').select('*').eq('slug', slug).single()
      if (!data) setNotFound(true)
      else setArticle(data)
    }
    load()
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

  const siteUrl = (typeof window !== 'undefined' ? window.location.origin : FALLBACK_SITE_URL).replace(/\/$/, '')
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.seo_description || article.excerpt || undefined,
    image: article.cover_image_url || undefined,
    author: article.author ? { '@type': 'Person', name: article.author } : undefined,
    datePublished: article.created_at || undefined,
    mainEntityOfPage: `${siteUrl}/article/${article.slug}`,
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
