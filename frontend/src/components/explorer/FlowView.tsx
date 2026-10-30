import { useQuery } from '@tanstack/react-query'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ClassBadge } from '@/components/ClassBadge'
import { Skeleton } from '@/components/Skeleton'
import { StatusLed } from '@/components/StatusLed'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import {
  columnGeometry,
  flowKey,
  flowMotion,
  flowPath,
  type FlowNode,
  layoutFlow,
  nodeLabel,
  relatedIds,
  routeLinks,
  routePath,
  type SizeBy,
} from '@/lib/flowLayout'
import { formatUnits, humanizeDefect } from '@/lib/format'
import { useCountUp, usePrefersReducedMotion } from '@/lib/motion'
import { recallLed } from '@/lib/statusLed'
import { CLASS_COLORS, PALETTE, TINTS } from '@/lib/tokens'
import type { StatsSummary } from '@/lib/types'
import { cn } from '@/lib/utils'

export type FlowSelection = { id: string; recallClass?: string; defectType?: string }

const RECALLS_LOADED = 50
// Neutral tints after the class column (class colours stay on the root → class links only).
const NEUTRAL = [TINTS.indigo[5], TINTS.violet[5], TINTS.teal[6], TINTS.indigo[3], TINTS.violet[3]]
const neutral = (i = 0) => NEUTRAL[i % NEUTRAL.length]

/** Counts up the first time a node appears; afterwards shows the number directly. */
function Count({ id, value, counted }: { id: string; value: number; counted: Set<string> }) {
  const [animate] = useState(() => !counted.has(id))
  const shown = useCountUp(value, 400)
  useEffect(() => {
    counted.add(id)
  }, [counted, id])
  return <span aria-hidden>{formatUnits(animate ? shown : value)}</span>
}

function NodeBody({ node, sizeBy, counted }: { node: FlowNode; sizeBy: SizeBy; counted: Set<string> }) {
  const units = sizeBy === 'units' && <span className="text-[11px] text-muted-foreground tabular-nums">{formatUnits(node.units)} units</span>
  switch (node.kind) {
    case 'root':
      return (
        <>
          <span className="font-semibold">All recalls</span>
          <span className="text-2xl font-semibold tabular-nums">
            <Count id={node.id} value={node.count} counted={counted} />
          </span>
          {units}
        </>
      )
    case 'class':
      return (
        <>
          <span className="flex items-center gap-2">
            <ClassBadge label={node.label} />
            <span className="ml-auto font-semibold tabular-nums">
              <Count id={node.id} value={node.count} counted={counted} />
            </span>
          </span>
          {units}
        </>
      )
    case 'defect':
      return (
        <>
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: neutral(node.tint) }} />
            <span className="truncate">{humanizeDefect(node.label)}</span>
            <span className="ml-auto font-semibold tabular-nums">
              <Count id={node.id} value={node.count} counted={counted} />
            </span>
          </span>
          {units}
        </>
      )
    case 'recall': {
      const led = node.led ?? 'none'
      return (
        <>
          <span className="truncate font-medium">{node.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs text-muted-foreground">{node.batch}</span>
            <StatusLed tone={led} className="ml-auto text-[11px]">
              {{ done: 'Done', pending: 'Open', overdue: 'Overdue', none: 'No timeline' }[led]}
            </StatusLed>
          </span>
        </>
      )
    }
    case 'more':
      return <span className="text-center text-sm font-medium underline-offset-4">{node.label}</span>
  }
}

/**
 * The Explorer as a left-to-right flow chart: HTML node buttons positioned from `layoutFlow` over an SVG of
 * links (aria-hidden). Hover lights up a node's whole route; the selected route turns indigo→violet and
 * four dots travel along it (paused when hidden or off screen; none with reduced motion).
 */
export function FlowView({
  stats,
  sizeBy,
  selection,
  onSelect,
  onClear,
  expanded,
  onExpand,
  keep,
}: {
  stats: StatsSummary
  sizeBy: SizeBy
  selection: FlowSelection
  onSelect: (node: FlowNode) => void
  onClear: () => void
  expanded: ReadonlySet<number>
  onExpand: (column: number) => void
  /** node that must stay visible (a recall picked with Cmd+K) */
  keep: string | null
}) {
  const navigate = useNavigate()
  const reduced = usePrefersReducedMotion()
  const motion = flowMotion(reduced)
  const wrap = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const ids = useId()
  const gradientId = `${ids}-route`
  const routeId = `${ids}-dots`
  const [width, setWidth] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)
  const [counted] = useState(() => new Set<string>())

  // The recall column follows the selected class or defect type.
  const scope = { recall_class: selection.recallClass ? [selection.recallClass] : [], defect_type: selection.defectType }
  const recalls = useQuery({
    queryKey: ['recalls', 'flow', scope.recall_class, scope.defect_type ?? null],
    queryFn: () => api.listRecalls({ ...scope, page_size: RECALLS_LOADED }),
    retry: false,
  })

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const layout = useMemo(
    () =>
      layoutFlow(
        {
          total: stats.total_recalls,
          totalUnits: stats.total_units,
          classes: stats.by_class,
          defects: stats.by_defect,
          recalls: (recalls.data?.items ?? []).map((r) => ({
            id: r.id,
            drug_name: r.drug_name,
            batch_id: r.batch_id,
            recall_class: r.recall_class,
            defect_type: r.defect_type,
            units: r.units_affected,
            led: recallLed(r.timeline ? r.timeline.map((m) => m.status) : null).tone,
          })),
          recallTotal: recalls.data?.total ?? 0,
        },
        { width: width || 960, sizeBy, expanded, keep },
      ),
    [stats, recalls.data, width, sizeBy, expanded, keep],
  )

  const related = useMemo(() => (hovered ? relatedIds(layout, hovered) : null), [layout, hovered])
  const route = useMemo(() => new Set(routeLinks(layout, selection.id).map((l) => l.id)), [layout, selection.id])
  const routeNodes = useMemo(() => new Set(flowPath(layout, selection.id).map((n) => n.id)), [layout, selection.id])
  const dotsPath = motion.dots ? routePath(layout, selection.id) : null
  const crumbs = flowPath(layout, selection.id).length ? flowPath(layout, selection.id) : layout.nodes.filter((n) => n.kind === 'root')

  // Dots run only while the tab is visible and the chart is on screen.
  useEffect(() => {
    const el = svg.current
    const box = wrap.current
    if (!el || !box || !dotsPath) return
    let onScreen = true
    const update = () => (document.hidden || !onScreen ? el.pauseAnimations() : el.unpauseAnimations())
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      update()
    })
    observer.observe(box)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [dotsPath])

  function focusNode(id: string) {
    wrap.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)?.focus()
  }

  function activate(node: FlowNode) {
    if (node.kind === 'more') {
      if (node.toHistory) {
        const q = new URLSearchParams()
        if (selection.recallClass) q.set('class', selection.recallClass)
        if (selection.defectType) q.set('defect', selection.defectType)
        navigate(q.size ? `/history?${q}` : '/history')
      } else onExpand(node.column)
      return
    }
    onSelect(node)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
    if (!id) return
    const result = flowKey(layout, id, e.key)
    if (!result) return
    e.preventDefault()
    if (result.focus) focusNode(result.focus)
    if (result.select) {
      const node = layout.nodes.find((n) => n.id === result.select)
      if (node) activate(node)
    }
    if (result.clear) onClear()
  }

  const linkColor = (l: (typeof layout.links)[number]) =>
    route.has(l.id)
      ? `url(#${gradientId})`
      : l.tone === 'class'
        ? CLASS_COLORS[l.recallClass as keyof typeof CLASS_COLORS] ?? PALETTE.muted
        : neutral(l.tint)

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm">
          {crumbs.map((n, i) => {
            const last = i === crumbs.length - 1
            const label = n.kind === 'defect' ? humanizeDefect(n.label) : n.kind === 'recall' ? n.batch : n.label
            return (
              <li key={n.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight aria-hidden className="size-3.5 text-muted-foreground" />}
                {last ? (
                  <span aria-current="location" className="px-1.5 py-0.5 font-semibold">
                    {label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(n)
                      requestAnimationFrame(() => focusNode(n.id))
                    }}
                    className="rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors duration-[var(--dur-fast)] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:outline-none"
                  >
                    {label}
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Column titles sit exactly over the columns the layout uses. */}
      <div aria-hidden className="relative h-4 text-xs font-medium text-muted-foreground">
        {['All recalls', 'Class', 'Defect type', 'Recalls'].map((t, i) => (
          <span key={t} className="absolute top-0" style={{ left: i * (columnGeometry(layout.width).colW + columnGeometry(layout.width).gap) }}>
            {t}
          </span>
        ))}
      </div>

      <div
        ref={wrap}
        role="group"
        aria-label="Recall flow chart. Tab moves between nodes; arrow keys go to the parent, first child or neighbour; Enter selects; Escape clears."
        onKeyDown={onKeyDown}
        className="relative"
        style={{ height: layout.height }}
      >
        <svg ref={svg} aria-hidden className="absolute inset-0 overflow-visible" width={layout.width} height={layout.height}>
          <defs>
            <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={layout.width || 1} y2={0}>
              <stop offset="0%" stopColor={PALETTE.brandFrom} />
              <stop offset="100%" stopColor={PALETTE.brandTo} />
            </linearGradient>
          </defs>
          {layout.links.map((l) => {
            const on = route.has(l.id)
            const dim = related ? !related.links.has(l.id) : false
            return (
              <path
                key={l.id}
                d={l.d}
                fill="none"
                stroke={linkColor(l)}
                strokeWidth={l.width}
                strokeOpacity={on ? 0.85 : l.tone === 'class' ? 0.45 : 0.35}
                pathLength={1}
                className={cn(motion.draw && 'flow-draw', 'transition-opacity duration-[var(--dur-fast)]')}
                style={{ animationDelay: `${motion.delay(l.column)}ms`, opacity: dim ? 0.25 : 1 }}
              />
            )
          })}
          {dotsPath && (
            <>
              <path id={routeId} d={dotsPath} fill="none" stroke="none" />
              {Array.from({ length: motion.dots }, (_, i) => (
                <circle key={`${dotsPath}-${i}`} r={3.5} fill={PALETTE.card} stroke={PALETTE.brandTo} strokeWidth={1.5}>
                  <animateMotion
                    dur={`${motion.dotCycleS}s`}
                    repeatCount="indefinite"
                    begin={`-${((motion.dotCycleS / motion.dots) * i).toFixed(2)}s`}
                  >
                    <mpath href={`#${routeId}`} />
                  </animateMotion>
                </circle>
              ))}
            </>
          )}
        </svg>

        {layout.nodes.map((n) => {
          const dim = related ? !related.nodes.has(n.id) && n.kind !== 'more' : false
          const onRoute = routeNodes.has(n.id) && routeNodes.size > 1
          return (
            <button
              key={n.id}
              type="button"
              data-node-id={n.id}
              aria-label={nodeLabel(layout, n, humanizeDefect)}
              aria-pressed={n.kind === 'more' ? undefined : n.id === selection.id}
              aria-haspopup={n.kind === 'recall' ? 'dialog' : undefined}
              onClick={() => activate(n)}
              onMouseEnter={() => n.kind !== 'more' && setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => n.kind !== 'more' && setHovered(n.id)}
              onBlur={() => setHovered(null)}
              className={cn(
                'enter-fade absolute flex flex-col justify-center gap-1 overflow-hidden rounded-xl border bg-card/85 px-3 py-1.5 text-left text-sm shadow-[var(--shadow-card)]',
                'transition-[opacity,box-shadow,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:shadow-[var(--shadow-raised)]',
                'focus-visible:ring-3 focus-visible:ring-[var(--accent-ring)]/60 focus-visible:outline-none',
                onRoute && 'explorer-selected',
                n.kind === 'more' && 'items-center border-dashed bg-card/60 shadow-none',
                dim && 'opacity-25',
              )}
              style={
                {
                  // left/top, not transform: the fade-in animation owns transform.
                  left: n.x,
                  top: n.y,
                  width: n.w,
                  height: n.h,
                  '--stagger': n.column * 2,
                } as React.CSSProperties
              }
            >
              <NodeBody node={n} sizeBy={sizeBy} counted={counted} />
            </button>
          )
        })}

        {/* Recall column states, drawn where that column sits. */}
        {(recalls.isPending || recalls.error) && (
          <div className="absolute top-0 right-0 flex w-[19%] min-w-[150px] flex-col gap-3" style={{ height: layout.height }}>
            {recalls.error ? (
              <div role="alert" className="rounded-xl border border-dashed p-3 text-sm">
                <p className="text-destructive">Could not load these recalls.</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => recalls.refetch()}>
                  <RotateCcw aria-hidden /> Try again
                </Button>
              </div>
            ) : (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-11 w-full rounded-xl" />)
            )}
          </div>
        )}
        {recalls.data && recalls.data.total === 0 && (
          <p className="absolute top-1/2 right-0 w-[19%] min-w-[150px] -translate-y-1/2 rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
            {selection.defectType ? 'No recalls in this defect type' : 'No recalls here'}
          </p>
        )}
      </div>
    </div>
  )
}
