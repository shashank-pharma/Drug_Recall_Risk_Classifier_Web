import assert from 'node:assert/strict'
import { test } from 'node:test'
import { milestoneProgress } from './progress.ts'

// API times are UTC without a "Z".
const START = '2026-10-28T06:00:00'
const DUE_24H = '2026-10-29T06:00:00'
const at = (iso: string) => new Date(`${iso}Z`)

test('no bar without both a start and a deadline', () => {
  assert.equal(milestoneProgress({ starts_at: null, due_at: DUE_24H, done_at: null }, at(START)), null)
  assert.equal(milestoneProgress({ starts_at: START, due_at: null, done_at: null }, at(START)), null)
})

test('fraction and time left part way through', () => {
  const p = milestoneProgress({ starts_at: START, due_at: DUE_24H, done_at: null }, at('2026-10-28T12:00:00'))
  assert.ok(p)
  assert.equal(p.fraction, 0.25)
  assert.equal(p.label, '18 h left')
  assert.equal(p.remainingMs, 18 * 3_600_000)
})

test('past the deadline the bar is full and says overdue', () => {
  const p = milestoneProgress({ starts_at: START, due_at: DUE_24H, done_at: null }, at('2026-10-29T09:00:00'))
  assert.ok(p)
  assert.equal(p.fraction, 1)
  assert.equal(p.label, '3 h overdue')
  assert.ok(p.remainingMs < 0)
})

test('long windows switch to days, short ones to minutes', () => {
  const days = milestoneProgress(
    { starts_at: START, due_at: '2026-11-07T06:00:00', done_at: null },
    at(START),
  )
  assert.equal(days?.label, '10 days left')
  const minutes = milestoneProgress({ starts_at: START, due_at: DUE_24H, done_at: null }, at('2026-10-29T05:40:00'))
  assert.equal(minutes?.label, '20 min left')
})

test('a done milestone is full and says Done', () => {
  const p = milestoneProgress(
    { starts_at: START, due_at: DUE_24H, done_at: '2026-10-28T10:00:00' },
    at('2026-11-30T00:00:00'),
  )
  assert.deepEqual(p, { fraction: 1, remainingMs: 0, label: 'Done' })
})

test('a clock that has not started yet shows an empty bar', () => {
  const p = milestoneProgress({ starts_at: START, due_at: DUE_24H, done_at: null }, at('2026-10-27T06:00:00'))
  assert.equal(p?.fraction, 0)
})
