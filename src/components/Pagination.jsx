import { useLocation } from 'react-router-dom'
import { pageHref } from '../lib/seoUrl'

// Builds a compact page list like 1 … 4 5 [6] 7 8 … 20 so long catalogs
// stay navigable without a wall of numbers.
function pageItems(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const items = new Set([1, total, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => items.add(p))
  if (page >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => items.add(p))
  const sorted = [...items].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…')
    out.push(sorted[i])
  }
  return out
}

// The pages are real links, so crawlers can follow them to page 2 and on (the prerendered HTML carries them).
// A plain click is still handled by the page without a reload; a middle or modified click opens the link as usual.
export default function Pagination({ page, totalPages, onChange }) {
  const { pathname, search } = useLocation()
  if (totalPages <= 1) return null
  const href = (n) => pageHref(pathname, search, n)
  const go = (n) => (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    if (n !== page) onChange(n)
  }
  const prevIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
  const nextIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? (
        <a href={href(page - 1)} rel="prev" className="btn btn-outline pagination-arrow" onClick={go(page - 1)} aria-label="Previous page">
          {prevIcon}
          <span className="pagination-arrow-text">Prev</span>
        </a>
      ) : (
        <span className="btn btn-outline pagination-arrow is-disabled" aria-disabled="true">
          {prevIcon}
          <span className="pagination-arrow-text">Prev</span>
        </span>
      )}
      <ol className="pagination-pages">
        {pageItems(page, totalPages).map((item, i) =>
          item === '…' ? (
            <li key={`gap-${i}`} className="pagination-gap" aria-hidden="true">…</li>
          ) : (
            <li key={item}>
              {item === page ? (
                <span className="pagination-page is-current" aria-current="page" aria-label={`Page ${item}, current page`}>{item}</span>
              ) : (
                <a href={href(item)} className="pagination-page" onClick={go(item)} aria-label={`Go to page ${item}`}>{item}</a>
              )}
            </li>
          )
        )}
      </ol>
      {page < totalPages ? (
        <a href={href(page + 1)} rel="next" className="btn btn-outline pagination-arrow" onClick={go(page + 1)} aria-label="Next page">
          <span className="pagination-arrow-text">Next</span>
          {nextIcon}
        </a>
      ) : (
        <span className="btn btn-outline pagination-arrow is-disabled" aria-disabled="true">
          <span className="pagination-arrow-text">Next</span>
          {nextIcon}
        </span>
      )}
    </nav>
  )
}
