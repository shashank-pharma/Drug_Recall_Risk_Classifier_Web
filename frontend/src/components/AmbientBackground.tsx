import { useEffect, useSyncExternalStore } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { RECALL_CLASSES } from '@/lib/recallClass'
import { classTintFor, ZONE_NAMES, zoneFor } from '@/lib/zone'

function subscribe(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

/**
 * Fixed pastel layer behind every page (styles: "Ambient background" in index.css). Each page area has
 * its own tint, and one chosen class adds a background-only tint; both cross-fade with opacity. The
 * drifting blobs pause while the tab is hidden and stop with reduced motion. Decorative only.
 */
export function AmbientBackground() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const zone = zoneFor(pathname)
  const tint = classTintFor(pathname, params)
  const hidden = useSyncExternalStore(subscribe, () => document.hidden, () => false)

  // On <html> so cards in panels and dialogs (portals) pick up the same tint.
  useEffect(() => {
    document.documentElement.dataset.zone = zone
  }, [zone])

  return (
    <div aria-hidden className="ambient" data-paused={hidden || undefined}>
      <span className="ambient-blob" />
      <span className="ambient-blob" />
      <span className="ambient-blob" />
      <span className="ambient-blob" />
      {ZONE_NAMES.map((z) => (
        <div key={z} className="ambient-layer ambient-zone" data-zone={z} data-on={z === zone || undefined} />
      ))}
      {RECALL_CLASSES.map((c) => (
        <div key={c} className="ambient-layer ambient-tint" data-tint={c} data-on={c === tint || undefined} />
      ))}
    </div>
  )
}
