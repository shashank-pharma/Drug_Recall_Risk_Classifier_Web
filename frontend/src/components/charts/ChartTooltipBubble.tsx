/** Rounded white bubble used for every chart tooltip: a title and one row per series. */
export function ChartTooltipBubble({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: string; color: string; dash?: string }[]
}) {
  return (
    <div className="min-w-36 rounded-xl border bg-card px-3 py-2 text-xs shadow-[var(--shadow-raised)]">
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            <svg aria-hidden width="12" height="4" className="shrink-0">
              <line x1="0" y1="2" x2="12" y2="2" stroke={r.color} strokeWidth="3" strokeDasharray={r.dash} />
            </svg>
            <span className="text-muted-foreground">{r.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
