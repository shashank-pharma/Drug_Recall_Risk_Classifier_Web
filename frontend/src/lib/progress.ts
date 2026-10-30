// How far along a CDSCO milestone is, for the timeline progress bar (tested with `npm test`).
import { parseUtc } from './format.ts'

export type MilestoneTimes = {
  starts_at: string | null
  due_at: string | null
  done_at: string | null
}

export type Progress = {
  /** 0–1 share of the allowed time used (1 when done or past due) */
  fraction: number
  /** negative when overdue */
  remainingMs: number
  /** "22 h left", "3 days overdue", "Done" */
  label: string
}

function amount(ms: number): string {
  const hours = Math.abs(ms) / 3_600_000
  if (hours < 1) return `${Math.max(1, Math.round(Math.abs(ms) / 60_000))} min`
  return hours < 48 ? `${Math.round(hours)} h` : `${Math.round(hours / 24)} days`
}

/** Null when the milestone has no deadline to measure against. */
export function milestoneProgress(m: MilestoneTimes, now: Date): Progress | null {
  if (!m.starts_at || !m.due_at) return null
  const start = parseUtc(m.starts_at).getTime()
  const due = parseUtc(m.due_at).getTime()
  if (m.done_at) return { fraction: 1, remainingMs: 0, label: 'Done' }

  const remainingMs = due - now.getTime()
  const total = Math.max(1, due - start)
  const fraction = Math.min(1, Math.max(0, (now.getTime() - start) / total))
  const label = remainingMs >= 0 ? `${amount(remainingMs)} left` : `${amount(remainingMs)} overdue`
  return { fraction, remainingMs, label }
}
