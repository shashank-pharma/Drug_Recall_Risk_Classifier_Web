import { useQuery } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { AmbientBackground } from '@/components/AmbientBackground'
import { CommandMenu } from '@/components/CommandMenu'
import { KpiStrip } from '@/components/KpiStrip'
import { MotionMenu } from '@/components/MotionMenu'
import { PaletteSwitcher } from '@/components/PaletteSwitcher'
import { SurfaceEffects } from '@/components/SurfaceEffects'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SimulationBanner } from '@/components/TimeTravel'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

const NAV = [
  { to: '/', label: 'New recall', end: true },
  { to: '/history', label: 'History', end: false },
  { to: '/explorer', label: 'Explorer', end: false },
  { to: '/dashboard', label: 'Dashboard', end: false },
]

function ApiStatus() {
  const { isSuccess, isError } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    // Check again quickly while the API is down so the dot turns green soon after it returns.
    refetchInterval: (query) => (query.state.status === 'error' ? 5_000 : 30_000),
    retry: false,
  })
  const label = isSuccess ? 'API connected' : isError ? 'API unreachable' : 'Checking API…'
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          isSuccess ? 'bg-emerald-500' : isError ? 'bg-red-500' : 'bg-muted-foreground',
        )}
      />
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}

/** Main navigation; one pill sits behind the active tab and slides to the next one (250–300 ms). */
function MainNav() {
  const { pathname } = useLocation()
  const nav = useRef<HTMLElement>(null)
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const el = nav.current
    if (!el) return
    const measure = () => {
      const active = el.querySelector<HTMLElement>('a[aria-current="page"]')
      setPill(active ? { x: active.offsetLeft, w: active.offsetWidth } : null)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    // No slide on the first paint; only between tabs afterwards.
    const frame = requestAnimationFrame(() => setReady(true))
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [pathname])

  return (
    <nav ref={nav} className="relative flex gap-1" aria-label="Main">
      {pill && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0 left-0 rounded-lg border border-[var(--frost-border)] bg-white/75 shadow-[var(--shadow-card)] dark:bg-white/10',
            ready && 'nav-pill',
          )}
          style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
        />
      )}
      {NAV.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          viewTransition
          className={({ isActive }) =>
            cn(
              'relative rounded-lg px-2 py-1.5 text-sm whitespace-nowrap transition-colors duration-[var(--dur-fast)] sm:px-3',
              'focus-visible:ring-3 focus-visible:ring-[var(--accent-ring)]/50 focus-visible:outline-none',
              isActive ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function Layout() {
  // The Dashboard shows these totals as cards already.
  const showKpis = useLocation().pathname !== '/dashboard'
  return (
    <div className="min-h-svh text-foreground">
      <AmbientBackground />
      {/* Content sits above the fixed pastel layer. */}
      <div className="relative isolate">
      <SurfaceEffects />
      {/* Frosted bar (white 55% + blur), sticky from small screens up so the background shows through. */}
      <header className="frost-bar z-40 border-b sm:sticky sm:top-0">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="size-5 text-red-600 dark:text-red-400" aria-hidden />
            Drug Recall Classifier
          </NavLink>
          <MainNav />
          <div className="ml-auto flex items-center gap-3">
            <CommandMenu />
            <PaletteSwitcher />
            <MotionMenu />
            <ThemeToggle />
            <ApiStatus />
          </div>
        </div>
      </header>
      <SimulationBanner />
      {showKpis && <KpiStrip />}
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 focus:outline-none">
        <Outlet />
      </main>
      </div>
    </div>
  )
}
