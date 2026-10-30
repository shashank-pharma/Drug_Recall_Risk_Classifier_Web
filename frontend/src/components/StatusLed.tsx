import type { LedTone } from '@/lib/statusLed'
import { LED, MARK_EDGE } from '@/lib/tokens'
import { cn } from '@/lib/utils'

const COLOR: Record<LedTone, string> = {
  done: LED.done,
  pending: LED.pending,
  overdue: LED.overdue,
  none: 'var(--border)',
}

/** A small status light, always followed by its text (colour never carries the meaning alone). */
export function StatusLed({ tone, children, className }: { tone: LedTone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap',
        tone === 'overdue' ? 'text-red-700 dark:text-red-300' : tone === 'none' ? 'text-muted-strong' : 'text-foreground',
        className,
      )}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{
          backgroundColor: COLOR[tone],
          // darker edge so the light reaches 3:1 on white and on the pastel backgrounds
          boxShadow: `inset 0 0 0 1px ${tone === 'none' ? 'rgb(15 23 42 / 0.18)' : MARK_EDGE[tone]}`,
        }}
      />
      {children}
    </span>
  )
}
