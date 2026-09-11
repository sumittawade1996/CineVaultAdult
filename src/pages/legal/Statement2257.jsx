import LegalPage from '../../components/LegalPage'
import { SITE_NAME } from '../../lib/siteConfig'

// 18 U.S.C. § 2257 record-keeping applies to "primary producers" of
// sexually explicit visual depictions. Whether an embed/aggregator site
// like this one qualifies as a producer (vs. relying on each source
// platform's own compliance) is a fact-specific legal question with real
// exposure — this is a starting template, not a determination. Get it
// reviewed by a lawyer who specializes in 18 U.S.C. 2257 compliance
// before publishing, and correct the exemption claim if it's wrong for
// how this site actually sources and displays content.
export default function Statement2257() {
  return (
    <LegalPage
      title="18 U.S.C. 2257 Exemption Statement"
      description={`Record-keeping compliance statement for ${SITE_NAME}.`}
      updated="September 2026"
    >
      <h2>Notice</h2>
      <p>
        All persons depicted in any visual content accessible through {SITE_NAME} were, to the
        best of our knowledge, adults aged 18 years or older at the time the content was produced.
      </p>

      <h2>Exemption claim</h2>
      <p>
        {SITE_NAME} is a content-discovery and linking site. It does not itself produce, film, or
        photograph any sexually explicit visual content; the video content accessible through the
        Site is hosted and served by independent third-party platforms via their own embedded
        players. As such, {SITE_NAME} is not a primary or secondary producer as defined under 18
        U.S.C. § 2257 and 28 C.F.R. Part 75, and does not maintain records under that statute.
      </p>

      <h2>Records custodians</h2>
      <p>
        Age and identity verification records for the performers appearing in embedded content are
        maintained by the original producers and the third-party platforms that host that content,
        each of which is independently responsible for compliance with 18 U.S.C. § 2257 and any
        applicable foreign equivalent.
      </p>

      <h2>Reporting a concern</h2>
      <p>
        If you believe any content accessible through {SITE_NAME} depicts a minor, or was produced
        without proper consent or age verification, remove yourself from the page and report it
        immediately through the site's social channels linked in the footer so it can be reviewed
        and, where warranted, delisted. In the United States, such content can also be reported to
        the National Center for Missing &amp; Exploited Children at report.cybertip.org.
      </p>
    </LegalPage>
  )
}
