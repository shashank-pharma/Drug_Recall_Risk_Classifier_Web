// "What if" time: statuses are shown as they would be up to 72 h from now. Screen only; the
// server checks the same window (SIMULATION_WINDOW in backend/app/schemas.py). Tested with `npm test`.

export const MAX_HOURS = 72

/** Whole hours between 0 (now) and 72. */
export function clampHours(hours: number): number {
  if (!Number.isFinite(hours)) return 0
  return Math.min(MAX_HOURS, Math.max(0, Math.round(hours)))
}

/** ISO time to send as `?at=`, or undefined for "now" (so the normal request is used). */
export function simulatedAt(hours: number, now: Date): string | undefined {
  const h = clampHours(hours)
  return h === 0 ? undefined : new Date(now.getTime() + h * 3_600_000).toISOString()
}

/** "Now", "+1 hour", "+3 days 4 h" */
export function formatOffset(hours: number): string {
  const h = clampHours(hours)
  if (h === 0) return 'Now'
  if (h < 24) return `+${h} ${h === 1 ? 'hour' : 'hours'}`
  const days = Math.floor(h / 24)
  const rest = h % 24
  return `+${days} ${days === 1 ? 'day' : 'days'}${rest ? ` ${rest} h` : ''}`
}
