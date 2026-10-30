import { useQuery } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { CommandMenu } from '@/components/CommandMenu'
import { KpiStrip } from '@/components/KpiStrip'
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
          isSuccess ? 'bg-emerald-500' : isError ? 'bg-red-500' : 'bg-neutral-300',
        )}
      />
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}

export function Layout() {
  // The Dashboard shows these totals as cards already.
  const showKpis = useLocation().pathname !== '/dashboard'
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="size-5 text-red-600" aria-hidden />
            Drug Recall Classifier
          </NavLink>
          <nav className="flex gap-1" aria-label="Main">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-2 py-1.5 text-sm whitespace-nowrap transition-colors sm:px-3',
                    isActive
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <CommandMenu />
            <ApiStatus />
          </div>
        </div>
      </header>
      {showKpis && <KpiStrip />}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
