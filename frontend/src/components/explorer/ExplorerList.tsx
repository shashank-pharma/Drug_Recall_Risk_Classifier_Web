import { useQueries, useQuery } from '@tanstack/react-query'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ClassBadge } from '@/components/ClassBadge'
import { Connectors } from '@/components/explorer/Connectors'
import { LoadingRegion, Skeleton } from '@/components/Skeleton'
import { StatusLed } from '@/components/StatusLed'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import {
  buildTree,
  type DefectRecalls,
  isExpandable,
  parseDefectId,
  pathTo,
  revealIds,
  type TreeNode,
  treeKey,
  type VisibleNode,
  visibleDescendants,
  visibleNodes,
} from '@/lib/explorerTree'
import { formatUnits, humanizeDefect } from '@/lib/format'
import { useCountUp, useMediaQuery, usePrefersReducedMotion } from '@/lib/motion'
import { classStyle } from '@/lib/recallClass'
import { recallLed } from '@/lib/statusLed'
import { TINTS } from '@/lib/tokens'
import { useSimulation } from '@/lib/useSimulation'
import { cn } from '@/lib/utils'

const RECALLS_PER_DEFECT = 50
const COLUMN_TITLES = ['All recalls', 'Class', 'Defect type', 'Recalls']
/** Wide layout (columns + connectors + fly-out); below this the stacked list is used. */
const WIDE = '(min-width: 900px)'
const FLY_MS = 250
const STAGGER_MS = 50
const EASE = 'cubic-bezier(0.2, 0, 0, 1)'

// Neutral tints for defect types (class colours stay on the class nodes only).
const DEFECT_TINTS = [
  { dot: TINTS.indigo[5], soft: TINTS.indigo[0] },
  { dot: TINTS.violet[5], soft: TINTS.violet[0] },
  { dot: TINTS.teal[6], soft: TINTS.teal[0] },
  { dot: TINTS.indigo[3], soft: TINTS.indigo[1] },
  { dot: TINTS.violet[3], soft: TINTS.violet[1] },
]
const defectTint = (i = 0) => DEFECT_TINTS[i % DEFECT_TINTS.length]

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Counts up the first time a node appears; later renders (re-open, refetch) show the number directly. */
function NodeCount({ id, value, counted }: { id: string; value: number; counted: Set<string> }) {
  const [animate] = useState(() => !counted.has(id))
  const shown = useCountUp(value, 400)
  useEffect(() => {
    counted.add(id)
  }, [counted, id])
  return (
    <>
      <span aria-hidden>{formatUnits(animate ? shown : value)}</span>
      <span className="sr-only">{formatUnits(value)}</span>
    </>
  )
}

function summary(node: TreeNode): string {
  switch (node.kind) {
    case 'root':
      return `${plural(node.count ?? 0, 'recall')} in total`
    case 'class':
      return `${plural(node.count ?? 0, 'recall')} · ${formatUnits(node.units ?? 0)} units · ${Math.round((node.share ?? 0) * 100)}% of all`
    case 'defect':
      return `${plural(node.count ?? 0, 'recall')} · ${node.recallClass}`
    case 'recall':
      return `${node.label} · batch ${node.detail}`
    default:
      return node.label
  }
}

function NodeContent({ node, open, counted }: { node: TreeNode; open: boolean; counted: Set<string> }) {
  const chevron = isExpandable(node) && (
    <ChevronRight
      aria-hidden
      className={cn(
        'size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)]',
        open && 'rotate-90',
      )}
    />
  )
  switch (node.kind) {
    case 'root':
      return (
        <span className="flex w-full items-center gap-2">
          <span className="font-semibold">{node.label}</span>
          <span className="ml-auto text-base font-semibold tabular-nums">
            <NodeCount id={node.id} value={node.count ?? 0} counted={counted} />
          </span>
          {chevron}
        </span>
      )
    case 'class': {
      const share = Math.round((node.share ?? 0) * 100)
      return (
        <span className="flex w-full min-w-0 flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <ClassBadge label={node.label} />
            <span className="ml-auto font-semibold tabular-nums">
              <NodeCount id={node.id} value={node.count ?? 0} counted={counted} />
            </span>
            {chevron}
          </span>
          {node.units !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">{formatUnits(node.units)} units affected</span>
          )}
          <span className="flex items-center gap-2">
            {/* Share of all recalls; the percentage says the same in text. */}
            <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full w-full origin-left rounded-full transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)]"
                style={{ backgroundColor: classStyle(node.label).chart, transform: `scaleX(${node.share ?? 0})` }}
              />
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{share}%</span>
          </span>
        </span>
      )
    }
    case 'defect': {
      const tint = defectTint(node.tint)
      return (
        <span className="flex w-full min-w-0 items-center gap-2">
          <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: tint.dot }} />
          <span className="truncate">{humanizeDefect(node.defectType ?? node.label)}</span>
          <span
            className="ml-auto shrink-0 rounded-full bg-[var(--chip)] px-2 py-0.5 text-xs font-semibold text-foreground tabular-nums dark:bg-muted"
            style={{ '--chip': tint.soft } as React.CSSProperties}
          >
            <NodeCount id={node.id} value={node.count ?? 0} counted={counted} />
          </span>
          {chevron}
        </span>
      )
    }
    case 'recall': {
      const led = node.led ?? 'none'
      const ledText = led === 'overdue' ? 'Overdue' : led === 'done' ? 'Done' : led === 'pending' ? 'Open' : 'No timeline'
      return (
        <span className="flex w-full min-w-0 flex-col gap-1">
          <span className="truncate font-medium">{node.label}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-xs text-muted-foreground">{node.detail}</span>
            {node.recallClass && <ClassBadge label={node.recallClass} className="h-4.5 px-1.5 text-[10px]" />}
            <StatusLed tone={led} className="ml-auto">
              {ledText}
            </StatusLed>
          </span>
        </span>
      )
    }
    case 'more':
      return <span className="underline underline-offset-4">{node.label}</span>
    case 'empty':
      return <span className="text-muted-foreground">{node.label}</span>
    case 'error':
      return (
        <span className="flex items-center gap-2 text-destructive">
          <RotateCcw className="size-3.5 shrink-0" aria-hidden />
          {node.label}
        </span>
      )
    case 'loading':
      return (
        <>
          <span className="sr-only">{node.label}</span>
          <Skeleton className="h-4 w-full" />
        </>
      )
  }
}

function crumbLabel(node: TreeNode) {
  if (node.kind === 'defect') return humanizeDefect(node.defectType ?? node.label)
  if (node.kind === 'recall') return node.detail ?? node.label
  return node.label
}

/** The Explorer as an indented tree (13G): used as the List view, and automatically below 900 px. */
export function ExplorerList() {
  const navigate = useNavigate()
  const sim = useSimulation()
  const [params, setParams] = useSearchParams()
  const openRecallId = Number(params.get('recall')) || null
  const wide = useMediaQuery(WIDE)
  const reducedMotion = usePrefersReducedMotion()
  const flyOut = wide && !reducedMotion

  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api.statsSummary() })
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(['root']))
  const [focusedId, setFocusedId] = useState('root')
  const [selectedId, setSelectedId] = useState('root')

  // Recalls are fetched only for the defect types that are open.
  const openDefects = useMemo(() => [...expanded].filter((id) => id.startsWith('defect:')).sort(), [expanded])
  const recallQueries = useQueries({
    queries: openDefects.map((id) => {
      const { recallClass, defectType } = parseDefectId(id)
      return {
        queryKey: ['recalls', 'explorer', recallClass, defectType],
        queryFn: () =>
          api.listRecalls({ recall_class: [recallClass], defect_type: defectType, page_size: RECALLS_PER_DEFECT }),
        retry: false,
      }
    }),
  })

  const recalls: Record<string, DefectRecalls> = {}
  openDefects.forEach((id, i) => {
    const q = recallQueries[i]
    recalls[id] = q?.data
      ? {
          total: q.data.total,
          items: q.data.items.map((r) => ({
            id: r.id,
            drug_name: r.drug_name,
            batch_id: r.batch_id,
            overdue: !!r.timeline?.some((m) => m.status === 'overdue'),
            led: recallLed(r.timeline ? r.timeline.map((m) => m.status) : null).tone,
          })),
        }
      : q?.error
        ? 'error'
        : 'loading'
  })

  const tree = stats.data ? buildTree(stats.data, recalls) : null
  const visible = useMemo(() => (tree ? visibleNodes(tree, expanded) : []), [tree, expanded])
  const tabbableId = visible.some((v) => v.node.id === focusedId) ? focusedId : 'root'
  const path = useMemo(() => (tree ? pathTo(tree, selectedId) : []), [tree, selectedId])
  const crumbs = path.length ? path : tree ? [tree] : []
  const highlighted = useMemo(() => new Set(path.map((n) => n.id)), [path])

  const elements = useRef(new Map<string, HTMLElement>())
  const getElement = useCallback((id: string) => elements.current.get(id), [])
  const [grid, setGrid] = useState<HTMLDivElement | null>(null)
  // Ids that have already counted up (a mutable set kept for the page's lifetime).
  const [counted] = useState(() => new Set<string>())
  const animating = useRef(false)

  // --- motion: children fly out from their parent and fly back in when collapsed ----------------
  const shown = useRef(new Set<string>())
  useLayoutEffect(() => {
    const before = shown.current
    const now = new Set(visible.map((v) => v.node.id))
    shown.current = now
    if (!flyOut || before.size === 0) return
    let order = 0
    for (const v of visible) {
      if (before.has(v.node.id) || !v.parentId) continue
      const el = elements.current.get(v.node.id)?.parentElement
      const parent = elements.current.get(v.parentId)
      if (!el || !parent) continue
      const from = parent.getBoundingClientRect()
      const to = el.getBoundingClientRect()
      const dx = from.left + from.width / 2 - (to.left + to.width / 2)
      const dy = from.top + from.height / 2 - (to.top + to.height / 2)
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.92)`, opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: FLY_MS, delay: Math.min(order++, 8) * STAGGER_MS, easing: EASE, fill: 'backwards' },
      )
    }
  }, [visible, flyOut])

  /** Animate these nodes back into their parents, then run `done` (the state change that removes them). */
  function flyBack(ids: string[], done: () => void) {
    if (!flyOut || ids.length === 0) return done()
    animating.current = true
    const byId = new Map(visible.map((v) => [v.node.id, v]))
    const runs = [...ids].reverse().map((id, i) => {
      const v = byId.get(id)
      const el = elements.current.get(id)?.parentElement
      const parent = v?.parentId ? elements.current.get(v.parentId) : undefined
      if (!el || !parent) return Promise.resolve()
      const from = el.getBoundingClientRect()
      const to = parent.getBoundingClientRect()
      const dx = to.left + to.width / 2 - (from.left + from.width / 2)
      const dy = to.top + to.height / 2 - (from.top + from.height / 2)
      return el
        .animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.92)`, opacity: 0 }], {
          duration: FLY_MS - 50,
          delay: Math.min(i, 6) * (STAGGER_MS / 2),
          easing: EASE,
          fill: 'forwards',
        })
        .finished.catch(() => {})
    })
    Promise.all(runs).then(() => {
      animating.current = false
      done()
    })
  }

  function toggle(id: string) {
    setFocusedId(id)
    setSelectedId(id)
    if (animating.current) return
    if (expanded.has(id)) {
      flyBack(visibleDescendants(visible, id), () =>
        setExpanded((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        }),
      )
    } else {
      setExpanded((prev) => new Set(prev).add(id))
    }
  }

  function collapseAll() {
    if (animating.current) return
    const keep = new Set(visible.filter((v) => v.depth <= 1).map((v) => v.node.id))
    flyBack(
      visible.filter((v) => !keep.has(v.node.id)).map((v) => v.node.id),
      () => setExpanded(new Set(['root'])),
    )
    setFocusedId('root')
    setSelectedId('root')
  }

  function openRecall(id: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('recall', String(id))
      return next
    })
  }

  function activate(v: VisibleNode) {
    const { node } = v
    setSelectedId(node.id)
    if (node.kind === 'recall' && node.recallId) openRecall(node.recallId)
    else if (node.kind === 'more' && node.detail) navigate(node.detail)
    else if (node.kind === 'error' && v.parentId) {
      const i = openDefects.indexOf(v.parentId)
      recallQueries[i]?.refetch()
    }
  }

  /** Breadcrumb: choose a node on the path, open it if it can be opened, and move focus to it. */
  function goTo(node: TreeNode) {
    setSelectedId(node.id)
    setFocusedId(node.id)
    if (isExpandable(node) && !expanded.has(node.id)) setExpanded((prev) => new Set(prev).add(node.id))
    requestAnimationFrame(() => elements.current.get(node.id)?.focus())
  }

  // --- Cmd+K (or a link) with ?recall=ID: open its class and defect type and select it ------------
  const target = useQuery({
    queryKey: ['recall', openRecallId, sim.hours],
    queryFn: () => api.getRecall(openRecallId as number, sim.at()),
    enabled: openRecallId !== null,
    retry: false,
  })
  const revealed = useRef<number | null>(null)
  useEffect(() => {
    const r = target.data
    if (!r || revealed.current === r.id) return
    revealed.current = r.id
    setExpanded((prev) => new Set([...prev, ...revealIds(r.recall_class, r.defect_type)]))
    setSelectedId(`recall:${r.id}`)
    setFocusedId(`recall:${r.id}`)
  }, [target.data])
  useEffect(() => {
    if (openRecallId === null) return
    const id = `recall:${openRecallId}`
    if (visible.some((v) => v.node.id === id)) {
      elements.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })
    }
  }, [visible, openRecallId, reducedMotion])

  function onKeyDown(e: React.KeyboardEvent) {
    const result = treeKey(visible, tabbableId, e.key, expanded)
    if (!result) return
    e.preventDefault()
    if (result.toggle) toggle(result.toggle)
    if (result.focus) {
      setFocusedId(result.focus)
      elements.current.get(result.focus)?.focus()
    }
    if (result.activate) {
      const v = visible.find((x) => x.node.id === result.activate)
      if (v) activate(v)
    }
  }

  return (
    <>
      {stats.error ? (
        <Card className="rounded-2xl p-8 text-center" role="alert">
          <p className="font-medium">The explorer could not load</p>
          <p className="mt-1 text-sm text-muted-foreground">{stats.error.message}</p>
          <Button variant="outline" className="mx-auto mt-4 w-fit" onClick={() => stats.refetch()}>
            <RotateCcw aria-hidden /> Try again
          </Button>
        </Card>
      ) : !tree ? (
        <Card className="rounded-2xl p-6">
          <LoadingRegion label="Loading recalls…" className="grid gap-4 min-[900px]:grid-cols-4">
            {[1, 3, 4, 5].map((n, col) => (
              <div key={col} className="space-y-2">
                {Array.from({ length: n }, (_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ))}
          </LoadingRegion>
        </Card>
      ) : tree.count === 0 ? (
        <Card className="rounded-2xl p-10 text-center">
          <p className="font-medium">No recalls saved yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link to="/" className="underline underline-offset-4">
              Enter the first recall
            </Link>{' '}
            to explore it here.
          </p>
        </Card>
      ) : (
        <Card className="rounded-2xl p-4 min-[900px]:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex flex-wrap items-center gap-1 text-sm">
                {crumbs.map((node, i) => {
                  const last = i === crumbs.length - 1
                  return (
                    <li key={node.id} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight aria-hidden className="size-3.5 text-muted-foreground" />}
                      {last ? (
                        <span aria-current="location" className="rounded-md px-1.5 py-0.5 font-semibold">
                          {crumbLabel(node)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => goTo(node)}
                          className="rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors duration-[var(--dur-fast)] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {crumbLabel(node)}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>
            <div className="flex items-center gap-3">
              <p className="hidden text-xs text-muted-foreground min-[900px]:block">Arrow keys move; Enter opens.</p>
              <Button variant="outline" size="sm" disabled={expanded.size <= 1} onClick={collapseAll}>
                Collapse all
              </Button>
            </div>
          </div>

          <div aria-hidden className="mb-2 hidden grid-cols-[repeat(4,minmax(0,1fr))] gap-x-12 min-[900px]:grid">
            {COLUMN_TITLES.map((t) => (
              <span key={t} className="text-xs font-medium text-muted-foreground">
                {t}
              </span>
            ))}
          </div>

          <div
            ref={setGrid}
            role="tree"
            aria-label="Recalls by class and defect type"
            onKeyDown={onKeyDown}
            className="relative grid grid-cols-1 gap-y-2 min-[900px]:grid-cols-[repeat(4,minmax(0,1fr))] min-[900px]:gap-x-12 min-[900px]:gap-y-3"
          >
            <Connectors container={grid} visible={visible} getElement={getElement} highlighted={highlighted} />
            {visible.map((v) => {
              const { node } = v
              const open = expanded.has(node.id)
              const expandable = isExpandable(node)
              const onPath = highlighted.has(node.id) && highlighted.size > 1
              const quiet = node.kind === 'loading' || node.kind === 'empty'
              const common = {
                ref: (el: HTMLElement | null) => {
                  if (el) elements.current.set(node.id, el)
                  else elements.current.delete(node.id)
                },
                role: 'treeitem',
                'aria-level': v.depth + 1,
                'aria-setsize': v.setsize,
                'aria-posinset': v.posinset,
                'aria-expanded': expandable ? open : undefined,
                'aria-selected': node.id === selectedId,
                'data-node-id': node.id,
                tabIndex: node.id === tabbableId ? 0 : -1,
                onFocus: () => setFocusedId(node.id),
                className: cn(
                  'relative z-10 flex w-full min-w-0 items-center gap-2 rounded-xl border bg-card/80 px-3 py-2.5 text-left text-sm shadow-[var(--shadow-card)]',
                  'transition-[transform,box-shadow,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]',
                  !quiet && 'hover:-translate-y-px hover:shadow-[var(--shadow-raised)]',
                  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  open && !onPath && 'border-foreground/25',
                  onPath && 'explorer-selected',
                  quiet && 'border-dashed shadow-none',
                ),
              } as const
              const content = <NodeContent node={node} open={open} counted={counted} />
              let item: React.ReactNode
              if (node.kind === 'more' && node.detail) {
                item = (
                  <Link to={node.detail} {...common}>
                    {content}
                  </Link>
                )
              } else if (quiet) {
                item = (
                  <div {...common} aria-busy={node.kind === 'loading' || undefined}>
                    {content}
                  </div>
                )
              } else {
                item = (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        {...common}
                        aria-haspopup={node.kind === 'recall' ? 'dialog' : undefined}
                        onClick={() => (expandable ? toggle(node.id) : activate(v))}
                      >
                        {content}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      {summary(node)}
                    </TooltipContent>
                  </Tooltip>
                )
              }
              return (
                <div
                  key={node.id}
                  className={cn(
                    'min-w-0 pl-[calc(var(--depth)*1.25rem)] min-[900px]:self-center min-[900px]:pl-0 min-[900px]:[grid-column:var(--col)] min-[900px]:[grid-row:var(--row)]',
                    // The stacked list fades rows in; the wide layout flies them out of their parent instead.
                    !wide && 'enter-fade',
                  )}
                  style={
                    {
                      '--depth': v.depth,
                      '--col': v.depth + 1,
                      '--row': `${v.row} / span ${v.span}`,
                    } as React.CSSProperties
                  }
                >
                  {item}
                </div>
              )
            })}
          </div>
        </Card>
      )}

    </>
  )
}
