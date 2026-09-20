import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'
import { MOVIE_CARD_FIELDS } from '../lib/movieFields'
import { usePreload } from '../lib/preload'
import MovieGrid from '../components/MovieGrid'
import Seo from '../components/Seo'
import Pagination from '../components/Pagination'
import CardSkeletonGrid from '../components/CardSkeletonGrid'

const PAGE_SIZE = 20

// An actor/category/channel page listing only one or two titles reads as a
// doorway page to search engines and dilutes the whole site; keep those
// out of the index until enough movies are filed under them. Mirrored in
// scripts/generate-sitemap.mjs, which omits the same pages.
export const MIN_INDEXABLE_TITLES = 3

// Cards don't need the actors column, but the actor pages filter on it.
export const TAXONOMY_FIELDS = `${MOVIE_CARD_FIELDS},actors`

export function displayName(movie, field, slug) {
  return (movie[field] || '')
    .split(',')
    .map((s) => s.trim())
    .find((v) => slugify(v) === slug)
}

// Maps a taxonomy field to the table holding hand-written bios for its top
// entries (categories build their intro from data alone — see below).
const DESC_TABLE = { actors: 'performer_descriptions', channel: 'channel_descriptions' }

export default function TaxonomyDetail({ field, label, backPath, backLabel }) {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') || 1))
  const pre = usePreload()
  const [allMatches, setAllMatches] = useState(pre?.allMatches ?? [])
  const [name, setName] = useState(pre?.name ?? '')
  const [bio, setBio] = useState(pre?.bio ?? null)
  const [loading, setLoading] = useState(!pre)
  const silentRefresh = useRef(!!pre)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (silentRefresh.current) silentRefresh.current = false
      else setLoading(true)
      // Matched server-side against generated slug columns (channel_slug,
      // tags_slugs, actors_slugs — see the taxonomy_slug_columns migration)
      // instead of fetching every movie and filtering in JS: a page for a
      // niche actor no longer downloads the entire catalog to find their
      // handful of titles.
      const descTable = DESC_TABLE[field]
      let query = supabase.from('movies').select(TAXONOMY_FIELDS).order('created_at', { ascending: false })
      query = field === 'channel' ? query.eq('channel_slug', slug) : query.contains(`${field}_slugs`, [slug])
      const [{ data }, bioRes] = await Promise.all([
        query,
        descTable
          ? supabase.from(descTable).select('description').eq('slug', slug).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      if (cancelled) return
      const matches = data || []
      setAllMatches(matches)
      setName((matches.length > 0 && displayName(matches[0], field, slug)) || slug)
      setBio(bioRes.data?.description || null)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [field, slug])

  function goToPage(nextPage) {
    const next = new URLSearchParams(params)
    next.set('page', String(nextPage))
    setParams(next)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  const totalPages = Math.max(1, Math.ceil(allMatches.length / PAGE_SIZE))
  const pageMovies = allMatches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Category pages tally which other tags most often ride along with this
  // one; actor/channel pages tally this person/channel's own most common
  // tags. Either way the intro paragraph and chip links are built from real
  // data instead of being the same boilerplate on every page (thin/
  // duplicate-content risk for search engines).
  const isCategoryPage = field === 'tags'
  let relatedTags = []
  if (allMatches.length > 0) {
    const counts = new Map()
    for (const m of allMatches) {
      for (const t of (m.tags || '').split(',').map((s) => s.trim()).filter(Boolean)) {
        if (isCategoryPage && slugify(t) === slug) continue
        counts.set(t, (counts.get(t) || 0) + 1)
      }
    }
    relatedTags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t)
  }

  const fallbackIntro = isCategoryPage
    ? `${name} on VEXN spans ${allMatches.length.toLocaleString()} ${allMatches.length === 1 ? 'title' : 'titles'}${relatedTags.length ? `, most often paired with ${relatedTags.slice(0, 3).join(', ')}` : ''}. Browse the full ${name} collection below, sorted newest first, or jump into a related category.`
    : field === 'actors'
    ? `${name} appears in ${allMatches.length.toLocaleString()} ${allMatches.length === 1 ? 'movie' : 'movies'} on VEXN${relatedTags.length ? `, most often tagged ${relatedTags.slice(0, 3).join(', ')}` : ''}.`
    : `${name} has ${allMatches.length.toLocaleString()} ${allMatches.length === 1 ? 'movie' : 'movies'} on VEXN${relatedTags.length ? `, spanning tags like ${relatedTags.slice(0, 3).join(', ')}` : ''}.`

  const introText = allMatches.length > 0 ? (bio || fallbackIntro) : null

  const seoDescription = isCategoryPage
    ? `${allMatches.length.toLocaleString()} ${name} movies on VEXN${relatedTags.length ? ` — plus ${relatedTags.slice(0, 3).join(', ')} and more` : ''}.`
    : bio || `Browse every movie ${label.toLowerCase() === 'actor' ? 'starring' : 'in'} ${name} on VEXN.`

  return (
    <>
      <Seo
        title={`${name} — ${label}`}
        description={seoDescription}
        noindex={page > 1 || allMatches.length < MIN_INDEXABLE_TITLES}
      />
      <div className="container">
        <div className="page-head">
          <div>
            <h1>{name}</h1>
            {!loading && (
              <p className="page-sub">
                {allMatches.length.toLocaleString()} {allMatches.length === 1 ? 'title' : 'titles'}
              </p>
            )}
          </div>
          <Link to={backPath} className="btn btn-outline btn-sm">{backLabel} →</Link>
        </div>
        {!loading && introText && <p className="taxonomy-intro">{introText}</p>}
        {!loading && relatedTags.length > 0 && (
          <div className="chip-row" style={{ marginBottom: 20 }}>
            {relatedTags.map((t) => (
              <Link to={`/category/${slugify(t)}`} className="chip" key={t}>{t}</Link>
            ))}
          </div>
        )}
        {loading ? (
          <CardSkeletonGrid count={8} />
        ) : pageMovies.length === 0 ? (
          <div className="empty-state">
            <h2>No movies found</h2>
            <p>Nothing is filed under “{name}” yet.</p>
            <Link to={backPath} className="btn btn-outline">{backLabel}</Link>
          </div>
        ) : (
          <>
            <MovieGrid movies={pageMovies} headingLevel="h2" />
            <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
          </>
        )}
      </div>
    </>
  )
}
