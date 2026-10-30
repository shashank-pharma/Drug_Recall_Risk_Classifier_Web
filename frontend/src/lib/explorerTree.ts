// Recall Explorer tree: model, layout and keyboard rules (tested with `npm test`).
// All recalls → class → defect type → recalls. Nodes are laid out in a CSS grid: one column
// per depth, and each node spans the rows of its visible subtree so it sits beside its children.

export type NodeKind = 'root' | 'class' | 'defect' | 'recall' | 'more' | 'loading'

export type TreeNode = {
  id: string
  kind: NodeKind
  label: string
  count?: number
  recallClass?: string
  defectType?: string
  recallId?: number
  overdue?: boolean
  /** batch ID for recalls; "Show all" link target for `more` */
  detail?: string
  children: TreeNode[]
}

export type RecallLeaf = { id: number; drug_name: string; batch_id: string; overdue: boolean }
/** Recalls loaded for one defect node, or 'loading' while they are fetched. */
export type DefectRecalls = { items: RecallLeaf[]; total: number } | 'loading'

export type Stats = {
  total_recalls: number
  by_class: { recall_class: string; count: number }[]
  by_defect: { defect_type: string; recall_class: string; count: number }[]
}

export const defectId = (recallClass: string, defectType: string) => `defect:${recallClass}:${defectType}`

export function parseDefectId(id: string): { recallClass: string; defectType: string } {
  const [, recallClass, defectType] = id.split(':')
  return { recallClass, defectType }
}

export function historyLink(recallClass: string, defectType: string): string {
  return `/history?${new URLSearchParams({ class: recallClass, defect: defectType })}`
}

/** Builds the tree. Defect types with no recalls are left out; recalls appear once loaded. */
export function buildTree(stats: Stats, recalls: Record<string, DefectRecalls | undefined>): TreeNode {
  const classes = stats.by_class.map((c): TreeNode => ({
    id: `class:${c.recall_class}`,
    kind: 'class',
    label: c.recall_class,
    count: c.count,
    recallClass: c.recall_class,
    children: stats.by_defect
      .filter((d) => d.recall_class === c.recall_class && d.count > 0)
      .map((d): TreeNode => {
        const id = defectId(d.recall_class, d.defect_type)
        const loaded = recalls[id]
        let children: TreeNode[] = []
        if (loaded === 'loading') {
          children = [{ id: `loading:${id}`, kind: 'loading', label: 'Loading recalls…', children: [] }]
        } else if (loaded) {
          children = loaded.items.map((r) => ({
            id: `recall:${r.id}`,
            kind: 'recall',
            label: r.drug_name,
            detail: r.batch_id,
            recallId: r.id,
            overdue: r.overdue,
            children: [],
          }))
          if (loaded.total > loaded.items.length) {
            children.push({
              id: `more:${id}`,
              kind: 'more',
              label: `Show all ${loaded.total} in History`,
              detail: historyLink(d.recall_class, d.defect_type),
              children: [],
            })
          }
        }
        return {
          id,
          kind: 'defect',
          label: d.defect_type,
          count: d.count,
          recallClass: d.recall_class,
          defectType: d.defect_type,
          children,
        }
      }),
  }))
  return { id: 'root', kind: 'root', label: 'All recalls', count: stats.total_recalls, children: classes }
}

/** Root, classes and defect types can open; a class only when it has recalls. */
export function isExpandable(node: TreeNode): boolean {
  if (node.kind === 'root') return true
  if (node.kind === 'class') return (node.count ?? 0) > 0
  return node.kind === 'defect'
}

export type VisibleNode = {
  node: TreeNode
  depth: number
  parentId: string | null
  /** 1-based position among siblings and sibling count, for aria-posinset/aria-setsize */
  posinset: number
  setsize: number
  /** 1-based grid row and how many rows the node spans */
  row: number
  span: number
}

/** Visible nodes in depth-first order (also the DOM and keyboard order). */
export function visibleNodes(root: TreeNode, expanded: ReadonlySet<string>): VisibleNode[] {
  const out: VisibleNode[] = []
  function place(node: TreeNode, depth: number, parentId: string | null, pos: number, size: number, row: number): number {
    const entry: VisibleNode = { node, depth, parentId, posinset: pos, setsize: size, row, span: 1 }
    out.push(entry)
    if (expanded.has(node.id) && node.children.length > 0) {
      let next = row
      node.children.forEach((child, i) => {
        next += place(child, depth + 1, node.id, i + 1, node.children.length, next)
      })
      entry.span = next - row
    }
    return entry.span
  }
  place(root, 0, null, 1, 1, 1)
  return out
}

export type KeyResult = { focus?: string; toggle?: string; activate?: string }

/** WAI-ARIA tree keys: ↑↓ move, → open / go to first child, ← close / go to parent, Home/End. */
export function treeKey(
  visible: VisibleNode[],
  focusedId: string,
  key: string,
  expanded: ReadonlySet<string>,
): KeyResult | null {
  const index = visible.findIndex((v) => v.node.id === focusedId)
  if (index === -1) return null
  const current = visible[index]
  const open = expanded.has(focusedId)
  switch (key) {
    case 'ArrowDown':
      return index < visible.length - 1 ? { focus: visible[index + 1].node.id } : {}
    case 'ArrowUp':
      return index > 0 ? { focus: visible[index - 1].node.id } : {}
    case 'Home':
      return { focus: visible[0].node.id }
    case 'End':
      return { focus: visible[visible.length - 1].node.id }
    case 'ArrowRight':
      if (!isExpandable(current.node)) return {}
      if (!open) return { toggle: focusedId }
      return current.node.children.length ? { focus: current.node.children[0].id } : {}
    case 'ArrowLeft':
      if (open && isExpandable(current.node)) return { toggle: focusedId }
      return current.parentId ? { focus: current.parentId } : {}
    case 'Enter':
    case ' ':
      return isExpandable(current.node) ? { toggle: focusedId } : { activate: focusedId }
    default:
      return null
  }
}

/** Smooth S-curve from a parent's right edge to a child's left edge. */
export function connectorPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const mid = from.x + (to.x - from.x) / 2
  return `M ${from.x} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x} ${to.y}`
}
