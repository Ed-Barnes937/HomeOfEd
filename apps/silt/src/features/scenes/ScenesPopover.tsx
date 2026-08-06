import { useEffect, useRef, useState } from 'react'

import type { SceneMeta } from './sceneStore.ts'
import styles from './ScenesPopover.module.scss'

/** How long a delete click stays armed before it forgets the first click (spec §9). */
const DELETE_ARM_MS = 3000

export interface SceneRow extends SceneMeta {
  /** PNG data URL of the world as it was saved, or `null` if it did not fit. */
  thumbnail: string | null
  /** Why this scene last failed to load. It stays listed regardless (spec §8). */
  error: string | null
}

export interface ScenesPopoverProps {
  scenes: readonly SceneRow[]
  /** Result of the last save/load, shown above the list. */
  status: { tone: 'ok' | 'error'; text: string } | null
  onSave: () => void
  onLoad: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

/**
 * The scenes popover (spec §9): save current at the top, then a row per saved
 * scene with its thumbnail, an inline rename and a delete that needs a second
 * click — the second click is required, because deleting is the only way out
 * of a full quota.
 */
export function ScenesPopover(props: ScenesPopoverProps) {
  const [armedDelete, setArmedDelete] = useState<string | null>(null)
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (armTimer.current) clearTimeout(armTimer.current)
    }
  }, [])

  const armDelete = (id: string): void => {
    if (armedDelete !== id) {
      setArmedDelete(id)
      if (armTimer.current) clearTimeout(armTimer.current)
      armTimer.current = setTimeout(() => setArmedDelete(null), DELETE_ARM_MS)
      return
    }
    if (armTimer.current) clearTimeout(armTimer.current)
    setArmedDelete(null)
    props.onDelete(id)
  }

  const commitRename = (scene: SceneRow, value: string): void => {
    const name = value.trim()
    if (name && name !== scene.name) props.onRename(scene.id, name)
  }

  return (
    <div className={styles.popover} data-testid="scenes-popover" role="dialog" aria-label="scenes">
      <div className={styles.head}>
        <span className={styles.headTitle}>Scenes</span>
        <button
          type="button"
          className={styles.close}
          data-testid="scenes-close"
          aria-label="close scenes"
          onClick={props.onClose}
        >
          ×
        </button>
      </div>

      <button type="button" className={styles.save} data-testid="scene-save" onClick={props.onSave}>
        save current
      </button>

      {props.status ? (
        <p
          className={props.status.tone === 'error' ? styles.error : styles.ok}
          data-testid="scenes-status"
        >
          {props.status.text}
        </p>
      ) : null}

      {props.scenes.length === 0 ? (
        <p className={styles.empty} data-testid="scenes-empty">
          nothing saved yet
        </p>
      ) : (
        <ul className={styles.list}>
          {props.scenes.map((scene) => (
            <li key={scene.id} className={styles.row} data-testid={`scene-row-${scene.name}`}>
              {scene.thumbnail ? (
                <img
                  className={styles.thumb}
                  src={scene.thumbnail}
                  alt=""
                  data-testid="scene-thumb"
                />
              ) : (
                <span className={styles.thumb} aria-hidden="true" />
              )}

              <div className={styles.rowBody}>
                <input
                  className={styles.name}
                  data-testid={`scene-name-${scene.name}`}
                  aria-label={`rename ${scene.name}`}
                  defaultValue={scene.name}
                  // Remounting on rename is what lets `defaultValue` stay the
                  // source of truth — the row is only ever edited in place.
                  key={`${scene.id}:${scene.name}`}
                  onBlur={(event) => commitRename(scene, event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                    if (event.key === 'Escape') {
                      event.currentTarget.value = scene.name
                      event.currentTarget.blur()
                    }
                  }}
                />
                {scene.error ? (
                  <span className={styles.error} data-testid={`scene-error-${scene.name}`}>
                    {scene.error}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                className={styles.action}
                data-testid={`scene-load-${scene.name}`}
                onClick={() => props.onLoad(scene.id)}
              >
                load
              </button>
              <button
                type="button"
                className={`${styles.action} ${armedDelete === scene.id ? styles.armed : ''}`}
                data-testid={`scene-delete-${scene.name}`}
                onClick={() => armDelete(scene.id)}
              >
                {armedDelete === scene.id ? 'sure?' : 'delete'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.footer}>this browser only</p>
    </div>
  )
}
