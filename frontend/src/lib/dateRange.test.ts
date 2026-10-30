import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addDays, daysBetween, rangeToSlider, sliderToRange, utcDay } from './dateRange.ts'

const MIN = '2026-08-03'
const MAX = '2026-10-01' // 59 days later

test('utcDay keeps the date part of an API timestamp', () => {
  assert.equal(utcDay('2026-10-30T06:50:00.123'), '2026-10-30')
})

test('day arithmetic crosses months and leap days', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01')
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  assert.equal(daysBetween(MIN, MAX), 59)
  assert.equal(daysBetween(MAX, MAX), 0)
})

test('no filter puts the thumbs at both ends', () => {
  assert.deepEqual(rangeToSlider(MIN, MAX, '', ''), [0, 59])
})

test('filters outside the data are clamped, reversed ones are swapped', () => {
  assert.deepEqual(rangeToSlider(MIN, MAX, '2026-01-01', '2027-01-01'), [0, 59])
  assert.deepEqual(rangeToSlider(MIN, MAX, '2026-09-10', '2026-09-01'), [29, 38])
})

test('thumbs at the ends mean no limit', () => {
  assert.deepEqual(sliderToRange(MIN, MAX, [0, 59]), { from: null, to: null })
  assert.deepEqual(sliderToRange(MIN, MAX, [29, 59]), { from: '2026-09-01', to: null })
  assert.deepEqual(sliderToRange(MIN, MAX, [0, 29]), { from: null, to: '2026-09-01' })
})

test('slider and filter round-trip', () => {
  const range = sliderToRange(MIN, MAX, [10, 40])
  assert.deepEqual(range, { from: '2026-08-13', to: '2026-09-12' })
  assert.deepEqual(rangeToSlider(MIN, MAX, range.from ?? '', range.to ?? ''), [10, 40])
})
