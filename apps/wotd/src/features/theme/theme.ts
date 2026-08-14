// Light/dark theme state. Client-only: a `data-theme` attribute on <html>
// drives every CSS token; the choice persists in localStorage and a first
// visit follows the OS preference (spec: theme decisions).

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'wotd-theme'

/** The stored choice when valid, otherwise the system preference. */
export function initialTheme(storage: Pick<Storage, 'getItem'>, systemPrefersDark: boolean): Theme {
  const stored = storage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return systemPrefersDark ? 'dark' : 'light'
}

export function loadTheme(): Theme {
  return initialTheme(window.localStorage, window.matchMedia('(prefers-color-scheme: dark)').matches)
}

/** Paints the theme by flipping the token root; every screen restyles at once. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export function saveTheme(theme: Theme): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
}

/**
 * Paints the persisted (or system) theme. Called before the first render by
 * both entry points — main.tsx and the .iwft harness — so no screen ever
 * flashes the wrong palette.
 */
export function bootTheme(): void {
  applyTheme(loadTheme())
}
