import { usePartnerState } from '../lib/usePartners'
import { breadcrumbJsonLd } from '../lib/breadcrumbs'
import { SITE_NAME } from '../lib/siteConfig'
import Seo from '../components/Seo'
import Breadcrumbs from '../components/Breadcrumbs'

// /partners: every active row of public.footer_partners with all its details
// (plan T15). The footer lists the same rows in short form and links here.
// Kept out of the search index and the sitemap: it is a reference page for
// visitors and partners, not content people search for.
const CRUMBS = [
  { name: 'Home', to: '/' },
  { name: 'Partners', to: '/partners' },
]

export default function Partners() {
  const { partners, ready, failed } = usePartnerState()

  return (
    <>
      <Seo
        title="Partners"
        description={`The sites ${SITE_NAME} works with and links to: what each one is, where its link goes and how the link is marked, so you know what to expect before you click.`}
        noindex
        jsonLd={breadcrumbJsonLd(CRUMBS)}
      />
      <div className="container partners-page">
        <Breadcrumbs items={CRUMBS} />
        <div className="page-head">
          <div>
            <h1>Partners</h1>
            {ready && partners.length > 0 && (
              <p className="page-sub">{partners.length} {partners.length === 1 ? 'partner' : 'partners'}</p>
            )}
          </div>
        </div>
        <p className="taxonomy-intro">
          These are the sites {SITE_NAME} works with. Each one is listed with its address and a short
          description. Links to partners are marked as sponsored: {SITE_NAME} may earn a referral fee
          or another benefit when you visit or sign up through them.
        </p>

        {!ready ? (
          <div className="partner-list-placeholder" aria-hidden="true" />
        ) : partners.length === 0 ? (
          <div className="empty-state">
            <h2>{failed ? 'Partners are not available right now' : 'No partners at the moment'}</h2>
            <p>{failed ? 'The list could not be loaded. Please try again in a few minutes.' : 'Check back later.'}</p>
          </div>
        ) : (
          <ul className="partner-list">
            {partners.map((p) => (
              <li key={p.key} id={p.id} className="partner">
                <div className="partner-body">
                  <h2>{p.name}</h2>
                  <p className="partner-host">{p.host}</p>
                  {p.description && <p className="partner-summary">{p.description}</p>}
                  {p.details.map((text, i) => (
                    <p key={i} className="partner-details">{text}</p>
                  ))}
                </div>
                <div className="partner-action">
                  <a className="btn btn-outline" href={p.href} rel={p.rel} target={p.target}>
                    Visit {p.host}<span aria-hidden="true"> ↗</span>
                    {p.target === '_blank' && <span className="sr-only"> (opens in a new tab)</span>}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}

        <aside className="partner-note" aria-label="About partner links">
          <h2>About these links</h2>
          <ul>
            <li>Partner sites are separate from {SITE_NAME}. They have their own terms and privacy policies, and {SITE_NAME} does not control what they publish.</li>
            <li>Partner sites may contain adult material. You must be 18 or older to visit them.</li>
            <li>Each link is marked <code>rel="sponsored"</code> so search engines know it is not an editorial recommendation.</li>
          </ul>
        </aside>
      </div>
    </>
  )
}
