import { useMemo, useState } from 'react'
import { clampHours, simulatedAt } from '@/lib/simulation'
import { SimulationContext, type Simulation } from '@/lib/useSimulation'

/**
 * Holds the "what if" time for the whole app. It lives only in memory (a reload goes back to now)
 * and is only ever sent as `?at=` on read requests, so nothing is saved.
 */
export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [hours, setHoursState] = useState(0)
  const value = useMemo<Simulation>(
    () => ({
      hours,
      active: hours > 0,
      setHours: (h) => setHoursState(clampHours(h)),
      reset: () => setHoursState(0),
      at: () => simulatedAt(hours, new Date()),
    }),
    [hours],
  )
  return <SimulationContext value={value}>{children}</SimulationContext>
}
