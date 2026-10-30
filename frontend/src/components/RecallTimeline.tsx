import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useNow } from '@/lib/motion'
import { milestoneProgress } from '@/lib/progress'
import type { Milestone, MilestoneStatus, Recall } from '@/lib/types'
import { cn } from '@/lib/utils'

// Bar fill per status; the status pill and the "time left" text carry the same meaning in words.
const BAR: Partial<Record<MilestoneStatus, string>> = {
  on_track: 'bg-sky-600',
  due_soon: 'bg-amber-500',
  overdue: 'bg-red-600',
  done: 'bg-emerald-600',
  done_late: 'bg-amber-600',
}

const STATUS: Record<MilestoneStatus, { label: string; className: string }> = {
  done: { label: 'Done', className: 'bg-emerald-100 text-emerald-900' },
  done_late: { label: 'Done late', className: 'bg-amber-100 text-amber-900' },
  overdue: { label: 'Overdue', className: 'bg-red-600 text-white' },
  due_soon: { label: 'Due soon', className: 'bg-amber-400 text-amber-950' },
  on_track: { label: 'On track', className: 'bg-sky-100 text-sky-900' },
  not_specified: { label: 'Not specified', className: 'bg-muted text-muted-foreground' },
  waiting: { label: 'Waiting for decision', className: 'bg-muted text-muted-foreground' },
}

const LEVEL_LABELS: Record<string, string> = {
  wholesale: 'Wholesale',
  retail: 'Retail',
  consumer: 'Consumer',
}

export function StatusPill({ status }: { status: MilestoneStatus }) {
  const { label, className } = STATUS[status]
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

function DueLine({ m, now }: { m: Milestone; now: Date }) {
  if (m.done_at) return <>Done {formatDateTime(m.done_at)}{m.due_at && ` · due ${formatDateTime(m.due_at)}`}</>
  if (!m.due_at) return <>{m.note}</>
  const progress = milestoneProgress(m, now)
  return (
    <>
      Due {formatDateTime(m.due_at)}
      {progress && (
        <>
          {' · '}
          <span className={cn(m.status === 'overdue' && 'font-medium text-red-700')}>{progress.label}</span>
        </>
      )}
    </>
  )
}

/** Share of the allowed time already used. Fills from empty when shown, then follows the clock. */
function MilestoneProgress({ m, now }: { m: Milestone; now: Date }) {
  const progress = milestoneProgress(m, now)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  if (!progress || !m.due_at) return null

  const percent = Math.round(progress.fraction * 100)
  return (
    <div
      role="progressbar"
      aria-label={`${m.label}: share of allowed time used`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}% of the time used, ${progress.label}, due ${formatDateTime(m.due_at)}`}
      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn(
          'h-full w-full origin-left rounded-full transition-[transform,background-color] duration-[var(--dur-slow)] ease-[var(--ease-out)]',
          BAR[m.status] ?? 'bg-muted-foreground',
        )}
        style={{ transform: `scaleX(${shown ? progress.fraction : 0})` }}
      />
    </div>
  )
}

export function RecallTimeline({ recall, onUpdated }: { recall: Recall; onUpdated: (r: Recall) => void }) {
  const queryClient = useQueryClient()
  const now = useNow(60_000)

  // Statuses are worked out by the server; ask again each minute while a deadline is still open.
  const hasOpenDeadline = !!recall.timeline?.some((m) => ['on_track', 'due_soon', 'overdue'].includes(m.status))
  useEffect(() => {
    if (!hasOpenDeadline) return
    const timer = setInterval(() => {
      api.getRecall(recall.id).then(onUpdated).catch(() => {})
    }, 60_000)
    return () => clearInterval(timer)
  }, [hasOpenDeadline, recall.id, onUpdated])

  const update = useMutation({
    mutationFn: (call: () => Promise<Recall>) => call(),
    onSuccess: (updated) => {
      onUpdated(updated)
      queryClient.setQueryData(['recall', updated.id], updated)
      queryClient.invalidateQueries({ queryKey: ['recalls'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  function action(m: Milestone) {
    if (m.key === 'decision') {
      return m.done_at
        ? { label: 'Clear', run: () => api.setDecision(recall.id, null) }
        : { label: 'Record decision now', run: () => api.setDecision(recall.id, new Date().toISOString()) }
    }
    if (m.status === 'not_specified' || m.status === 'waiting') return null
    const key = m.key
    return m.done_at
      ? { label: 'Undo', run: () => api.setMilestone(recall.id, key, false) }
      : { label: 'Mark done', run: () => api.setMilestone(recall.id, key, true) }
  }

  const error = update.error instanceof ApiError ? update.error : null

  return (
    <section aria-labelledby={`timeline-${recall.id}`} className="space-y-4 border-b p-5">
      <div>
        <h3 id={`timeline-${recall.id}`} className="text-sm font-semibold">
          CDSCO timeline
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Recall up to:</span>
          {recall.recall_levels.map((level) => (
            <span key={level} className="rounded-md border px-2 py-0.5 font-medium">
              {LEVEL_LABELS[level] ?? level}
            </span>
          ))}
        </div>
        {recall.public_announcement && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-red-800">
            <Megaphone className="mt-px size-3.5 shrink-0" aria-hidden />
            Public announcement needed (newspaper, TV, radio).
          </p>
        )}
      </div>

      {!recall.timeline ? (
        <p className="text-sm text-muted-foreground">
          No timeline: this recall was saved before the information-received time was recorded.
        </p>
      ) : (
        <ol className="space-y-3">
          {recall.timeline.map((m) => {
            const act = action(m)
            return (
              <li key={m.key} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    <StatusPill status={m.status} />
                  </div>
                  <MilestoneProgress m={m} now={now} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    <DueLine m={m} now={now} />
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    {m.due_at || m.done_at ? `${m.note} · ` : ''}
                    {m.source}
                  </p>
                </div>
                {act && (
                  <Button
                    type="button"
                    size="sm"
                    variant={act.label === 'Mark done' || act.label === 'Record decision now' ? 'outline' : 'ghost'}
                    disabled={update.isPending}
                    onClick={() => update.mutate(act.run)}
                  >
                    {act.label}
                  </Button>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}

      {recall.timeline && recall.information_received_at && (
        <p className="text-[11px] text-muted-foreground">
          Clock started when the information was received: {formatDateTime(recall.information_received_at)}.
          Days are calendar days; the guideline does not specify working days.
        </p>
      )}
    </section>
  )
}
