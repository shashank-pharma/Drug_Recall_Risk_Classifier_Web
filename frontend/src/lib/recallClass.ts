// Colours per recall class: I = red, II = amber, III = sky (see CLAUDE.md). Hex values come from tokens.ts.
import { CLASS_COLORS } from './tokens.ts'

export const RECALL_CLASSES = ['Class I', 'Class II', 'Class III'] as const
export type RecallClassLabel = (typeof RECALL_CLASSES)[number]

type ClassStyle = {
  /** solid badge */
  badge: string
  /** tinted panel, e.g. the result card */
  soft: string
  /** chart fill (hex: Tailwind theme variables only exist when a utility uses them) */
  chart: string
}

const STYLES: Record<RecallClassLabel, ClassStyle> = {
  'Class I': {
    badge: 'bg-red-600 text-white',
    soft: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100',
    chart: CLASS_COLORS['Class I'],
  },
  'Class II': {
    badge: 'bg-amber-500 text-amber-950',
    soft: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100',
    chart: CLASS_COLORS['Class II'],
  },
  'Class III': {
    badge: 'bg-sky-700 text-white',
    soft: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-100',
    chart: CLASS_COLORS['Class III'],
  },
}

const FALLBACK: ClassStyle = {
  badge: 'bg-muted text-muted-strong',
  soft: 'border-border bg-muted text-foreground',
  chart: '#a3a3a3',
}

export function classStyle(label: string): ClassStyle {
  return STYLES[label as RecallClassLabel] ?? FALLBACK
}
