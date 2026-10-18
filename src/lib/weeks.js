// Weekly archive keys for the "New on VEXN" pages (plan T13): `2026-w41` is
// ISO 8601 week 41 of 2026 (Monday to Sunday, UTC), counted from a video's
// created_at, i.e. the day it was added to the site.

const DAY = 86400000
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)) // the Thursday decides the year
  const year = d.getUTCFullYear()
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / DAY + 1) / 7)
  return { year, week }
}

export function weekKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const { year, week } = isoWeek(date)
  return `${year}-w${String(week).padStart(2, '0')}`
}

// '2026-w41' -> { key, start, end } (end is the next Monday, exclusive), or null
export function parseWeekKey(key) {
  const m = /^(\d{4})-w(\d{2})$/.exec(key || '')
  if (!m) return null
  const year = Number(m[1])
  const week = Number(m[2])
  if (week < 1 || week > 53) return null
  const jan4 = Date.UTC(year, 0, 4) // always inside ISO week 1
  const monday1 = jan4 - (new Date(jan4).getUTCDay() || 7) * DAY + DAY
  const start = new Date(monday1 + (week - 1) * 7 * DAY)
  if (weekKey(start) !== key) return null // e.g. w53 in a year that has only 52
  return { key, start, end: new Date(start.getTime() + 7 * DAY) }
}

// "5–11 October 2026", "28 September – 4 October 2026", "29 December 2026 – 4 January 2027"
export function weekLabel(key) {
  const range = parseWeekKey(key)
  if (!range) return key
  const first = range.start
  const last = new Date(range.end.getTime() - DAY)
  const [d1, m1, y1] = [first.getUTCDate(), first.getUTCMonth(), first.getUTCFullYear()]
  const [d2, m2, y2] = [last.getUTCDate(), last.getUTCMonth(), last.getUTCFullYear()]
  if (y1 !== y2) return `${d1} ${MONTHS[m1]} ${y1} – ${d2} ${MONTHS[m2]} ${y2}`
  if (m1 !== m2) return `${d1} ${MONTHS[m1]} – ${d2} ${MONTHS[m2]} ${y2}`
  return `${d1}–${d2} ${MONTHS[m2]} ${y2}`
}

// created_at values -> [{ key, label, count }], newest week first
export function summarizeWeeks(createdAtValues) {
  const counts = new Map()
  for (const value of createdAtValues) {
    const key = weekKey(value)
    if (key) counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, count]) => ({ key, label: weekLabel(key), count }))
}
