// Change against the previous window, coloured by whether the change is good or bad
// (tested with `npm test`). For recalls, more is worse, so a rise is "bad" whatever the arrow says.

export type Tone = 'good' | 'bad' | 'neutral'

export type Delta = {
  change: number
  /** whole-number percent of the previous value */
  percent: number
  direction: 'up' | 'down' | 'flat'
  tone: Tone
}

/**
 * Null when there is no earlier data to compare with: a change from zero has no meaningful
 * percentage, and the badge should not appear without real data behind it.
 */
export function computeDelta(current: number, previous: number, higherIs: 'good' | 'bad'): Delta | null {
  if (previous <= 0) return null
  const change = current - previous
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
  const worse = higherIs === 'bad' ? direction === 'up' : direction === 'down'
  return {
    change,
    percent: Math.round((change / previous) * 100),
    direction,
    tone: direction === 'flat' ? 'neutral' : worse ? 'bad' : 'good',
  }
}

/** "+3", "−2" (true minus sign), "0". */
export function formatChange(change: number, format: (n: number) => string = String): string {
  if (change > 0) return `+${format(change)}`
  if (change < 0) return `−${format(-change)}`
  return '0'
}
