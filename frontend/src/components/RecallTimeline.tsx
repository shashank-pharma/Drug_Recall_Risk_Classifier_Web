import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { useEffect } from 'react'
import { CountdownRing } from '@/components/CountdownRing'
import { StatusLed } from '@/components/StatusLed'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useNow } from '@/lib/motion'
import { milestoneProgress } from '@/lib/progress'
import { ringText } from '@/lib/ring'
import { MILESTONE_TEXT, milestoneTone } from '@/lib/statusLed'
import type { Milestone, Recall } from '@/lib/types'
import { useSimulation } from '@/lib/useSimulation'
import { cn } from '@/lib/utils'

const LEVEL_LABELS: Record<string, string> = {
  wholesale: 'Wholesale',
  retail: 'Retail',
  consumer: 'Consumer',
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

/** Countdown ring for a milestone with a deadline; a plain spacer keeps rows aligned otherwise. */
function MilestoneRing({ m, now }: { m: Milestone; now: Date }) {
  const progress = milestoneProgress(m, now)
  if (!progress || !m.due_at) return <span aria-hidden className="size-11 shrink-0" />
  return (
    <CountdownRing
      fraction={progress.fraction}
      status={m.status}
      text={ringText(progress.remainingMs)}
      label={`${m.label}: ${progress.label}, due ${formatDateTime(m.due_at)}`}
    />
  )
}

export function RecallTimeline({ recall, onUpdated }: { recall: Recall; onUpdated: (r: Recall) => void }) {
  const queryClient = useQueryClient()
  const sim = useSimulation()
  // During a simulation the rings and "time left" text use the simulated time, like the server's statuses.
  const realNow = useNow(60_000)
  const now = sim.active ? new Date(realNow.getTime() + sim.hours * 3_600_000) : realNow

  // Statuses are worked out by the server; ask again each minute while a deadline is still open.
  const hasOpenDeadline = !!recall.timeline?.some((m) => ['on_track', 'due_soon', 'overdue'].includes(m.status))
  useEffect(() => {
    if (!hasOpenDeadline) return
    const timer = setInterval(() => {
      api.getRecall(recall.id, sim.at()).then(onUpdated).catch(() => {})
    }, 60_000)
    return () => clearInterval(timer)
  }, [hasOpenDeadline, recall.id, onUpdated, sim])

  const update = useMutation({
    mutationFn: (call: () => Promise<Recall>) => call(),
    onSuccess: (updated) => {
      onUpdated(updated)
      queryClient.setQueryData(['recall', updated.id, 0], updated)
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
                <MilestoneRing m={m} now={now} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-medium">{m.label}</span>
                    <StatusLed tone={milestoneTone(m.status)}>{MILESTONE_TEXT[m.status]}</StatusLed>
                  </div>
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
                    disabled={update.isPending || sim.active}
                    title={sim.active ? 'Paused during the simulation' : undefined}
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

      {sim.active && recall.timeline && (
        <p className="text-xs text-muted-strong">Marking milestones is paused while the simulation is on.</p>
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
