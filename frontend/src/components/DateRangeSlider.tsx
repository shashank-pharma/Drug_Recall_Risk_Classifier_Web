import { Slider as SliderPrimitive } from 'radix-ui'
import { useState } from 'react'
import { addDays, rangeToSlider, sliderToRange } from '@/lib/dateRange'

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/**
 * Two-thumb slider over the days that have recalls (UTC). It writes the History `from`/`to`
 * filters when a thumb is released (or moved with the keyboard), and follows them when they
 * change elsewhere (date fields, Clear filters).
 */
export function DateRangeSlider({
  min,
  max,
  from,
  to,
  onCommit,
}: {
  min: string
  max: string
  from: string
  to: string
  onCommit: (range: { from: string | null; to: string | null }) => void
}) {
  const [value, setValue] = useState(() => rangeToSlider(min, max, from, to))
  // Follow outside changes without remounting, so a focused thumb keeps keyboard focus.
  const props = `${min}|${max}|${from}|${to}`
  const [seen, setSeen] = useState(props)
  if (props !== seen) {
    setSeen(props)
    setValue(rangeToSlider(min, max, from, to))
  }
  const [start, end] = value
  const last = rangeToSlider(min, max, '', '')[1]
  const startDay = addDays(min, start)
  const endDay = addDays(min, end)

  if (last === 0) {
    return <p className="text-sm text-muted-foreground">All recalls were saved on {dayLabel(min)} (UTC).</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-sm tabular-nums" aria-live="polite">
        {dayLabel(startDay)} – {dayLabel(endDay)} <span className="text-muted-foreground">(UTC)</span>
      </p>
      <SliderPrimitive.Root
        min={0}
        max={last}
        step={1}
        minStepsBetweenThumbs={0}
        value={value}
        onValueChange={(v) => setValue([v[0], v[1]])}
        onValueCommit={(v) => onCommit(sliderToRange(min, max, [v[0], v[1]]))}
        className="relative flex h-5 w-full touch-none items-center select-none"
      >
        <SliderPrimitive.Track className="relative h-1 grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        {(['From date', 'To date'] as const).map((label, i) => (
          <SliderPrimitive.Thumb
            key={label}
            aria-label={label}
            aria-valuetext={`${dayLabel(i === 0 ? startDay : endDay)} (UTC)`}
            className="block size-4 rounded-full border-2 border-primary bg-card transition-[box-shadow] duration-[var(--dur-fast)] hover:ring-4 hover:ring-ring/30 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        ))}
      </SliderPrimitive.Root>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{dayLabel(min)}</span>
        <span>{dayLabel(max)}</span>
      </div>
    </div>
  )
}
