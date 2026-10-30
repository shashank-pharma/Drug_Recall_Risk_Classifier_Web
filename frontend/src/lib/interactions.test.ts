import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearLinked, describeLinked, hasLinked, historyHref, readLinkedFilter, toggleLinked } from './linkedFilter.ts'
import { ringDash, ringText } from './ring.ts'
import { clampHours, formatOffset, MAX_HOURS, simulatedAt } from './simulation.ts'
import { milestoneTone, recallLed } from './statusLed.ts'

// --- linked filter --------------------------------------------------------------------------------

test('clicking a chart item sets the filter, clicking it again clears it', () => {
  const start = new URLSearchParams('defect=contamination')
  const on = toggleLinked(start, 'recallClass', 'Class I')
  assert.equal(on.toString(), 'defect=contamination&class=Class+I')
  const off = toggleLinked(on, 'recallClass', 'Class I')
  assert.equal(off.toString(), 'defect=contamination')
  // A different value replaces the old one; null clears.
  assert.equal(toggleLinked(on, 'recallClass', 'Class II').get('class'), 'Class II')
  assert.equal(toggleLinked(on, 'recallClass', null).get('class'), null)
  // The input is not changed.
  assert.equal(start.toString(), 'defect=contamination')
})

test('unknown classes in the URL are ignored', () => {
  assert.deepEqual(readLinkedFilter(new URLSearchParams('class=Class+IV&defect=')), { recallClass: null, defect: null })
  assert.deepEqual(readLinkedFilter(new URLSearchParams('class=Class+III&defect=mislabeling')), {
    recallClass: 'Class III',
    defect: 'mislabeling',
  })
})

test('clear, describe and the History link keep the same filters', () => {
  const f = { recallClass: 'Class I', defect: 'wrong_drug' }
  assert.equal(clearLinked(new URLSearchParams('class=Class+I&defect=x&days=7')).toString(), 'days=7')
  assert.equal(hasLinked(f), true)
  assert.equal(hasLinked({ recallClass: null, defect: null }), false)
  assert.equal(describeLinked(f, (d) => d.replace('_', ' ')), 'Class I and wrong drug')
  assert.equal(historyHref(f), '/history?class=Class+I&defect=wrong_drug')
  assert.equal(historyHref({ recallClass: null, defect: null }, { status: 'overdue' }), '/history?status=overdue')
  assert.equal(historyHref({ recallClass: null, defect: null }), '/history')
})

// --- simulation -----------------------------------------------------------------------------------

test('simulation hours stay between now and 72 h', () => {
  assert.equal(clampHours(-5), 0)
  assert.equal(clampHours(100), MAX_HOURS)
  assert.equal(clampHours(23.6), 24)
  assert.equal(clampHours(Number.NaN), 0)
})

test('"now" sends no time; later sends an ISO time', () => {
  const now = new Date('2026-10-30T10:00:00Z')
  assert.equal(simulatedAt(0, now), undefined)
  assert.equal(simulatedAt(24, now), '2026-10-31T10:00:00.000Z')
  assert.equal(simulatedAt(500, now), '2026-11-02T10:00:00.000Z')
})

test('offset labels', () => {
  assert.equal(formatOffset(0), 'Now')
  assert.equal(formatOffset(1), '+1 hour')
  assert.equal(formatOffset(23), '+23 hours')
  assert.equal(formatOffset(24), '+1 day')
  assert.equal(formatOffset(52), '+2 days 4 h')
})

// --- countdown ring -------------------------------------------------------------------------------

test('ring dash offset follows the share of time used', () => {
  const r = 10
  const c = 2 * Math.PI * r
  assert.equal(ringDash(0, r).dashOffset, c)
  assert.ok(Math.abs(ringDash(0.25, r).dashOffset - c * 0.75) < 1e-9)
  assert.equal(ringDash(1, r).dashOffset, 0)
  assert.equal(ringDash(3, r).dashOffset, 0)
  assert.equal(ringDash(Number.NaN, r).dashOffset, c)
})

test('ring text is short, with a minus sign when overdue', () => {
  assert.equal(ringText(30 * 60_000), '30m')
  assert.equal(ringText(10_000), '1m')
  assert.equal(ringText(22 * 3_600_000), '22h')
  assert.equal(ringText(5 * 86_400_000), '5d')
  assert.equal(ringText(-3 * 86_400_000), '−3d')
})

// --- status lights --------------------------------------------------------------------------------

test('each milestone status maps to one light', () => {
  assert.equal(milestoneTone('done'), 'done')
  assert.equal(milestoneTone('done_late'), 'done')
  assert.equal(milestoneTone('overdue'), 'overdue')
  assert.equal(milestoneTone('due_soon'), 'pending')
  assert.equal(milestoneTone('on_track'), 'pending')
  assert.equal(milestoneTone('waiting'), 'pending')
  assert.equal(milestoneTone('not_specified'), 'none')
})

test('a recall is overdue if any milestone is, done when all deadlines are met', () => {
  assert.deepEqual(recallLed(['done', 'overdue', 'on_track']), { tone: 'overdue', text: 'Overdue' })
  assert.deepEqual(recallLed(['done', 'done_late', 'not_specified']), { tone: 'done', text: 'Done' })
  assert.deepEqual(recallLed(['done', 'waiting']), { tone: 'pending', text: 'Open' })
  assert.deepEqual(recallLed(null), { tone: 'none', text: 'No timeline' })
})
