import { Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMotionSetting } from '@/lib/motion'
import type { MotionSetting } from '@/lib/motionPref'

const OPTIONS: { value: MotionSetting; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Follows your system setting' },
  { value: 'full', label: 'Full', hint: 'All animations on' },
  { value: 'reduced', label: 'Reduced', hint: 'Static background, no extra motion' },
]

/** Header menu: Motion Auto / Full / Reduced (lib/motionPref.ts). */
export function MotionMenu() {
  const [setting, setSetting] = useMotionSetting()
  const current = OPTIONS.find((o) => o.value === setting) ?? OPTIONS[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Motion: ${current.label}`}
        title={`Motion: ${current.label}`}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--frost-border)] bg-[var(--frost)] text-muted-strong transition-colors duration-[var(--dur-fast)] hover:text-foreground focus-visible:ring-3 focus-visible:ring-[var(--accent-ring)]/50 focus-visible:outline-none"
      >
        <Sparkles className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Motion</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={setting} onValueChange={(v) => setSetting(v as MotionSetting)}>
          {OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} className="flex-col items-start gap-0">
              <span className="font-medium">{o.label}</span>
              <span className="text-xs text-muted-foreground">{o.hint}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
