/** 125 -> "2:05" */
export function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "February_10" -> "Feb 10" */
export function dayLabel(day: string): string {
  const [month, d] = day.split('_')
  return `${month.slice(0, 3)} ${d}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * unix seconds -> "Feb 10 · 14:05 UTC". Date comes from the timestamp, not the day folder:
 * a few matches in a folder started just before midnight of the previous day.
 */
export function utcDateTime(unix: number): string {
  const d = new Date(unix * 1000)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} · ${hh}:${mm} UTC`
}

export function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}
