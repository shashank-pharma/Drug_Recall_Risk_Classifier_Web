// Light is the default; a choice made with the header toggle is remembered in localStorage.
// index.html applies the stored choice before the first paint (same key), so there is no flash.

export type Theme = 'light' | 'dark'
export const THEME_KEY = 'recall-theme'

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** Stored theme, or light when there is none, it is unknown, or storage is blocked. */
export function readTheme(store: Store | undefined): Theme {
  try {
    return store?.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** Remember the choice; returns false when storage is blocked (the theme still applies for this visit). */
export function saveTheme(store: Store | undefined, theme: Theme): boolean {
  try {
    store?.setItem(THEME_KEY, theme)
    return !!store
  } catch {
    return false
  }
}

export const otherTheme = (theme: Theme): Theme => (theme === 'dark' ? 'light' : 'dark')
