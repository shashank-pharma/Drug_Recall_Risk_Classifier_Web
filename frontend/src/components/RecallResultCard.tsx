import { CheckCircle2 } from 'lucide-react'
import { ClassBadge } from '@/components/ClassBadge'
import { RecallTimeline } from '@/components/RecallTimeline'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDateTime, formatUnits, humanizeDefect } from '@/lib/format'
import { classStyle } from '@/lib/recallClass'
import type { Recall } from '@/lib/types'
import { cn } from '@/lib/utils'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-lg font-semibold tabular-nums" title={value}>
        {value}
      </dd>
    </div>
  )
}

export function RecallResultCard({
  recall,
  onUpdated,
  onReset,
}: {
  recall: Recall
  /** Called with the saved recall after a timeline change (decision, milestone done). */
  onUpdated: (recall: Recall) => void
  /** Shows the "Enter another recall" button when given. */
  onReset?: () => void
}) {
  return (
    <Card className="gap-0 overflow-hidden rounded-2xl p-0" aria-live="polite">
      <div className={cn('border-b p-5', classStyle(recall.recall_class).soft)}>
        <div className="flex items-center justify-between gap-3">
          <ClassBadge label={recall.recall_class} size="lg" explain />
          <span className="flex items-center gap-1 text-xs font-medium">
            <CheckCircle2 className="size-4" aria-hidden />
            Saved as #{recall.id}
          </span>
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide opacity-70">Required action</p>
        <h2 className="text-2xl font-semibold tracking-tight">{recall.action}</h2>
        <p className="mt-1 text-sm opacity-80">{recall.meaning}</p>
      </div>

      <dl className="grid grid-cols-2 divide-x border-b">
        <Stat label="Units affected" value={formatUnits(recall.units_affected)} />
        <Stat label="Defect type" value={humanizeDefect(recall.defect_type)} />
      </dl>

      <RecallTimeline recall={recall} onUpdated={onUpdated} />

      <div className="space-y-3 p-5 text-sm">
        <div>
          <p className="font-medium">
            {recall.drug_name} <span className="text-muted-foreground">· Batch {recall.batch_id}</span>
          </p>
          <p className="mt-1 text-muted-foreground">{recall.reason}</p>
        </div>
        <p className="text-xs text-muted-foreground">Saved {formatDateTime(recall.created_at)}</p>
        {onReset && (
          <Button variant="outline" className="w-full" onClick={onReset}>
            Enter another recall
          </Button>
        )}
      </div>
    </Card>
  )
}

export function ResultPlaceholder() {
  return (
    <Card className="items-center justify-center rounded-2xl border-dashed bg-muted/30 p-10 text-center shadow-none">
      <p className="font-medium">Your result will appear here</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Fill in the form and submit it to see the recall class and the action required.
      </p>
    </Card>
  )
}
