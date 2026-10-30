import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { api } from '@/lib/api'
import { formatUnits, humanizeDefect } from '@/lib/format'
import { classStyle } from '@/lib/recallClass'
import { cn } from '@/lib/utils'

const classConfig = { count: { label: 'Recalls' } } satisfies ChartConfig
const defectConfig = { count: { label: 'Recalls' } } satisfies ChartConfig

function StatCard({
  label,
  value,
  hint,
  to,
  alert = false,
}: {
  label: string
  value: string
  hint?: string
  to?: string
  alert?: boolean
}) {
  const card = (
    <Card className={cn('h-full gap-1 rounded-2xl p-5', alert && 'border-red-200 bg-red-50 text-red-900')}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
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

  if (isPending) {
    return (
      <>
        <PageHeader title="Dashboard" description="Recalls by class and defect type." />
        <p className="text-sm text-muted-foreground">Loading statistics…</p>
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
  const pieData = data.by_class.map((c) => ({ ...c, fill: classStyle(c.recall_class).chart }))
  const barData = data.by_defect.map((d) => ({
    ...d,
    // The count goes in the axis label because Recharts draws no bar (or bar label) for a count of 0.
    label: `${humanizeDefect(d.defect_type)} · ${d.count}`,
    fill: classStyle(d.recall_class).chart,
  }))

  return (
    <>
      <PageHeader title="Dashboard" description="Recalls by class and defect type." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total recalls" value={formatUnits(data.total_recalls)} />
        <StatCard label="Units affected" value={formatUnits(data.total_units)} hint="Across all recalls" />
        <StatCard
          label="Class I recalls"
          value={formatUnits(classI?.count ?? 0)}
          hint="Serious or life-threatening risk"
        />
        <StatCard
          label="Overdue recalls"
          value={formatUnits(data.overdue)}
          hint={data.overdue ? 'Past a CDSCO deadline · view list' : 'No CDSCO deadline missed'}
          to={data.overdue ? '/history?status=overdue' : undefined}
          alert={data.overdue > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Recalls by class</CardTitle>
            <CardDescription>Share of all saved recalls</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 sm:flex-row">
            <ChartContainer config={classConfig} className="aspect-square h-56 shrink-0">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="recall_class" hideLabel />} />
                <Pie data={pieData} dataKey="count" nameKey="recall_class" innerRadius={55} strokeWidth={2} />
              </PieChart>
            </ChartContainer>
            <ul className="w-full space-y-3 text-sm">
              {data.by_class.map((c) => (
                <li key={c.recall_class} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: classStyle(c.recall_class).chart }}
                  />
                  <span className="font-medium">{c.recall_class}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {c.count} · {Math.round((c.count / data.total_recalls) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Recalls by defect type</CardTitle>
            <CardDescription>Bar colour shows the class that defect belongs to</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={defectConfig} className="h-56 w-full">
              <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={150} />
                <XAxis dataKey="count" type="number" allowDecimals={false} hide />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="count" name="Recalls" radius={6}>
                  {barData.map((d) => (
                    <Cell key={d.defect_type} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
