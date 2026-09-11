import Seo from './Seo'

// Shared chrome for the static compliance pages (Terms, Privacy, DMCA,
// 2257). Kept out of the main nav — linked only from the footer and the
// age gate — since they're reference pages, not content people browse to.
export default function LegalPage({ title, description, updated, children }) {
  return (
    <>
      <Seo title={title} description={description} />
      <div className="container legal-page">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated {updated}</p>
        {children}
      </div>
    </>
  )
}
