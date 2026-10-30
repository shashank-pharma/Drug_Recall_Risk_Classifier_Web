import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  columnGeometry,
  flowKey,
  flowMotion,
  flowPath,
  type FlowInput,
  type FlowLayout,
  type FlowRecall,
  layoutFlow,
  MAX_PER_COLUMN,
  MIN_GAP,
  moreId,
  NODE_H,
  nodeLabel,
  relatedIds,
  routeLinks,
  ROW,
} from './flowLayout.ts'

const recall = (id: number, recall_class: string, defect_type: string, units = 1000): FlowRecall => ({
  id, drug_name: `Drug ${id}`, batch_id: `B-${id}`, recall_class, defect_type, units, led: 'pending',
})

// Newest first, as the API returns them; deliberately mixed classes.
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
  recalls: [
    recall(5, 'Class III', 'packaging_defect', 15000),
    recall(4, 'Class I', 'contamination', 50000),
    recall(3, 'Class II', 'mislabeling', 25000),
    recall(2, 'Class I', 'wrong_drug', 10000),
    recall(1, 'Class I', 'contamination', 1000),
  ],
  recallTotal: 5,
}
const W = 1100
const flow = (input = INPUT, opts = {}) => layoutFlow(input, { width: W, sizeBy: 'recalls', ...opts })
const node = (l: FlowLayout, id: string) => l.nodes.find((n) => n.id === id)!
const mid = (l: FlowLayout, id: string) => node(l, id).y + node(l, id).h / 2

// --- positions --------------------------------------------------------------------------------------

test('four columns left to right; every card has its column’s fixed size', () => {
  const l = flow()
  const { colW, gap } = columnGeometry(W)
  for (const n of l.nodes) {
    assert.equal(n.x, n.column * (colW + gap))
    assert.equal(n.w, colW)
    assert.equal(n.h, NODE_H[n.column])
  }
  assert.ok(!l.nodes.some((n) => n.defectType === 'subpotent' && n.kind === 'defect'))
})

test('size by recalls or units changes the numbers, never the card sizes or positions', () => {
  const a = flow()
  const b = flow(INPUT, { sizeBy: 'units' })
  assert.deepEqual(a.nodes.map((n) => [n.id, n.x, n.y, n.h]), b.nodes.map((n) => [n.id, n.x, n.y, n.h]))
  assert.equal(node(b, 'class:Class II').value, 25000)
  assert.equal(node(a, 'class:Class II').value, 1)
})

test('recalls are sorted class → defect type → newest and sit one row apart', () => {
  const l = flow()
  const rows = l.nodes.filter((n) => n.kind === 'recall')
  assert.deepEqual(rows.map((n) => n.recallId), [4, 1, 2, 3, 5])
  for (let i = 1; i < rows.length; i++) {
    const step = rows[i].y - rows[i - 1].y
    assert.ok(step >= 62 && step <= 72, `row step ${step}`)
  }
  assert.equal(ROW, 68)
})

test('each parent sits in the vertical middle of its children; the root in the middle of the classes', () => {
  const l = flow()
  assert.equal(mid(l, 'defect:Class I:contamination'), (mid(l, 'recall:4') + mid(l, 'recall:1')) / 2)
  assert.equal(mid(l, 'class:Class I'), (mid(l, 'defect:Class I:contamination') + mid(l, 'defect:Class I:wrong_drug')) / 2)
  assert.equal(mid(l, 'root'), (mid(l, 'class:Class I') + mid(l, 'class:Class III')) / 2)
  // A single child lines up straight across.
  assert.equal(mid(l, 'class:Class III'), mid(l, 'recall:5'))
})

test('no two cards overlap within a column', () => {
  for (const l of [flow(), flow({ ...INPUT, recalls: [], recallTotal: 0 })]) {
    for (const c of [0, 1, 2, 3]) {
      const col = l.nodes.filter((n) => n.column === c).sort((a, b) => a.y - b.y)
      for (let i = 1; i < col.length; i++) assert.ok(col[i].y >= col[i - 1].y + col[i - 1].h + MIN_GAP - 1e-9)
    }
  }
})

test('links start and end at the vertical centre of the card edges, and never cross', () => {
  const l = flow()
  for (const k of l.links) {
    const s = node(l, k.source)
    const t = node(l, k.target)
    assert.deepEqual([k.x1, k.y1, k.x2, k.y2], [s.x + s.w, s.y + s.h / 2, t.x, t.y + t.h / 2])
  }
  const last = l.links.filter((k) => k.column === 2).sort((a, b) => a.y1 - b.y1 || a.y2 - b.y2)
  for (let i = 1; i < last.length; i++) assert.ok(last[i].y2 >= last[i - 1].y2)
})

test('a narrowed recall column: defect types without shown recalls get their own row', () => {
  const l = flow({ ...INPUT, recalls: [recall(4, 'Class I', 'contamination'), recall(1, 'Class I', 'contamination')], recallTotal: 2 })
  assert.equal(l.nodes.filter((n) => n.kind === 'recall').length, 2)
  const defects = l.nodes.filter((n) => n.kind === 'defect').sort((a, b) => a.y - b.y)
  for (let i = 1; i < defects.length; i++) assert.ok(defects[i].y - defects[i - 1].y >= NODE_H[2] + MIN_GAP)
})

test('at most 8 per column, then "+N more"; expanding shows them; a kept recall stays visible', () => {
  const many = Array.from({ length: 12 }, (_, i) => recall(12 - i, 'Class I', 'contamination'))
  const input = { ...INPUT, recalls: many, recallTotal: 12 }
  const l = flow(input)
  assert.equal(l.nodes.filter((n) => n.kind === 'recall').length, MAX_PER_COLUMN)
  assert.equal(node(l, moreId(3)).label, '+4 more')
  assert.ok(node(l, moreId(3)).y > Math.max(...l.nodes.filter((n) => n.kind === 'recall').map((n) => n.y)))
  assert.equal(flow(input, { expanded: new Set([3]) }).nodes.filter((n) => n.kind === 'recall').length, 12)
  const kept = flow(input, { keep: 'recall:1' })
  assert.ok(kept.nodes.some((n) => n.id === 'recall:1'))
  assert.equal(node(kept, moreId(3)).hidden, 3)
})

test('recalls that were never loaded point to History', () => {
  const l = flow({ ...INPUT, recallTotal: 60 }, { expanded: new Set([3]) })
  assert.equal(node(l, moreId(3)).toHistory, true)
  assert.equal(node(l, moreId(3)).label, '+55 more in History')
})

test('empty database: nothing to draw', () => {
  const l = flow({ ...INPUT, total: 0, recalls: [], recallTotal: 0 })
  assert.deepEqual([l.nodes.length, l.links.length, l.height], [0, 0, 0])
})

// --- highlight and selection ------------------------------------------------------------------------

test('hover and selection highlight the whole upstream and downstream route only', () => {
  const l = flow()
  const r = relatedIds(l, 'defect:Class I:contamination')
  assert.deepEqual([...r.nodes].sort(), ['class:Class I', 'defect:Class I:contamination', 'recall:1', 'recall:4', 'root'].sort())
  assert.ok(r.links.has('root>class:Class I'))
  assert.ok(!r.links.has('root>class:Class II'))
  assert.equal(relatedIds(l, 'root').nodes.size, l.nodes.filter((n) => n.kind !== 'more').length)
})

test('the selected route and its breadcrumb', () => {
  const l = flow()
  assert.deepEqual(flowPath(l, 'recall:1').map((n) => n.id), ['root', 'class:Class I', 'defect:Class I:contamination', 'recall:1'])
  assert.deepEqual(routeLinks(l, 'recall:1').map((k) => k.id), [
    'root>class:Class I', 'class:Class I>defect:Class I:contamination', 'defect:Class I:contamination>recall:1',
  ])
  assert.deepEqual(routeLinks(l, 'root'), [])
  assert.deepEqual(flowPath(l, null), [])
})

test('node names for screen readers carry the path and size', () => {
  const l = flow()
  const human = (s: string) => s.replace('_', ' ').replace(/^./, (c) => c.toUpperCase())
  assert.equal(nodeLabel(l, node(l, 'defect:Class I:contamination'), human), 'Class I, Contamination, 2 recalls')
  assert.equal(nodeLabel(l, node(l, 'root'), human), 'All recalls, 5 recalls')
  assert.match(nodeLabel(l, node(l, 'recall:4'), human), /^Class I, Contamination, Drug 4, batch B-4, 50,000 units, open$/)
})

// --- keyboard -------------------------------------------------------------------------------------

test('arrow keys: parent, first child and neighbours; Enter selects; Escape clears', () => {
  const l = flow()
  assert.deepEqual(flowKey(l, 'class:Class I', 'ArrowLeft'), { focus: 'root' })
  assert.deepEqual(flowKey(l, 'root', 'ArrowRight'), { focus: 'class:Class I' })
  assert.deepEqual(flowKey(l, 'class:Class I', 'ArrowDown'), { focus: 'class:Class II' })
  assert.deepEqual(flowKey(l, 'class:Class I', 'ArrowUp'), {})
  assert.deepEqual(flowKey(l, 'defect:Class I:contamination', 'ArrowRight'), { focus: 'recall:4' })
  assert.deepEqual(flowKey(l, 'recall:4', 'ArrowRight'), {})
  assert.deepEqual(flowKey(l, 'recall:1', 'Enter'), { select: 'recall:1' })
  assert.deepEqual(flowKey(l, 'recall:1', 'Escape'), { clear: true })
  assert.equal(flowKey(l, 'nope', 'Enter'), null)
})

// --- motion ---------------------------------------------------------------------------------------

test('full motion: draw column by column within 600 ms, 2 dots per route link on a 3 s loop', () => {
  const m = flowMotion(false)
  assert.equal(m.draw, true)
  assert.deepEqual([0, 1, 2].map(m.delay), [0, 80, 160])
  assert.ok(m.delay(2) + m.duration <= 600)
  assert.deepEqual([m.dots, m.dotCycleS], [2, 3])
})

test('reduced motion: lines at once, no draw and no dots', () => {
  const m = flowMotion(true)
  assert.deepEqual([m.draw, m.duration, m.dots, m.delay(2)], [false, 0, 0, 0])
})
