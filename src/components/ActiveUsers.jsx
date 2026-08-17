import { useActiveUsers } from '../lib/usePresence'
import { BASE_VIEWER_COUNT } from '../lib/siteConfig'

export default function ActiveUsers() {
  const liveCount = useActiveUsers()
  const displayCount = BASE_VIEWER_COUNT + liveCount
  return (
    <span className="active-users" title="People watching right now">
      <span className="pulse-dot" />
      <span className="active-users-text">{displayCount.toLocaleString()} watching now</span>
    </span>
  )
}
