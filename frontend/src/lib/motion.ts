import { useEffect, useState, useSyncExternalStore } from 'react'
import { countUpValue } from './countUp.ts'
import { type Motion, type MotionSetting, readMotionSetting, resolveMotion, saveMotionSetting } from './motionPref.ts'

const QUERY = '(prefers-reduced-motion: reduce)'
const MOTION_EVENT = 'recall-motion-change'

function storage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function osPrefersReduced(): boolean {
  return window.matchMedia(QUERY).matches
}

/** Put the effective motion on <html data-motion> (index.css reads it) and tell hooks it changed. */
export function applyMotion(): Motion {
  const motion = resolveMotion(readMotionSetting(storage()), osPrefersReduced())
  if (document.documentElement.dataset.motion !== motion) document.documentElement.dataset.motion = motion
  window.dispatchEvent(new Event(MOTION_EVENT))
  return motion
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  const onOs = () => {
    applyMotion() // Auto follows the OS live
    onChange()
  }
  media.addEventListener('change', onOs)
  window.addEventListener(MOTION_EVENT, onChange)
  return () => {
    media.removeEventListener('change', onOs)
    window.removeEventListener(MOTION_EVENT, onChange)
  }
}

/**
 * True when motion should be reduced: the header's Motion setting (Full / Reduced), or with Auto the OS
 * "reduce motion" setting. Same answer as <html data-motion> in CSS.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => resolveMotion(readMotionSetting(storage()), osPrefersReduced()) === 'reduced',
    () => false,
  )
}

/** The Motion menu's value and setter (saved, then applied everywhere). */
export function useMotionSetting(): [MotionSetting, (setting: MotionSetting) => void] {
  const setting = useSyncExternalStore(subscribe, () => readMotionSetting(storage()), () => 'auto' as MotionSetting)
  const set = (next: MotionSetting) => {
    saveMotionSetting(storage(), next)
    applyMotion()
  }
  return [setting, set]
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

/** True while the media query matches (e.g. the wide Explorer layout). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
