/** The API sends UTC timestamps without a "Z"; add it so the browser doesn't read them as local. */
export function parseUtc(timestamp: string): Date {
  return new Date(/([zZ]|[+-]\d\d:\d\d)$/.test(timestamp) ? timestamp : `${timestamp}Z`)
}

export function formatDateTime(timestamp: string): string {
  return parseUtc(timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatUnits(units: number): string {
  return units.toLocaleString('en-IN')
}

/** Value for <input type="datetime-local">, in the browser's own time zone. */
export function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

/** "in 22 h", "3 days overdue" — rough distance from now to a UTC timestamp. */
export function formatDueIn(timestamp: string, now = new Date()): string {
  const ms = parseUtc(timestamp).getTime() - now.getTime()
  const hours = Math.abs(ms) / 3_600_000
  const amount = hours < 48 ? `${Math.max(1, Math.round(hours))} h` : `${Math.round(hours / 24)} days`
  return ms >= 0 ? `in ${amount}` : `${amount} overdue`
}

/** snake_case defect type → "Packaging defect" */
export function humanizeDefect(defectType: string): string {
  const words = defectType.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
