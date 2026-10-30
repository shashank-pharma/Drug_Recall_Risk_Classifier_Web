import { cn } from '@/lib/utils'

/**
 * Static placeholder block. Deliberately not shadcn's Skeleton: that one pulses in a loop,
 * and looping animation is against the motion rules (CLAUDE.md "Motion").
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rounded-md bg-muted', className)} />
}

/** Wraps placeholders so screen readers hear one "Loading…" instead of empty boxes. */
export function LoadingRegion({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
