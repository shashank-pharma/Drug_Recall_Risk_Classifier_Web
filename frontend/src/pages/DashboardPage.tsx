import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ClassDonut } from '@/components/charts/ClassDonut'
import { DefectBars } from '@/components/charts/DefectBars'
import { DeltaBadge } from '@/components/charts/DeltaBadge'
import { TrendChart } from '@/components/charts/TrendChart'
import { PageHeader } from '@/components/PageHeader'
import { PillLink } from '@/components/PillLink'
import { LoadingRegion, Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { computeDelta, type Delta } from '@/lib/delta'
import { formatUnits } from '@/lib/format'
import { useCountUp } from '@/lib/motion'
import { cn } from '@/lib/utils'

// The page's one load sequence: four cards, then the charts (CLAUDE.md "Motion").
const stagger = (i: number) => ({ '--stagger': i }) as React.CSSProperties
const DELTA_DAYS = 30

/** Counts up visually; screen readers get the final number straight away. */
function CountUpNumber({ value }: { value: number }) {
  const shown = useCountUp(value, 500)
  return (
    <>
      <span aria-hidden>{formatUnits(shown)}</span>
      <span className="sr-only">{formatUnits(value)}</span>
    </>
  )
}

type Recent = { amount: number; delta: Delta | null; noun: string }

function StatCard({
  label,
  value,
  hint,
  recent,
  to,
  alert = false,
  index,
}: {
  label: string
  value: number
  hint?: string
  /** what happened in the last 30 days, compared with the 30 days before (shown only with real data) */
  recent?: Recent
  to?: string
  alert?: boolean
  index: number
}) {
  const card = (
    <Card
      className={cn('enter-fade h-full gap-1 rounded-2xl p-5', alert && 'border-red-200 bg-red-50 text-red-900')}
      style={stagger(index)}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">
        <CountUpNumber value={value} />
      </p>
      {recent && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {formatUnits(recent.amount)} {recent.noun} in the last {DELTA_DAYS} days
          <DeltaBadge delta={recent.delta} period={`previous ${DELTA_DAYS} days`} format={formatUnits} />
        </p>
      )}
      {hint && <p className={cn('text-xs', alert ? 'text-red-800' : 'text-muted-foreground')}>{hint}</p>}
    </Card>
  )
  return to ? (
    <Link to={to} className="rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      {card}
    </Link>
  ) : (
    card
  )
}

export function DashboardPage() {
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['stats'], queryFn: api.statsSummary })
  const trend = useQuery({ queryKey: ['stats', 'trend', DELTA_DAYS], queryFn: () => api.statsTrend(DELTA_DAYS) })

  if (isPending) {
    return (
      <>
        <PageHeader title="Dashboard" description="Recalls by class and defect type." />
        <LoadingRegion label="Loading statistics…">
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Card key={i} className="h-full gap-3 rounded-2xl p-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 2 }, (_, i) => (
              <Card key={i} className="rounded-2xl p-6">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-56 w-full" />
              </Card>
            ))}
          </div>
        </LoadingRegion>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" description="Recalls by class and defect type." />
        <div role="alert" className="text-sm">
          <p className="text-destructive">{error.message}</p>
          <Button variant="outline" className="mt-3" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </>
    )
  }

  if (data.total_recalls === 0) {
    return (
      <>
        <PageHeader title="Dashboard" description="Recalls by class and defect type." />
        <Card className="rounded-2xl p-10 text-center">
          <p className="font-medium">No recalls saved yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link to="/" className="underline underline-offset-4">
              Enter the first recall
            </Link>{' '}
            and the charts will appear here.
          </p>
        </Card>
      </>
    )
  }

  const classI = data.by_class.find((c) => c.recall_class === 'Class I')
  const now = trend.data?.current
  const before = trend.data?.previous
  // More recalls, more units or more Class I recalls is worse, so a rise shows red.
  const recent = (current: number | undefined, previous: number | undefined, noun: string): Recent | undefined =>
    current === undefined || previous === undefined
      ? undefined
      : { amount: current, noun, delta: computeDelta(current, previous, 'bad') }

  return (
    <>
      <PageHeader title="Dashboard" description="Recalls by class and defect type." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          index={0}
          label="Total recalls"
          value={data.total_recalls}
          recent={recent(now?.recalls, before?.recalls, 'saved')}
        />
        <StatCard
          index={1}
          label="Units affected"
          value={data.total_units}
          recent={recent(now?.units, before?.units, 'units')}
        />
        <StatCard
          index={2}
          label="Class I recalls"
          value={classI?.count ?? 0}
          hint="Serious or life-threatening risk"
          recent={recent(now?.by_class['Class I'], before?.by_class['Class I'], 'saved')}
        />
        <StatCard
          index={3}
          label="Overdue recalls"
          value={data.overdue}
          hint={data.overdue ? 'Past a CDSCO deadline · view list' : 'No CDSCO deadline missed'}
          to={data.overdue ? '/history?status=overdue' : undefined}
          alert={data.overdue > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="enter-fade rounded-[var(--radius-card)]" style={stagger(4)}>
          <CardHeader>
            <CardTitle>Recalls by class</CardTitle>
            <CardDescription>Share of all saved recalls</CardDescription>
            <CardAction>
              <PillLink to="/history">View all</PillLink>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ClassDonut data={data.by_class} total={data.total_recalls} />
          </CardContent>
        </Card>

        <Card className="enter-fade rounded-[var(--radius-card)]" style={stagger(5)}>
          <CardHeader>
            <CardTitle>Recalls by defect type</CardTitle>
            <CardDescription>The dot shows each defect type&apos;s class</CardDescription>
            <CardAction>
              <PillLink to="/explorer">Explore</PillLink>
            </CardAction>
          </CardHeader>
          <CardContent>
            <DefectBars data={data.by_defect} />
          </CardContent>
        </Card>

        <Card className="enter-fade rounded-[var(--radius-card)] lg:col-span-2" style={stagger(5)}>
          <CardHeader>
            <CardTitle>Recalls saved over time</CardTitle>
            <CardDescription>Per day, in UTC</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
