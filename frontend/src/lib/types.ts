// Mirrors backend/app/schemas.py — keep the two in sync.

export type RecallInput = {
  drug_name: string
  batch_id: string
  reason: string
  defect_type: string
  units_affected: number
  /** ISO timestamp; CDSCO §8.0 clock start */
  information_received_at: string
  decision_at?: string | null
}

export type MilestoneKey = 'decision' | 'communication' | 'stop_sale' | 'completion'
export type MarkableMilestone = Exclude<MilestoneKey, 'decision'>

export type MilestoneStatus =
  | 'done' | 'done_late' | 'overdue' | 'due_soon' | 'on_track' | 'not_specified' | 'waiting'

/** Times are UTC without a timezone suffix — parse with parseUtc() */
export type Milestone = {
  key: MilestoneKey
  label: string
  due_at: string | null
  done_at: string | null
  status: MilestoneStatus
  source: string
  note: string
  /** when this milestone's clock started; null when it has no deadline yet */
  starts_at: string | null
}

export type RecallPreview = Omit<RecallInput, 'information_received_at' | 'decision_at'> & {
  recall_class: string
  action: string
  meaning: string
  recall_levels: string[]
  public_announcement: boolean
  /** UTC, no suffix; null for recalls saved before the timeline existed */
  information_received_at: string | null
  decision_at: string | null
  timeline: Milestone[] | null
}

export type Recall = RecallPreview & {
  id: number
  /** UTC, without a timezone suffix — parse with parseUtc() */
  created_at: string
}

export type DefectType = {
  defect_type: string
  recall_class: string
  action: string
  meaning: string
}

export type SortField =
  | 'created_at' | '-created_at'
  | 'drug_name' | '-drug_name'
  | 'recall_class' | '-recall_class'
  | 'units_affected' | '-units_affected'

export type RecallQuery = {
  recall_class?: string[]
  defect_type?: string
  q?: string
  /** inclusive UTC date, YYYY-MM-DD */
  date_from?: string
  /** inclusive UTC date, YYYY-MM-DD */
  date_to?: string
  page?: number
  page_size?: number
  sort?: SortField
  status?: 'overdue'
}

export type RecallPage = {
  items: Recall[]
  total: number
  page: number
  page_size: number
}

export type StatsSummary = {
  total_recalls: number
  total_units: number
  overdue: number
  /** UTC, no suffix; null when there are no recalls */
  first_created_at: string | null
  last_created_at: string | null
  by_class: { recall_class: string; count: number; units: number }[]
  by_defect: { defect_type: string; recall_class: string; count: number }[]
}

export type RecallRule = {
  recall_class: string
  stop_sale_hours: number | null
  completion_hours: number
  recall_levels: string[]
  public_announcement: boolean
  source_timelines: string
  source_levels: string
}

export type FieldError = { field: string; message: string }

/** Every API error body has code + message; the rest depends on the code. */
export type ApiErrorBody = {
  code: 'unknown_defect' | 'validation_error' | 'timeline_error' | 'not_found' | 'network_error' | (string & {})
  message: string
  defect_type?: string | null
  known_types?: string[]
  errors?: FieldError[]
}
