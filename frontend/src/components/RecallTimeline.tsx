import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'
import { formatDateTime, formatDueIn } from '@/lib/format'
import type { Milestone, MilestoneStatus, Recall } from '@/lib/types'
import { cn } from '@/lib/utils'

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

function DueLine({ m }: { m: Milestone }) {
  if (m.done_at) return <>Done {formatDateTime(m.done_at)}{m.due_at && ` · due ${formatDateTime(m.due_at)}`}</>
  if (!m.due_at) return <>{m.note}</>
  return (
    <>
      Due {formatDateTime(m.due_at)} · {formatDueIn(m.due_at)}
    </>
  )
}

export function RecallTimeline({ recall, onUpdated }: { recall: Recall; onUpdated: (r: Recall) => void }) {
  const queryClient = useQueryClient()
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
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <DueLine m={m} />
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
