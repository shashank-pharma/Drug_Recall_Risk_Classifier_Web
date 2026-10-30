import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fitLabel } from './chartText.ts'
import { computeDelta, formatChange } from './delta.ts'
import { circumference, donutSegments, largestIndex, pointOnRing } from './donut.ts'

// --- delta ----------------------------------------------------------------------------------------

test('a rise in recalls is bad (red) even though the arrow points up', () => {
  assert.deepEqual(computeDelta(13, 10, 'bad'), { change: 3, percent: 30, direction: 'up', tone: 'bad' })
})

test('a fall in recalls is good', () => {
  assert.deepEqual(computeDelta(8, 10, 'bad'), { change: -2, percent: -20, direction: 'down', tone: 'good' })
})

test('when higher is better the colours swap', () => {
  assert.equal(computeDelta(12, 10, 'good')?.tone, 'good')
  assert.equal(computeDelta(8, 10, 'good')?.tone, 'bad')
})

test('no change is neutral', () => {
  assert.deepEqual(computeDelta(5, 5, 'bad'), { change: 0, percent: 0, direction: 'flat', tone: 'neutral' })
})

test('no badge without earlier data to compare with', () => {
  assert.equal(computeDelta(4, 0, 'bad'), null)
  assert.equal(computeDelta(0, 0, 'bad'), null)
})

test('change text uses a plus or a true minus sign', () => {
  assert.equal(formatChange(3), '+3')
  assert.equal(formatChange(-2), '−2')
  assert.equal(formatChange(0), '0')
  assert.equal(formatChange(150000, (n) => n.toLocaleString('en-IN')), '+1,50,000')
})

// --- donut ----------------------------------------------------------------------------------------

const R = 50
const C = circumference(R)

test('segments share the circle by value, with gaps between neighbours', () => {
  const s = donutSegments([2, 1, 1], R, 2)
  assert.deepEqual(s.map((x) => x.fraction), [0.5, 0.25, 0.25])
  assert.ok(Math.abs(s[0].length - (C / 2 - 2)) < 1e-9)
  assert.equal(s[0].offset, 0)
  assert.ok(Math.abs(s[1].offset - C / 2) < 1e-9)
  assert.ok(Math.abs(s[2].offset - (C * 3) / 4) < 1e-9)
})

test('mid angles are measured clockwise from 12 o’clock', () => {
  const [a, b, c] = donutSegments([2, 1, 1], R)
  assert.ok(Math.abs(a.midAngle - 90) < 1e-9)
  assert.ok(Math.abs(b.midAngle - 225) < 1e-9)
  assert.ok(Math.abs(c.midAngle - 315) < 1e-9)
})

test('zero values draw nothing and a single value needs no gap', () => {
  const s = donutSegments([0, 5, 0], R, 2)
  assert.deepEqual(s.map((x) => x.length > 0), [false, true, false])
  assert.ok(Math.abs(s[1].length - C) < 1e-9)
  assert.deepEqual(donutSegments([0, 0], R).map((x) => x.fraction), [0, 0])
})

test('pointOnRing: 0° is the top, 90° is the right', () => {
  const top = pointOnRing(100, 100, 50, 0)
  const right = pointOnRing(100, 100, 50, 90)
  assert.ok(Math.abs(top.x - 100) < 1e-9 && Math.abs(top.y - 50) < 1e-9)
  assert.ok(Math.abs(right.x - 150) < 1e-9 && Math.abs(right.y - 100) < 1e-9)
})

test('largestIndex picks the biggest value, first on ties, -1 when empty', () => {
  assert.equal(largestIndex([1, 3, 3]), 1)
  assert.equal(largestIndex([0, 0]), -1)
})

// --- labels ---------------------------------------------------------------------------------------

test('labels that fit stay on one line', () => {
  assert.deepEqual(fitLabel('Wrong drug', 120), ['Wrong drug'])
})

test('long labels split into words, and words too long for the column are cut', () => {
  assert.deepEqual(fitLabel('Packaging defect', 80), ['Packaging', 'defect'])
  // 58px column: (58 - 12) / 6.4 → 7 characters per line
  assert.deepEqual(fitLabel('Packaging defect', 58), ['Packag\u2026', 'defect'])
  assert.deepEqual(fitLabel('Contamination', 58), ['Contam\u2026'])
})
