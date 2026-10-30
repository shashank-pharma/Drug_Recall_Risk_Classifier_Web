import { Check, Minus } from 'lucide-react'
import { CountdownRing } from '@/components/CountdownRing'
import { StatusLed } from '@/components/StatusLed'
import { formatDateTime } from '@/lib/format'
import { milestoneProgress } from '@/lib/progress'
import { ringText } from '@/lib/ring'
import { MILESTONE_TEXT, milestoneTone } from '@/lib/statusLed'
import type { Milestone, Recall } from '@/lib/types'
import { cn } from '@/lib/utils'

// The CDSCO steps in order. "Information received" starts the clock (§8.0); the others are the
// timeline's own milestones, with their own section references. No new rules here.
const STEPS: { key: 'received' | Milestone['key']; label: string }[] = [
  { key: 'received', label: 'Information received' },
  { key: 'decision', label: 'Recall decision' },
  { key: 'communication', label: 'Supply chain informed' },
  { key: 'stop_sale', label: 'Stop sale/\u200Bdistribution' }, // may wrap after the slash
  { key: 'completion', label: 'Recall completed' },
]

const OPEN = ['on_track', 'due_soon', 'overdue', 'waiting']
const section = (source: string) => source.match(/§\s?\d+(\.\d+)?/)?.[0] ?? ''

type Step = {
  key: string
  label: string
  milestone?: Milestone
  done: boolean
  open: boolean
  section: string
  when?: string
}

function steps(recall: Recall): Step[] {
  const byKey = new Map((recall.timeline ?? []).map((m) => [m.key, m]))
  return STEPS.map(({ key, label }) => {
    if (key === 'received') {
      return { key, label, done: true, open: false, section: '§8.0', when: recall.information_received_at ?? undefined }
    }
    const m = byKey.get(key)
    return {
      key,
      label,
      milestone: m,
      done: !!m && (m.status === 'done' || m.status === 'done_late'),
      open: !!m && OPEN.includes(m.status),
      section: m ? section(m.source) : '',
      when: m?.done_at ?? m?.due_at ?? undefined,
    }
  })
}

/**
 * The CDSCO steps as one horizontal flow: a light per step (green done, amber open, red overdue), a
 * countdown ring while a deadline is running, and connectors that fill once a step is done. The first
 * open step is marked as the current one (static, no loop). Follows the simulation time via `now`.
 */
export function ProcessFlow({ recall, now }: { recall: Recall; now: Date }) {
  const list = steps(recall)
  const current = list.findIndex((s) => s.open)
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Process flow</h4>
      <ol aria-label="CDSCO process flow" className="grid grid-cols-5">
        {list.map((s, i) => {
          const m = s.milestone
          const progress = m && !s.done ? milestoneProgress(m, now) : null
          const tone = s.key === 'received' ? 'done' : m ? milestoneTone(m.status) : 'none'
          const text = s.key === 'received' ? 'Done' : m ? MILESTONE_TEXT[m.status] : 'No deadline'
          return (
            <li key={s.key} className="relative flex min-w-0 flex-col items-center gap-1 px-0.5 text-center">
              {i < list.length - 1 && (
                // Connector to the next step: grey track, gradient fill once this step is done.
                <span aria-hidden className="absolute top-[21px] left-[calc(50%+24px)] h-0.5 w-[calc(100%-48px)] overflow-hidden rounded-full bg-border">
                  {s.done && (
                    <span className="connector-fill block h-full w-full bg-[linear-gradient(90deg,var(--brand-from),var(--brand-to))]" />
                  )}
                </span>
              )}
              <span className={cn('rounded-full', i === current && 'ring-2 ring-[var(--accent-ring)] ring-offset-2 ring-offset-transparent')}>
                {progress && m?.due_at ? (
                  <CountdownRing
                    fraction={progress.fraction}
                    status={m.status}
                    text={ringText(progress.remainingMs)}
                    label={`${s.label}: ${progress.label}, due ${formatDateTime(m.due_at)}`}
                  />
                ) : (
                  <span
                    className={cn(
                      'grid size-11 place-items-center rounded-full border-2',
                      s.done ? 'border-[var(--led-done)] text-[var(--led-done)]' : 'border-border text-muted-foreground',
                    )}
                  >
                    {s.done ? <Check className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                  </span>
                )}
              </span>
              <span className="w-full text-[11px] leading-tight font-medium break-words">{s.label}</span>
              <StatusLed tone={tone} className="justify-center text-[11px]">
                {text}
              </StatusLed>
              {s.section && <span className="text-[10px] text-muted-foreground">{s.section}</span>}
              {i === current && <span className="sr-only">Current step.</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Shown instead of the flow when a recall was saved before information-received times were recorded. */
export function NoTimeline() {
  return (
    <div className="rounded-xl border border-dashed p-4 text-center">
      <p className="text-sm font-medium">No timeline</p>
      <p className="mt-1 text-xs text-muted-foreground">
        This recall was saved before the information-received time was recorded, so it has no CDSCO steps.
      </p>
    </div>
  )
}
