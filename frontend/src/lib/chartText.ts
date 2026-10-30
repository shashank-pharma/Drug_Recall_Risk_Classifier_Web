// Fitting chart labels into narrow columns (tested with `npm test`).

/** Approximate width of one 11px Geist character, in px. */
export const CHAR_WIDTH = 6.4

/** Fits a label into a column: one word per line when needed, long words cut with "…". */
export function fitLabel(label: string, columnWidth: number): string[] {
  const maxChars = Math.max(4, Math.floor((columnWidth - 12) / CHAR_WIDTH))
  if (label.length <= maxChars) return [label]
  return label
    .split(' ')
    .slice(0, 2)
    .map((word) => (word.length > maxChars ? `${word.slice(0, maxChars - 1)}\u2026` : word))
}
