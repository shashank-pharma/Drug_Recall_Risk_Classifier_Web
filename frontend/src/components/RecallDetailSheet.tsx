import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PillLink } from '@/components/PillLink'
import { RecallResultCard } from '@/components/RecallResultCard'
import { TimeTravelBar } from '@/components/TimeTravel'
import { LoadingRegion, Skeleton } from '@/components/Skeleton'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { api } from '@/lib/api'
import type { Recall } from '@/lib/types'
import { useSimulation } from '@/lib/useSimulation'

/**
 * Right-hand panel with one recall's card and timeline; open while `recallId` is set.
 * The panel opens from the URL rather than a trigger button, so `onAfterClose` says where
 * keyboard focus should go back to.
 */
export function RecallDetailSheet({
  recallId,
  onClose,
  onAfterClose,
}: {
  recallId: number | null
  onClose: () => void
  onAfterClose?: (id: number) => void
}) {
  const queryClient = useQueryClient()
  const sim = useSimulation()
  // Keep showing the last recall while the panel slides out, instead of flashing to a skeleton.
  const [shownId, setShownId] = useState(recallId)
  if (recallId !== null && recallId !== shownId) setShownId(recallId)

  const { data, error } = useQuery({
    queryKey: ['recall', shownId, sim.hours],
    queryFn: () => api.getRecall(shownId as number, sim.at()),
    enabled: shownId !== null,
    retry: false,
    placeholderData: (previous) => (previous?.id === shownId ? previous : undefined),
  })

  return (
    <Sheet open={recallId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto bg-background sm:max-w-md"
        onCloseAutoFocus={(e) => {
          if (onAfterClose && shownId !== null) {
            e.preventDefault()
            onAfterClose(shownId)
          }
        }}
      >
        <SheetHeader className="border-b border-[var(--frost-border)]">
          <SheetTitle>{data ? `${data.drug_name} · ${data.batch_id}` : `Recall #${shownId ?? ''}`}</SheetTitle>
          <SheetDescription>Classification, recall levels and the CDSCO timeline.</SheetDescription>
          {shownId !== null && (
            <PillLink to={`/recalls/${shownId}`} className="mt-1 w-fit">
              Open full page
            </PillLink>
          )}
        </SheetHeader>
        <div className="space-y-4 p-4">
          <TimeTravelBar />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          ) : !data ? (
            <LoadingRegion label="Loading recall…" className="space-y-3">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </LoadingRegion>
          ) : (
            <RecallResultCard
              recall={data}
              onUpdated={(r: Recall) => queryClient.setQueryData(['recall', r.id, sim.hours], r)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
