import { useEffect, useRef, useState } from 'react'

import type { Kit, Pattern } from '../../engine/sequencerEngine.ts'
import type { StoredBoop, StoredPattern } from '../../persistence/saveFormat.ts'
import { useBoops } from '../../persistence/useBoops.ts'
import { useIsPhone } from '../../useIsPhone.ts'
import { ConfirmCard } from '../confirm/ConfirmCard.tsx'
import { PresetThumbnail } from '../presets/PresetThumbnail.tsx'
import { generateBoopName } from './boopNames.ts'
import styles from './BoopsPanel.module.scss'

interface BoopsPanelProps {
  onClose: () => void
  /** Loads a saved boop into the working grid. */
  onLoad: (boop: StoredBoop) => void
  /** Read at tap time (Save button), not render time — see `TopBar`'s `getShareUrl` for the same reasoning. */
  getWorkingSnapshot: () => { kit: Kit; pattern: Pattern; tempo: number }
  /** Renders one saved boop to a WAV and hands it to the share sheet or a download (ticket 34). */
  onExport: (boop: StoredBoop) => Promise<void>
}

type Editing =
  | { kind: 'none' }
  | { kind: 'renaming'; index: number; name: string }
  | { kind: 'deleting'; index: number }

/** How long the freshly saved row keeps its highlight (ticket 32). */
const HIGHLIGHT_MS = 1200

/** One row's dots, read off its bitstrings — position only, matching `PresetThumbnail`'s shape. */
function thumbnailRows(pattern: StoredPattern) {
  return pattern.rows.map((row) => ({
    steps: Array.from(row.steps, (c) => c === '1'),
  }))
}

/**
 * "My boops" (design handoff §4): a light paper card opened from the top bar.
 * Reads title, save form, list, footer note.
 *
 * The save form is always on and always prefilled with the generated name
 * (ticket 32), so saving stays one tap with no keyboard; Save is blocked only
 * while the field is empty. After a save the dialog stays open, the new row is
 * briefly highlighted, and the field re-prefills with the *next* name — the box
 * therefore always holds the name the next press will write, which is what
 * stops a second press duplicating the first.
 *
 * Each row loads on tap and carries rename, delete and export icon buttons.
 */
export function BoopsPanel({ onClose, onLoad, getWorkingSnapshot, onExport }: BoopsPanelProps) {
  const boops = useBoops()
  const [editing, setEditing] = useState<Editing>({ kind: 'none' })
  const [name, setName] = useState(() => generateBoopName(boops.boops.map((b) => b.name)))
  const [highlighted, setHighlighted] = useState<number | null>(null)
  const [exportingIndex, setExportingIndex] = useState<number | null>(null)
  // A phone autofocus would open the keyboard over the list the child just
  // asked to see, for a name they were not going to change (ticket 32).
  const phone = useIsPhone()

  useEffect(() => {
    if (highlighted === null) return
    const timer = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [highlighted])

  function handleSave() {
    const trimmed = name.trim()
    if (trimmed === '') return
    const { kit, pattern, tempo } = getWorkingSnapshot()
    const { index } = boops.save(kit, pattern, tempo, trimmed)
    setHighlighted(index)
    setName(generateBoopName([...boops.boops.map((b) => b.name), trimmed]))
  }

  // The double-tap guard lives in a ref, not in `exportingIndex`: two taps
  // inside one task both read the pre-render state, so only a ref can stop the
  // second starting a render of its own. The state is what disables the button.
  const exporting = useRef(false)
  function handleExport(index: number, boop: StoredBoop) {
    if (exporting.current) return
    exporting.current = true
    setExportingIndex(index)
    void (async () => {
      try {
        await onExport(boop)
      } finally {
        exporting.current = false
        setExportingIndex(null)
      }
    })()
  }

  function commitRename(index: number, newName: string) {
    const trimmed = newName.trim()
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

          <form
            className={styles.saveForm}
            onSubmit={(event) => {
              event.preventDefault()
              handleSave()
            }}
          >
            <input
              className={styles.nameInput}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Name for this boop"
              autoFocus={!phone}
              data-testid="boop-save-name-input"
            />
            <button
              type="submit"
              className={styles.saveButton}
              disabled={name.trim() === ''}
              data-testid="save-boop-button"
            >
              Save this boop
            </button>
          </form>

          <div className={styles.list} data-testid="boops-list">
            {boops.boops.length === 0 && <p className={styles.empty}>No boops saved yet.</p>}
            {boops.boops.map((boop, index) => (
              <div
                key={index}
                className={`${styles.row}${highlighted === index ? ` ${styles.rowHighlight}` : ''}`}
                data-highlighted={highlighted === index}
                data-testid={`boop-row-${index}`}
              >
                {editing.kind === 'renaming' && editing.index === index ? (
                  <NameField
                    initialName={editing.name}
                    onDone={(newName) => commitRename(index, newName)}
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
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => handleExport(index, boop)}
                      disabled={exportingIndex !== null}
                      aria-label={`Export ${boop.name}`}
                      data-exporting={exportingIndex === index}
                      data-testid={`boop-export-button-${index}`}
                    >
                      <DownloadIcon />
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

/** The focused rename field + "Done" button a row switches to when the pencil is tapped (design handoff §5). */
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

function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}
