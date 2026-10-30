import { ToggleGroup } from 'radix-ui'
import { cn } from '@/lib/utils'

/**
 * Single-choice pill tabs (e.g. 7d / 30d / 90d). Built on Radix ToggleGroup: arrow keys move
 * between pills, and one pill always stays selected.
 */
export function PillTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      className={cn('inline-flex gap-1 rounded-full border bg-muted p-1', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            'h-7 rounded-full px-3 text-xs font-medium text-muted-strong',
            'transition-[background-color,color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)]',
            'hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            'data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-[var(--shadow-card)]',
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
