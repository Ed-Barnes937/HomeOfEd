import { useState } from 'react'

import type { Preset } from '../garden/settings.ts'
import styles from './SavedTray.module.scss'

export interface SavedTrayProps {
  presets: Preset[]
  onLoad: (preset: Preset) => void
  onDelete: (index: number) => void
}

/**
 * A slim tray that slides up from the bottom edge — present only when presets
 * exist, so saved gardens stay out of the resting composition (plan D3). The
 * handle is a real disclosure button; collapsed pills are `hidden` (out of the
 * tab order) until it's opened.
 */
export function SavedTray({ presets, onLoad, onDelete }: SavedTrayProps) {
  const [open, setOpen] = useState(false)
  if (presets.length === 0) return null

  return (
    <div className={styles.tray} data-open={open}>
      <button
        type="button"
        className={styles.handle}
        data-testid="tray-toggle"
        aria-expanded={open}
        aria-controls="saved-tray-panel"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.handleLabel}>Saved gardens</span>
        <span className={styles.count}>{presets.length}</span>
        <span className={styles.caret} aria-hidden="true" data-open={open}>
          ▴
        </span>
      </button>

      <div className={styles.pills} id="saved-tray-panel" hidden={!open}>
        {presets.map((preset, i) => (
          <span key={`${preset.name}-${i}`} className={styles.pill} data-testid={`preset-${i}`}>
            <button type="button" className={styles.name} onClick={() => onLoad(preset)}>
              {preset.name}
            </button>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Delete preset ${preset.name}`}
              data-testid={`preset-delete-${i}`}
              onClick={() => onDelete(i)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
