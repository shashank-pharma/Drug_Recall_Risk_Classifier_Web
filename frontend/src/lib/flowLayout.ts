// Recall flow chart (Explorer, Phase 13I): layered left-to-right layout, highlight, keyboard and motion
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
  /** what the size follows (recalls or units) */
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
  /** neutral tint index of a defect type (and its recalls) */
  tint?: number
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
  width: number
  d: string
  /** root → class links use the class colour; later links a neutral tint */
  tone: 'class' | 'neutral'
  recallClass?: string
  tint?: number
  x1: number
  y1: number
  x2: number
  y2: number
}

export type FlowLayout = { nodes: FlowNode[]; links: FlowLink[]; width: number; height: number }

export const MAX_PER_COLUMN = 8
export const MIN_NODE_H = 52 // fits two lines; above the 44 px touch target
export const NODE_GAP = 12
export const SCALE_H = 360 // height the root's total maps to
export const MIN_LINK = 2
const CLASS_ORDER = ['Class I', 'Class II', 'Class III']

export const moreId = (column: number) => `more:${column}`

/** Smooth left-to-right link between two points (centre line of a band). */
export function linkPath(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
}

/** Column width and the gap between columns for a container width. */
export function columnGeometry(width: number): { colW: number; gap: number } {
  const colW = Math.max(150, Math.min(220, width * 0.19))
  return { colW, gap: Math.max(24, (width - colW * 4) / 3) }
}

export function layoutFlow(input: FlowInput, options: FlowOptions): FlowLayout {
  const { width, sizeBy, expanded = new Set<number>(), keep = null } = options
  if (input.total === 0) return { nodes: [], links: [], width, height: 0 }

  const pick = (count: number, units = 0) => (sizeBy === 'units' ? units : count)
  const rootValue = pick(input.total, input.totalUnits)
  const k = SCALE_H / Math.max(rootValue, 1)
  const { colW, gap } = columnGeometry(width)
  const x = (column: number) => column * (colW + gap)
  const tintOf = new Map(input.defects.map((d, i) => [d.defect_type, i]))

  const base = (n: Omit<FlowNode, 'x' | 'y' | 'w' | 'h'>): FlowNode => ({
    ...n,
    x: x(n.column),
    y: 0,
    w: colW,
    h: Math.max(MIN_NODE_H, n.value * k),
  })

  /** Keep the first MAX_PER_COLUMN (plus `keep`) unless the column is expanded; the rest become "+N more".
   *  Recalls that were not loaded at all (`notLoaded`) can only be seen in History. */
  function limit(nodes: FlowNode[], column: number, notLoaded = 0): FlowNode[] {
    const shown = expanded.has(column) ? nodes : nodes.slice(0, MAX_PER_COLUMN)
    const kept = keep && !shown.some((n) => n.id === keep) ? nodes.find((n) => n.id === keep) : undefined
    const visible = kept ? [...shown, kept] : shown
    const hidden = nodes.length - visible.length + notLoaded
    if (hidden <= 0) return visible
    const toHistory = nodes.length === visible.length
    return [
      ...visible,
      base({
        id: moreId(column), kind: 'more', column, parentId: null,
        label: toHistory ? `+${hidden} more in History` : `+${hidden} more`,
        count: hidden, units: 0, value: 0, hidden, toHistory,
      }),
    ]
  }

  const root = base({
    id: 'root', kind: 'root', column: 0, parentId: null, label: 'All recalls',
    count: input.total, units: input.totalUnits, value: rootValue,
  })
  const classes = [...input.classes]
    .sort((a, b) => CLASS_ORDER.indexOf(a.recall_class) - CLASS_ORDER.indexOf(b.recall_class))
    .map((c) =>
      base({
        id: `class:${c.recall_class}`, kind: 'class', column: 1, parentId: 'root', label: c.recall_class,
        count: c.count, units: c.units ?? 0, value: pick(c.count, c.units), recallClass: c.recall_class,
      }),
    )
  const defects = limit(
    input.defects
      .filter((d) => d.count > 0)
      .sort((a, b) =>
        CLASS_ORDER.indexOf(a.recall_class) - CLASS_ORDER.indexOf(b.recall_class) ||
        pick(b.count, b.units) - pick(a.count, a.units) ||
        a.defect_type.localeCompare(b.defect_type),
      )
      .map((d) =>
        base({
          id: defectId(d.recall_class, d.defect_type), kind: 'defect', column: 2, parentId: `class:${d.recall_class}`,
          label: d.defect_type, count: d.count, units: d.units ?? 0, value: pick(d.count, d.units),
          recallClass: d.recall_class, defectType: d.defect_type, tint: tintOf.get(d.defect_type) ?? 0,
        }),
      ),
    2,
  )
  const recalls = limit(
    input.recalls.map((r) =>
      base({
        id: `recall:${r.id}`, kind: 'recall', column: 3, parentId: defectId(r.recall_class, r.defect_type),
        label: r.drug_name, count: 1, units: r.units, value: pick(1, r.units), recallClass: r.recall_class,
        defectType: r.defect_type, recallId: r.id, batch: r.batch_id, led: r.led, tint: tintOf.get(r.defect_type) ?? 0,
      }),
    ),
    3,
    Math.max(0, input.recallTotal - input.recalls.length),
  )

  // Recalls keep their newest-first pick, then sit in the order of their defect type so links don't cross.
  const defectOrder = new Map(defects.map((d, i) => [d.id, i]))
  recalls.sort(
    (a, b) =>
      Number(a.kind === 'more') - Number(b.kind === 'more') ||
      (defectOrder.get(a.parentId ?? '') ?? 99) - (defectOrder.get(b.parentId ?? '') ?? 99),
  )

  // Stack each column, then centre the columns against the tallest one.
  const columns = [[root], classes, defects, recalls]
  const heights = columns.map((col) => col.reduce((sum, n) => sum + n.h, 0) + NODE_GAP * Math.max(0, col.length - 1))
  const height = Math.max(...heights)
  columns.forEach((col, i) => {
    let y = (height - heights[i]) / 2
    for (const n of col) {
      n.y = y
      y += n.h + NODE_GAP
    }
  })
  const nodes = columns.flat()
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // Links: one per child; bands stack down the parent's right edge in the children's order.
  const links: FlowLink[] = []
  const offsets = new Map<string, number>()
  for (const child of nodes) {
    const parent = child.parentId ? byId.get(child.parentId) : undefined
    if (!parent || child.value <= 0) continue
    const siblings = nodes.filter((n) => n.parentId === parent.id && n.value > 0)
    const widths = siblings.map((n) => Math.max(MIN_LINK, n.value * k))
    const total = widths.reduce((a, b) => a + b, 0)
    const start = parent.y + Math.max(0, (parent.h - total) / 2)
    const w = Math.max(MIN_LINK, child.value * k)
    const used = offsets.get(parent.id) ?? 0
    offsets.set(parent.id, used + w)
    const x1 = parent.x + parent.w
    const y1 = Math.min(parent.y + parent.h - w / 2, start + used + w / 2)
    const x2 = child.x
    const y2 = child.y + child.h / 2
    links.push({
      id: `${parent.id}>${child.id}`,
      source: parent.id,
      target: child.id,
      column: parent.column,
      width: Math.min(w, child.h),
      d: linkPath(x1, y1, x2, y2),
      tone: parent.column === 0 ? 'class' : 'neutral',
      recallClass: child.recallClass,
      tint: child.tint,
      x1, y1, x2, y2,
    })
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

/** One continuous path through the selected route (across the nodes), for the flowing dots. */
export function routePath(layout: FlowLayout, id: string | null): string | null {
  const links = routeLinks(layout, id)
  if (!links.length) return null
  return links
    .map((l, i) => {
      const mid = (l.x1 + l.x2) / 2
      return `${i === 0 ? 'M' : 'L'} ${l.x1} ${l.y1} C ${mid} ${l.y1}, ${mid} ${l.y2}, ${l.x2} ${l.y2}`
    })
    .join(' ')
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
  /** flowing dots on the selected route */
  dots: number
  dotCycleS: number
}

/** Load draw: column by column, 80 ms apart, all done within 600 ms. Reduced: lines at once, no dots. */
export function flowMotion(reduced: boolean): FlowMotion {
  if (reduced) return { draw: false, delay: () => 0, duration: 0, dots: 0, dotCycleS: 0 }
  return { draw: true, delay: (column) => column * 80, duration: 400, dots: 4, dotCycleS: 5.5 }
}
