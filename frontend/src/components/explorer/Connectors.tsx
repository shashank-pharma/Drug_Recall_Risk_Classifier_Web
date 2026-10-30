import { useEffect, useState } from 'react'
import { connectorPath, type VisibleNode } from '@/lib/explorerTree'
import { PALETTE } from '@/lib/tokens'
import { cn } from '@/lib/utils'

type Path = { key: string; d: string }

const GRADIENT = 'explorer-path-gradient'

/**
 * Curved lines from each open node to its children, in an SVG over the tree grid. Positions are measured
 * from the DOM (ResizeObserver), so they follow the grid on resize. A line draws in when it appears; the
 * chosen path is drawn again in the indigo→violet gradient and the other lines fade back.
 */
export function Connectors({
  container,
  visible,
  getElement,
  highlighted,
}: {
  container: HTMLElement | null
  visible: VisibleNode[]
  getElement: (id: string) => HTMLElement | undefined
  /** ids of the nodes on the chosen path (root first) */
  highlighted: ReadonlySet<string>
}) {
  const [paths, setPaths] = useState<Path[]>([])
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!container) return
    const measure = () => {
      const box = container.getBoundingClientRect()
      const next: Path[] = []
      for (const v of visible) {
        if (!v.parentId) continue
        const parent = getElement(v.parentId)?.getBoundingClientRect()
        const child = getElement(v.node.id)?.getBoundingClientRect()
        if (!parent || !child || child.left <= parent.right) continue // stacked (narrow): no lines
        next.push({
          key: `${v.parentId}>${v.node.id}`,
          d: connectorPath(
            { x: parent.right - box.left, y: parent.top + parent.height / 2 - box.top },
            { x: child.left - box.left, y: child.top + child.height / 2 - box.top },
          ),
        })
      }
      setWidth(box.width)
      // Keep the same array when nothing moved, so measuring never causes another render.
      setPaths((prev) =>
        prev.length === next.length && prev.every((p, i) => p.key === next[i].key && p.d === next[i].d) ? prev : next,
      )
    }
    // Wait a frame (and again after fly-in animations settle) so positions are final.
    const frame = requestAnimationFrame(measure)
    const late = setTimeout(measure, 450)
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(late)
      observer.disconnect()
    }
  }, [container, visible, getElement])

  const onPath = (key: string) => {
    const [from, to] = key.split('>')
    return highlighted.has(from) && highlighted.has(to)
  }
  const anyHighlight = highlighted.size > 1

  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible min-[900px]:block">
      <defs>
        <linearGradient id={GRADIENT} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={width || 1} y2={0}>
          <stop offset="0%" stopColor={PALETTE.brandFrom} />
          <stop offset="100%" stopColor={PALETTE.brandTo} />
        </linearGradient>
      </defs>
      {paths.map((p) => {
        const hl = onPath(p.key)
        return (
          <path
            // The key changes when a line joins the chosen path, so it draws in again (connector-draw).
            key={`${p.key}:${hl ? 'on' : 'off'}`}
            d={p.d}
            pathLength={1}
            fill="none"
            strokeWidth={hl ? 2.25 : 1.5}
            stroke={hl ? `url(#${GRADIENT})` : undefined}
            className={cn(
              'connector-draw transition-opacity duration-[var(--dur-base)]',
              !hl && 'stroke-muted-foreground',
              !hl && (anyHighlight ? 'opacity-30' : 'opacity-60'),
            )}
          />
        )
      })}
    </svg>
  )
}
