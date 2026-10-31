import { CircleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { ApiError } from '@/lib/api'

export function FriendlyError({
  error,
  onPickDefect,
}: {
  error: ApiError
  onPickDefect: (defectType: string) => void
}) {
  const { code, message, defect_type, known_types } = error.body

  if (code === 'unknown_defect') {
    return (
      <Alert variant="destructive" role="alert">
        <CircleAlert />
        <AlertTitle>We couldn't classify this recall</AlertTitle>
        <AlertDescription>
          <p>
            {defect_type ? `"${defect_type}"` : 'This defect type'} isn't a known defect type. Choose
            one of these instead:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {known_types?.map((type) => (
              <Button key={type} type="button" size="sm" variant="outline" onClick={() => onPickDefect(type)}>
                {type}
              </Button>
            ))}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  const title =
    code === 'network_error'
      ? "We couldn't reach the server"
      : code === 'demo_full'
        ? 'The demo is full'
        : code === 'validation_error'
          ? 'Please check the highlighted fields'
          : 'Something went wrong'

  return (
    <Alert variant="destructive" role="alert">
      <CircleAlert />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
