import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { ClassBadge } from '@/components/ClassBadge'
import { FriendlyError } from '@/components/FriendlyError'
import { PageHeader } from '@/components/PageHeader'
import { RecallResultCard, ResultPlaceholder } from '@/components/RecallResultCard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError } from '@/lib/api'
import { humanizeDefect, toLocalInputValue } from '@/lib/format'
import type { Recall, RecallRule } from '@/lib/types'
import { useSimulation } from '@/lib/useSimulation'

const wholeNumber = (value: string) => /^\d+$/.test(value.replace(/,/g, ''))
// Same allowance for clock differences as the backend.
const notInFuture = (value: string) => new Date(value).getTime() <= Date.now() + 5 * 60_000

const schema = z.object({
  drug_name: z.string().trim().min(1, 'Enter the drug name.').max(200, 'Use 200 characters or fewer.'),
  batch_id: z.string().trim().min(1, 'Enter the batch ID.').max(100, 'Use 100 characters or fewer.'),
  reason: z.string().trim().min(1, 'Describe why this drug is being recalled.').max(1000, 'Use 1000 characters or fewer.'),
  defect_type: z.string().min(1, 'Choose a defect type.'),
  // Kept as text so "50,000" can be typed; converted to a number on submit.
  units_affected: z
    .string()
    .trim()
    .min(1, 'Enter the number of units affected.')
    .refine(wholeNumber, 'Enter a whole number of 0 or more.')
    .refine((v) => Number.isSafeInteger(Number(v.replace(/,/g, ''))), 'That number is too large.'),
  // <input type="datetime-local"> values, in the browser's time zone; sent as ISO (UTC).
  information_received_at: z
    .string()
    .min(1, 'Enter when the information was received.')
    .refine(notInFuture, 'Must not be in the future.'),
  decision_at: z.string(),
}).superRefine((values, ctx) => {
  if (!values.decision_at) return
  if (!notInFuture(values.decision_at)) {
    ctx.addIssue({ code: 'custom', path: ['decision_at'], message: 'Must not be in the future.' })
  } else if (values.information_received_at && values.decision_at < values.information_received_at) {
    ctx.addIssue({ code: 'custom', path: ['decision_at'], message: 'Must not be before the information was received.' })
  }
})

type FormValues = z.infer<typeof schema>

function emptyValues(): FormValues {
  return {
    drug_name: '',
    batch_id: '',
    reason: '',
    defect_type: '',
    units_affected: '',
    information_received_at: toLocalInputValue(new Date()),
    decision_at: '',
  }
}
const FIELD_NAMES = Object.keys(emptyValues())

function deadline(hours: number): string {
  return hours <= 72 ? `${hours} hours` : `${hours / 24} days`
}

function ruleSummary(rule: RecallRule): string {
  const stop = rule.stop_sale_hours ? `stop sale within ${deadline(rule.stop_sale_hours)}, ` : ''
  return `${stop}complete within ${deadline(rule.completion_hours)}`
}

function Field({
  id,
  label,
  error,
  hint,
  optional = false,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: React.ReactNode
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}{' '}
        {optional ? (
          <span className="font-normal text-muted-foreground">(optional)</span>
        ) : (
          <span className="text-red-600" aria-hidden>*</span>
        )}
      </Label>
      {children}
      {hint}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function NewRecallPage() {
  const queryClient = useQueryClient()
  // Saving is paused during a "what if" simulation (TimeTravel), so nothing lands in real data by mistake.
  const sim = useSimulation()
  const defects = useQuery({ queryKey: ['defect-types'], queryFn: api.defectTypes })
  const rules = useQuery({ queryKey: ['recall-rules'], queryFn: api.recallRules })
  const [result, setResult] = useState<Recall | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  // On narrow screens the result sits below the form; bring it into view.
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [result])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(),
  })
  const { register, control, handleSubmit, setError, setValue, formState } = form
  const defectValue = useWatch({ control, name: 'defect_type' })
  const { errors } = formState

  // After a save the button shows "Classified" with a tick for a moment, then returns to normal.
  const [justClassified, setJustClassified] = useState(false)
  useEffect(() => {
    if (!justClassified) return
    const timer = setTimeout(() => setJustClassified(false), 1200)
    return () => clearTimeout(timer)
  }, [justClassified])

  const create = useMutation({
    mutationFn: api.createRecall,
    onSuccess: (recall) => {
      setJustClassified(true)
      setResult(recall)
      form.reset(emptyValues())
      queryClient.invalidateQueries({ queryKey: ['recalls'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'validation_error') {
        // Show the server's per-field messages next to the fields.
        for (const { field, message } of error.body.errors ?? []) {
          if (FIELD_NAMES.includes(field)) setError(field as keyof FormValues, { message })
        }
      }
    },
  })

  const onSubmit = handleSubmit((values) => {
    setResult(null)
    create.mutate({
      ...values,
      drug_name: values.drug_name.trim(),
      batch_id: values.batch_id.trim(),
      reason: values.reason.trim(),
      units_affected: Number(values.units_affected.replace(/,/g, '')),
      information_received_at: new Date(values.information_received_at).toISOString(),
      decision_at: values.decision_at ? new Date(values.decision_at).toISOString() : null,
    })
  })

  const chosen = defects.data?.find((d) => d.defect_type === defectValue)
  const chosenRule = rules.data?.find((r) => r.recall_class === chosen?.recall_class)
  const error = create.error instanceof ApiError ? create.error : null

  function pickDefect(defectType: string) {
    setValue('defect_type', defectType, { shouldValidate: true })
    create.reset()
  }

  return (
    <>
      <PageHeader
        title="New recall"
        description="Enter the recall details to classify it as Class I, II or III."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {error && <FriendlyError error={error} onPickDefect={pickDefect} />}

          <Card className="rounded-2xl p-6">
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="drug_name" label="Drug name" error={errors.drug_name?.message}>
                  <Input
                    id="drug_name"
                    placeholder="e.g. Metformin 500mg"
                    aria-invalid={!!errors.drug_name}
                    aria-describedby={errors.drug_name ? 'drug_name-error' : undefined}
                    {...register('drug_name')}
                  />
                </Field>
                <Field id="batch_id" label="Batch ID" error={errors.batch_id?.message}>
                  <Input
                    id="batch_id"
                    placeholder="e.g. BT-001"
                    aria-invalid={!!errors.batch_id}
                    aria-describedby={errors.batch_id ? 'batch_id-error' : undefined}
                    {...register('batch_id')}
                  />
                </Field>
              </div>

              <Field
                id="defect_type"
                label="Defect type"
                error={errors.defect_type?.message}
                hint={
                  chosen && (
                    <p className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
                      <ClassBadge label={chosen.recall_class} />
                      {chosen.action}
                      {chosenRule && <span>· CDSCO: {ruleSummary(chosenRule)}</span>}
                    </p>
                  )
                }
              >
                <Controller
                  control={control}
                  name="defect_type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v)
                        if (error?.code === 'unknown_defect') create.reset()
                      }}
                      disabled={!defects.data}
                    >
                      <SelectTrigger
                        id="defect_type"
                        className="w-full"
                        aria-invalid={!!errors.defect_type}
                        aria-describedby={errors.defect_type ? 'defect_type-error' : undefined}
                        onBlur={field.onBlur}
                      >
                        <SelectValue
                          placeholder={
                            defects.isPending ? 'Loading defect types…' : 'Select a defect type'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {defects.data?.map((d) => (
                          <SelectItem key={d.defect_type} value={d.defect_type}>
                            {humanizeDefect(d.defect_type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {defects.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {defects.error.message}{' '}
                    <button type="button" className="underline" onClick={() => defects.refetch()}>
                      Try again
                    </button>
                  </p>
                )}
              </Field>

              <Field id="units_affected" label="Units affected" error={errors.units_affected?.message}>
                <Input
                  id="units_affected"
                  inputMode="numeric"
                  placeholder="e.g. 50,000"
                  aria-invalid={!!errors.units_affected}
                  aria-describedby={errors.units_affected ? 'units_affected-error' : undefined}
                  {...register('units_affected')}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="information_received_at"
                  label="Information received"
                  error={errors.information_received_at?.message}
                  hint={<p className="text-xs text-muted-foreground">CDSCO deadlines count from this time (§8.0).</p>}
                >
                  <Input
                    id="information_received_at"
                    type="datetime-local"
                    aria-invalid={!!errors.information_received_at}
                    aria-describedby={errors.information_received_at ? 'information_received_at-error' : undefined}
                    {...register('information_received_at')}
                  />
                </Field>
                <Field
                  id="decision_at"
                  label="Recall decision"
                  optional
                  error={errors.decision_at?.message}
                  hint={<p className="text-xs text-muted-foreground">Can be recorded later on the result card.</p>}
                >
                  <Input
                    id="decision_at"
                    type="datetime-local"
                    aria-invalid={!!errors.decision_at}
                    aria-describedby={errors.decision_at ? 'decision_at-error' : undefined}
                    {...register('decision_at')}
                  />
                </Field>
              </div>

              <Field id="reason" label="Reason for recall" error={errors.reason?.message}>
                <Textarea
                  id="reason"
                  rows={3}
                  placeholder="e.g. Microbial contamination found during testing"
                  aria-invalid={!!errors.reason}
                  aria-describedby={errors.reason ? 'reason-error' : undefined}
                  {...register('reason')}
                />
              </Field>

              <Button type="submit" size="lg" className="w-full" disabled={create.isPending || sim.active}
                aria-busy={create.isPending}
                aria-describedby={sim.active ? 'sim-paused' : undefined}
              >
                {create.isPending ? (
                  // The one allowed loop: it only turns while the request runs (static with reduced motion).
                  <>
                    <Loader2 className="animate-spin" aria-hidden /> Classifying…
                  </>
                ) : justClassified ? (
                  <>
                    <Check aria-hidden /> Classified
                  </>
                ) : (
                  'Classify recall'
                )}
              </Button>
              {sim.active && (
                <p id="sim-paused" className="text-sm text-muted-strong">
                  Saving is paused while the simulation is on. Use “Back to now” above to save this recall.
                </p>
              )}
              <span role="status" className="sr-only">
                {justClassified ? 'Recall classified and saved.' : ''}
              </span>
            </form>
          </Card>
        </div>

        <div ref={resultRef} className="lg:col-span-2">
          {result ? (
            <RecallResultCard recall={result} onUpdated={setResult} onReset={() => setResult(null)} />
          ) : (
            <ResultPlaceholder />
          )}
        </div>
      </div>
    </>
  )
}
