import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { RecallResultCard } from '@/components/RecallResultCard'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { Recall } from '@/lib/types'

export function RecallDetailPage() {
  const id = Number(useParams().id)
  const queryClient = useQueryClient()
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['recall', id],
    queryFn: () => api.getRecall(id),
    enabled: Number.isInteger(id) && id > 0,
    retry: false,
  })

  return (
    <>
      <Link
        to="/history"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to history
      </Link>
      <PageHeader
        title={data ? `${data.drug_name} · ${data.batch_id}` : `Recall #${Number.isNaN(id) ? '' : id}`}
        description="Classification, recall levels and the CDSCO timeline for this recall."
      />
      <div className="max-w-xl">
        {error ? (
          <div role="alert" className="text-sm">
            <p className="text-destructive">{error.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : isPending ? (
          <p className="text-sm text-muted-foreground">Loading recall…</p>
        ) : (
          <RecallResultCard
            recall={data}
            onUpdated={(r: Recall) => queryClient.setQueryData(['recall', id], r)}
          />
        )}
      </div>
    </>
  )
}
