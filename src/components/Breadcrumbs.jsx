import { Link } from 'react-router-dom'

// Visible breadcrumb line. The last item is the current page and is not a
// link. The matching BreadcrumbList JSON-LD comes from breadcrumbJsonLd()
// and is passed to <Seo>, so there is one source of truth for both.
export default function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={item.to}>
              {last ? <span aria-current="page">{item.name}</span> : <Link to={item.to}>{item.name}</Link>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
