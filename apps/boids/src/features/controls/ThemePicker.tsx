import type { ThemeId } from '../sim/settings.ts'
import { THEME_ORDER, THEMES } from '../sim/themes.ts'
import styles from './ThemePicker.module.scss'

export interface ThemePickerProps {
  value: ThemeId
  onChange: (theme: ThemeId) => void
}

/** 2x2 grid of theme chips: a preview swatch + palette dots above the name. */
export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className={styles.grid}>
      {THEME_ORDER.map((id) => {
        const theme = THEMES[id]
        const selected = id === value
        return (
          <button
            key={id}
            type="button"
            className={styles.chip}
            aria-selected={selected}
            onClick={() => onChange(id)}
          >
            <div className={styles.preview} style={{ background: theme.background }}>
              {theme.palette.slice(0, 3).map((color) => (
                <span
                  key={color}
                  className={styles.dot}
                  style={{
                    background: color,
                    boxShadow: theme.glow > 0 ? `0 0 7px ${color}` : undefined,
                  }}
                />
              ))}
            </div>
            <span className={styles.name}>{theme.name}</span>
          </button>
        )
      })}
    </div>
  )
}
