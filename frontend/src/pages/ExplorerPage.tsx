import { useQueries, useQuery } from '@tanstack/react-query'
import { AlarmClock, ChevronRight } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ClassBadge } from '@/components/ClassBadge'
import { Connectors } from '@/components/explorer/Connectors'
import { PageHeader } from '@/components/PageHeader'
import { RecallDetailSheet } from '@/components/RecallDetailSheet'
import { LoadingRegion, Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import {
  buildTree,
  type DefectRecalls,
  isExpandable,
  parseDefectId,
  treeKey,
  type VisibleNode,
  visibleNodes,
} from '@/lib/explorerTree'
import { humanizeDefect } from '@/lib/format'
import { classStyle } from '@/lib/recallClass'
import { cn } from '@/lib/utils'

const RECALLS_PER_DEFECT = 50
const COLUMN_TITLES = ['All recalls', 'Class', 'Defect type', 'Recalls']

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function NodeContent({ v, open }: { v: VisibleNode; open: boolean }) {
  const { node } = v
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
        <>
          <span className="font-semibold">{node.label}</span>
          <span className="ml-auto tabular-nums text-muted-foreground">{node.count}</span>
          {chevron}
        </>
      )
    case 'class':
      return (
        <>
          <ClassBadge label={node.label} />
          <span className="ml-auto text-muted-foreground">{plural(node.count ?? 0, 'recall')}</span>
          {chevron}
        </>
      )
    case 'defect':
      return (
        <>
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: classStyle(node.recallClass ?? '').chart }}
          />
          <span className="truncate">{humanizeDefect(node.defectType ?? node.label)}</span>
          <span className="ml-auto tabular-nums text-muted-foreground">{node.count}</span>
          {chevron}
        </>
      )
    case 'recall':
      return (
        <>
          <span className="min-w-0 truncate font-medium">{node.label}</span>
          <span className="shrink-0 text-muted-foreground">{node.detail}</span>
          {node.overdue && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
              <AlarmClock className="size-3" aria-hidden /> Overdue
            </span>
          )}
        </>
      )
    case 'more':
      return <span className="underline underline-offset-4">{node.label}</span>
    case 'loading':
      return (
        <>
          <span className="sr-only">{node.label}</span>
          <Skeleton className="h-4 w-full" />
        </>
      )
  }
}

export function ExplorerPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const openRecallId = Number(params.get('recall')) || null

  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api.statsSummary() })
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(['root']))
  const [focusedId, setFocusedId] = useState('root')

  // Recalls are fetched only for the defect types that are open.
  const openDefects = useMemo(() => [...expanded].filter((id) => id.startsWith('defect:')).sort(), [expanded])
  const recallQueries = useQueries({
    queries: openDefects.map((id) => {
      const { recallClass, defectType } = parseDefectId(id)
      return {
        queryKey: ['recalls', 'explorer', recallClass, defectType],
        queryFn: () =>
          api.listRecalls({ recall_class: [recallClass], defect_type: defectType, page_size: RECALLS_PER_DEFECT }),
      }
    }),
  })

  const recalls: Record<string, DefectRecalls> = {}
  openDefects.forEach((id, i) => {
    const data = recallQueries[i]?.data
    recalls[id] = data
      ? {
          total: data.total,
          items: data.items.map((r) => ({
            id: r.id,
            drug_name: r.drug_name,
            batch_id: r.batch_id,
            overdue: !!r.timeline?.some((m) => m.status === 'overdue'),
          })),
        }
      : 'loading'
  })

  const tree = stats.data ? buildTree(stats.data, recalls) : null
  const visible = tree ? visibleNodes(tree, expanded) : []
  const tabbableId = visible.some((v) => v.node.id === focusedId) ? focusedId : 'root'

  const elements = useRef(new Map<string, HTMLElement>())
  const getElement = useCallback((id: string) => elements.current.get(id), [])
  const [grid, setGrid] = useState<HTMLDivElement | null>(null)

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setFocusedId(id)
  }

  function openRecall(id: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('recall', String(id))
      return next
    })
  }

  function activate(v: VisibleNode) {
    if (v.node.kind === 'recall' && v.node.recallId) openRecall(v.node.recallId)
    else if (v.node.kind === 'more' && v.node.detail) navigate(v.node.detail)
  }

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
      <PageHeader
        title="Recall explorer"
        description="Open a class, then a defect type, to see its recalls. Select a recall to see its details."
      />

      {stats.error ? (
        <div role="alert" className="text-sm">
          <p className="text-destructive">{stats.error.message}</p>
          <Button variant="outline" className="mt-3" onClick={() => stats.refetch()}>
            Try again
          </Button>
        </div>
      ) : !tree ? (
        <Card className="rounded-2xl p-6">
          <LoadingRegion label="Loading recalls…" className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full max-w-xs" />
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
        <Card className="rounded-2xl p-4 md:p-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">Arrow keys move through the tree; Enter opens.</p>
            <Button
              variant="ghost"
              size="sm"
              disabled={expanded.size <= 1}
              onClick={() => {
                setExpanded(new Set(['root']))
                setFocusedId('root')
              }}
            >
              Collapse all
            </Button>
          </div>

          <div aria-hidden className="mb-2 hidden grid-cols-[repeat(4,minmax(0,1fr))] gap-x-16 md:grid">
            {COLUMN_TITLES.map((t) => (
              <span key={t} className="text-xs text-muted-foreground">
                {t}
              </span>
            ))}
          </div>

          <div
            ref={setGrid}
            role="tree"
            aria-label="Recalls by class and defect type"
            onKeyDown={onKeyDown}
            className="relative grid grid-cols-1 gap-y-2 md:grid-cols-[repeat(4,minmax(0,1fr))] md:gap-x-16"
          >
            <Connectors container={grid} visible={visible} getElement={getElement} />
            {visible.map((v) => {
              const { node } = v
              const open = expanded.has(node.id)
              const expandable = isExpandable(node)
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
                tabIndex: node.id === tabbableId ? 0 : -1,
                onFocus: () => setFocusedId(node.id),
                className: cn(
                  'relative z-10 flex w-full min-w-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm',
                  'transition-[border-color,background-color] duration-[var(--dur-fast)] hover:border-foreground/30',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  open && 'border-foreground/40',
                  node.kind === 'recall' && openRecallId === node.recallId && 'border-foreground/60 bg-muted',
                  node.kind === 'loading' && 'border-dashed',
                ),
              } as const
              return (
                <div
                  key={node.id}
                  className="enter-fade min-w-0 pl-[calc(var(--depth)*1.25rem)] md:self-center md:pl-0 md:[grid-column:var(--col)] md:[grid-row:var(--row)]"
                  style={
                    {
                      '--depth': v.depth,
                      '--col': v.depth + 1,
                      '--row': `${v.row} / span ${v.span}`,
                    } as React.CSSProperties
                  }
                >
                  {node.kind === 'more' && node.detail ? (
                    <Link to={node.detail} {...common}>
                      <NodeContent v={v} open={open} />
                    </Link>
                  ) : node.kind === 'loading' ? (
                    <div {...common} aria-busy>
                      <NodeContent v={v} open={open} />
                    </div>
                  ) : (
                    <button
                      type="button"
                      {...common}
                      aria-haspopup={node.kind === 'recall' ? 'dialog' : undefined}
                      onClick={() => (expandable ? toggle(node.id) : activate(v))}
                    >
                      <NodeContent v={v} open={open} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <RecallDetailSheet
        recallId={openRecallId}
        onClose={() =>
          setParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.delete('recall')
              return next
            },
            { replace: true },
          )
        }
        onAfterClose={(id) => elements.current.get(`recall:${id}`)?.focus()}
      />
    </>
  )
}
