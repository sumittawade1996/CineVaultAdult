import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/slugify'
import Seo from '../components/Seo'

// Views per channel (first-party counts from page_views, read through the admin-only functions in
// supabase/migrations/015_admin_channel_views.sql). A video view counts for the channel the video
// has now; a visit to the channel page counts for that channel too.
const PERIODS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All time', days: null },
]
const SPECIAL = new Set(['(no channel)', '(removed or renamed videos)'])
const fmt = (n) => Number(n || 0).toLocaleString('en-IN')
// Names for the referrer rows that are not a plain website address
const REFERRER_LABEL = { '(direct)': 'Direct (typed, bookmarks, apps, hidden referrer)', 't.co': 'X (t.co links)', 'so.com': 'so.com (360 Search)' }

export default function AdminDashboard() {
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState({ top: [], daily: [], loading: false })
  const [error, setError] = useState(null)
  const [refs, setRefs] = useState(null)

  // Where visits came from (supabase/migrations/017_admin_referrers.sql)
  useEffect(() => {
    let cancelled = false
    setRefs(null)
    supabase.rpc('admin_referrers', { p_days: days, p_limit: 25 }).then(({ data, error: err }) => {
      if (cancelled) return
      if (err) setError(err.message)
      else setRefs(data || [])
    })
    return () => { cancelled = true }
  }, [days])

  useEffect(() => {
    let cancelled = false
    setRows(null); setError(null)
    supabase.rpc('admin_channel_views', { p_days: days }).then(({ data, error: err }) => {
      if (cancelled) return
      if (err) setError(err.message)
      else setRows(data || [])
    })
    return () => { cancelled = true }
  }, [days])

  useEffect(() => {
    if (!selected || selected === '(removed or renamed videos)') { setDetail({ top: [], daily: [], loading: false }); return }
    let cancelled = false
    setDetail((d) => ({ ...d, loading: true }))
    Promise.all([
      supabase.rpc('admin_channel_top_movies', { p_channel: selected, p_days: days, p_limit: 10 }),
      supabase.rpc('admin_channel_daily', { p_channel: selected, p_days: days }),
    ]).then(([top, daily]) => {
      if (cancelled) return
      if (top.error || daily.error) setError((top.error || daily.error).message)
      setDetail({ top: top.data || [], daily: daily.data || [], loading: false })
    })
    return () => { cancelled = true }
  }, [selected, days])

  const totals = useMemo(() => {
    const list = rows || []
    const sum = (k) => list.reduce((s, r) => s + Number(r[k] || 0), 0)
    const total = sum('total_views')
    const best = list.find((r) => !SPECIAL.has(r.channel) && Number(r.total_views) > 0)
    return { total, video: sum('movie_views'), channelPage: sum('channel_page_views'), best, max: Math.max(1, ...list.map((r) => Number(r.total_views))) }
  }, [rows])

  const peak = Math.max(1, ...detail.daily.map((d) => Number(d.views)))
  const periodLabel = PERIODS.find((p) => p.days === days)?.label.toLowerCase()

  return (
    <>
      <Seo title="Channel views" description="Admin: views per channel." noindex />
      <div className="container" style={{ padding: '48px 24px' }}>
        <div className="section-head"><h2>Channel views</h2></div>
        <div className="admin-tabs" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.label} type="button" className={days === p.days ? 'active' : ''} aria-pressed={days === p.days} onClick={() => setDays(p.days)}>{p.label}</button>
          ))}
        </div>

        {error && <p className="log-line log-err">{error}</p>}
        {!rows && !error && <p className="hint" style={{ color: 'var(--text-muted)' }}>Loading…</p>}

        {rows && (
          <>
            <div className="admin-tiles">
              <div><span>Total views</span><strong>{fmt(totals.total)}</strong></div>
              <div><span>Video page views</span><strong>{fmt(totals.video)}</strong></div>
              <div><span>Channel page views</span><strong>{fmt(totals.channelPage)}</strong></div>
              <div>
                <span>Most viewed channel</span>
                <strong>{totals.best ? totals.best.channel : '—'}</strong>
                {totals.best && totals.total > 0 && <small>{Math.round((Number(totals.best.total_views) / totals.total) * 100)}% of all views</small>}
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Channel</th>
                    <th scope="col" className="num">Videos</th>
                    <th scope="col" className="num">Video views</th>
                    <th scope="col" className="num">Channel page</th>
                    <th scope="col" className="num">Total</th>
                    <th scope="col" className="num">Per video</th>
                    <th scope="col">Share of views</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const total = Number(r.total_views)
                    const videos = Number(r.videos)
                    const real = !SPECIAL.has(r.channel)
                    return (
                      <tr key={r.channel} className={selected === r.channel ? 'selected' : ''}>
                        <th scope="row">
                          <button type="button" className="admin-row-button" onClick={() => setSelected(selected === r.channel ? null : r.channel)} aria-expanded={selected === r.channel}>{r.channel}</button>
                        </th>
                        <td className="num">{real || r.channel === '(no channel)' ? fmt(videos) : '—'}</td>
                        <td className="num">{fmt(r.movie_views)}</td>
                        <td className="num">{real ? fmt(r.channel_page_views) : '—'}</td>
                        <td className="num"><strong>{fmt(total)}</strong></td>
                        <td className="num">{videos > 0 ? (Number(r.movie_views) / videos).toFixed(1) : '—'}</td>
                        <td><span className="share-bar" aria-hidden="true"><i style={{ width: `${(total / totals.max) * 100}%` }} /></span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {selected && selected !== '(removed or renamed videos)' && (
              <section className="admin-detail" aria-label={`${selected} details`}>
                <div className="admin-detail-head">
                  <h3>{selected}</h3>
                  {!SPECIAL.has(selected) && <Link to={`/channel/${slugify(selected)}`} style={{ color: 'var(--gold)' }}>View the channel page →</Link>}
                </div>
                {detail.loading ? <p className="hint">Loading…</p> : (
                  <div className="admin-detail-grid">
                    <div>
                      <h4>Most viewed videos, {periodLabel}</h4>
                      {detail.top.length === 0 ? <p className="hint">No video views in this period.</p> : (
                        <ol className="admin-top">
                          {detail.top.map((m) => (
                            <li key={m.slug}><Link to={`/movie/${m.slug}`}>{m.title}</Link><span>{fmt(m.views)}</span></li>
                          ))}
                        </ol>
                      )}
                    </div>
                    <div>
                      <h4>Views per day{days === null || days > 90 ? ', last 90 days' : `, ${periodLabel}`}</h4>
                      <div className="daily-bars" role="img" aria-label={`Views per day, highest ${fmt(peak)}`}>
                        {detail.daily.map((d) => (
                          <i key={d.day} style={{ height: `${Math.max(2, (Number(d.views) / peak) * 100)}%` }} title={`${d.day}: ${fmt(d.views)}`} />
                        ))}
                      </div>
                      {detail.daily.length > 0 && (
                        <div className="daily-axis"><span>{detail.daily[0].day}</span><span>highest day {fmt(peak)}</span><span>{detail.daily[detail.daily.length - 1].day}</span></div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

            <section aria-label="Top referring sites" style={{ marginTop: 36 }}>
              <div className="section-head"><h2>Top referring sites</h2></div>
              {!refs && <p className="hint" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
              {refs && refs.length === 0 && <p className="hint" style={{ color: 'var(--text-muted)' }}>No visits with a referrer in this period.</p>}
              {refs && refs.length > 0 && (() => {
                const outside = refs.filter((r) => r.site !== '(direct)')
                const top = Math.max(1, ...refs.map((r) => Number(r.visits)))
                return (
                  <>
                    <div className="admin-tiles">
                      <div><span>Sites that sent visits</span><strong>{fmt(outside.length)}</strong><small>top 25 shown, direct visits not counted</small></div>
                      <div><span>Visits from other sites</span><strong>{fmt(outside.reduce((s, r) => s + Number(r.visits), 0))}</strong></div>
                      <div><span>Direct visits</span><strong>{fmt(refs.find((r) => r.site === '(direct)')?.visits)}</strong></div>
                    </div>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th scope="col">Site</th>
                            <th scope="col" className="num">Visits</th>
                            <th scope="col" className="num">Visitors</th>
                            <th scope="col">Share of the top row</th>
                          </tr>
                        </thead>
                        <tbody>
                          {refs.map((r) => (
                            <tr key={r.site}>
                              <th scope="row">{REFERRER_LABEL[r.site] || r.site}</th>
                              <td className="num"><strong>{fmt(r.visits)}</strong></td>
                              <td className="num">{fmt(r.visitors)}</td>
                              <td><span className="share-bar" aria-hidden="true"><i style={{ width: `${(Number(r.visits) / top) * 100}%` }} /></span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="hint" style={{ color: 'var(--text-muted)', maxWidth: '78ch', lineHeight: 1.6, marginTop: 12 }}>
                      The site a visitor came from, as the browser reports it. Some sites hide it, so "Direct" includes those. Visits between our own
                      pages are left out. "Visitors" counts sessions and is lower than the real number for older rows, which carry no session id.
                      Links that nobody clicked do not show here: use Search Console or Ahrefs for all backlinks.
                    </p>
                  </>
                )
              })()}
            </section>

            <p className="hint" style={{ color: 'var(--text-muted)', maxWidth: '78ch', lineHeight: 1.6, marginTop: 24 }}>
              First-party counts from this site only (not Google or the player sites). Rows from the older tracking carry no bot marker and
              are all counted; once the new view tracking (/api/pv) is live, bots are marked and left out. A video counts for the channel it
              has now. Part of the traffic comes from our posts on X. "Removed or renamed videos" are visits to addresses that no longer exist.
            </p>
          </>
        )}
      </div>
    </>
  )
}
