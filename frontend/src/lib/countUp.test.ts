import assert from 'node:assert/strict'
import { test } from 'node:test'
import { countUpValue, easeOutCubic } from './countUp.ts'

test('easeOutCubic starts at 0, ends at 1 and is clamped', () => {
  assert.equal(easeOutCubic(0), 0)
  assert.equal(easeOutCubic(1), 1)
  assert.equal(easeOutCubic(-1), 0)
  assert.equal(easeOutCubic(2), 1)
  assert.ok(easeOutCubic(0.5) > 0.5, 'ease-out is ahead of linear at the midpoint')
})

test('countUpValue reaches the exact target when the time is up', () => {
  assert.equal(countUpValue(27, 0, 500), 0)
  assert.equal(countUpValue(27, 500, 500), 27)
  assert.equal(countUpValue(27, 900, 500), 27)
})

test('countUpValue gives whole numbers that never go past the target', () => {
  for (let t = 0; t <= 500; t += 25) {
    const v = countUpValue(962_500, t, 500)
    assert.ok(Number.isInteger(v))
    assert.ok(v <= 962_500)
  }
})

test('a zero duration jumps straight to the target', () => {
  assert.equal(countUpValue(13, 0, 0), 13)
})
