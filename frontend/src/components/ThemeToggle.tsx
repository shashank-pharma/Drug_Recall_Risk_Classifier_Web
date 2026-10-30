import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { otherTheme, readTheme, saveTheme, type Theme } from '@/lib/theme'

function storage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

/** Header button that switches between the light (default) and dark theme. */
export function ThemeToggle() {
  // index.html has already put the stored theme on <html>; start from that.
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : readTheme(storage()),
  )
  const next = otherTheme(theme)

  function toggle() {
    document.documentElement.classList.toggle('dark', next === 'dark')
    saveTheme(storage(), next)
    setTheme(next)
  }

  const Icon = theme === 'dark' ? Sun : Moon
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--frost-border)] bg-[var(--frost)] text-muted-strong transition-colors duration-[var(--dur-fast)] hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}
