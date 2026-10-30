import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  columnGeometry,
  flowKey,
  flowMotion,
  flowPath,
  type FlowInput,
  type FlowRecall,
  layoutFlow,
  MAX_PER_COLUMN,
  MIN_NODE_H,
  moreId,
  nodeLabel,
  relatedIds,
  routeLinks,
  routePath,
  SCALE_H,
} from './flowLayout.ts'

const recall = (id: number, recall_class: string, defect_type: string, units = 1000): FlowRecall => ({
  id, drug_name: `Drug ${id}`, batch_id: `B-${id}`, recall_class, defect_type, units, led: 'pending',
})

const INPUT: FlowInput = {
  total: 5,
  totalUnits: 101000,
  classes: [
    { recall_class: 'Class II', count: 1, units: 25000 },
    { recall_class: 'Class I', count: 3, units: 61000 },
    { recall_class: 'Class III', count: 1, units: 15000 },
  ],
  defects: [
    { defect_type: 'contamination', recall_class: 'Class I', count: 2, units: 51000 },
    { defect_type: 'wrong_drug', recall_class: 'Class I', count: 1, units: 10000 },
    { defect_type: 'mislabeling', recall_class: 'Class II', count: 1, units: 25000 },
    { defect_type: 'packaging_defect', recall_class: 'Class III', count: 1, units: 15000 },
    { defect_type: 'subpotent', recall_class: 'Class II', count: 0, units: 0 },
  ],
  recalls: [recall(1, 'Class I', 'contamination', 50000), recall(2, 'Class I', 'contamination', 1000)],
  recallTotal: 2,
}
const W = 1000
const flow = (input = INPUT, opts = {}) => layoutFlow(input, { width: W, sizeBy: 'recalls', ...opts })
const node = (l: ReturnType<typeof flow>, id: string) => l.nodes.find((n) => n.id === id)!

// --- layout ---------------------------------------------------------------------------------------

test('four columns left to right; classes in risk order; empty defect types left out', () => {
  const l = flow()
  const { colW, gap } = columnGeometry(W)
  assert.deepEqual([0, 1, 2, 3].map((c) => l.nodes.find((n) => n.column === c)!.x), [0, colW + gap, 2 * (colW + gap), 3 * (colW + gap)])
  assert.deepEqual(l.nodes.filter((n) => n.kind === 'class').map((n) => n.label), ['Class I', 'Class II', 'Class III'])
  assert.ok(!l.nodes.some((n) => n.defectType === 'subpotent' && n.kind === 'defect'))
})

test('node heights follow the value, never below the minimum (two lines, ≥ 44 px touch target)', () => {
  const l = flow()
  assert.equal(node(l, 'root').h, SCALE_H)
  assert.equal(node(l, 'class:Class I').h, (3 / 5) * SCALE_H)
  assert.equal(node(l, 'recall:1').h, Math.max(MIN_NODE_H, SCALE_H / 5))
  for (const n of l.nodes) assert.ok(n.h >= MIN_NODE_H)
})

test('link widths add up to the parent and stack down its edge without overlapping', () => {
  const l = flow()
  const fromRoot = l.links.filter((k) => k.source === 'root')
  assert.equal(fromRoot.reduce((s, k) => s + k.width, 0), SCALE_H)
  const ys = fromRoot.map((k) => [k.y1 - k.width / 2, k.y1 + k.width / 2])
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i][0] >= ys[i - 1][1] - 1e-9)
  assert.ok(fromRoot.every((k) => k.tone === 'class'))
  assert.ok(l.links.filter((k) => k.source !== 'root').every((k) => k.tone === 'neutral'))
})

test('size by units changes widths: the 50,000-unit recall gets the wider link', () => {
  const l = flow(INPUT, { sizeBy: 'units' })
  const a = l.links.find((k) => k.target === 'recall:1')!
  const b = l.links.find((k) => k.target === 'recall:2')!
  assert.ok(a.width > b.width * 10)
  assert.equal(node(l, 'class:Class II').value, 25000)
})

test('at most 8 per column, then "+N more"; expanding shows them; a kept recall stays visible', () => {
  const many = Array.from({ length: 12 }, (_, i) => recall(i + 1, 'Class I', 'contamination'))
  const input = { ...INPUT, recalls: many, recallTotal: 12 }
  const l = flow(input)
  const col = l.nodes.filter((n) => n.column === 3)
  assert.equal(col.length, MAX_PER_COLUMN + 1)
  assert.equal(node(l, moreId(3)).label, '+4 more')
  assert.equal(flow(input, { expanded: new Set([3]) }).nodes.filter((n) => n.kind === 'recall').length, 12)
  const kept = flow(input, { keep: 'recall:12' })
  assert.ok(kept.nodes.some((n) => n.id === 'recall:12'))
  assert.equal(node(kept, moreId(3)).hidden, 3)
})

test('recalls not loaded at all point to History', () => {
  const l = flow({ ...INPUT, recallTotal: 60 }, { expanded: new Set([3]) })
  assert.equal(node(l, moreId(3)).toHistory, true)
  assert.equal(node(l, moreId(3)).label, '+58 more in History')
})

test('empty database: nothing to draw', () => {
  const l = flow({ ...INPUT, total: 0, recalls: [], recallTotal: 0 })
  assert.deepEqual([l.nodes.length, l.links.length, l.height], [0, 0, 0])
})

// --- highlight and selection ------------------------------------------------------------------------

test('hover highlights the whole upstream and downstream route only', () => {
  const l = flow()
  const r = relatedIds(l, 'defect:Class I:contamination')
  assert.deepEqual([...r.nodes].sort(), ['class:Class I', 'defect:Class I:contamination', 'recall:1', 'recall:2', 'root'].sort())
  assert.ok(r.links.has('root>class:Class I'))
  assert.ok(!r.links.has('root>class:Class II'))
  assert.ok(!r.nodes.has('defect:Class I:wrong_drug'))
  assert.equal(relatedIds(l, 'root').nodes.size, l.nodes.filter((n) => n.kind !== 'more').length)
})

test('the selected route, its breadcrumb and the path the dots follow', () => {
  const l = flow()
  assert.deepEqual(flowPath(l, 'recall:2').map((n) => n.id), ['root', 'class:Class I', 'defect:Class I:contamination', 'recall:2'])
  assert.deepEqual(routeLinks(l, 'recall:2').map((k) => k.id), [
    'root>class:Class I', 'class:Class I>defect:Class I:contamination', 'defect:Class I:contamination>recall:2',
  ])
  const d = routePath(l, 'recall:2')!
  assert.ok(d.startsWith('M '))
  assert.equal(d.match(/ C /g)?.length, 3)
  assert.equal(routePath(l, 'root'), null)
  assert.deepEqual(flowPath(l, null), [])
})

test('node names for screen readers carry the path and size', () => {
  const l = flow()
  const human = (s: string) => s.replace('_', ' ').replace(/^./, (c) => c.toUpperCase())
  assert.equal(nodeLabel(l, node(l, 'defect:Class I:contamination'), human), 'Class I, Contamination, 2 recalls')
  assert.equal(nodeLabel(l, node(l, 'root'), human), 'All recalls, 5 recalls')
  assert.match(nodeLabel(l, node(l, 'recall:1'), human), /^Class I, Contamination, Drug 1, batch B-1, 50,000 units, open$/)
})

// --- keyboard -------------------------------------------------------------------------------------

test('arrow keys: parent, first child and neighbours; Enter selects; Escape clears', () => {
  const l = flow()
  assert.deepEqual(flowKey(l, 'class:Class I', 'ArrowLeft'), { focus: 'root' })
  assert.deepEqual(flowKey(l, 'root', 'ArrowRight'), { focus: 'class:Class I' })
  assert.deepEqual(flowKey(l, 'class:Class I', 'ArrowDown'), { focus: 'class:Class II' })
  assert.deepEqual(flowKey(l, 'class:Class I', 'ArrowUp'), {})
  assert.deepEqual(flowKey(l, 'class:Class III', 'End'), { focus: 'class:Class III' })
  assert.deepEqual(flowKey(l, 'recall:1', 'ArrowRight'), {})
  assert.deepEqual(flowKey(l, 'root', 'ArrowLeft'), {})
  assert.deepEqual(flowKey(l, 'recall:2', 'Enter'), { select: 'recall:2' })
  assert.deepEqual(flowKey(l, 'recall:2', 'Escape'), { clear: true })
  assert.equal(flowKey(l, 'recall:2', 'x'), null)
  assert.equal(flowKey(l, 'nope', 'Enter'), null)
})

// --- motion ---------------------------------------------------------------------------------------

test('full motion draws column by column within 600 ms and runs 4 dots on the route', () => {
  const m = flowMotion(false)
  assert.equal(m.draw, true)
  assert.deepEqual([0, 1, 2].map(m.delay), [0, 80, 160])
  assert.ok(m.delay(2) + m.duration <= 600)
  assert.equal(m.dots, 4)
  assert.ok(m.dotCycleS >= 5 && m.dotCycleS <= 6)
})

test('reduced motion: lines at once, no draw and no dots', () => {
  const m = flowMotion(true)
  assert.deepEqual([m.draw, m.duration, m.dots, m.delay(2)], [false, 0, 0, 0])
})

test('recalls are grouped under their defect type so links do not cross', () => {
  const input = {
    ...INPUT,
    recalls: [recall(9, 'Class III', 'packaging_defect'), recall(8, 'Class I', 'contamination'), recall(7, 'Class I', 'wrong_drug')],
    recallTotal: 3,
  }
  const order = flow(input).nodes.filter((n) => n.kind === 'recall').map((n) => n.recallId)
  assert.deepEqual(order, [8, 7, 9])
  const links = flow(input).links.filter((l) => l.column === 2).sort((a, b) => a.y1 - b.y1)
  for (let i = 1; i < links.length; i++) assert.ok(links[i].y2 >= links[i - 1].y2)
})
