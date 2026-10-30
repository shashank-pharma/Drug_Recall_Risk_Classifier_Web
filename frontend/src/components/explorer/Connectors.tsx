import { useEffect, useState } from 'react'
import { connectorPath, type VisibleNode } from '@/lib/explorerTree'

type Path = { key: string; d: string }

/**
 * Lines from each open node to its children, drawn in an SVG over the tree grid. Positions are
 * measured from the DOM, so they follow the grid on resize; each new line draws in once.
 */
export function Connectors({
  container,
  visible,
  getElement,
}: {
  container: HTMLElement | null
  visible: VisibleNode[]
  getElement: (id: string) => HTMLElement | undefined
}) {
  const [paths, setPaths] = useState<Path[]>([])

  useEffect(() => {
    if (!container) return
    const measure = () => {
      const box = container.getBoundingClientRect()
      const next: Path[] = []
      for (const v of visible) {
        if (!v.parentId) continue
        const parent = getElement(v.parentId)?.getBoundingClientRect()
        const child = getElement(v.node.id)?.getBoundingClientRect()
        if (!parent || !child || child.left <= parent.right) continue // stacked (mobile): no lines
        next.push({
          key: `${v.parentId}>${v.node.id}`,
          d: connectorPath(
            { x: parent.right - box.left, y: parent.top + parent.height / 2 - box.top },
            { x: child.left - box.left, y: child.top + child.height / 2 - box.top },
          ),
        })
      }
      // Keep the same array when nothing moved, so measuring never causes another render.
      setPaths((prev) =>
        prev.length === next.length && prev.every((p, i) => p.key === next[i].key && p.d === next[i].d) ? prev : next,
      )
    }
    const frame = requestAnimationFrame(measure)
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [container, visible, getElement])

  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible md:block">
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          pathLength={1}
          fill="none"
          strokeWidth={1.5}
          className="connector-draw stroke-muted-foreground/60"
        />
      ))}
    </svg>
  )
}
