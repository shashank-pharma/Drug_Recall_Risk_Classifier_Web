// Dashboard cross-filter: clicking a donut segment or a defect column sets ?class= or ?defect=,
// clicking the same one again clears it (tested with `npm test`).
import { RECALL_CLASSES } from './recallClass.ts'

export type LinkedFilter = { recallClass: string | null; defect: string | null }

const KEYS = { recallClass: 'class', defect: 'defect' } as const

export function readLinkedFilter(params: URLSearchParams): LinkedFilter {
  const cls = params.get(KEYS.recallClass)
  return {
    recallClass: cls && (RECALL_CLASSES as readonly string[]).includes(cls) ? cls : null,
    defect: params.get(KEYS.defect) || null,
  }
}

/** New query string with `value` set for `key`, or removed when it was already set (or is null). */
export function toggleLinked(
  params: URLSearchParams,
  key: keyof LinkedFilter,
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams(params)
  const name = KEYS[key]
  if (value === null || next.get(name) === value) next.delete(name)
  else next.set(name, value)
  return next
}

export function clearLinked(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)
  Object.values(KEYS).forEach((name) => next.delete(name))
  return next
}

export const hasLinked = (f: LinkedFilter) => f.recallClass !== null || f.defect !== null

/** History link with the same filters (History reads ?class= and ?defect= too). */
export function historyHref(f: LinkedFilter, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams()
  if (f.recallClass) params.set('class', f.recallClass)
  if (f.defect) params.set('defect', f.defect)
  for (const [k, v] of Object.entries(extra)) params.set(k, v)
  const query = params.toString()
  return query ? `/history?${query}` : '/history'
}

/** "Class I and Contamination" for the filter summary line. */
export function describeLinked(f: LinkedFilter, humanize: (defect: string) => string): string {
  return [f.recallClass, f.defect && humanize(f.defect)].filter(Boolean).join(' and ')
}
