import { useQuery } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ExplorerList } from '@/components/explorer/ExplorerList'
import { type FlowSelection, FlowView } from '@/components/explorer/FlowView'
import { PageHeader } from '@/components/PageHeader'
import { PillTabs } from '@/components/PillTabs'
import { RecallDetailSheet } from '@/components/RecallDetailSheet'
import { LoadingRegion, Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { FlowNode, SizeBy } from '@/lib/flowLayout'
import { useMediaQuery } from '@/lib/motion'
import { useSimulation } from '@/lib/useSimulation'

/** The flow chart needs room for four columns; below this the List view is used. */
const WIDE = '(min-width: 900px)'
const ROOT: FlowSelection = { id: 'root' }

const SIZE_OPTIONS: { value: SizeBy; label: string }[] = [
  { value: 'recalls', label: 'Recalls' },
  { value: 'units', label: 'Units' },
]
const VIEW_OPTIONS = [
  { value: 'flow', label: 'Flow' },
  { value: 'list', label: 'List' },
] as const

export function ExplorerPage() {
  const sim = useSimulation()
  const [params, setParams] = useSearchParams()
  const openRecallId = Number(params.get('recall')) || null
  const wide = useMediaQuery(WIDE)
  const [view, setView] = useState<'flow' | 'list'>('flow')
  const [sizeBy, setSizeBy] = useState<SizeBy>('recalls')
  const [selection, setSelection] = useState<FlowSelection>(ROOT)
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set())
  const [keep, setKeep] = useState<string | null>(null)
  const showFlow = wide && view === 'flow'

  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api.statsSummary() })

  function openRecall(id: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('recall', String(id))
      return next
    })
  }

  /** Selecting narrows the recall column to that class or defect type; a recall also opens its panel. */
  function select(node: FlowNode) {
    const next: FlowSelection =
      node.kind === 'root' ? ROOT : { id: node.id, recallClass: node.recallClass, defectType: node.kind === 'class' ? undefined : node.defectType }
    if (next.recallClass !== selection.recallClass || next.defectType !== selection.defectType) {
      setExpanded((prev) => {
        const copy = new Set(prev)
        copy.delete(3)
        return copy
      })
    }
    setSelection(next)
    if (node.kind === 'recall' && node.recallId) openRecall(node.recallId)
  }

  function reset() {
    setSelection(ROOT)
    setExpanded(new Set())
    setKeep(null)
    setSizeBy('recalls')
  }

  // Cmd+K (or a link) with ?recall=ID: select its route in the flow so the recall is in view.
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
    setSelection({ id: `recall:${r.id}`, recallClass: r.recall_class, defectType: r.defect_type })
    setKeep(`recall:${r.id}`)
  }, [target.data])

  return (
    <>
      <PageHeader
        title="Recall explorer"
        description="How recalls flow from class to defect type to each recall. Select a node to follow its route."
      />

      {stats.error ? (
        <Card className="rounded-2xl p-8 text-center" role="alert">
          <p className="font-medium">The explorer could not load</p>
          <p className="mt-1 text-sm text-muted-foreground">{stats.error.message}</p>
          <Button variant="outline" className="mx-auto mt-4 w-fit" onClick={() => stats.refetch()}>
            <RotateCcw aria-hidden /> Try again
          </Button>
        </Card>
      ) : !stats.data ? (
        <Card className="rounded-2xl p-6">
          <LoadingRegion label="Loading recalls…" className="grid gap-6 min-[900px]:grid-cols-4">
            {[1, 3, 4, 5].map((n, col) => (
              <div key={col} className="flex flex-col justify-center gap-3">
                {Array.from({ length: n }, (_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ))}
          </LoadingRegion>
        </Card>
      ) : stats.data.total_recalls === 0 ? (
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
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {wide ? (
              <>
                <span className="flex items-center gap-2 text-sm text-muted-strong">
                  Size by
                  <PillTabs
                    label="Size by"
                    options={SIZE_OPTIONS}
                    value={sizeBy}
                    onChange={(v) => setSizeBy(v as SizeBy)}
                  />
                </span>
                <span className="flex items-center gap-2 text-sm text-muted-strong">
                  View
                  <PillTabs label="View" options={[...VIEW_OPTIONS]} value={view} onChange={(v) => setView(v as 'flow' | 'list')} />
                </span>
              </>
            ) : (
              <p className="text-sm text-muted-strong">List view on small screens; the flow chart needs at least 900 px.</p>
            )}
            {showFlow && (
              <Button variant="outline" size="sm" className="ml-auto" onClick={reset}>
                <RotateCcw aria-hidden /> Reset
              </Button>
            )}
          </div>

          {showFlow ? (
            <Card className="rounded-2xl p-6">
              <FlowView
                stats={stats.data}
                sizeBy={sizeBy}
                selection={selection}
                onSelect={select}
                onClear={() => setSelection(ROOT)}
                expanded={expanded}
                onExpand={(column) => setExpanded((prev) => new Set(prev).add(column))}
                keep={keep}
              />
            </Card>
          ) : (
            <ExplorerList />
          )}
        </>
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
        onAfterClose={(id) => document.querySelector<HTMLElement>(`[data-node-id="recall:${id}"]`)?.focus()}
      />
    </>
  )
}
