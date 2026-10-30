// Pure helpers for the count-up animation (tested with `npm test`).

export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return 1 - (1 - clamped) ** 3
}

/** Whole-number value `elapsedMs` into a count-up to `target`; exactly `target` once finished. */
export function countUpValue(target: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return target
  return Math.round(target * easeOutCubic(elapsedMs / durationMs))
}
