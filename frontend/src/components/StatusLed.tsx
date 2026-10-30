import type { LedTone } from '@/lib/statusLed'
import { LED, PALETTE } from '@/lib/tokens'
import { cn } from '@/lib/utils'

const COLOR: Record<LedTone, string> = {
  done: LED.done,
  pending: LED.pending,
  overdue: LED.overdue,
  none: PALETTE.border,
}

/** A small status light, always followed by its text (colour never carries the meaning alone). */
export function StatusLed({ tone, children, className }: { tone: LedTone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap',
        tone === 'overdue' ? 'text-red-700' : tone === 'none' ? 'text-muted-strong' : 'text-foreground',
        className,
      )}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(15_23_42/0.18)]"
        style={{ backgroundColor: COLOR[tone] }}
      />
      {children}
    </span>
  )
}
