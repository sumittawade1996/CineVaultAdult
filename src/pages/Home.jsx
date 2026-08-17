import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import MovieCard from '../components/MovieCard'
import MovieGrid from '../components/MovieGrid'
import AdSlot from '../components/AdSlot'
import Seo from '../components/Seo'
import CardSkeletonGrid from '../components/CardSkeletonGrid'
import { SITE_NAME, SOCIAL_LINKS, FALLBACK_SITE_URL } from '../lib/siteConfig'

const siteUrl = (typeof window !== 'undefined' ? window.location.origin : FALLBACK_SITE_URL).replace(/\/$/, '')

const homeJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/movies?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: siteUrl,
    sameAs: [SOCIAL_LINKS.twitter, SOCIAL_LINKS.telegram],
  },
]

export default function Home() {
  const [featured, setFeatured] = useState([])
  const [latest, setLatest] = useState([])
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: feat }, { data: lat }, { data: arts }] = await Promise.all([
        supabase.from('movies').select('*').eq('featured', true).limit(6),
        supabase.from('movies').select('*').order('created_at', { ascending: false }).limit(12),
        supabase.from('articles').select('*').eq('published', true).order('created_at', { ascending: false }).limit(3),
      ])
      setFeatured(feat || [])
      setLatest(lat || [])
      setArticles(arts || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <>
      <Seo
        title={undefined}
        description="Discover new movie trailers, reviews, and cinema news. Browse a growing library of films with ratings, genres, and in-depth articles."
        jsonLd={homeJsonLd}
      />
      <div className="container home-heading">
        <h1>Movie Trailers, Reviews &amp; Cinema News</h1>
      </div>

      <div className="container">
        {loading ? (
          <>
            <div className="section-head"><h2>Featured</h2></div>
            <CardSkeletonGrid count={6} />
          </>
        ) : (
          featured.length > 0 && (
            <>
              <div className="section-head">
                <h2>Featured</h2>
              </div>
              <div className="movie-grid">
                {featured.map((m) => <MovieCard key={m.id} movie={m} />)}
              </div>
            </>
          )
        )}

        <AdSlot slot="homeLeaderboard" />

        <div className="section-head">
          <h2>Latest additions</h2>
          <Link to="/movies">View all →</Link>
        </div>
        {loading ? (
          <CardSkeletonGrid count={8} />
        ) : latest.length === 0 ? (
          <div className="empty-state">No movies yet. Upload your first batch from the admin page.</div>
        ) : (
          <MovieGrid movies={latest} />
        )}

        <AdSlot slot="homeMidFeed" />

        {articles.length > 0 && (
          <>
            <div className="section-head">
              <h2>From the blog</h2>
              <Link to="/articles">All articles →</Link>
            </div>
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
          </>
        )}
      </div>
    </>
  )
}
