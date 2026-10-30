import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { usePrefersReducedMotion } from '@/lib/motion'

const REVEAL_GAP_MS = 50

/**
 * Page-wide card effects (styles in index.css): a soft spotlight that follows the cursor on cards, and
 * cards fading up as they scroll into view, 50 ms apart. Both are off with reduced motion; the spotlight
 * also needs a fine pointer (no touch). Renders nothing.
 */
export function SurfaceEffects() {
  const reduced = usePrefersReducedMotion()
  const { pathname } = useLocation()

  // Spotlight: one throttled listener for the whole page.
  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return
    let frame = 0
    let last: PointerEvent | null = null
    const run = () => {
      frame = 0
      const card = last?.target instanceof Element ? last.target.closest<HTMLElement>('[data-slot="card"]') : null
      if (!card || !last) return
      const box = card.getBoundingClientRect()
      card.style.setProperty('--spot-x', `${last.clientX - box.left}px`)
      card.style.setProperty('--spot-y', `${last.clientY - box.top}px`)
    }
    const onMove = (e: PointerEvent) => {
      last = e
      if (!frame) frame = requestAnimationFrame(run)
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [reduced])

  // Reveal: cards in <main> (not the Dashboard's own load sequence, which uses enter-fade).
  useEffect(() => {
    const main = document.getElementById('main')
    if (!main) return
    const pending = () => main.querySelectorAll<HTMLElement>('[data-reveal="pending"]')
    if (reduced) {
      pending().forEach((el) => (el.dataset.reveal = 'shown'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((e) => e.isIntersecting)
          .forEach((e, i) => {
            const el = e.target as HTMLElement
            el.style.setProperty('--reveal-delay', `${Math.min(i, 6) * REVEAL_GAP_MS}ms`)
            el.dataset.reveal = 'shown'
            observer.unobserve(el)
          })
      },
      { rootMargin: '0px 0px -6% 0px' },
    )
    let frame = 0
    const scan = () => {
      frame = 0
      main.querySelectorAll<HTMLElement>('[data-slot="card"]:not([data-reveal]):not(.enter-fade)').forEach((el) => {
        el.dataset.reveal = 'pending'
        observer.observe(el)
      })
    }
    scan()
    const mutations = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(scan)
    })
    mutations.observe(main, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      mutations.disconnect()
      cancelAnimationFrame(frame)
      // Never leave a card hidden if the effect stops (e.g. switching to Reduced).
      pending().forEach((el) => (el.dataset.reveal = 'shown'))
    }
  }, [reduced, pathname])

  return null
}
