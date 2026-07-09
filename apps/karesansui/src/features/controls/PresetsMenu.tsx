import { useEffect, useRef, useState } from 'react'

import type { Preset } from '../garden/settings.ts'
import styles from './PresetsMenu.module.scss'

export interface PresetsMenuProps {
  presets: Preset[]
  onLoad: (preset: Preset) => void
  onRename: (index: number, name: string) => void
  onDelete: (index: number) => void
}

/**
 * Saved gardens in a burger menu (plan 0008 D6). Present only once a preset
 * exists, so saved gardens stay out of the resting composition. Each entry
 * loads on click, renames inline (✎ → text field, commit on Enter/blur), or
 * deletes. A real disclosure: Escape and outside-click close it.
 */
export function PresetsMenu({ presets, onLoad, onRename, onDelete }: PresetsMenuProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setEditing(null)
      }
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false)
        setEditing(null)
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (presets.length === 0) return null

  const commitRename = (index: number): void => {
    onRename(index, draft)
    setEditing(null)
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.burger}
        data-testid="presets-menu"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Saved gardens"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.lines} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className={styles.label}>Saved</span>
        <span className={styles.count}>{presets.length}</span>
      </button>

      {open && (
        <div className={styles.panel} role="menu" aria-label="Saved gardens">
          {presets.map((preset, i) => (
            <div key={`${preset.name}-${i}`} className={styles.item} data-testid={`preset-${i}`}>
              {editing === i ? (
                <input
                  className={styles.input}
                  data-testid={`preset-rename-input-${i}`}
                  value={draft}
                  autoFocus
                  aria-label={`Rename ${preset.name}`}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(i)
                  }}
                  onBlur={() => commitRename(i)}
                />
              ) : (
                <button
                  type="button"
                  className={styles.name}
                  onClick={() => {
                    onLoad(preset)
                    setOpen(false)
                  }}
                >
                  {preset.name}
                </button>
              )}
              <button
                type="button"
                className={styles.action}
                data-testid={`preset-rename-${i}`}
                aria-label={`Rename ${preset.name}`}
                onClick={() => {
                  setEditing(i)
                  setDraft(preset.name)
                }}
              >
                ✎
              </button>
              <button
                type="button"
                className={styles.action}
                data-testid={`preset-delete-${i}`}
                aria-label={`Delete ${preset.name}`}
                onClick={() => onDelete(i)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
