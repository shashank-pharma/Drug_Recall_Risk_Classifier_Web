import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { type Delta, formatChange } from '@/lib/delta'
import { cn } from '@/lib/utils'

const TONE = {
  bad: 'bg-red-50 text-red-700 ring-red-200',
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  neutral: 'bg-muted text-muted-strong ring-border',
} as const

const TONE_WORD = { bad: 'worse', good: 'better', neutral: 'no change' } as const

/** Change since the previous window. Colour follows good/bad, not the arrow; renders nothing without data. */
export function DeltaBadge({
  delta,
  period,
  format,
}: {
  delta: Delta | null
  /** e.g. "previous 30 days" */
  period: string
  format?: (n: number) => string
}) {
  if (!delta) return null
  const Icon = delta.direction === 'up' ? ArrowUpRight : delta.direction === 'down' ? ArrowDownRight : ArrowRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset',
        TONE[delta.tone],
      )}
      title={`${formatChange(delta.change, format)} (${delta.percent}%) vs ${period}`}
    >
      <Icon className="size-3" aria-hidden />
      {formatChange(delta.change, format)}
      <span className="sr-only">
        {' '}
        ({delta.percent}%) compared with the {period}, {TONE_WORD[delta.tone]}
      </span>
    </span>
  )
}
