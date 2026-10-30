import { createContext, useContext } from 'react'

export type Simulation = {
  /** hours ahead of now, 0–72; 0 = real time */
  hours: number
  active: boolean
  setHours: (hours: number) => void
  reset: () => void
  /** ISO time for `?at=`, worked out when the request is made; undefined when not simulating */
  at: () => string | undefined
}

export const SimulationContext = createContext<Simulation>({
  hours: 0,
  active: false,
  setHours: () => {},
  reset: () => {},
  at: () => undefined,
})

/** The "what if" time shared by History, the detail panel and the totals (see SimulationProvider). */
export const useSimulation = () => useContext(SimulationContext)
