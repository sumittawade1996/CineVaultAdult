import LegalPage from '../../components/LegalPage'
import { SITE_NAME } from '../../lib/siteConfig'

// Generic starting-point terms for an adult content aggregator/embed site.
// Not legal advice — have a lawyer review before relying on this, and
// update the contact details and governing-law clause for your situation.
export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      description={`The terms that govern your use of ${SITE_NAME}.`}
      updated="September 2026"
    >
      <h2>1. Acceptance of terms</h2>
      <p>
        By accessing or using {SITE_NAME} (the “Site”), you agree to be bound by these Terms of
        Service. If you do not agree, do not use the Site.
      </p>

      <h2>2. Age requirement</h2>
      <p>
        The Site contains sexually explicit material and is intended solely for adults. You must
        be at least 18 years old, or the age of majority in your jurisdiction, to access or use
        the Site. By using the Site you represent that you meet this requirement.
      </p>

      <h2>3. Third-party content</h2>
      <p>
        Most video content displayed on the Site is hosted by third-party platforms and embedded
        or linked from their players. {SITE_NAME} does not host, produce, or control that content
        and is not responsible for it. Each third-party platform's own terms and policies apply to
        the content it hosts.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Access the Site if you are under 18 or the applicable age of majority;</li>
        <li>Use automated tools to scrape, crawl, or bulk-download content beyond normal browsing;</li>
        <li>Attempt to bypass, disable, or interfere with security or access controls;</li>
        <li>Upload, link to, or request removal of content in bad faith or through false claims;</li>
        <li>Use the Site in violation of any applicable law.</li>
      </ul>

      <h2>5. Intellectual property</h2>
      <p>
        Site design, text, and branding are the property of {SITE_NAME} or its licensors. Movie
        posters, artwork, and clips remain the property of their respective owners and are used
        for identification and linking purposes.
      </p>

      <h2>6. Copyright complaints</h2>
      <p>
        If you believe content accessible through the Site infringes your copyright, see our{' '}
        <a href="/legal/dmca">DMCA Policy</a> for how to submit a notice.
      </p>

      <h2>7. Disclaimer of warranties</h2>
      <p>
        The Site is provided “as is” without warranties of any kind, express or implied, including
        availability, accuracy, or fitness for a particular purpose.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, {SITE_NAME} and its operators are not liable for
        any indirect, incidental, or consequential damages arising from your use of the Site or of
        any third-party content it links to or embeds.
      </p>

      <h2>9. Changes</h2>
      <p>
        These terms may be updated from time to time. Continued use of the Site after a change
        constitutes acceptance of the revised terms.
      </p>

      <h2>10. Contact</h2>
      <p>Questions about these terms can be sent through the site's social channels linked in the footer.</p>
    </LegalPage>
  )
}
