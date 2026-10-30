import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Skeleton } from '@/components/Skeleton'
import { api } from '@/lib/api'
import { formatUnits } from '@/lib/format'
import { useSimulation } from '@/lib/useSimulation'
import { cn } from '@/lib/utils'

function Kpi({
  label,
  value,
  to,
  alert = false,
}: {
  label: string
  value: number | undefined
  to?: string
  alert?: boolean
}) {
  const body = (
    <>
      <span className={cn('text-xs', alert ? 'text-red-800 dark:text-red-300' : 'text-muted-foreground')}>{label}</span>
      {value === undefined ? (
        <Skeleton className="h-5 w-8" />
      ) : (
        <span className={cn('text-base font-semibold tabular-nums', alert && 'text-red-700 dark:text-red-300')}>
          {formatUnits(value)}
        </span>
      )}
    </>
  )
  const className = 'flex items-baseline gap-2 px-4 py-2 first:pl-0'
  return to ? (
    <Link
      to={to}
      className={cn(
        className,
        'rounded-sm underline-offset-4 transition-colors duration-[var(--dur-fast)] hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/** Total, overdue and Class I counts under the header; the overdue and Class I numbers open the matching History list. */
export function KpiStrip() {
  const sim = useSimulation()
  // The overdue count follows the simulation time; the other totals don't depend on time.
  const { data } = useQuery({
    queryKey: sim.active ? ['stats', 'summary', {}, sim.hours] : ['stats'],
    queryFn: () => api.statsSummary({ at: sim.at() }),
  })
  const classI = data?.by_class.find((c) => c.recall_class === 'Class I')?.count

  return (
    <section aria-label="Recall totals" className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap divide-x px-4">
        <Kpi label="Total recalls" value={data?.total_recalls} />
        <Kpi
          label="Overdue"
          value={data?.overdue}
          to="/history?status=overdue"
          alert={!!data?.overdue}
        />
        <Kpi label="Class I" value={classI} to="/history?class=Class+I" />
      </div>
    </section>
  )
}
