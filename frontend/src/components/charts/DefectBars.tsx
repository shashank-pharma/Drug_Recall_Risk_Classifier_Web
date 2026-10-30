import { useState } from 'react'
import { Bar, BarChart, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltipBubble } from '@/components/charts/ChartTooltipBubble'
import { ChartContainer } from '@/components/ui/chart'
import { CHAR_WIDTH, fitLabel } from '@/lib/chartText'
import { largestIndex } from '@/lib/donut'
import { humanizeDefect } from '@/lib/format'
import { usePrefersReducedMotion } from '@/lib/motion'
import { CLASS_COLORS, PALETTE, TINTS } from '@/lib/tokens'

type DefectCount = { defect_type: string; recall_class: string; count: number }
type Row = DefectCount & { label: string }

const SOFT = 'defect-bar-soft'
const STRONG = 'defect-bar-strong'

/** Category label under a column: class dot on top, name below; the active column's name sits in a dark pill. */
function Tick({
  x,
  y,
  payload,
  width,
  visibleTicksCount,
  rows,
  active,
}: {
  x?: number
  y?: number
  payload?: { index: number }
  width?: number
  visibleTicksCount?: number
  rows: Row[]
  active: number
}) {
  const index = payload?.index ?? -1
  const row = rows[index]
  if (!row || x === undefined || y === undefined) return null
  const column = (width ?? 300) / Math.max(1, visibleTicksCount ?? rows.length)
  const lines = fitLabel(row.label, column)
  const pillWidth = Math.min(column - 2, Math.max(...lines.map((l) => l.length)) * CHAR_WIDTH + 14)
  const isActive = index === active
  return (
    <g transform={`translate(${x} ${y + 4})`}>
      <circle cx={0} cy={3} r={3.5} fill={CLASS_COLORS[row.recall_class as keyof typeof CLASS_COLORS]} />
      {isActive && (
        <rect x={-pillWidth / 2} y={9} width={pillWidth} height={lines.length * 13 + 6} rx={8} fill={PALETTE.text} />
      )}
      <text textAnchor="middle" y={21} className={isActive ? 'fill-white text-[11px] font-medium' : 'fill-muted-foreground text-[11px]'}>
        {lines.map((line, i) => (
          <tspan key={line + i} x={0} dy={i === 0 ? 0 : 13}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  )
}

/**
 * Recalls per defect type as gradient columns. The active column (pointer, else `selected`,
 * else the largest) is strong; the rest are pastel. ←/→ move the active column; Enter selects it.
 */
export function DefectBars({
  data,
  selected,
  onSelect,
}: {
  data: DefectCount[]
  selected?: string | null
  onSelect?: (defectType: string) => void
}) {
  const reducedMotion = usePrefersReducedMotion()
  const rows: Row[] = data.filter((d) => d.count > 0).map((d) => ({ ...d, label: humanizeDefect(d.defect_type) }))
  const [pointed, setPointed] = useState<number | null>(null)
  const selectedIndex = rows.findIndex((r) => r.defect_type === selected)
  const active = pointed ?? (selectedIndex >= 0 ? selectedIndex : largestIndex(rows.map((r) => r.count)))
  const activeRow = rows[active]

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No recalls to show yet.</p>
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const last = rows.length - 1
    const from = active < 0 ? 0 : active
    const next =
      e.key === 'ArrowRight' ? Math.min(last, from + 1)
      : e.key === 'ArrowLeft' ? Math.max(0, from - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (next !== null) {
      e.preventDefault()
      setPointed(next)
    } else if ((e.key === 'Enter' || e.key === ' ') && onSelect && activeRow) {
      e.preventDefault()
      onSelect(activeRow.defect_type)
    }
  }

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={`Recalls by defect type. Use the left and right arrow keys to move between defect types${onSelect ? ', and Enter to filter by one' : ''}.`}
      onKeyDown={onKeyDown}
      onBlur={() => setPointed(null)}
      className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ChartContainer config={{ count: { label: 'Recalls' } }} className="h-64 w-full">
        <BarChart
          data={rows}
          margin={{ top: 22, right: 8, left: 8, bottom: 0 }}
          accessibilityLayer={false}
          onMouseMove={(state) => {
            const i = state?.activeTooltipIndex
            if (i !== undefined && i !== null) setPointed(Number(i))
          }}
          onMouseLeave={() => setPointed(null)}
          onClick={(state) => {
            const i = state?.activeTooltipIndex
            if (onSelect && i !== undefined && i !== null) onSelect(rows[Number(i)].defect_type)
          }}
        >
          <defs>
            <linearGradient id={SOFT} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TINTS.violet[2]} />
              <stop offset="100%" stopColor={TINTS.indigo[1]} />
            </linearGradient>
            <linearGradient id={STRONG} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PALETTE.brandTo} />
              <stop offset="100%" stopColor={PALETTE.brandFrom} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            interval={0}
            tickLine={false}
            axisLine={false}
            height={50}
            tick={(props: object) => <Tick {...props} rows={rows} active={active} />}
          />
          <YAxis hide allowDecimals={false} />
          <Tooltip
            cursor={false}
            isAnimationActive={false}
            content={({ active: shown, payload }) => {
              const row = shown && payload?.[0] ? (payload[0].payload as Row) : null
              return row ? (
                <ChartTooltipBubble
                  title={row.label}
                  rows={[
                    { label: 'Recalls', value: String(row.count), color: PALETTE.brandTo },
                    { label: row.recall_class, value: '', color: CLASS_COLORS[row.recall_class as keyof typeof CLASS_COLORS] },
                  ]}
                />
              ) : null
            }}
          />
          <Bar
            dataKey="count"
            radius={[12, 12, 12, 12]}
            maxBarSize={64}
            isAnimationActive={!reducedMotion}
            animationDuration={500}
            animationEasing="ease-out"
            className={onSelect ? 'cursor-pointer' : undefined}
          >
            {rows.map((r, i) => (
              <Cell key={r.defect_type} fill={`url(#${i === active ? STRONG : SOFT})`} />
            ))}
            <LabelList dataKey="count" position="top" className="fill-foreground text-xs font-semibold" />
          </Bar>
        </BarChart>
      </ChartContainer>

      <p className="sr-only" aria-live="polite">
        {activeRow ? `${activeRow.label}: ${activeRow.count} recalls, ${activeRow.recall_class}.` : ''}
      </p>
      <table className="sr-only">
        <caption>Recalls by defect type</caption>
        <thead>
          <tr>
            <th>Defect type</th>
            <th>Class</th>
            <th>Recalls</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.defect_type}>
              <td>{r.label}</td>
              <td>{r.recall_class}</td>
              <td>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
