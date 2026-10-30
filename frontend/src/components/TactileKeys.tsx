import { classStyle } from '@/lib/recallClass'
import { PALETTE } from '@/lib/tokens'
import { cn } from '@/lib/utils'

type Key = { value: string; label: string; /** accessible name when the visible label is short */ name?: string }

/**
 * A row of physical-looking keys: raised at rest, pressed in when on, with a small light that shows the
 * class colour when on. "All" is on when nothing is chosen and clears the choice. Each key is an
 * `aria-pressed` toggle button. `multiple` lets several be on at once (History); otherwise one (Dashboard).
 */
export function TactileKeys({
  label,
  keys,
  value,
  onChange,
  multiple = false,
  className,
}: {
  /** name of the group for screen readers */
  label: string
  keys: Key[]
  value: string[]
  onChange: (value: string[]) => void
  multiple?: boolean
  className?: string
}) {
  function press(key: string) {
    const on = value.includes(key)
    if (multiple) onChange(on ? value.filter((v) => v !== key) : [...value, key])
    else onChange(on ? [] : [key])
  }

  const all: Key = { value: '', label: 'All', name: 'All classes' }
  return (
    <div role="group" aria-label={label} className={cn('flex gap-1.5', className)}>
      {[all, ...keys].map((key) => {
        const on = key.value === '' ? value.length === 0 : value.includes(key.value)
        const led = key.value === '' ? PALETTE.brandFrom : classStyle(key.value).chart
        return (
          <button
            key={key.value || 'all'}
            type="button"
            aria-pressed={on}
            aria-label={key.name}
            onClick={() => (key.value === '' ? onChange([]) : press(key.value))}
            className={cn(
              'relative inline-flex h-11 min-w-12 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold select-none',
              'transition-[transform,box-shadow,background-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]',
              'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              on
                ? 'translate-y-px border-slate-300 bg-muted text-foreground shadow-[inset_0_2px_3px_rgb(15_23_42/0.12)]'
                : 'border-border bg-card text-muted-strong shadow-[0_2px_0_0_var(--border),var(--shadow-card)] hover:-translate-y-px hover:text-foreground active:translate-y-px active:shadow-[inset_0_2px_3px_rgb(15_23_42/0.12)]',
            )}
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(15_23_42/0.18)] transition-[background-color] duration-[var(--dur-fast)]"
              style={{ backgroundColor: on ? led : PALETTE.border }}
            />
            {key.label}
          </button>
        )
      })}
    </div>
  )
}
