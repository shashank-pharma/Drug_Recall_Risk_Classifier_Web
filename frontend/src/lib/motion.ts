import { useEffect, useState, useSyncExternalStore } from 'react'
import { countUpValue } from './countUp.ts'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** True when the person has asked the OS to reduce motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
}

/** Animates from 0 to `target` once (ease-out); jumps straight there with reduced motion. */
export function useCountUp(target: number, durationMs = 500): number {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (reduced) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const next = countUpValue(target, now - start, durationMs)
      setValue(next)
      if (next !== target) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, reduced])

  return reduced ? target : value
}

/** Current time, refreshed every `intervalMs` so "time left" text stays honest. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
