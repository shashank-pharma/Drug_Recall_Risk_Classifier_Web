import { useState } from 'react'
import { PALETTE_NAMES, readPalette, savePalette, stepPalette } from '@/lib/palette'
import { PALETTES, type PaletteName } from '@/lib/tokens'
import { cn } from '@/lib/utils'

function storage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

/**
 * Three dots in the header that switch the calm background palette (radio group: click, or arrow keys).
 * The background cross-fades in 500 ms through the registered colour properties in index.css.
 */
export function PaletteSwitcher() {
  const [palette, setPalette] = useState<PaletteName>(() => {
    const current = document.documentElement.dataset.palette
    return current && current in PALETTES ? (current as PaletteName) : readPalette(storage())
  })

  function choose(next: PaletteName, focus = false) {
    document.documentElement.setAttribute('data-palette', next)
    savePalette(storage(), next)
    setPalette(next)
    if (focus) document.getElementById(`palette-${next}`)?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    choose(stepPalette(palette, step), true)
  }

  return (
    <div role="radiogroup" aria-label="Background colours" onKeyDown={onKeyDown} className="flex items-center gap-0.5">
      {PALETTE_NAMES.map((name) => {
        const on = name === palette
        const [a, b, c] = PALETTES[name].light.stops
        return (
          <button
            key={name}
            id={`palette-${name}`}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={PALETTES[name].label}
            title={PALETTES[name].label}
            tabIndex={on ? 0 : -1}
            onClick={() => choose(name)}
            className="grid size-8 place-items-center rounded-full focus-visible:outline-none"
          >
            <span
              aria-hidden
              className={cn(
                'size-4 rounded-full shadow-[inset_0_0_0_1px_rgb(27_36_64/0.25)] transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)]',
                on ? 'scale-110 ring-2 ring-[var(--accent-ring)] ring-offset-2 ring-offset-transparent' : 'hover:scale-110',
              )}
              style={{ backgroundImage: `linear-gradient(135deg, ${a}, ${b}, ${c})` }}
            />
          </button>
        )
      })}
    </div>
  )
}
