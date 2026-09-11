import LegalPage from '../../components/LegalPage'
import { SITE_NAME } from '../../lib/siteConfig'

// Generic starting-point privacy policy. Update it to match what the site
// actually collects if that changes (e.g. adding an analytics tool or a
// login system) — a privacy policy has to describe real practices, not
// aspirational ones. Not legal advice; have a lawyer review it, especially
// if you have visitors in the EU/UK (GDPR) or California (CCPA).
export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      description={`How ${SITE_NAME} handles information about visitors.`}
      updated="September 2026"
    >
      <h2>1. Overview</h2>
      <p>
        {SITE_NAME} does not require an account to browse, search, or watch content, and does not
        knowingly collect personal information such as your name or email address.
      </p>

      <h2>2. Information collected automatically</h2>
      <p>Like most websites, the Site's hosting and ad providers automatically log technical data such as:</p>
      <ul>
        <li>IP address and approximate location</li>
        <li>Browser type, device type, and operating system</li>
        <li>Pages visited and time spent on them</li>
        <li>Referring website</li>
      </ul>
      <p>
        This information is used in aggregate for security, performance, and to understand which
        pages are popular — not to identify individual visitors.
      </p>

      <h2>3. Local storage</h2>
      <p>
        The Site stores a small marker in your browser's local storage to remember that you
        confirmed you are of legal age, so the age-verification screen doesn't reappear on every
        visit. This stays on your device and is not sent to us.
      </p>

      <h2>4. Cookies and third-party advertising</h2>
      <p>
        Advertising partners shown on the Site may set their own cookies or use similar
        technologies to serve and measure ads. {SITE_NAME} does not control these technologies;
        review each advertiser's own privacy policy for details. You can limit cookie-based
        advertising through your browser settings.
      </p>

      <h2>5. Embedded third-party content</h2>
      <p>
        Video players embedded from third-party platforms may collect data according to those
        platforms' own privacy policies when you interact with them (for example, playing a
        video). {SITE_NAME} is not responsible for their data practices.
      </p>

      <h2>6. Data we do not collect</h2>
      <p>
        {SITE_NAME} does not require registration, does not ask for payment information, and does
        not knowingly collect information from anyone under 18.
      </p>

      <h2>7. Your choices</h2>
      <p>
        You can clear your browser's local storage and cookies at any time to remove any locally
        stored preferences, and can use browser or device settings to limit ad tracking.
      </p>

      <h2>8. Changes to this policy</h2>
      <p>This policy may be updated periodically; the “Last updated” date above reflects the most recent revision.</p>

      <h2>9. Contact</h2>
      <p>Questions about this policy can be sent through the site's social channels linked in the footer.</p>
    </LegalPage>
  )
}
