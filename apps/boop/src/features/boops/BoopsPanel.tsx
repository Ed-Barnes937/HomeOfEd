import { useEffect, useRef, useState } from 'react'

import type { Kit, Pattern } from '../../engine/sequencerEngine.ts'
import type { StoredBoop, StoredPattern } from '../../persistence/saveFormat.ts'
import { useBoops } from '../../persistence/useBoops.ts'
import { ConfirmCard } from '../confirm/ConfirmCard.tsx'
import { PresetThumbnail } from '../presets/PresetThumbnail.tsx'
import styles from './BoopsPanel.module.scss'

interface BoopsPanelProps {
  onClose: () => void
  /** Loads a saved boop into the working grid. */
  onLoad: (boop: StoredBoop) => void
  /** Read at tap time (Save button), not render time — see `TopBar`'s `getShareUrl` for the same reasoning. */
  getWorkingSnapshot: () => { kit: Kit; pattern: Pattern; tempo: number }
  /**
   * Open straight into the "Saved it" moment, having already saved — the phone
   * chrome's save icon (ticket 27), which has nowhere of its own to show it.
   */
  saveOnOpen?: boolean
}

type Editing =
  | { kind: 'none' }
  | { kind: 'saved'; index: number; name: string }
  | { kind: 'renaming'; index: number; name: string }
  | { kind: 'deleting'; index: number }

/** One row's dots, read off its bitstrings — position only, matching `PresetThumbnail`'s shape. */
function thumbnailRows(pattern: StoredPattern) {
  return pattern.rows.map((row) => ({
    steps: Array.from(row.steps, (c) => c === '1'),
  }))
}

/**
 * "My boops" (design handoff §4): a light paper card opened from the top
 * bar. Lists saved boops with a dot-matrix thumbnail, rename and delete
 * icon buttons; tapping a row loads it. Save snapshots the working grid
 * immediately under a generated name and shows the "Saved it" moment (§5) —
 * the field it puts focus in is a rename, not a gate, since the save has
 * already happened.
 */
export function BoopsPanel({ onClose, onLoad, getWorkingSnapshot, saveOnOpen }: BoopsPanelProps) {
  const boops = useBoops()
  const [editing, setEditing] = useState<Editing>({ kind: 'none' })

  function handleSave() {
    const { kit, pattern, tempo } = getWorkingSnapshot()
    const { boop, index } = boops.save(kit, pattern, tempo)
    setEditing({ kind: 'saved', index, name: boop.name })
  }

  // Saves once per mount, guarded by a ref rather than by the dependency list:
  // StrictMode runs the effect twice, and a second `save` would write a
  // duplicate boop. `handleSave` is left out of the deps for the same reason
  // — it is rebuilt every render, and re-running it is exactly what we don't
  // want. The panel is unmounted on close (`HomePage`), so "once per mount" is
  // once per time the save icon is tapped.
  const savedOnOpen = useRef(false)
  useEffect(() => {
    if (saveOnOpen !== true || savedOnOpen.current) return
    savedOnOpen.current = true
    handleSave()
  }, [saveOnOpen])

  function commitRename(index: number, name: string) {
    const trimmed = name.trim()
    if (trimmed !== '') boops.rename(index, trimmed)
    setEditing({ kind: 'none' })
  }

  const deletingName = editing.kind === 'deleting' ? boops.boops[editing.index]?.name : undefined

  return (
    // `ConfirmCard` renders outside the backdrop's own onClick region: nested
    // inside it, its "Keep it"/"Throw away" click would bubble up and close
    // this whole panel along with the confirm.
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div
          className={styles.card}
          role="dialog"
          aria-modal="true"
          aria-label="My boops"
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.header}>
            <span className={styles.title}>My boops</span>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close My boops"
              data-testid="boops-close-button"
            >
              ×
            </button>
          </div>

          {editing.kind === 'saved' ? (
            <div className={styles.savedMoment}>
              <p className={styles.savedTitle}>Saved it</p>
              <NameField
                initialName={editing.name}
                onDone={(name) => commitRename(editing.index, name)}
                testId="boop-save-name"
              />
              <p className={styles.savedHelper}>Already saved. Type a new name if you want one.</p>
            </div>
          ) : (
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSave}
              data-testid="save-boop-button"
            >
              Save this boop
            </button>
          )}

          <div className={styles.list}>
            {boops.boops.length === 0 && <p className={styles.empty}>No boops saved yet.</p>}
            {boops.boops.map((boop, index) => (
              <div key={index} className={styles.row} data-testid={`boop-row-${index}`}>
                {editing.kind === 'renaming' && editing.index === index ? (
                  <NameField
                    initialName={editing.name}
                    onDone={(name) => commitRename(index, name)}
                    testId={`boop-rename-${index}`}
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.rowLoad}
                      onClick={() => onLoad(boop)}
                      data-testid={`boop-load-${index}`}
                    >
                      <PresetThumbnail rows={thumbnailRows(boop.patterns[0]!)} tone="paper" />
                      <span className={styles.name}>{boop.name}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => setEditing({ kind: 'renaming', index, name: boop.name })}
                      aria-label={`Rename ${boop.name}`}
                      data-testid={`boop-rename-button-${index}`}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButtonDanger}
                      onClick={() => setEditing({ kind: 'deleting', index })}
                      aria-label={`Delete ${boop.name}`}
                      data-testid={`boop-delete-button-${index}`}
                    >
                      <BinIcon />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <p className={styles.footer}>Tap a boop to open it. No limit on how many you keep.</p>
        </div>
      </div>

      {editing.kind === 'deleting' && deletingName !== undefined && (
        <ConfirmCard
          title={`Throw away ${deletingName}?`}
          message="You can't get it back."
          safeLabel="Keep it"
          destructiveLabel="Throw away"
          onSafe={() => setEditing({ kind: 'none' })}
          onDestructive={() => {
            boops.remove(editing.index)
            setEditing({ kind: 'none' })
          }}
        />
      )}
    </>
  )
}

interface NameFieldProps {
  initialName: string
  onDone: (name: string) => void
  testId: string
}

/** The focused rename field + "Done" button shared by the save moment and row rename (design handoff §5). */
function NameField({ initialName, onDone, testId }: NameFieldProps) {
  const [value, setValue] = useState(initialName)
  return (
    <div className={styles.nameField}>
      <input
        className={styles.nameInput}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onDone(value)
        }}
        autoFocus
        data-testid={`${testId}-input`}
      />
      <button type="button" className={styles.doneButton} onClick={() => onDone(value)} data-testid={`${testId}-done`}>
        Done
      </button>
    </div>
  )
}

function PencilIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function BinIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
    </svg>
  )
}
