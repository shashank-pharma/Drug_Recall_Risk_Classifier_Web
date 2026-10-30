// Status lights: green = done, amber = still open, red = overdue, grey = no deadline.
// The light is never shown without its text (tested with `npm test`).
import type { MilestoneStatus } from './types.ts'

export type LedTone = 'done' | 'pending' | 'overdue' | 'none'

export const MILESTONE_TEXT: Record<MilestoneStatus, string> = {
  done: 'Done',
  done_late: 'Done late',
  overdue: 'Overdue',
  due_soon: 'Due soon',
  on_track: 'On track',
  not_specified: 'Not specified',
  waiting: 'Waiting for decision',
}

export function milestoneTone(status: MilestoneStatus): LedTone {
  switch (status) {
    case 'done':
    case 'done_late':
      return 'done'
    case 'overdue':
      return 'overdue'
    case 'not_specified':
      return 'none'
    default:
      return 'pending'
  }
}

/** One light for a whole recall: overdue if any milestone is, done when every deadline is met. */
export function recallLed(statuses: MilestoneStatus[] | null): { tone: LedTone; text: string } {
  if (!statuses) return { tone: 'none', text: 'No timeline' }
  if (statuses.includes('overdue')) return { tone: 'overdue', text: 'Overdue' }
  const tones = statuses.map(milestoneTone)
  if (tones.every((t) => t === 'done' || t === 'none')) return { tone: 'done', text: 'Done' }
  return { tone: 'pending', text: 'Open' }
}
