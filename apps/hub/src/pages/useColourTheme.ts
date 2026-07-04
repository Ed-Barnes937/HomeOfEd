import { useCallback, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function storedTheme(): Theme | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

/**
 * Resolves the active theme, preferring a persisted user choice over the OS
 * setting. The returned setter persists to localStorage, so a click on the
 * toggle button becomes the stored preference from then on.
 */
export function useColourTheme(): [Theme, (next: Theme | ((prev: Theme) => Theme)) => void] {
  const [theme, setThemeState] = useState<Theme>(() => storedTheme() ?? systemTheme())

  const setTheme = useCallback((next: Theme | ((prev: Theme) => Theme)) => {
    setThemeState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      localStorage.setItem(STORAGE_KEY, value)
      return value
    })
  }, [])

  return [theme, setTheme]
}
