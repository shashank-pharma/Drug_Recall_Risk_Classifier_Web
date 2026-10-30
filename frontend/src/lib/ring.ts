// Geometry for CountdownRing (SVG circle stroke), tested with `npm test`.

export type Ring = { circumference: number; dashOffset: number }

/** A circle stroke that is `fraction` (0–1) drawn, starting at 12 o'clock when the circle is rotated −90°. */
export function ringDash(fraction: number, radius: number): Ring {
  const circumference = 2 * Math.PI * radius
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0
  return { circumference, dashOffset: circumference * (1 - f) }
}

/** Short text for the middle of the ring: "45m", "22h", "3d"; a true minus sign when overdue. */
export function ringText(remainingMs: number): string {
  const sign = remainingMs < 0 ? '−' : ''
  const minutes = Math.abs(remainingMs) / 60_000
  if (minutes < 60) return `${sign}${Math.max(1, Math.round(minutes))}m`
  const hours = minutes / 60
  return hours < 48 ? `${sign}${Math.round(hours)}h` : `${sign}${Math.round(hours / 24)}d`
}
