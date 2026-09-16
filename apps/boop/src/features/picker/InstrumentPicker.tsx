import { useEffect, useRef, type CSSProperties } from 'react'

import type { Kit } from '../../engine/sequencerEngine.ts'
import { instrumentSections } from './instrumentGroups.ts'
import styles from './InstrumentPicker.module.scss'

interface InstrumentPickerProps {
  /** The roster (ADR 0042): the only enumeration of instruments there is. */
  kit: Kit
  /** The dialog's title and accessible name — "Change this sound", "Add a sound". */
  title: string
  /**
   * The instruments the clip already holds. They render disabled: a clip may
   * not hold one twice (spec §1), and the *current* row's own sound is in here
   * too, so re-tapping it auditions and changes nothing.
   */
  inClip: readonly string[]
  /**
   * The hue every entry is tinted in: the opening row's colour var (hues are
   * positional — `ROW_COLOR_VARS[rowIndex % 6]`), so the dialog reads as
   * belonging to the row that opened it.
   */
  colorVar: string
  /**
   * A sound was tapped. The caller auditions it and applies it — and decides
   * whether the dialog closes: the row-swap route deliberately stays open so a
   * child can browse by ear (spec §4, §10.1), while ticket 06's add-a-row route
   * closes, because "add" is one decision rather than browsing.
   */
  onChoose: (instrumentId: string) => void
  onClose: () => void
  /**
   * The footer's "Remove this row". Omitted where there is nothing to remove —
   * the one-row floor, and the add-a-row route, which has no row yet.
   */
  onRemoveRow?: () => void
  /**
   * The starred instrument ids (ticket 01). Ids the kit does not contain are
   * ignored here and kept in storage — `instrumentSections` filters.
   */
  favourites: readonly string[]
  /** An entry's star was tapped — its own hit target, never a choose. */
  onToggleFavourite: (instrumentId: string) => void
}

/**
 * The instrument picker (spec §4): the roster as a paper-card dialog in
 * `NewClipPicker`'s idiom, sectioned Drums / Notes / Silly with each entry the
 * instrument's own artwork and name, tinted in the opening row's hue.
 *
 * It is deliberately *not* choose-and-close like `NewClipPicker`: this dialog
 * is for finding a sound by ear, so the caller keeps it open while the row
 * swaps live underneath it. The 20 entries scroll inside the card, which is
 * what keeps it on a 390px phone.
 *
 * Dismiss follows the app's other dialogs — the ×, the dimmed backdrop, and
 * Escape. Escape is taken in the **capture** phase and stopped there: this
 * dialog opens over `ClipEditorCard`, whose own Escape listener sits on
 * `window` (so it would otherwise fire in the same keystroke and close the grid
 * behind us). The innermost dialog wins, which is what a modal stack means.
 *
 * Focus moves into the card on mount so a keyboard user is not left tabbing
 * from behind the backdrop. There is no focus *trap*: no dialog in this app has
 * one, and adding one here alone would make this dialog behave unlike its four
 * siblings.
 */
export function InstrumentPicker({
  kit,
  title,
  inClip,
  colorVar,
  onChoose,
  onClose,
  onRemoveRow,
  favourites,
  onToggleFavourite,
}: InstrumentPickerProps) {
  const card = useRef<HTMLDivElement>(null)
  const held = new Set(inClip)
  const starred = new Set(favourites)

  useEffect(() => {
    card.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={onClose} data-testid="instrument-picker-overlay">
      <div
        ref={card}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{ '--row-color': `var(${colorVar})` } as CSSProperties}
        data-testid="instrument-picker"
      >
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={`Close ${title}`}
            data-testid="instrument-picker-close-button"
          >
            ×
          </button>
        </div>

        <div className={styles.list} data-testid="instrument-picker-list">
          {instrumentSections(kit, favourites).map((section) => (
            <div
              key={section.id}
              className={styles.section}
              data-testid={`instrument-picker-section-${section.id}`}
            >
              <span
                className={styles.sectionLabel}
                data-testid={`instrument-picker-section-label-${section.id}`}
              >
                {section.label}
              </span>
              <div className={styles.entries}>
                {section.instruments.map((instrument) => {
                  const alreadyHere = held.has(instrument.instrumentId)
                  const isFavourite = starred.has(instrument.instrumentId)
                  return (
                    <div key={instrument.instrumentId} className={styles.entryCell}>
                      <button
                        type="button"
                        className={styles.entry}
                        disabled={alreadyHere}
                        onClick={() => onChoose(instrument.instrumentId)}
                        aria-label={
                          alreadyHere
                            ? `${instrument.name}. Already in this clip.`
                            : instrument.name
                        }
                        data-in-clip={alreadyHere}
                        data-testid={`instrument-picker-entry-${instrument.instrumentId}`}
                      >
                        <span
                          className={styles.artwork}
                          style={{
                            maskImage: `url(${instrument.artwork})`,
                            WebkitMaskImage: `url(${instrument.artwork})`,
                          }}
                        />
                        <span className={styles.name}>{instrument.name}</span>
                      </button>
                      {/* Its own hit target, over the tile's corner: starring
                          must never audition or select the sound (ticket 01).
                          The testid carries the section — a favourited sound
                          renders twice, so the id alone would be ambiguous. */}
                      <button
                        type="button"
                        className={styles.star}
                        onClick={() => onToggleFavourite(instrument.instrumentId)}
                        aria-pressed={isFavourite}
                        aria-label={`Favourite ${instrument.name}`}
                        data-testid={`instrument-picker-star-${section.id}-${instrument.instrumentId}`}
                      >
                        <svg viewBox="0 0 24 24" className={styles.starIcon} aria-hidden="true">
                          <path d="M12 2.6l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-1z" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {onRemoveRow && (
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.removeButton}
              onClick={onRemoveRow}
              data-testid="instrument-picker-remove-row"
            >
              Remove this row
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
