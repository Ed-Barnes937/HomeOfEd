import type { PaletteEntry } from './paletteGroups.ts'
import styles from './EarnedElements.module.scss'

export interface EarnedElementsProps {
  /** The unlocked elements, in unlock order. Never empty - see the note below. */
  entries: readonly PaletteEntry[]
  open: boolean
  onToggle: () => void
  onClose: () => void
  /** The element currently selected for painting, whatever it is. */
  selectedId: number
  /** Selects an earned element for painting, exactly as a rail swatch does. */
  onSelect: (id: number) => void
}

/**
 * The rail's EARNED control (discovery-tree spec §6 "The unlock", decision 8):
 * **one** control holding everything mastered, however many unlockables follow,
 * rather than a swatch inserted into the rail. That is what keeps the `1`-`9`
 * hotkeys and the rail's length fixed while the roster grows - an inline entry
 * would renumber the rail the first time something was earned.
 *
 * There is no locked placeholder: the caller renders this only once something
 * has been unlocked, so an untouched rail says nothing about what is coming
 * (spec §7, silhouette policy - the chart is where the goal lives).
 */
export function EarnedElements(props: EarnedElementsProps) {
  const selectedHere = props.entries.some((entry) => entry.id === props.selectedId)

  return (
    <div className={styles.anchor}>
      <span className={styles.label}>Earned</span>
      <button
        type="button"
        className={styles.control}
        data-testid="earned-button"
        aria-expanded={props.open}
        // The rail shows where the current selection lives, the way a swatch
        // does - the popover closes on select, so this is the only thing left
        // on screen saying the brush is loaded with something earned.
        aria-pressed={selectedHere}
        onClick={props.onToggle}
      >
        <span className={styles.mark} aria-hidden="true" />
        <span className={styles.controlName}>elements</span>
        <span className={styles.count}>{props.entries.length}</span>
      </button>

      {props.open ? (
        <div
          className={styles.popover}
          data-testid="earned-popover"
          role="dialog"
          aria-label="earned elements"
        >
          <div className={styles.head}>
            <span className={styles.headTitle}>Earned elements</span>
            <button
              type="button"
              className={styles.close}
              data-testid="earned-close"
              aria-label="close earned elements"
              onClick={props.onClose}
            >
              ×
            </button>
          </div>

          {props.entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={styles.row}
              data-testid={`earned-element-${entry.name}`}
              aria-pressed={props.selectedId === entry.id}
              onClick={() => props.onSelect(entry.id)}
            >
              <span
                className={styles.swatch}
                style={{ background: entry.colour }}
                aria-hidden="true"
              />
              <span className={styles.rowName}>{entry.name}</span>
            </button>
          ))}

          <p className={styles.footer}>earned by mastering an element</p>
        </div>
      ) : null}
    </div>
  )
}
