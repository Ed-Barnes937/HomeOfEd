import { useState } from 'react'

import { applyTheme, loadTheme, saveTheme, type Theme } from '../features/theme/theme.ts'
import { MoonIcon, SunIcon } from './icons.tsx'
import styles from './ThemeToggle.module.scss'

/**
 * The design's two-segment sun/moon pill. One button — a press flips the
 * whole app between light and dark and remembers the choice. main.tsx paints
 * the initial theme before render, so loadTheme() here always agrees with
 * what is already on <html>.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(loadTheme)

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    applyTheme(next)
    saveTheme(next)
  }

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      data-testid="theme-toggle"
      aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
    >
      <span className={theme === 'light' ? styles.activeSegment : styles.segment}>
        <SunIcon size={15} />
      </span>
      <span className={theme === 'dark' ? styles.activeSegment : styles.segment}>
        <MoonIcon size={15} />
      </span>
    </button>
  )
}
