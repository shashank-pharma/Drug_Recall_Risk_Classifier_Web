import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltipBubble } from '@/components/charts/ChartTooltipBubble'
import { PillTabs } from '@/components/PillTabs'
import { Skeleton } from '@/components/Skeleton'
import { ChartContainer } from '@/components/ui/chart'
import { api } from '@/lib/api'
import { usePrefersReducedMotion } from '@/lib/motion'
import { CLASS_COLORS, PALETTE } from '@/lib/tokens'
import type { StatsFilter, TrendDays } from '@/lib/types'
import { cn } from '@/lib/utils'

const AREA_FILL = 'trend-area-fill'
const Y_AXIS_WIDTH = 28

// Class lines differ by dash pattern as well as colour, so they never rely on colour alone.
const SERIES = [
  { key: 'total', label: 'All recalls', color: PALETTE.brandFrom, dash: undefined },
  { key: 'Class I', label: 'Class I', color: CLASS_COLORS['Class I'], dash: undefined },
  { key: 'Class II', label: 'Class II', color: CLASS_COLORS['Class II'], dash: '6 4' },
  { key: 'Class III', label: 'Class III', color: CLASS_COLORS['Class III'], dash: '2 3' },
] as const
type SeriesKey = (typeof SERIES)[number]['key']

const DAY_OPTIONS: { value: `${TrendDays}`; label: string }[] = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
]

const shortDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Active point with a horizontal guide back to the y-axis; with the vertical cursor it forms a crosshair. */
function CrosshairDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx === undefined || cy === undefined) return null
  return (
    <g className="pointer-events-none">
      <line x1={Y_AXIS_WIDTH} y1={cy} x2={cx} y2={cy} stroke={PALETTE.muted} strokeDasharray="3 3" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={5} fill={PALETTE.card} stroke={PALETTE.brandFrom} strokeWidth={2.5} />
    </g>
  )
}

/** Recalls saved per day (UTC) as an area chart, with 7/30/90-day chips and toggleable class lines. */
export function TrendChart({ filter = {} }: { filter?: StatsFilter }) {
  const reducedMotion = usePrefersReducedMotion()
  const [days, setDays] = useState<TrendDays>(30)
  const [shown, setShown] = useState<ReadonlySet<SeriesKey>>(() => new Set<SeriesKey>(['total']))
  const { data, isPending, error } = useQuery({
    queryKey: ['stats', 'trend', days, filter],
    queryFn: () => api.statsTrend(days, filter),
    placeholderData: keepPreviousData,
  })

  const rows = (data?.series ?? []).map((d) => ({ day: d.date, label: shortDay(d.date), total: d.total, ...d.by_class }))
  const empty = !!data && data.current.recalls === 0

  function toggle(key: SeriesKey) {
    setShown((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key) // keep at least one series on
      } else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Series" className="flex flex-wrap gap-1.5">
          {SERIES.map((s) => {
            const on = shown.has(s.key)
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.key)}
                className={cn(
                  'inline-flex h-7 items-center gap-2 rounded-full border px-2.5 text-xs font-medium',
                  'transition-[background-color,color,opacity] duration-[var(--dur-fast)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  on ? 'bg-card text-foreground' : 'bg-transparent text-muted-strong opacity-70 hover:opacity-100',
                )}
              >
                <svg aria-hidden width="14" height="4">
                  <line x1="0" y1="2" x2="14" y2="2" stroke={s.color} strokeWidth="3" strokeDasharray={s.dash} />
                </svg>
                {s.label}
              </button>
            )
          })}
        </div>
        <PillTabs
          label="Time window"
          options={DAY_OPTIONS}
          value={`${days}`}
          onChange={(v) => setDays(Number(v) as TrendDays)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : isPending ? (
        <Skeleton className="h-60 w-full rounded-xl" />
      ) : (
        <div className="relative">
          <ChartContainer config={{ total: { label: 'All recalls' } }} className="h-60 w-full">
            <AreaChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={AREA_FILL} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.brandFrom} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={PALETTE.brandTo} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={PALETTE.border} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} className="text-[11px]" />
              <YAxis width={Y_AXIS_WIDTH} allowDecimals={false} tickLine={false} axisLine={false} className="text-[11px]" />
              <Tooltip
                isAnimationActive={false}
                cursor={{ stroke: PALETTE.muted, strokeDasharray: '3 3', strokeWidth: 1 }}
                content={({ active, payload }) => {
                  const row = active && payload?.[0] ? (payload[0].payload as Record<string, number | string>) : null
                  if (!row) return null
                  return (
                    <ChartTooltipBubble
                      title={new Date(`${row.day}T00:00:00Z`).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'UTC' })}
                      rows={SERIES.filter((s) => shown.has(s.key)).map((s) => ({
                        label: s.label,
                        value: String(row[s.key] ?? 0),
                        color: s.color,
                        dash: s.dash,
                      }))}
                    />
                  )
                }}
              />
              {shown.has('total') && (
                <Area
                  type="monotone"
                  dataKey="total"
                  name="All recalls"
                  stroke={PALETTE.brandFrom}
                  strokeWidth={2}
                  fill={`url(#${AREA_FILL})`}
                  activeDot={<CrosshairDot />}
                  isAnimationActive={!reducedMotion}
                  animationDuration={500}
                  animationEasing="ease-out"
                />
              )}
              {SERIES.slice(1)
                .filter((s) => shown.has(s.key))
                .map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={1.75}
                    strokeDasharray={s.dash}
                    dot={false}
                    activeDot={{ r: 3.5, fill: PALETTE.card, stroke: s.color, strokeWidth: 2 }}
                    isAnimationActive={!reducedMotion}
                    animationDuration={500}
                  />
                ))}
            </AreaChart>
          </ChartContainer>
          {empty && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-strong">
              No recalls saved in the last {days} days{filter.recall_class || filter.defect_type ? ' for this filter' : ''}.
            </p>
          )}
        </div>
      )}

      {data && (
        <table className="sr-only">
          <caption>
            Recalls saved per day, last {days} days (UTC). Days without recalls are left out.
          </caption>
          <thead>
            <tr>
              <th>Day</th>
              <th>All recalls</th>
              <th>Class I</th>
              <th>Class II</th>
              <th>Class III</th>
            </tr>
          </thead>
          <tbody>
            {data.series
              .filter((d) => d.total > 0)
              .map((d) => (
                <tr key={d.date}>
                  <td>{shortDay(d.date)}</td>
                  <td>{d.total}</td>
                  <td>{d.by_class['Class I'] ?? 0}</td>
                  <td>{d.by_class['Class II'] ?? 0}</td>
                  <td>{d.by_class['Class III'] ?? 0}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
