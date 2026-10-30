// UTC calendar-day helpers for the History date-range slider (tested with `npm test`).
// Days are 'YYYY-MM-DD' strings, the same form the History `from`/`to` filters use.

const DAY_MS = 86_400_000

function toMs(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** UTC day of an API timestamp ('2026-10-30T06:50:00' → '2026-10-30'). */
export function utcDay(timestamp: string): string {
  return timestamp.slice(0, 10)
}

export function addDays(day: string, n: number): string {
  return new Date(toMs(day) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from `from` to `to` (0 when they are the same day). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS)
}

/** Slider positions [start, end] (days after `min`) for the current filter, clamped to the data. */
export function rangeToSlider(min: string, max: string, from: string, to: string): [number, number] {
  const last = daysBetween(min, max)
  const clamp = (n: number) => Math.min(last, Math.max(0, n))
  const start = from ? clamp(daysBetween(min, from)) : 0
  const end = to ? clamp(daysBetween(min, to)) : last
  return start <= end ? [start, end] : [end, start]
}

/** Filter values for slider positions; null means "no limit" when a thumb sits at the end. */
export function sliderToRange(min: string, max: string, [start, end]: [number, number]): {
  from: string | null
  to: string | null
} {
  const last = daysBetween(min, max)
  return {
    from: start <= 0 ? null : addDays(min, start),
    to: end >= last ? null : addDays(min, end),
  }
}
