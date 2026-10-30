// Motion setting from the header menu: Auto follows the OS "reduce motion" setting (default), Full always
// animates, Reduced never does. The result is put on <html data-motion="full|reduced">, which index.css and
// usePrefersReducedMotion() both read. index.html applies it before the first paint (same key).

export type MotionSetting = 'auto' | 'full' | 'reduced'
export type Motion = 'full' | 'reduced'
export const MOTION_KEY = 'recall-motion'
export const MOTION_SETTINGS: MotionSetting[] = ['auto', 'full', 'reduced']

type Store = Pick<Storage, 'getItem' | 'setItem'>

export function readMotionSetting(store: Store | undefined): MotionSetting {
  try {
    const value = store?.getItem(MOTION_KEY)
    return value === 'full' || value === 'reduced' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

export function saveMotionSetting(store: Store | undefined, setting: MotionSetting): boolean {
  try {
    store?.setItem(MOTION_KEY, setting)
    return !!store
  } catch {
    return false
  }
}

/** What actually happens: Auto takes the OS setting, the other two override it. */
export function resolveMotion(setting: MotionSetting, osPrefersReduced: boolean): Motion {
  if (setting === 'auto') return osPrefersReduced ? 'reduced' : 'full'
  return setting
}
