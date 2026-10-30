import { Badge } from '@/components/ui/badge'
import { classStyle } from '@/lib/recallClass'
import { cn } from '@/lib/utils'

export function ClassBadge({
  label,
  size = 'sm',
  className,
}: {
  label: string
  size?: 'sm' | 'lg'
  className?: string
}) {
  return (
    <Badge
      className={cn(
        classStyle(label).badge,
        size === 'lg' && 'h-auto px-4 py-1.5 text-base font-semibold',
        className,
      )}
    >
      {label}
    </Badge>
  )
}
