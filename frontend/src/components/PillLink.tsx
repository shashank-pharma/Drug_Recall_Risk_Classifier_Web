import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/** Rounded "View all"-style link that lifts slightly on hover and settles when pressed. */
export function PillLink({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'pill-link inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-[var(--frost-border)] bg-[var(--frost)] px-3 text-sm font-medium',
        'transition-[transform,box-shadow,background-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]',
        'hover:-translate-y-px hover:bg-muted hover:shadow-[var(--shadow-raised)] active:scale-[0.97] active:shadow-[var(--shadow-pressed)]',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden />
    </Link>
  )
}
