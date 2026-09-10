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

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn-outline pagination-arrow"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        <span className="pagination-arrow-text">Prev</span>
      </button>
      <ol className="pagination-pages">
        {pageItems(page, totalPages).map((item, i) =>
          item === '…' ? (
            <li key={`gap-${i}`} className="pagination-gap" aria-hidden="true">…</li>
          ) : (
            <li key={item}>
              <button
                type="button"
                className={`pagination-page${item === page ? ' is-current' : ''}`}
                aria-current={item === page ? 'page' : undefined}
                aria-label={item === page ? `Page ${item}, current page` : `Go to page ${item}`}
                onClick={() => item !== page && onChange(item)}
              >
                {item}
              </button>
            </li>
          )
        )}
      </ol>
      <button
        type="button"
        className="btn btn-outline pagination-arrow"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <span className="pagination-arrow-text">Next</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </nav>
  )
}
