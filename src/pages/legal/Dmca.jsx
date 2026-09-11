import LegalPage from '../../components/LegalPage'
import { SITE_NAME } from '../../lib/siteConfig'

// Standard notice-and-takedown policy. Fill in a real designated-agent
// contact (ideally registered with the US Copyright Office at
// dmca.copyright.gov) before relying on this for DMCA safe-harbor
// protection. Not legal advice — have a lawyer review it.
export default function Dmca() {
  return (
    <LegalPage
      title="DMCA Policy"
      description={`How to submit a copyright takedown notice for content on ${SITE_NAME}.`}
      updated="September 2026"
    >
      <h2>1. Our position</h2>
      <p>
        {SITE_NAME} respects the intellectual property rights of others. Most video content on the
        Site is hosted by third-party platforms and displayed via their embedded players;{' '}
        {SITE_NAME} does not host these video files. We will nonetheless remove links or embeds in
        response to a valid takedown notice.
      </p>

      <h2>2. Filing a notice</h2>
      <p>To submit a copyright infringement notice, send the following information in writing:</p>
      <ul>
        <li>A physical or electronic signature of the copyright owner or their authorized agent;</li>
        <li>Identification of the copyrighted work claimed to have been infringed;</li>
        <li>Identification of the material you claim is infringing, including the specific URL on {SITE_NAME};</li>
        <li>Your contact information (name, address, phone number, and email address);</li>
        <li>A statement that you have a good-faith belief the use is not authorized by the copyright owner, its agent, or the law;</li>
        <li>A statement, under penalty of perjury, that the above information is accurate and that you are the copyright owner or authorized to act on their behalf.</li>
      </ul>

      <h2>3. Where to send it</h2>
      <p>
        Send notices to the designated agent at{' '}
        <strong>dmca@vexn.org</strong>{' '}
        <em>(replace with a monitored mailbox before publishing this page)</em>. Incomplete
        notices may not be actioned.
      </p>

      <h2>4. Counter-notices</h2>
      <p>
        If content was removed in error, you may submit a counter-notice with your contact
        information, identification of the removed material, and a statement under penalty of
        perjury that you have a good-faith belief the material was removed by mistake.
      </p>

      <h2>5. Repeat infringers</h2>
      <p>{SITE_NAME} will act on valid, properly documented notices and may restrict access to material subject to repeated, verified claims.</p>
    </LegalPage>
  )
}
