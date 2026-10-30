import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

/**
 * Offers example recalls on an empty database. Renders nothing unless the server was started with
 * RECALL_ENABLE_SAMPLE_DATA=1 and has no recalls, so real data never gets examples by accident.
 */
export function SampleDataButton() {
  const queryClient = useQueryClient()
  const status = useQuery({ queryKey: ['sample-data'], queryFn: api.sampleDataStatus, retry: false })
  const load = useMutation({
    mutationFn: api.loadSampleData,
    onSuccess: () => queryClient.invalidateQueries(),
  })
  if (!status.data?.available) return null

  return (
    <div className="mt-5 space-y-2">
      <Button variant="outline" onClick={() => load.mutate()} disabled={load.isPending} aria-busy={load.isPending}>
        {load.isPending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Loading sample data…
          </>
        ) : (
          'Load sample data'
        )}
      </Button>
      <p className="text-xs text-muted-strong">
        Adds 12 example recalls (batches SAMPLE-001 to SAMPLE-012) with CDSCO timelines, for trying the app out.
      </p>
      {load.error && (
        <p role="alert" className="text-sm text-destructive">
          {load.error.message}
        </p>
      )}
    </div>
  )
}
