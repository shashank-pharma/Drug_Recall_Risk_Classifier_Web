import { Clock, RotateCcw } from 'lucide-react'
import { Slider as SliderPrimitive } from 'radix-ui'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'
import { formatOffset, MAX_HOURS, simulatedAt } from '@/lib/simulation'
import { useSimulation } from '@/lib/useSimulation'
import { cn } from '@/lib/utils'

const TICKS = [0, 24, 48, 72]

function when(hours: number) {
  const at = simulatedAt(hours, new Date())
  return at ? formatDateTime(at) : 'the current time'
}

/**
 * Slider from now to +72 h: shows CDSCO statuses as they would be at that time. The label follows the
 * thumb; the data is fetched when the thumb is let go (or on each key press).
 */
export function TimeTravelBar({ className }: { className?: string }) {
  const sim = useSimulation()
  // During a pointer drag the label follows the thumb; the data loads on release. Keys commit at once
  // (Radix reports the commit before the change), so outside a drag the shared time is what is shown.
  const [drag, setDrag] = useState<number | null>(null)
  const [pointerDown, setPointerDown] = useState(false)
  const shown = pointerDown && drag !== null ? drag : sim.hours
  const thumb = useRef<HTMLSpanElement>(null)

  return (
    <section
      aria-labelledby="time-travel-title"
      className={cn('rounded-[var(--radius-card)] border bg-card p-4', sim.active && 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/50', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="time-travel-title" className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="size-4 text-muted-strong" aria-hidden />
          What if: view statuses later
        </h2>
        {sim.active && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              sim.reset()
              thumb.current?.focus() // the button goes away; keep focus on the slider
            }}
          >
            <RotateCcw aria-hidden /> Back to now
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-strong">
        Simulation only: nothing is saved, and marking milestones is paused while it is on.
      </p>
      <div className="mt-4 px-1">
        <SliderPrimitive.Root
          min={0}
          max={MAX_HOURS}
          step={1}
          value={[shown]}
          onPointerDown={() => setPointerDown(true)}
          onPointerUp={() => setPointerDown(false)}
          onValueChange={([h]) => setDrag(h)}
          onValueCommit={([h]) => {
            setPointerDown(false)
            sim.setHours(h)
          }}
          className="relative flex h-5 w-full touch-none items-center select-none"
        >
          <SliderPrimitive.Track className="relative h-1 grow overflow-hidden rounded-full bg-muted">
            <SliderPrimitive.Range className="absolute h-full bg-primary" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            ref={thumb}
            aria-label="Simulation time, hours from now"
            aria-valuetext={`${formatOffset(shown)}, ${when(shown)}`}
            className="block size-4 rounded-full border-2 border-primary bg-card transition-[box-shadow] duration-[var(--dur-fast)] hover:ring-4 hover:ring-ring/30 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        </SliderPrimitive.Root>
        <div aria-hidden className="mt-2 flex justify-between text-[11px] text-muted-strong tabular-nums">
          {TICKS.map((t) => (
            <span key={t}>{t === 0 ? 'Now' : `+${t} h`}</span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm" aria-live="polite">
        <span className="font-medium">{formatOffset(shown)}</span>
        <span className="text-muted-strong"> · {shown === 0 ? 'real time' : when(shown)}</span>
      </p>
    </section>
  )
}

/** Shown under the header on every page while a simulation time is set. */
export function SimulationBanner() {
  const sim = useSimulation()
  if (!sim.active) return null
  return (
    <div role="status" className="border-b border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
        <Clock className="size-4 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">Simulation:</span> statuses are shown as at {when(sim.hours)} (
          {formatOffset(sim.hours)}). Nothing is saved
          <span className="hidden sm:inline">; saving recalls and marking milestones are paused</span>.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="bg-card"
          onClick={() => {
            sim.reset()
            // The banner goes away with its button; move focus to the page content.
            document.getElementById('main')?.focus({ preventScroll: true })
          }}
        >
          <RotateCcw aria-hidden /> Back to now
        </Button>
      </div>
    </div>
  )
}
