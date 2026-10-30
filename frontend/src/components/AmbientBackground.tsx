import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { usePrefersReducedMotion } from '@/lib/motion'
import { RECALL_CLASSES } from '@/lib/recallClass'
import { classTintFor, ZONE_NAMES, zoneFor } from '@/lib/zone'

const PARALLAX_PX = 20
// How strongly each blob follows the mouse (the nearest moves most).
const DEPTHS = [1, 0.6, 0.8, 0.4]

function subscribe(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

/**
 * Fixed aurora layer behind every page (styles: "Aurora background" in index.css): the palette gradient,
 * four drifting blobs with a light mouse parallax, a small per-page shift and a class tint. The drift
 * pauses while the tab is hidden; parallax needs a fine pointer (none on touch). Reduced motion keeps
 * only the static gradient. Decorative only.
 */
export function AmbientBackground() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const zone = zoneFor(pathname)
  const tint = classTintFor(pathname, params)
  const hidden = useSyncExternalStore(subscribe, () => document.hidden, () => false)
  const reduced = usePrefersReducedMotion()
  const root = useRef<HTMLDivElement>(null)

  // On <html> so panels and dialogs (portals) match the page too.
  useEffect(() => {
    document.documentElement.dataset.zone = zone
  }, [zone])

  // Parallax: at most one update per frame, written as CSS variables (no React render).
  useEffect(() => {
    const el = root.current
    if (!el || reduced || !window.matchMedia('(pointer: fine)').matches) return
    let frame = 0
    let x = 0
    let y = 0
    const run = () => {
      frame = 0
      el.style.setProperty('--px', `${x.toFixed(1)}px`)
      el.style.setProperty('--py', `${y.toFixed(1)}px`)
    }
    const onMove = (e: PointerEvent) => {
      x = (e.clientX / window.innerWidth - 0.5) * 2 * PARALLAX_PX
      y = (e.clientY / window.innerHeight - 0.5) * 2 * PARALLAX_PX
      if (!frame) frame = requestAnimationFrame(run)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
      el.style.removeProperty('--px')
      el.style.removeProperty('--py')
    }
  }, [reduced])

  return (
    <div ref={root} aria-hidden className="ambient" data-paused={hidden || undefined}>
      {DEPTHS.map((depth, i) => (
        <span key={i} className="ambient-par" style={{ '--depth': depth } as React.CSSProperties}>
          <span className="ambient-blob" />
        </span>
      ))}
      {ZONE_NAMES.map((z) => (
        <div key={z} className="ambient-layer ambient-zone" data-zone={z} data-on={z === zone || undefined} />
      ))}
      {RECALL_CLASSES.map((c) => (
        <div key={c} className="ambient-layer ambient-tint" data-tint={c} data-on={c === tint || undefined} />
      ))}
    </div>
  )
}
