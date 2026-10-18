// Dates shown on articles. A fixed locale and the UTC zone keep the prerendered
// HTML and the browser's first render identical (hydration must match).
const FORMAT = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }

export function formatArticleDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', FORMAT)
}

// "Updated" is only worth showing when the article changed on a later day than it was published.
export function isUpdated(article) {
  if (!article?.updated_at || !article?.created_at) return false
  return formatArticleDate(article.updated_at) !== formatArticleDate(article.created_at)
}
