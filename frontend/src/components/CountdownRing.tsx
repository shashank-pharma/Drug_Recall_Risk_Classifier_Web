import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ringDash } from '@/lib/ring'
import type { MilestoneStatus } from '@/lib/types'
import { LED } from '@/lib/tokens'

const SIZE = 44
const R = 18
const STROKE = 4

// Ring colour per status; the status text next to it says the same in words.
const COLOR: Partial<Record<MilestoneStatus, string>> = {
  on_track: 'var(--chart-1)',
  due_soon: LED.pending,
  overdue: LED.overdue,
  done: LED.done,
  done_late: LED.pending,
}

/**
 * Share of a milestone's allowed time already used, as a ring that fills clockwise from 12 o'clock.
 * Draws in from empty when shown (stroke-dashoffset, 300 ms), then follows the clock.
 */
export function CountdownRing({
  fraction,
  status,
  text,
  label,
}: {
  fraction: number
  status: MilestoneStatus
  /** short text in the middle, e.g. "22h" */
  text: string
  /** full description for screen readers */
  label: string
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const { circumference, dashOffset } = ringDash(shown ? fraction : 0, R)
  const done = status === 'done' || status === 'done_late'
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100)

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}% of the time used, ${label}`}
      className="relative grid size-11 shrink-0 place-items-center"
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={COLOR[status] ?? 'var(--muted-foreground)'}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset,stroke] duration-[var(--dur-slow)] ease-[var(--ease-out)]"
        />
      </svg>
      {done ? (
        <Check className="size-4" style={{ color: COLOR[status] }} aria-hidden />
      ) : (
        <span aria-hidden className="text-[10px] font-semibold tabular-nums">
          {text}
        </span>
      )}
    </div>
  )
}
