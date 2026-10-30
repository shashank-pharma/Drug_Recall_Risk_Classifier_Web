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
  type SizeBy,
} from '@/lib/flowLayout'
import { formatUnits, humanizeDefect } from '@/lib/format'
import { useCountUp, usePrefersReducedMotion } from '@/lib/motion'
import { recallLed } from '@/lib/statusLed'
import { PALETTE } from '@/lib/tokens'
import { classStyle } from '@/lib/recallClass'
import type { StatsSummary } from '@/lib/types'
import { cn } from '@/lib/utils'

export type FlowSelection = { id: string; recallClass?: string; defectType?: string }

const RECALLS_LOADED = 50
/** Counts up the first time a node appears; afterwards shows the number directly. */
function Count({ id, value, counted }: { id: string; value: number; counted: Set<string> }) {
  const [animate] = useState(() => !counted.has(id))
  const shown = useCountUp(value, 400)
  useEffect(() => {
    counted.add(id)
  }, [counted, id])
  return <span aria-hidden>{formatUnits(animate ? shown : value)}</span>
}

function NodeBody({ node, sizeBy, rootValue, counted }: { node: FlowNode; sizeBy: SizeBy; rootValue: number; counted: Set<string> }) {
  const number = <Count id={`${node.id}:${sizeBy}`} value={node.value} counted={counted} />
  const unit = sizeBy === 'units' ? 'units' : node.value === 1 ? 'recall' : 'recalls'
  switch (node.kind) {
    case 'root':
      return (
        <span className="flex flex-col items-start">
          <span className="text-3xl leading-none font-semibold tabular-nums">{number}</span>
          <span className="mt-1 text-xs text-muted-foreground">{sizeBy === 'units' ? 'units, all recalls' : 'All recalls'}</span>
        </span>
      )
    case 'class': {
      // The share bar is the one place the class colour appears besides the badge.
      const share = rootValue ? node.value / rootValue : 0
      return (
        <>
          <span className="flex items-center gap-2">
            <ClassBadge label={node.label} />
            <span className="ml-auto text-sm font-semibold tabular-nums">{number}</span>
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full w-full origin-left rounded-full transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)]"
                style={{ backgroundColor: classStyle(node.label).chart, transform: `scaleX(${share})` }}
              />
            </span>
            <span className="w-9 text-right text-[11px] text-muted-foreground tabular-nums">{Math.round(share * 100)}%</span>
          </span>
        </>
      )
    }
    case 'defect':
      return (
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-medium">{humanizeDefect(node.label)}</span>
          <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums">{number}</span>
          <span className="sr-only">{unit}</span>
        </span>
      )
    case 'recall': {
      const led = node.led ?? 'none'
      return (
        <>
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium">{node.label}</span>
            {sizeBy === 'units' && <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">{formatUnits(node.units)}</span>}
          </span>
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
      return <span className="w-full text-center text-sm font-medium">{node.label}</span>
  }
}

/**
 * The Explorer as a left-to-right tree flow: fixed-size node cards positioned by `layoutFlow` over an SVG of
 * thin neutral lines (aria-hidden). Hover lights up a node's route lightly; the selected route turns
 * indigo→violet with 2 small dots per line (paused when hidden or off screen; none with reduced motion) and
 * everything else fades to 35%.
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

  // Selection: its route (upstream) is drawn in the gradient; it and everything under it stay at full strength.
  const selected = selection.id !== 'root'
  const kept = useMemo(() => (selected ? relatedIds(layout, selection.id) : null), [layout, selection.id, selected])
  const route = useMemo(() => routeLinks(layout, selection.id), [layout, selection.id])
  const routeSet = useMemo(() => new Set(route.map((l) => l.id)), [route])
  const routeNodes = useMemo(() => new Set(flowPath(layout, selection.id).map((n) => n.id)), [layout, selection.id])
  // Hover: the same idea, lighter, and only while nothing is selected or over another route.
  const hover = useMemo(() => (hovered && hovered !== selection.id ? relatedIds(layout, hovered) : null), [layout, hovered, selection.id])
  const hoverRoute = useMemo(() => new Set(hovered ? routeLinks(layout, hovered).map((l) => l.id) : []), [layout, hovered])
  const dots = motion.dots > 0 && route.length > 0
  const crumbs = flowPath(layout, selection.id)
  const rootValue = layout.nodes.find((n) => n.kind === 'root')?.value ?? 0

  // Dots run only while the tab is visible and the chart is on screen.
  useEffect(() => {
    const el = svg.current
    const box = wrap.current
    if (!el || !box || !dots) return
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
  }, [dots])

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

  const fade = (id: string, isLink: boolean) => {
    const strong = isLink ? (hover ? hover.links : kept?.links) : hover ? hover.nodes : kept?.nodes
    if (!strong) return 1
    return strong.has(id) ? 1 : hover ? 0.55 : 0.35
  }

  return (
    <div className="space-y-4">
      {/* No title: the breadcrumb appears once something is selected (the root card already says "All recalls"). */}
      {crumbs.length > 1 && (
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
      )}

      {/* Column titles sit exactly over the columns the layout uses. */}
      <div aria-hidden className="relative h-4 text-xs font-medium text-muted-foreground">
        {['Class', 'Defect type', 'Recalls'].map((t, i) => (
          <span key={t} className="absolute top-0" style={{ left: (i + 1) * (columnGeometry(layout.width).colW + columnGeometry(layout.width).gap) }}>
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
            const on = routeSet.has(l.id)
            const hot = !on && hoverRoute.has(l.id)
            return (
              <path
                key={l.id}
                d={l.d}
                fill="none"
                stroke={on || hot ? `url(#${gradientId})` : 'var(--border-strong)'}
                strokeWidth={on ? 2.5 : hot ? 2 : 1.5}
                strokeOpacity={hot ? 0.75 : 1}
                strokeLinecap="round"
                pathLength={1}
                className={cn(motion.draw && 'flow-draw', 'transition-opacity duration-[var(--dur-fast)]')}
                style={{ animationDelay: `${motion.delay(l.column)}ms`, opacity: fade(l.id, true) }}
              />
            )
          })}
          {dots &&
            route.flatMap((l) =>
              Array.from({ length: motion.dots }, (_, i) => (
                <circle key={`${l.id}-${i}`} r={3} fill={PALETTE.card} stroke={PALETTE.brandTo} strokeWidth={1.5}>
                  <animateMotion
                    path={l.d}
                    dur={`${motion.dotCycleS}s`}
                    repeatCount="indefinite"
                    begin={`-${((motion.dotCycleS / motion.dots) * i).toFixed(2)}s`}
                  />
                </circle>
              )),
            )}
        </svg>

        {layout.nodes.map((n) => {
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
                // fill-mode backwards: after the fade-in, the inline opacity (route dimming) takes over
                'enter-fade [animation-fill-mode:backwards] absolute flex flex-col justify-center gap-1.5 overflow-hidden rounded-xl border bg-card/85 px-3 py-2 text-left text-sm shadow-[var(--shadow-card)]',
                'transition-[opacity,box-shadow,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:shadow-[var(--shadow-raised)]',
                'focus-visible:ring-3 focus-visible:ring-[var(--accent-ring)]/60 focus-visible:outline-none',
                onRoute && 'explorer-selected',
                n.kind === 'more' && 'items-center border-dashed bg-card/60 shadow-none',
              )}
              style={
                {
                  // left/top, not transform: the fade-in animation owns transform.
                  left: n.x,
                  top: n.y,
                  width: n.w,
                  height: n.h,
                  '--stagger': n.column * 2,
                  opacity: n.kind === 'more' ? undefined : fade(n.id, false),
                } as React.CSSProperties
              }
            >
              <NodeBody node={n} sizeBy={sizeBy} rootValue={rootValue} counted={counted} />
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
