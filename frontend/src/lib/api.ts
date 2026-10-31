import type {
  ApiErrorBody,
  DefectType,
  MarkableMilestone,
  Recall,
  RecallInput,
  RecallPage,
  RecallPreview,
  RecallQuery,
  RecallRule,
  SampleDataStatus,
  StatsFilter,
  StatsSummary,
  Trend,
  TrendDays,
} from './types'

export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }

  get code() {
    return this.body.code
  }
}

const UNREACHABLE = 'Could not reach the server. Is the backend running?'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, { code: 'network_error', message: UNREACHABLE })
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    // The dev proxy answers 502 when the backend is down; treat gateway errors like a dropped connection.
    if (!body?.code && [502, 503, 504].includes(res.status)) {
      throw new ApiError(res.status, { code: 'network_error', message: UNREACHABLE })
    }
    throw new ApiError(
      res.status,
      body?.code ? body : { code: 'http_error', message: `Request failed (${res.status}).` },
    )
  }
  return body as T
}

function toSearchParams(query: Record<string, string | number | string[] | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v))
    else params.set(key, String(value))
  }
  return params.toString()
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })
const patch = (body: unknown): RequestInit => ({ method: 'PATCH', body: JSON.stringify(body) })

export const api = {
  health: () => request<{ status: string }>('/health'),
  /** Public demo mode (server started with RECALL_DEMO_SEED=1). */
  demo: () => request<{ enabled: boolean; max_recalls: number }>('/demo'),
  defectTypes: () => request<DefectType[]>('/defect-types'),
  previewRecall: (data: RecallInput) => request<RecallPreview>('/recalls/preview', post(data)),
  createRecall: (data: RecallInput) => request<Recall>('/recalls', post(data)),
  listRecalls: (query: RecallQuery = {}) => request<RecallPage>(`/recalls?${toSearchParams(query)}`),
  /** `at`: simulation time (ISO), see SimulationProvider. */
  getRecall: (id: number, at?: string) => request<Recall>(`/recalls/${id}?${toSearchParams({ at })}`),
  /** Record (ISO time) or clear (null) the recall decision. */
  setDecision: (id: number, decision_at: string | null) => request<Recall>(`/recalls/${id}`, patch({ decision_at })),
  /** Mark a milestone done (default: now) or not done. */
  setMilestone: (id: number, key: MarkableMilestone, done: boolean, done_at?: string) =>
    request<Recall>(`/recalls/${id}/milestones/${key}`, patch({ done, done_at })),
  recallRules: () => request<RecallRule[]>('/recall-rules'),
  sampleDataStatus: () => request<SampleDataStatus>('/sample-data'),
  loadSampleData: () => request<{ created: number }>('/sample-data', { method: 'POST' }),
  statsSummary: (filter: StatsFilter & { at?: string } = {}) =>
    request<StatsSummary>(`/stats/summary?${toSearchParams(filter)}`),
  statsTrend: (days: TrendDays, filter: StatsFilter = {}) =>
    request<Trend>(`/stats/trend?${toSearchParams({ days, ...filter })}`),
}
