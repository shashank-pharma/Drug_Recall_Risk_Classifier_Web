import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { ClassBadge } from '@/components/ClassBadge'
import { ClassDonut } from '@/components/charts/ClassDonut'
import { DefectBars } from '@/components/charts/DefectBars'
import { DeltaBadge } from '@/components/charts/DeltaBadge'
import { TrendChart } from '@/components/charts/TrendChart'
import { PageHeader } from '@/components/PageHeader'
import { PillLink } from '@/components/PillLink'
import { SampleDataButton } from '@/components/SampleDataButton'
import { LoadingRegion, Skeleton } from '@/components/Skeleton'
import { StatusLed } from '@/components/StatusLed'
import { TactileKeys } from '@/components/TactileKeys'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { computeDelta, type Delta } from '@/lib/delta'
import { formatDateTime, formatUnits, humanizeDefect } from '@/lib/format'
import {
  clearLinked,
  describeLinked,
  hasLinked,
  historyHref,
  type LinkedFilter,
  readLinkedFilter,
  toggleLinked,
} from '@/lib/linkedFilter'
import { useCountUp } from '@/lib/motion'
import { RECALL_CLASSES } from '@/lib/recallClass'
import { recallLed } from '@/lib/statusLed'
import type { StatsFilter } from '@/lib/types'
import { useSimulation } from '@/lib/useSimulation'
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
  tint,
  risk = false,
  index,
}: {
  label: string
  value: number
  hint?: string
  /** what happened in the last 30 days, compared with the 30 days before (shown only with real data) */
  recent?: Recent
  to?: string
  alert?: boolean
  /** pastel wash for this card (Total lavender, Units sky, Class I rose, Overdue mint) */
  tint: 'lavender' | 'sky' | 'rose' | 'mint'
  /** red top line instead of indigo→violet (Class I only) */
  risk?: boolean
  index: number
}) {
  const card = (
    <Card
      className={cn('enter-fade h-full gap-1 rounded-2xl p-5', `tint-${tint}`, risk && 'line-risk')}
      style={stagger(index)}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      {/* An overdue count shows in red text; the mint card colour itself carries no meaning. */}
      <p className={cn('text-3xl font-semibold tracking-tight tabular-nums', alert && 'text-red-700 dark:text-red-300')}>
        <CountUpNumber value={value} />
      </p>
      {recent && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {formatUnits(recent.amount)} {recent.noun} in the last {DELTA_DAYS} days
          <DeltaBadge delta={recent.delta} period={`previous ${DELTA_DAYS} days`} format={formatUnits} />
        </p>
      )}
      {hint && <p className={cn('text-xs', alert ? 'text-red-800 dark:text-red-300' : 'text-muted-foreground')}>{hint}</p>}
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

const RECENT_COUNT = 5

/** The latest recalls for the current filter, with a link to the full list in History. */
function RecentRecalls({ filter, linked }: { filter: StatsFilter; linked: LinkedFilter }) {
  const sim = useSimulation()
  const query = {
    recall_class: filter.recall_class ? [filter.recall_class] : [],
    defect_type: filter.defect_type,
    page_size: RECENT_COUNT,
  }
  const { data, error, isFetching } = useQuery({
    queryKey: ['recalls', query, sim.hours],
    queryFn: () => api.listRecalls({ ...query, at: sim.at() }),
    placeholderData: keepPreviousData,
  })

  if (error) return <p role="alert" className="text-sm text-destructive">{error.message}</p>
  if (!data) return <Skeleton className="h-40 w-full rounded-xl" />
  if (data.items.length === 0) return <p className="py-6 text-center text-sm text-muted-strong">No recalls match this filter.</p>
  return (
    <>
      <Table className={cn('transition-opacity duration-[var(--dur-base)]', isFetching && 'opacity-60')}>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Drug</TableHead>
            <TableHead className="hidden sm:table-cell">Defect type</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>CDSCO status</TableHead>
            <TableHead className="hidden text-right md:table-cell">Units</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((r) => {
            const led = r.timeline ? recallLed(r.timeline.map((m) => m.status)) : null
            return (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</TableCell>
                <TableCell className="font-medium">
                  <Link to={`/history?recall=${r.id}`} className="rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                    {r.drug_name}
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{humanizeDefect(r.defect_type)}</TableCell>
                <TableCell>
                  <ClassBadge label={r.recall_class} explain />
                </TableCell>
                <TableCell>{led ? <StatusLed tone={led.tone}>{led.text}</StatusLed> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{formatUnits(r.units_affected)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <p className="mt-3 text-xs text-muted-strong">
        Latest {Math.min(RECENT_COUNT, data.total)} of {data.total}.{' '}
        <Link to={historyHref(linked)} className="underline underline-offset-4 hover:text-foreground">
          See every matching recall in History
        </Link>
      </p>
    </>
  )
}

export function DashboardPage() {
  const sim = useSimulation()
  const [params, setParams] = useSearchParams()
  const linked = readLinkedFilter(params)
  const filtered = hasLinked(linked)
  const filter: StatsFilter = {
    ...(linked.recallClass && { recall_class: linked.recallClass }),
    ...(linked.defect && { defect_type: linked.defect }),
  }
  // Charts filter each other through the URL, so Back undoes a click and a link keeps the view.
  const setLinked = (key: keyof LinkedFilter, value: string | null) =>
    setParams((prev) => toggleLinked(prev, key, value), { preventScrollReset: true })

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['stats', 'summary', filter, sim.hours],
    queryFn: () => api.statsSummary({ ...filter, at: sim.at() }),
    placeholderData: keepPreviousData,
  })
  const trend = useQuery({
    queryKey: ['stats', 'trend', DELTA_DAYS, filter],
    queryFn: () => api.statsTrend(DELTA_DAYS, filter),
    placeholderData: keepPreviousData,
  })

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

  if (data.total_recalls === 0 && !filtered) {
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
          <SampleDataButton />
        </Card>
      </>
    )
  }

  // by_class ignores the class filter (so the donut keeps every class); the card should not.
  const classI =
    linked.recallClass && linked.recallClass !== 'Class I' ? 0 : (data.by_class.find((c) => c.recall_class === 'Class I')?.count ?? 0)
  const donutTotal = data.by_class.reduce((sum, c) => sum + c.count, 0)
  const summary = describeLinked(linked, humanizeDefect)
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

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
        <TactileKeys
          label="Filter by class"
          className="w-full sm:w-auto"
          keys={RECALL_CLASSES.map((c) => ({ value: c, label: c.replace('Class ', ''), name: c }))}
          value={linked.recallClass ? [linked.recallClass] : []}
          onChange={(next) => setLinked('recallClass', next[0] ?? null)}
        />
        <p className="min-w-0 flex-1 text-sm text-muted-strong" aria-live="polite">
          {filtered ? (
            <>
              Showing <span className="font-medium text-foreground">{summary}</span>. Click a chart item again to remove it.
            </>
          ) : (
            'Click a class or a defect type in the charts to filter everything on this page.'
          )}
        </p>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => setParams((prev) => clearLinked(prev), { preventScrollReset: true })}>
            <X aria-hidden /> Clear filters
          </Button>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          index={0}
          tint="lavender"
          label="Total recalls"
          value={data.total_recalls}
          recent={recent(now?.recalls, before?.recalls, 'saved')}
        />
        <StatCard
          index={1}
          tint="sky"
          label="Units affected"
          value={data.total_units}
          recent={recent(now?.units, before?.units, 'units')}
        />
        <StatCard
          index={2}
          tint="rose"
          risk
          label="Class I recalls"
          value={classI}
          hint="Serious or life-threatening risk"
          recent={recent(now?.by_class['Class I'], before?.by_class['Class I'], 'saved')}
        />
        <StatCard
          index={3}
          tint="mint"
          label="Overdue recalls"
          value={data.overdue}
          hint={data.overdue ? 'Past a CDSCO deadline · view list' : 'No CDSCO deadline missed'}
          to={data.overdue ? historyHref(linked, { status: 'overdue' }) : undefined}
          alert={data.overdue > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="enter-fade rounded-[var(--radius-card)]" style={stagger(4)}>
          <CardHeader>
            <CardTitle>Recalls by class</CardTitle>
            <CardDescription>
              {linked.defect ? `Share of ${humanizeDefect(linked.defect).toLowerCase()} recalls` : 'Share of all saved recalls'}
            </CardDescription>
            <CardAction>
              <PillLink to={historyHref(linked)}>View all</PillLink>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ClassDonut
              data={data.by_class}
              total={donutTotal}
              selected={linked.recallClass}
              onSelect={(c) => setLinked('recallClass', c)}
            />
          </CardContent>
        </Card>

        <Card className="enter-fade rounded-[var(--radius-card)]" style={stagger(5)}>
          <CardHeader>
            <CardTitle>Recalls by defect type</CardTitle>
            <CardDescription>
              {linked.recallClass ? `${linked.recallClass} only. ` : ''}The dot shows each defect type&apos;s class
            </CardDescription>
            <CardAction>
              <PillLink to="/explorer">Explore</PillLink>
            </CardAction>
          </CardHeader>
          <CardContent>
            <DefectBars data={data.by_defect} selected={linked.defect} onSelect={(d) => setLinked('defect', d)} />
          </CardContent>
        </Card>

        <Card className="enter-fade rounded-[var(--radius-card)] lg:col-span-2" style={stagger(5)}>
          <CardHeader>
            <CardTitle>Recalls saved over time</CardTitle>
            <CardDescription>Per day, in UTC</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart filter={filter} />
          </CardContent>
        </Card>

        <Card className="enter-fade rounded-[var(--radius-card)] lg:col-span-2" style={stagger(5)}>
          <CardHeader>
            <CardTitle>Recent recalls</CardTitle>
            <CardDescription>{filtered ? `Latest saved: ${summary}` : 'Latest saved'}</CardDescription>
            <CardAction>
              <PillLink to={historyHref(linked)}>View all</PillLink>
            </CardAction>
          </CardHeader>
          <CardContent>
            <RecentRecalls filter={filter} linked={linked} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
