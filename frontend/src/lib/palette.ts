// Which calm background palette is shown. Lagoon is the default; the choice made with the header dots is
// remembered in localStorage. index.html applies the stored palette before the first paint (same key).
import { PALETTES, type PaletteName } from './tokens.ts'

export const PALETTE_KEY = 'recall-palette'
export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[]
export const DEFAULT_PALETTE: PaletteName = 'lagoon'

type Store = Pick<Storage, 'getItem' | 'setItem'>

export function isPalette(value: unknown): value is PaletteName {
  return typeof value === 'string' && (PALETTE_NAMES as string[]).includes(value)
}

/** Stored palette, or Lagoon when there is none, it is unknown, or storage is blocked. */
export function readPalette(store: Store | undefined): PaletteName {
  try {
    const value = store?.getItem(PALETTE_KEY)
    return isPalette(value) ? value : DEFAULT_PALETTE
  } catch {
    return DEFAULT_PALETTE
  }
}

/** Remember the choice; false when storage is blocked (the palette still applies for this visit). */
export function savePalette(store: Store | undefined, palette: PaletteName): boolean {
  try {
    store?.setItem(PALETTE_KEY, palette)
    return !!store
  } catch {
    return false
  }
}

/** Next or previous palette for arrow keys in the radio group (wraps around). */
export function stepPalette(current: PaletteName, step: 1 | -1): PaletteName {
  const i = PALETTE_NAMES.indexOf(current)
  return PALETTE_NAMES[(i + step + PALETTE_NAMES.length) % PALETTE_NAMES.length]
}
