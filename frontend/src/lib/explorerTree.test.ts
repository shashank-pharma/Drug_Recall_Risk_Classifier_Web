import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildTree,
  connectorPath,
  defectId,
  historyLink,
  parseDefectId,
  treeKey,
  visibleNodes,
  type Stats,
} from './explorerTree.ts'

const STATS: Stats = {
  total_recalls: 5,
  by_class: [
    { recall_class: 'Class I', count: 3 },
    { recall_class: 'Class II', count: 2 },
    { recall_class: 'Class III', count: 0 },
  ],
  by_defect: [
    { defect_type: 'contamination', recall_class: 'Class I', count: 2 },
    { defect_type: 'wrong_drug', recall_class: 'Class I', count: 1 },
    { defect_type: 'mislabeling', recall_class: 'Class II', count: 2 },
    { defect_type: 'packaging_defect', recall_class: 'Class III', count: 0 },
  ],
}
const CONTAMINATION = defectId('Class I', 'contamination')

test('defect ids round-trip, including class names with spaces', () => {
  assert.deepEqual(parseDefectId(CONTAMINATION), { recallClass: 'Class I', defectType: 'contamination' })
  assert.equal(historyLink('Class I', 'contamination'), '/history?class=Class+I&defect=contamination')
})

test('the tree has every class but only defect types with recalls', () => {
  const root = buildTree(STATS, {})
  assert.equal(root.count, 5)
  assert.deepEqual(root.children.map((c) => c.label), ['Class I', 'Class II', 'Class III'])
  assert.deepEqual(root.children[0].children.map((d) => d.defectType), ['contamination', 'wrong_drug'])
  assert.equal(root.children[2].children.length, 0)
})

test('loading, loaded and "show all" children of a defect', () => {
  const loading = buildTree(STATS, { [CONTAMINATION]: 'loading' })
  assert.equal(loading.children[0].children[0].children[0].kind, 'loading')

  const loaded = buildTree(STATS, {
    [CONTAMINATION]: { items: [{ id: 7, drug_name: 'Metformin', batch_id: 'BT-1', overdue: true }], total: 60 },
  })
  const kids = loaded.children[0].children[0].children
  assert.deepEqual(kids.map((k) => k.kind), ['recall', 'more'])
  assert.equal(kids[0].recallId, 7)
  assert.equal(kids[0].overdue, true)
  assert.equal(kids[1].label, 'Show all 60 in History')
})

test('only the root is open: root spans its three classes', () => {
  const v = visibleNodes(buildTree(STATS, {}), new Set(['root']))
  assert.deepEqual(v.map((n) => [n.node.id, n.depth, n.row, n.span]), [
    ['root', 0, 1, 3],
    ['class:Class I', 1, 1, 1],
    ['class:Class II', 1, 2, 1],
    ['class:Class III', 1, 3, 1],
  ])
  assert.deepEqual(v.slice(1).map((n) => [n.posinset, n.setsize]), [[1, 3], [2, 3], [3, 3]])
})

test('opening a class and a defect makes parents span their children', () => {
  const tree = buildTree(STATS, {
    [CONTAMINATION]: {
      items: [
        { id: 1, drug_name: 'A', batch_id: 'B1', overdue: false },
        { id: 2, drug_name: 'B', batch_id: 'B2', overdue: false },
      ],
      total: 2,
    },
  })
  const v = visibleNodes(tree, new Set(['root', 'class:Class I', CONTAMINATION]))
  const at = (id: string) => v.find((n) => n.node.id === id)!
  assert.deepEqual([at('root').row, at('root').span], [1, 5])
  assert.deepEqual([at('class:Class I').row, at('class:Class I').span], [1, 3])
  assert.deepEqual([at(CONTAMINATION).row, at(CONTAMINATION).span], [1, 2])
  assert.deepEqual([at('recall:2').row, at('recall:2').depth], [2, 3])
  assert.deepEqual([at('class:Class II').row], [4])
  // Depth-first order: a defect's recalls come before the next defect.
  assert.deepEqual(v.map((n) => n.node.id).slice(0, 6), [
    'root', 'class:Class I', CONTAMINATION, 'recall:1', 'recall:2', defectId('Class I', 'wrong_drug'),
  ])
})

test('keyboard: arrows move, right opens then enters, left closes then goes up', () => {
  const tree = buildTree(STATS, {})
  const closed = new Set(['root'])
  const v = visibleNodes(tree, closed)
  assert.deepEqual(treeKey(v, 'class:Class I', 'ArrowDown', closed), { focus: 'class:Class II' })
  assert.deepEqual(treeKey(v, 'class:Class I', 'ArrowUp', closed), { focus: 'root' })
  assert.deepEqual(treeKey(v, 'class:Class I', 'ArrowRight', closed), { toggle: 'class:Class I' })
  assert.deepEqual(treeKey(v, 'class:Class I', 'ArrowLeft', closed), { focus: 'root' })
  assert.deepEqual(treeKey(v, 'class:Class III', 'ArrowRight', closed), {}) // no recalls: cannot open
  assert.deepEqual(treeKey(v, 'root', 'End', closed), { focus: 'class:Class III' })

  const open = new Set(['root', 'class:Class I'])
  const v2 = visibleNodes(tree, open)
  assert.deepEqual(treeKey(v2, 'class:Class I', 'ArrowRight', open), { focus: CONTAMINATION })
  assert.deepEqual(treeKey(v2, 'class:Class I', 'ArrowLeft', open), { toggle: 'class:Class I' })
  assert.deepEqual(treeKey(v2, 'class:Class I', 'Enter', open), { toggle: 'class:Class I' })
  assert.equal(treeKey(v2, 'class:Class I', 'x', open), null)
})

test('Enter on a recall activates it instead of toggling', () => {
  const tree = buildTree(STATS, { [CONTAMINATION]: { items: [{ id: 9, drug_name: 'A', batch_id: 'B', overdue: false }], total: 1 } })
  const open = new Set(['root', 'class:Class I', CONTAMINATION])
  const v = visibleNodes(tree, open)
  assert.deepEqual(treeKey(v, 'recall:9', 'Enter', open), { activate: 'recall:9' })
  assert.deepEqual(treeKey(v, 'recall:9', 'ArrowLeft', open), { focus: CONTAMINATION })
})

test('connector path is an S-curve between the two points', () => {
  assert.equal(connectorPath({ x: 0, y: 10 }, { x: 40, y: 50 }), 'M 0 10 C 20 10, 20 50, 40 50')
})
