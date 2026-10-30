// Donut geometry for SVG circle segments (tested with `npm test`).
// Each segment is a <circle> stroke: strokeDasharray = `${length} ${circumference}` and
// strokeDashoffset = -offset. The circle is rotated −90° so the first segment starts at 12 o'clock.

export type Segment = {
  index: number
  value: number
  fraction: number
  /** drawn length and start position along the circumference */
  length: number
  offset: number
  /** middle of the segment, in degrees clockwise from 12 o'clock */
  midAngle: number
}

export function circumference(radius: number): number {
  return 2 * Math.PI * radius
}

/** Segments for the given values; a small gap separates neighbours when more than one is shown. */
export function donutSegments(values: number[], radius: number, gap = 2): Segment[] {
  const total = values.reduce((sum, v) => sum + Math.max(0, v), 0)
  const c = circumference(radius)
  const shown = values.filter((v) => v > 0).length
  let start = 0
  return values.map((raw, index) => {
    const value = Math.max(0, raw)
    const fraction = total > 0 ? value / total : 0
    const span = fraction * c
    const segment: Segment = {
      index,
      value,
      fraction,
      length: value > 0 ? Math.max(0, span - (shown > 1 ? gap : 0)) : 0,
      offset: start,
      midAngle: ((start + span / 2) / c) * 360,
    }
    start += span
    return segment
  })
}

/** Point on the ring at `angle` (degrees clockwise from 12 o'clock), for the value badge. */
export function pointOnRing(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
}

/** Index of the largest value (first one on ties), or -1 when all are zero. */
export function largestIndex(values: number[]): number {
  let best = -1
  values.forEach((v, i) => {
    if (v > 0 && (best === -1 || v > values[best])) best = i
  })
  return best
}
