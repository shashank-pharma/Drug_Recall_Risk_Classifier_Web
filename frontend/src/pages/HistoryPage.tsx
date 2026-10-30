import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlarmClock, ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ClassBadge } from '@/components/ClassBadge'
import { DateRangeSlider } from '@/components/DateRangeSlider'
import { RecallDetailSheet } from '@/components/RecallDetailSheet'
import { LoadingRegion, Skeleton } from '@/components/Skeleton'
import { StatusPill } from '@/components/RecallTimeline'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { utcDay } from '@/lib/dateRange'
import { formatDateTime, formatUnits, humanizeDefect } from '@/lib/format'
import { classStyle, RECALL_CLASSES } from '@/lib/recallClass'
import type { Recall, RecallQuery, SortField } from '@/lib/types'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10
const ALL = 'all' // Radix Select can't use an empty string as a value

const SORT_FIELDS = ['created_at', 'drug_name', 'recall_class', 'units_affected'] as const
type SortKey = (typeof SORT_FIELDS)[number]

const COLUMNS: { label: string; sort?: SortKey; className?: string }[] = [
  { label: 'Date', sort: 'created_at' },
  { label: 'Drug', sort: 'drug_name' },
  { label: 'Batch' },
  { label: 'Defect type' },
  { label: 'Class', sort: 'recall_class' },
  { label: 'Action' },
  { label: 'CDSCO status' },
  { label: 'Units', sort: 'units_affected', className: 'text-right' },
]

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** One status for the row: overdue if any milestone is, done when every deadline is met. */
function TimelineStatus({ recall }: { recall: Recall }) {
  const timeline = recall.timeline
  if (!timeline) return <span className="text-muted-foreground">—</span>
  if (timeline.some((m) => m.status === 'overdue')) return <StatusPill status="overdue" />
  const closed = timeline.every((m) => ['done', 'done_late', 'not_specified'].includes(m.status))
  if (closed) return <StatusPill status="done" />
  return <span className="text-muted-foreground">Open</span>
}

function parseSort(raw: string | null): SortField {
  const key = raw?.replace(/^-/, '')
  return SORT_FIELDS.includes(key as SortKey) ? (raw as SortField) : '-created_at'
}

export function HistoryPage() {
  const [params, setParams] = useSearchParams()

  // Filters live in the URL so a refresh or a shared link keeps them.
  const classes = params.getAll('class').filter((c) => (RECALL_CLASSES as readonly string[]).includes(c))
  const defect = params.get('defect') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const q = params.get('q') ?? ''
  const sort = parseSort(params.get('sort'))
  const page = Math.max(1, Number(params.get('page')) || 1)
  const overdueOnly = params.get('status') === 'overdue'
  const openRecallId = Number(params.get('recall')) || null

  // The detail panel is part of the URL: a link opens it, Back closes it.
  function openRecall(id: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('recall', String(id))
      return next
    })
  }
  function closeRecall() {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('recall')
        return next
      },
      { replace: true },
    )
  }

  /** Change filters; any change except paging goes back to page 1. */
  function update(changes: Record<string, string | string[] | null>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          next.delete(key)
          if (Array.isArray(value)) value.forEach((v) => next.append(key, v))
          else if (value) next.set(key, value)
        }
        if (!('page' in changes)) next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  const [search, setSearch] = useState(q)
  const debouncedSearch = useDebounced(search)
  useEffect(() => {
    if (debouncedSearch.trim() !== q) update({ q: debouncedSearch.trim() || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the typed text
  }, [debouncedSearch])

  const query: RecallQuery = {
    recall_class: classes,
    defect_type: defect || undefined,
    q: q || undefined,
    date_from: from || undefined,
    date_to: to || undefined,
    sort,
    page,
    page_size: PAGE_SIZE,
    status: overdueOnly ? 'overdue' : undefined,
  }
  const defects = useQuery({ queryKey: ['defect-types'], queryFn: api.defectTypes })
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.statsSummary })
  const firstDay = stats.data?.first_created_at ? utcDay(stats.data.first_created_at) : null
  const lastDay = stats.data?.last_created_at ? utcDay(stats.data.last_created_at) : null
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['recalls', query],
    queryFn: () => api.listRecalls(query),
    placeholderData: keepPreviousData,
  })

  // Rows fade in on the first load only; paging and filtering swap them without motion.
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (!data || entered) return
    const timer = setTimeout(() => setEntered(true), 500)
    return () => clearTimeout(timer)
  }, [data, entered])

  const hasFilters = classes.length > 0 || !!defect || !!from || !!to || !!q || !!search || overdueOnly
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const dateOrderWrong = !!from && !!to && from > to

  function toggleClass(label: string) {
    update({ class: classes.includes(label) ? classes.filter((c) => c !== label) : [...classes, label] })
  }

  function clearFilters() {
    setSearch('')
    setParams({}, { replace: true })
  }

  function toggleSort(key: SortKey) {
    // First click: sensible default (newest / A→Z / biggest first); second click flips it.
    const defaultDesc = key === 'created_at' || key === 'units_affected'
    const current = sort.replace(/^-/, '')
    const nextDesc = current === key ? !sort.startsWith('-') : defaultDesc
    update({ sort: `${nextDesc ? '-' : ''}${key}` })
  }

  return (
    <>
      <PageHeader title="History" description="Every recall that has been classified and saved." />

      <Card className="mb-4 rounded-2xl p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="search"
                className="pl-9"
                placeholder="Drug name or batch ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="defect">Defect type</Label>
            <Select value={defect || ALL} onValueChange={(v) => update({ defect: v === ALL ? null : v })}>
              <SelectTrigger id="defect" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All defect types</SelectItem>
                {defects.data?.map((d) => (
                  <SelectItem key={d.defect_type} value={d.defect_type}>
                    {humanizeDefect(d.defect_type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <span id="class-label" className="text-sm leading-none font-medium">
              Class
            </span>
            <div role="group" aria-labelledby="class-label" className="flex gap-1.5">
              {RECALL_CLASSES.map((label) => {
                const on = classes.includes(label)
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleClass(label)}
                    className={cn(
                      'h-9 flex-1 rounded-md border px-2 text-sm font-medium transition-colors',
                      on ? classStyle(label).badge + ' border-transparent' : 'bg-card hover:bg-muted',
                    )}
                  >
                    {label.replace('Class ', '')}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="from">From date (UTC)</Label>
            <Input id="from" type="date" value={from} max={to || undefined} onChange={(e) => update({ from: e.target.value || null })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To date (UTC)</Label>
            <Input id="to" type="date" value={to} min={from || undefined} onChange={(e) => update({ to: e.target.value || null })} />
          </div>

          <div className="flex flex-wrap items-end gap-2 md:col-span-2">
            <Button
              variant="outline"
              aria-pressed={overdueOnly}
              onClick={() => update({ status: overdueOnly ? null : 'overdue' })}
              className={cn(overdueOnly && 'border-transparent bg-red-600 text-white hover:bg-red-700 hover:text-white')}
            >
              <AlarmClock aria-hidden /> Overdue only
            </Button>
            <Button variant="ghost" onClick={clearFilters} disabled={!hasFilters}>
              <X aria-hidden /> Clear filters
            </Button>
          </div>
        </div>
        {firstDay && lastDay && (
          <div className="mt-4 border-t pt-4">
            <span className="text-sm leading-none font-medium">Saved between</span>
            <div className="mt-2 max-w-xl">
              <DateRangeSlider
                min={firstDay}
                max={lastDay}
                from={from}
                to={to}
                onCommit={(range) => update({ from: range.from, to: range.to })}
              />
            </div>
          </div>
        )}
        {dateOrderWrong && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            The "From" date is after the "To" date, so no recalls can match.
          </p>
        )}
      </Card>

      <Card className="gap-0 overflow-hidden rounded-2xl p-0">
        {error ? (
          <div role="alert" className="p-8 text-center text-sm">
            <p className="text-destructive">{error.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : isPending ? (
          <LoadingRegion label="Loading recalls…">
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUMNS.map(({ label, className }) => (
                    <TableHead key={label} className={className}>
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    {COLUMNS.map(({ label }) => (
                      <TableCell key={label}>
                        <Skeleton className="h-4 w-full max-w-28" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </LoadingRegion>
        ) : data.items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium">
              {hasFilters ? 'No recalls match these filters' : 'No recalls saved yet'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters ? (
                'Try removing a filter or searching for something else.'
              ) : (
                <>
                  <Link to="/" className="underline underline-offset-4">
                    Enter the first recall
                  </Link>{' '}
                  to see it here.
                </>
              )}
            </p>
          </div>
        ) : (
          <Table className={cn(isFetching && 'opacity-60 transition-opacity')}>
            <TableHeader>
              <TableRow>
                {COLUMNS.map(({ label, sort: key, className }) => {
                  const active = key && sort.replace(/^-/, '') === key
                  const Icon = !active ? ArrowUpDown : sort.startsWith('-') ? ArrowDown : ArrowUp
                  return (
                    <TableHead
                      key={label}
                      className={className}
                      aria-sort={active ? (sort.startsWith('-') ? 'descending' : 'ascending') : undefined}
                    >
                      {key ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')}
                        >
                          {label}
                          <Icon className={cn('size-3.5', !active && 'opacity-40')} aria-hidden />
                        </button>
                      ) : (
                        label
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((r, i) => (
                <TableRow
                  key={r.id}
                  // Mouse users can click anywhere on the row; keyboard users use the drug name button.
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest('a, button')) openRecall(r.id)
                  }}
                  data-state={openRecallId === r.id ? 'selected' : undefined}
                  className={cn('cursor-pointer', !entered && 'enter-fade')}
                  style={entered ? undefined : ({ '--stagger': Math.min(i, 5) } as React.CSSProperties)}
                >
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</TableCell>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      id={`recall-button-${r.id}`}
                      aria-haspopup="dialog"
                      onClick={() => openRecall(r.id)}
                      className="rounded-sm text-left underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {r.drug_name}
                    </button>
                  </TableCell>
                  <TableCell>{r.batch_id}</TableCell>
                  <TableCell>{humanizeDefect(r.defect_type)}</TableCell>
                  <TableCell>
                    <ClassBadge label={r.recall_class} />
                  </TableCell>
                  <TableCell>{r.action}</TableCell>
                  <TableCell>
                    <TimelineStatus recall={r} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatUnits(r.units_affected)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
            <p className="text-muted-foreground" role="status">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => update({ page: String(page + 1) })}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <RecallDetailSheet
        recallId={openRecallId}
        onClose={closeRecall}
        onAfterClose={(id) => document.getElementById(`recall-button-${id}`)?.focus()}
      />
    </>
  )
}
