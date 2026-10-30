import { useEffect, useState } from 'react'
import { donutSegments, largestIndex, pointOnRing } from '@/lib/donut'
import { CLASS_COLORS, MARK_EDGE } from '@/lib/tokens'
import { cn } from '@/lib/utils'

const SIZE = 200
const C = SIZE / 2
const R = 70
const STROKE = 22
const ACTIVE_STROKE = 30

type ClassCount = { recall_class: string; count: number }

/**
 * Donut of recalls per class (risk colours). One segment is highlighted: the one under the
 * pointer, else the `selected` class, else the largest. Its value sits in a dark badge on the
 * ring; the total sits in the middle. The legend buttons are the keyboard way in.
 */
export function ClassDonut({
  data,
  total,
  selected,
  onSelect,
}: {
  data: ClassCount[]
  total: number
  selected?: string | null
  onSelect?: (recallClass: string) => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const values = data.map((d) => d.count)
  const segments = donutSegments(values, R)
  const selectedIndex = data.findIndex((d) => d.recall_class === selected)
  const active = hovered ?? (selectedIndex >= 0 ? selectedIndex : largestIndex(values))
  const activeSegment = active >= 0 ? segments[active] : null
  const badge = activeSegment && activeSegment.value > 0 ? pointOnRing(C, C, R, activeSegment.midAngle) : null
  const color = (cls: string) => CLASS_COLORS[cls as keyof typeof CLASS_COLORS] ?? '#94A3B8'

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-52 shrink-0 overflow-visible"
        aria-hidden
        onMouseLeave={() => setHovered(null)}
      >
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--muted)" strokeWidth={STROKE} />
        <g transform={`rotate(-90 ${C} ${C})`}>
          {segments.map((s) =>
            s.length > 0 ? (
              <circle
                key={s.index}
                cx={C}
                cy={C}
                r={R}
                fill="none"
                stroke={color(data[s.index].recall_class)}
                strokeWidth={s.index === active ? ACTIVE_STROKE : STROKE}
                strokeDasharray={`${drawn ? s.length : 0} ${2 * Math.PI * R}`}
                strokeDashoffset={-s.offset}
                className={cn(
                  'transition-[stroke-dasharray,stroke-width,opacity] duration-[var(--dur-chart)] ease-[var(--ease-out)]',
                  onSelect && 'cursor-pointer',
                  active >= 0 && s.index !== active && 'opacity-80',
                )}
                onMouseEnter={() => setHovered(s.index)}
                onClick={() => onSelect?.(data[s.index].recall_class)}
              />
            ) : null,
          )}
        </g>
        <text x={C} y={C - 4} textAnchor="middle" className="fill-foreground text-[28px] font-semibold tabular-nums">
          {total}
        </text>
        <text x={C} y={C + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          {total === 1 ? 'recall' : 'recalls'}
        </text>
        {badge && activeSegment && (
          <g transform={`translate(${badge.x} ${badge.y})`} className="pointer-events-none">
            <rect x={-15} y={-11} width={30} height={22} rx={8} fill="var(--foreground)" />
            <text textAnchor="middle" dy="0.35em" className="fill-background text-[12px] font-semibold tabular-nums">
              {activeSegment.value}
            </text>
          </g>
        )}
      </svg>

      <ul className="w-full space-y-1.5 text-sm" aria-label="Classes">
        {data.map((d, i) => {
          const percent = total ? Math.round((d.count / total) * 100) : 0
          const isActive = i === active
          return (
            <li key={d.recall_class}>
              <button
                type="button"
                aria-pressed={onSelect ? d.recall_class === selected : isActive}
                onClick={() => (onSelect ? onSelect(d.recall_class) : setHovered(i))}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left',
                  'transition-colors duration-[var(--dur-fast)] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  isActive && 'bg-muted',
                )}
              >
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor: color(d.recall_class),
                    // darker edge so the dot reaches 3:1 on pale surfaces (amber alone is ~2:1)
                    boxShadow: `inset 0 0 0 1.5px ${MARK_EDGE[d.recall_class as keyof typeof MARK_EDGE] ?? 'transparent'}`,
                  }}
                />
                <span className="font-medium">{d.recall_class}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {d.count} · {percent}%
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <table className="sr-only">
        <caption>Recalls by class</caption>
        <thead>
          <tr>
            <th>Class</th>
            <th>Recalls</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.recall_class}>
              <td>{d.recall_class}</td>
              <td>{d.count}</td>
              <td>{total ? Math.round((d.count / total) * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
