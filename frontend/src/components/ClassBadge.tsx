import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { classStyle } from '@/lib/recallClass'
import { cn } from '@/lib/utils'

const LEVELS: Record<string, string> = { wholesale: 'wholesale', retail: 'retail', consumer: 'consumer' }

const hoursText = (h: number) => (h % 24 === 0 && h >= 48 ? `${h / 24} days` : `${h} h`)

/** What a class means, from the classifier and the CDSCO rules endpoints (both cached). */
function ClassExplainer({ label }: { label: string }) {
  const rules = useQuery({ queryKey: ['recall-rules'], queryFn: api.recallRules })
  const defects = useQuery({ queryKey: ['defect-types'], queryFn: api.defectTypes })
  const rule = rules.data?.find((r) => r.recall_class === label)
  const example = defects.data?.find((d) => d.recall_class === label)
  if (!rule || !example) return <span>Loading what {label} means…</span>
  return (
    <span className="block max-w-64 space-y-1 py-0.5 text-left leading-snug">
      <span className="block font-semibold">{label}: {example.meaning}</span>
      <span className="block">Action: {example.action}</span>
      <span className="block">
        {rule.stop_sale_hours !== null
          ? `Stop sale within ${hoursText(rule.stop_sale_hours)}; complete within ${hoursText(rule.completion_hours)}.`
          : `Complete within ${hoursText(rule.completion_hours)}.`}
      </span>
      <span className="block">Recall up to: {rule.recall_levels.map((l) => LEVELS[l] ?? l).join(', ')}.</span>
      <span className="block opacity-75">{rule.source_timelines}</span>
    </span>
  )
}

export function ClassBadge({
  label,
  size = 'sm',
  explain = false,
  className,
}: {
  label: string
  size?: 'sm' | 'lg'
  /** hover or keyboard focus shows what the class means (the result card says the same in full) */
  explain?: boolean
  className?: string
}) {
  const classes = cn(
    classStyle(label).badge,
    // Solid fill, a 2 px white ring and the text label, so a badge never melts into a blue/violet page.
    'ring-2 ring-white dark:ring-white/70',
    size === 'lg' && 'h-auto px-4 py-1.5 text-base font-semibold',
    className,
  )
  if (!explain) return <Badge className={classes}>{label}</Badge>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge asChild className={cn(classes, 'cursor-help focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none')}>
          <button type="button" aria-label={`${label}, what this means`}>
            {label}
          </button>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        <ClassExplainer label={label} />
      </TooltipContent>
    </Tooltip>
  )
}
