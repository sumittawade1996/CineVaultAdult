import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'
import { fetchAll } from '../lib/fetchAll'
// Attribute tags, the Eporner channel and thin pages stay out of the index
// (plan T10); scripts/generate-sitemap.mjs applies the same rules.
import { isIndexableTaxonomy } from '../lib/indexing'
import { clipText } from '../lib/seoText'
import { TAXONOMY_FIELDS } from '../lib/movieFields'
import { pickRail, summarizeMatches } from '../lib/taxonomyFacts'
import { getPosterUrl } from '../lib/poster'
import { checkContent } from '../lib/contentRules'
import { AD_SLOTS } from '../lib/adSlots'
import { usePreload } from '../lib/preload'
import AdSlot from '../components/AdSlot'
import MovieCard from '../components/MovieCard'
import MovieGrid from '../components/MovieGrid'
import Seo from '../components/Seo'
import Breadcrumbs from '../components/Breadcrumbs'
import { breadcrumbJsonLd } from '../lib/breadcrumbs'
import Pagination from '../components/Pagination'
import CardSkeletonGrid from '../components/CardSkeletonGrid'

const PAGE_SIZE = 20

// Cards don't need the actors column, but the actor pages filter on it.
export { TAXONOMY_FIELDS }

export function displayName(movie, field, slug) {
  return (movie[field] || '')
    .split(',')
    .map((s) => s.trim())
    .find((v) => slugify(v) === slug)
}

// Maps a taxonomy field to the table holding hand-written copy for its top
// entries. Actors and channels have a one-paragraph bio; categories have the
// richer category_descriptions row (H1, intro, SEO title/description, FAQ and
// an index switch — plan T12). Pages without a row fall back to a sentence
// built from the data.
const DESC_TABLE = { actors: 'performer_descriptions', channel: 'channel_descriptions' }
const CATEGORY_COLUMNS = 'slug,title,intro,seo_title,seo_description,faq,is_indexable'

export default function TaxonomyDetail({ field, label, backPath, backLabel }) {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') || 1))
  const pre = usePreload()
  const [allMatches, setAllMatches] = useState(pre?.allMatches ?? [])
  const [name, setName] = useState(pre?.name ?? '')
  const [bio, setBio] = useState(pre?.bio ?? null)
  const [catDesc, setCatDesc] = useState(pre?.catDesc ?? null)
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
      // page by page: a big category can match more than the 1,000 rows one request returns (src/lib/fetchAll.js)
      const buildQuery = () => {
        const query = supabase.from('movies').select(TAXONOMY_FIELDS).order('created_at', { ascending: false }).order('id')
        return field === 'channel' ? query.eq('channel_slug', slug) : query.contains(`${field}_slugs`, [slug])
      }
      const [{ data }, bioRes, catRes] = await Promise.all([
        fetchAll(buildQuery),
        descTable
          ? supabase.from(descTable).select('description').eq('slug', slug).maybeSingle()
          : Promise.resolve({ data: null }),
        field === 'tags'
          ? supabase.from('category_descriptions').select(CATEGORY_COLUMNS).eq('slug', slug).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      if (cancelled) return
      const matches = data || []
      setAllMatches(matches)
      setName((matches.length > 0 && displayName(matches[0], field, slug)) || slug)
      setBio(bioRes.data?.description || null)
      setCatDesc(catRes.data || null)
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

  // A written category intro is followed by one sentence from live data, so
  // the page text still changes as titles are added.
  const dataLine = `${allMatches.length.toLocaleString()} ${allMatches.length === 1 ? 'title is' : 'titles are'} filed under ${name} right now${relatedTags.length ? `, most often together with ${relatedTags.slice(0, 3).join(', ')}` : ''}.`
  const introText = allMatches.length > 0
    ? (catDesc?.intro ? `${catDesc.intro} ${dataLine}` : bio || fallbackIntro)
    : null
  // Performer and channel pages get a counted summary (runtime, channels,
  // co-stars, longest videos); categories have written intros instead.
  const facts = isCategoryPage ? null : summarizeMatches(allMatches, { ownSlug: field === 'actors' ? slug : null })
  // Desktop side rail beside the intro: an ad when one is configured (src/lib/adSlots.js,
  // taxonomyRail), and poster picks that fill the rest of the height. Hidden on phones and tablets.
  const railAd = Boolean(AD_SLOTS.taxonomyRail?.html)
  // Rows the content rules flag (block or review) are never promoted here, even if featured.
  const railEligible = (m) => {
    const hits = checkContent(m)
    return Boolean(getPosterUrl(m)) && hits.block.length === 0 && hits.review.length === 0
  }
  const railPicks = loading ? [] : pickRail(allMatches, railAd ? (facts ? 1 : 0) : (facts ? 2 : 1), railEligible)
  const showRail = !loading && (railAd || railPicks.length > 0)
  const faq = Array.isArray(catDesc?.faq) ? catDesc.faq.filter((f) => f?.q && f?.a) : []
  const heading = catDesc?.title || name

  // Without written copy the description is built from the data (70–170
  // characters); a hand-written bio is clipped to fit.
  const count = allMatches.length.toLocaleString()
  const tagList = relatedTags.slice(0, 3).join(', ')
  const generatedDescription = isCategoryPage
    ? `${count} ${name} videos on VEXN${tagList ? `, often tagged ${tagList}` : ''}. Newest first, with the cast, tags and runtime on every video page.`
    : field === 'actors'
    ? `${name} in ${count} ${allMatches.length === 1 ? 'video' : 'videos'} on VEXN${tagList ? `, tagged ${tagList}` : ''}. Open a scene for the cast, tags and runtime; every video plays from its source site.`
    : `${count} ${allMatches.length === 1 ? 'video' : 'videos'} from ${name} on VEXN${tagList ? `, tagged ${tagList}` : ''}. Newest first, with the cast, tags and runtime on every video page.`
  // A short hand-written bio (under 120 characters) is topped up with the data sentence, so the
  // description fills the space a search result gives it.
  const bioClip = bio ? clipText(bio) : ''
  const topUp = `${count} ${allMatches.length === 1 ? 'video' : 'videos'} on VEXN, newest first.`
  const seoDescription = catDesc?.seo_description || (bioClip.length >= 120 ? bioClip : bioClip ? clipText(`${bioClip} ${topUp}`) : generatedDescription)
  // The search title names what people look for ("<name> porn videos"); the visible heading stays the name.
  // A channel and a performer can share a name, so a channel title says so.
  const fallbackTitle = field === 'channel' ? `${name} Porn Videos – Channel` : isCategoryPage ? `${name} Porn Videos` : `${name} Porn Videos and Scenes`

  // Home › Categories|Actors|Channels › this page
  const crumbs = [
    { name: 'Home', to: '/' },
    { name: backLabel.replace(/^All /, '').replace(/^./, (c) => c.toUpperCase()), to: backPath },
    { name: name || slug, to: `${field === 'actors' ? '/actor' : field === 'tags' ? '/category' : '/channel'}/${slug}` },
  ]

  return (
    <>
      <Seo
        title={catDesc?.seo_title || fallbackTitle}
        description={seoDescription}
        noindex={page > 1 || catDesc?.is_indexable === false || !isIndexableTaxonomy(field, slug, allMatches.length)}
        jsonLd={breadcrumbJsonLd(crumbs)}
      />
      <div className="container">
        <Breadcrumbs items={crumbs} />
        <div className="page-head">
          <div>
            <h1>{heading}</h1>
            {!loading && (
              <p className="page-sub">
                {allMatches.length.toLocaleString()} {allMatches.length === 1 ? 'title' : 'titles'}
              </p>
            )}
          </div>
          <Link to={backPath} className="btn btn-outline btn-sm">{backLabel} →</Link>
        </div>
        <div className={`taxonomy-band${showRail ? ' taxonomy-band--rail' : ''}`}>
        <div className="taxonomy-band-main">
        {!loading && introText && <p className="taxonomy-intro">{introText}</p>}
        {!loading && relatedTags.length > 0 && (
          <div className="chip-row" style={{ marginBottom: 20 }}>
            {relatedTags.map((t) => (
              <Link to={`/category/${slugify(t)}`} className="chip" key={t}>{t}</Link>
            ))}
          </div>
        )}
        {!loading && facts && (
          <section className="taxonomy-facts" aria-label={`${name} at a glance`}>
            <h2>{name} at a glance</h2>
            <dl>
              {facts.runtime && (
                <>
                  <div><dt>Runtime</dt><dd>{facts.runtime.min}–{facts.runtime.max} minutes, average {facts.runtime.avg}</dd></div>
                  <div><dt>30 minutes or more</dt><dd>{facts.runtime.over30} of {facts.runtime.known} videos</dd></div>
                </>
              )}
              {field === 'actors' && facts.channels.length > 0 && (
                <div>
                  <dt>Channels</dt>
                  <dd>
                    {facts.channels.map((c, i) => (
                      <span key={c.name}>{i > 0 && ' · '}<Link to={`/channel/${slugify(c.name)}`}>{c.name}</Link> {c.count}</span>
                    ))}
                  </dd>
                </div>
              )}
              {facts.sources.length > 0 && (
                <div><dt>Plays from</dt><dd>{facts.sources.map((s) => `${s.name} (${s.count})`).join(' · ')}</dd></div>
              )}
              {facts.coStars.length > 0 && (
                <div>
                  <dt>{field === 'actors' ? 'Often with' : 'Most credited'}</dt>
                  <dd>
                    {facts.coStars.map((p, i) => (
                      <span key={p.slug}>{i > 0 && ' · '}<Link to={`/actor/${p.slug}`}>{p.name}</Link> {p.count}</span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
            {facts.longest.length > 0 && (
              <div className="taxonomy-longest">
                <h3>Longest videos</h3>
                <ul>
                  {facts.longest.map((l) => (
                    <li key={l.slug}><Link to={`/movie/${l.slug}`}>{l.title}</Link><span>{l.minutes} min</span></li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
        </div>
        {showRail && (
          <aside className="taxonomy-rail" aria-label={`More from ${name}`}>
            {railAd && <AdSlot slot="taxonomyRail" />}
            {railPicks.length > 0 && (
              <>
                <h2 className="taxonomy-rail-title">Watch next</h2>
                {railPicks.map((m) => <MovieCard key={m.slug} movie={m} headingLevel="h3" featured />)}
              </>
            )}
          </aside>
        )}
        </div>
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
        {!loading && faq.length > 0 && (
          <section className="taxonomy-faq" aria-label={`Questions about ${name}`}>
            <h2>Questions about {name}</h2>
            {faq.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </section>
        )}
      </div>
    </>
  )
}
