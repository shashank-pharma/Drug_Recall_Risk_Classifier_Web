// Which pastel tint the page background shows (tested with `npm test`).
import { RECALL_CLASSES } from './recallClass.ts'

export const ZONE_NAMES = ['new', 'history', 'explorer', 'dashboard'] as const
export type Zone = (typeof ZONE_NAMES)[number]

/** Area of the app for a path; a recall's own page belongs to History. */
export function zoneFor(pathname: string): Zone {
  if (pathname.startsWith('/history') || pathname.startsWith('/recalls')) return 'history'
  if (pathname.startsWith('/explorer')) return 'explorer'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  return 'new'
}

/**
 * Class tint while exactly one class is chosen on the Dashboard or in History (`?class=`).
 * Several classes, none, or an unknown one: no tint.
 */
export function classTintFor(pathname: string, params: URLSearchParams): string | null {
  const zone = zoneFor(pathname)
  if (zone !== 'dashboard' && !pathname.startsWith('/history')) return null
  const chosen = params.getAll('class').filter((c) => (RECALL_CLASSES as readonly string[]).includes(c))
  return chosen.length === 1 ? chosen[0] : null
}
