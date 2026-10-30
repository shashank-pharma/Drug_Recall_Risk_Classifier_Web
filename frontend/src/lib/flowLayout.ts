// Recall tree flow (Explorer, Phases 13I/13J): left-to-right tree layout, highlight, keyboard and motion
// rules. Pure functions, tested with `npm test`; FlowView only draws what these return.
// Columns: All recalls → classes → defect types → recalls. Node ids match explorerTree.ts.
import { defectId } from './explorerTree.ts'
import type { LedTone } from './statusLed.ts'

export type SizeBy = 'recalls' | 'units'

export type FlowRecall = {
  id: number
  drug_name: string
  batch_id: string
  recall_class: string
  defect_type: string
  units: number
  led: LedTone
}

export type FlowInput = {
  total: number
  totalUnits: number
  classes: { recall_class: string; count: number; units?: number }[]
  defects: { defect_type: string; recall_class: string; count: number; units?: number }[]
  /** the recall column, newest first (already narrowed to the selected class or defect type) */
  recalls: FlowRecall[]
  /** how many recalls match that scope in total (for "+N more") */
  recallTotal: number
}

export type FlowOptions = {
  width: number
  sizeBy: SizeBy
  /** columns (2 = defect types, 3 = recalls) whose "+N more" was opened */
  expanded?: ReadonlySet<number>
  /** a node that must be shown even past the limit (e.g. a recall chosen with Cmd+K) */
  keep?: string | null
}

export type FlowNodeKind = 'root' | 'class' | 'defect' | 'recall' | 'more'

export type FlowNode = {
  id: string
  kind: FlowNodeKind
  column: number
  parentId: string | null
  label: string
  count: number
  units: number
  /** the number shown and used for the share bar (recalls or units) */
  value: number
  x: number
  y: number
  w: number
  h: number
  recallClass?: string
  defectType?: string
  recallId?: number
  batch?: string
  led?: LedTone
  /** "+N more": how many are hidden */
  hidden?: number
  /** "+N more" that can only open History (those recalls were not loaded) */
  toHistory?: boolean
}

export type FlowLink = {
  id: string
  source: string
  target: string
  /** column of the source node; drives the draw-in order */
  column: number
  d: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type FlowLayout = { nodes: FlowNode[]; links: FlowLink[]; width: number; height: number }

export const MAX_PER_COLUMN = 8
/** Fixed card height per column (root, class, defect type, recall): sizes never follow the counts. */
export const NODE_H = [88, 60, 52, 52] as const
/** Distance between leaf rows (recall rows, or a parent with nothing shown to its right). */
export const ROW = 68
export const MIN_GAP = 8
const PAD = 4
const CLASS_ORDER = ['Class I', 'Class II', 'Class III']

export const moreId = (column: number) => `more:${column}`

/** Thin left-to-right link between two edge centres. */
export function linkPath(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
}

/** Column width and the gap between columns for a container width. */
export function columnGeometry(width: number): { colW: number; gap: number } {
  const colW = Math.max(160, Math.min(230, width * 0.2))
  return { colW, gap: Math.max(32, (width - colW * 4) / 3) }
}

/**
 * Tree layout: every node is a fixed-size card. Leaves get rows ROW px apart (sorted class → defect type →
 * newest recall, so links never cross); each parent sits at the vertical middle of its children, the root in
 * the middle of the classes. Links run from a parent's right-edge centre to a child's left-edge centre.
 */
export function layoutFlow(input: FlowInput, options: FlowOptions): FlowLayout {
  const { width, sizeBy, expanded = new Set<number>(), keep = null } = options
  if (input.total === 0) return { nodes: [], links: [], width, height: 0 }

  const pick = (count: number, units = 0) => (sizeBy === 'units' ? units : count)
  const { colW, gap } = columnGeometry(width)
  const x = (column: number) => column * (colW + gap)
  const card = (n: Omit<FlowNode, 'x' | 'y' | 'w' | 'h'>): FlowNode => ({ ...n, x: x(n.column), y: 0, w: colW, h: NODE_H[n.column] })
  const rank = (cls?: string) => CLASS_ORDER.indexOf(cls ?? '')

  const root = card({
    id: 'root', kind: 'root', column: 0, parentId: null, label: 'All recalls',
    count: input.total, units: input.totalUnits, value: pick(input.total, input.totalUnits),
  })
  const classes = [...input.classes]
    .sort((a, b) => rank(a.recall_class) - rank(b.recall_class))
    .map((c) =>
      card({
        id: `class:${c.recall_class}`, kind: 'class', column: 1, parentId: 'root', label: c.recall_class,
        count: c.count, units: c.units ?? 0, value: pick(c.count, c.units), recallClass: c.recall_class,
      }),
    )

  const allDefects = input.defects
    .filter((d) => d.count > 0)
    .sort((a, b) => rank(a.recall_class) - rank(b.recall_class) || b.count - a.count || a.defect_type.localeCompare(b.defect_type))
  const defects = (expanded.has(2) ? allDefects : allDefects.slice(0, MAX_PER_COLUMN)).map((d) =>
    card({
      id: defectId(d.recall_class, d.defect_type), kind: 'defect', column: 2, parentId: `class:${d.recall_class}`,
      label: d.defect_type, count: d.count, units: d.units ?? 0, value: pick(d.count, d.units),
      recallClass: d.recall_class, defectType: d.defect_type,
    }),
  )
  const defectOrder = new Map(defects.map((d, i) => [d.id, i]))

  // Recall column: the newest MAX_PER_COLUMN (plus `keep`), then ordered class → defect type → newest.
  const all = input.recalls.filter((r) => defectOrder.has(defectId(r.recall_class, r.defect_type)))
  let picked = expanded.has(3) ? all : all.slice(0, MAX_PER_COLUMN)
  const kept = keep && !picked.some((r) => `recall:${r.id}` === keep) ? all.find((r) => `recall:${r.id}` === keep) : undefined
  if (kept) picked = [...picked, kept]
  const recalls = picked
    .map((r, i) => ({ r, i }))
    .sort((a, b) =>
      (defectOrder.get(defectId(a.r.recall_class, a.r.defect_type)) ?? 0) -
        (defectOrder.get(defectId(b.r.recall_class, b.r.defect_type)) ?? 0) || a.i - b.i,
    )
    .map(({ r }) =>
      card({
        id: `recall:${r.id}`, kind: 'recall', column: 3, parentId: defectId(r.recall_class, r.defect_type),
        label: r.drug_name, count: 1, units: r.units, value: pick(1, r.units), recallClass: r.recall_class,
        defectType: r.defect_type, recallId: r.id, batch: r.batch_id, led: r.led,
      }),
    )

  const more: FlowNode[] = []
  const hiddenDefects = allDefects.length - defects.length
  if (hiddenDefects > 0) {
    more.push(card({ id: moreId(2), kind: 'more', column: 2, parentId: null, label: `+${hiddenDefects} more`, count: hiddenDefects, units: 0, value: 0, hidden: hiddenDefects }))
  }
  const hiddenRecalls = all.length - recalls.length + Math.max(0, input.recallTotal - input.recalls.length)
  if (hiddenRecalls > 0) {
    const toHistory = recalls.length === all.length
    more.push(
      card({
        id: moreId(3), kind: 'more', column: 3, parentId: null,
        label: toHistory ? `+${hiddenRecalls} more in History` : `+${hiddenRecalls} more`,
        count: hiddenRecalls, units: 0, value: 0, hidden: hiddenRecalls, toHistory,
      }),
    )
  }

  // Leaf rows, then parents centred on their children.
  const center = new Map<string, number>()
  let row = 0
  const nextRow = () => row++ * ROW + ROW / 2
  for (const c of classes) {
    const kids = defects.filter((d) => d.parentId === c.id)
    for (const d of kids) {
      const leaves = recalls.filter((r) => r.parentId === d.id)
      if (leaves.length) leaves.forEach((r) => center.set(r.id, nextRow()))
      else center.set(d.id, nextRow())
      if (leaves.length) center.set(d.id, (center.get(leaves[0].id)! + center.get(leaves.at(-1)!.id)!) / 2)
    }
    center.set(c.id, kids.length ? (center.get(kids[0].id)! + center.get(kids.at(-1)!.id)!) / 2 : nextRow())
  }
  center.set('root', (center.get(classes[0].id)! + center.get(classes.at(-1)!.id)!) / 2)
  if (more.length) {
    const y = nextRow()
    more.forEach((m) => center.set(m.id, y))
  }

  // Never overlap inside a column (only matters when neighbours are single rows of tall cards).
  const columns = [[root], classes, [...defects, ...more.filter((m) => m.column === 2)], [...recalls, ...more.filter((m) => m.column === 3)]]
  for (const col of columns) {
    col.sort((a, b) => center.get(a.id)! - center.get(b.id)!)
    for (let i = 1; i < col.length; i++) {
      const min = center.get(col[i - 1].id)! + (col[i - 1].h + col[i].h) / 2 + MIN_GAP
      if (center.get(col[i].id)! < min) center.set(col[i].id, min)
    }
  }
  const nodes = columns.flat()
  const top = Math.min(...nodes.map((n) => center.get(n.id)! - n.h / 2))
  for (const n of nodes) n.y = center.get(n.id)! - n.h / 2 - top + PAD
  const height = Math.max(...nodes.map((n) => n.y + n.h)) + PAD

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const links: FlowLink[] = []
  for (const child of nodes) {
    const parent = child.parentId ? byId.get(child.parentId) : undefined
    if (!parent) continue
    const x1 = parent.x + parent.w
    const y1 = parent.y + parent.h / 2
    const x2 = child.x
    const y2 = child.y + child.h / 2
    links.push({ id: `${parent.id}>${child.id}`, source: parent.id, target: child.id, column: parent.column, d: linkPath(x1, y1, x2, y2), x1, y1, x2, y2 })
  }
  return { nodes, links, width, height }
}

function ancestors(layout: FlowLayout, id: string): string[] {
  const byId = new Map(layout.nodes.map((n) => [n.id, n]))
  const out: string[] = []
  for (let n = byId.get(id); n; n = n.parentId ? byId.get(n.parentId) : undefined) out.unshift(n.id)
  return out
}

/** Nodes from the root down to `id` (the breadcrumb and the selected route). */
export function flowPath(layout: FlowLayout, id: string | null): FlowNode[] {
  if (!id) return []
  const byId = new Map(layout.nodes.map((n) => [n.id, n]))
  return ancestors(layout, id).map((a) => byId.get(a) as FlowNode)
}

/** Everything upstream (ancestors) and downstream (descendants) of a node, for the hover highlight. */
export function relatedIds(layout: FlowLayout, id: string): { nodes: Set<string>; links: Set<string> } {
  const nodes = new Set(ancestors(layout, id))
  if (!nodes.size) return { nodes, links: new Set() }
  let grew = true
  while (grew) {
    grew = false
    for (const n of layout.nodes) {
      if (n.parentId && !nodes.has(n.id) && nodes.has(n.parentId) && isBelow(layout, n.id, id)) {
        nodes.add(n.id)
        grew = true
      }
    }
  }
  const links = new Set(layout.links.filter((l) => nodes.has(l.source) && nodes.has(l.target)).map((l) => l.id))
  return { nodes, links }
}

function isBelow(layout: FlowLayout, id: string, ancestor: string): boolean {
  return ancestors(layout, id).includes(ancestor)
}

/** The links along the selected route (root → … → id). */
export function routeLinks(layout: FlowLayout, id: string | null): FlowLink[] {
  const path = id ? ancestors(layout, id) : []
  return path.slice(1).flatMap((target, i) => layout.links.filter((l) => l.source === path[i] && l.target === target))
}

export type FlowKeyResult = { focus?: string; select?: string; clear?: true }

/** Keys on a focused node: ←/→ parent / first child, ↑/↓ neighbour in the column, Enter select, Esc clear. */
export function flowKey(layout: FlowLayout, focusedId: string, key: string): FlowKeyResult | null {
  const node = layout.nodes.find((n) => n.id === focusedId)
  if (!node) return null
  const column = layout.nodes.filter((n) => n.column === node.column).sort((a, b) => a.y - b.y)
  const index = column.findIndex((n) => n.id === focusedId)
  switch (key) {
    case 'ArrowLeft':
      return node.parentId ? { focus: node.parentId } : {}
    case 'ArrowRight': {
      const child = layout.nodes.filter((n) => n.parentId === node.id).sort((a, b) => a.y - b.y)[0]
      return child ? { focus: child.id } : {}
    }
    case 'ArrowUp':
      return index > 0 ? { focus: column[index - 1].id } : {}
    case 'ArrowDown':
      return index < column.length - 1 ? { focus: column[index + 1].id } : {}
    case 'Home':
      return { focus: column[0].id }
    case 'End':
      return { focus: column[column.length - 1].id }
    case 'Enter':
    case ' ':
      return { select: focusedId }
    case 'Escape':
      return { clear: true }
    default:
      return null
  }
}

/** Screen-reader name: the path down to the node, then its size. */
export function nodeLabel(layout: FlowLayout, node: FlowNode, humanize: (s: string) => string): string {
  if (node.kind === 'more') return `${node.hidden} more, show them`
  const names = flowPath(layout, node.id)
    .filter((n) => n.kind !== 'root')
    .map((n) => (n.kind === 'defect' ? humanize(n.label) : n.kind === 'recall' ? `${n.label}, batch ${n.batch}` : n.label))
  const size = node.kind === 'recall' ? `${node.units.toLocaleString('en-IN')} units` : `${node.count} recall${node.count === 1 ? '' : 's'}`
  const status = node.kind === 'recall' && node.led ? `, ${{ done: 'done', pending: 'open', overdue: 'overdue', none: 'no timeline' }[node.led]}` : ''
  return [node.kind === 'root' ? 'All recalls' : names.join(', '), size].join(', ') + status
}

export type FlowMotion = {
  /** draw links in with stroke-dashoffset */
  draw: boolean
  /** delay before a column's links start drawing (ms) */
  delay: (column: number) => number
  duration: number
  /** flowing dots per link on the selected route */
  dots: number
  dotCycleS: number
}

/** Load draw: column by column, 80 ms apart, all done within 600 ms; 2 dots per route link on a 3 s loop.
 *  Reduced: lines at once, no dots. */
export function flowMotion(reduced: boolean): FlowMotion {
  if (reduced) return { draw: false, delay: () => 0, duration: 0, dots: 0, dotCycleS: 0 }
  return { draw: true, delay: (column) => column * 80, duration: 400, dots: 2, dotCycleS: 3 }
}
