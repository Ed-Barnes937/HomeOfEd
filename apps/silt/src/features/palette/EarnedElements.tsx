import { type RefObject, useLayoutEffect, useRef, useState } from 'react'

import { MOBILE_QUERY, useMobileLayout } from '../../hooks/useMobileLayout.ts'
import { ElementTile } from '../fieldNotes/ElementTile.tsx'
import { type AnchorPlacement, type AnchorRect, anchorPopover } from './earnedAnchor.ts'
import type { PaletteEntry } from './paletteGroups.ts'
import styles from './EarnedElements.module.scss'

export interface EarnedElementsProps {
  /**
   * The unlocked elements, in roster order - the order `entryIndex().unlockable`
   * declares, not the order the player earned them in (ticket 14: mastery is
   * derived from a set of edges, which remembers no chronology). Never empty -
   * see the note below.
   */
  entries: readonly PaletteEntry[]
  /**
   * Whether the roster still holds something that can be earned. It says only
   * *that* there is more, never what: a silhouette, like the chart's own "?"
   * slots (spec §7).
   */
  moreToEarn: boolean
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
  const placement = usePopoverPlacement(props.open)

  return (
    <div className={styles.anchor}>
      <span className={styles.label}>Earned</span>
      <button
        type="button"
        ref={placement.controlRef}
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
          ref={placement.popoverRef}
          className={styles.popover}
          style={placement.offsets ?? undefined}
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

          {props.moreToEarn ? (
            <span className={styles.teaser} data-testid="earned-more">
              <ElementTile shape="static" size={22} />
              <span className={styles.teaserText}>more to earn in Field notes</span>
            </span>
          ) : null}

          <p className={styles.footer}>earned by mastering an element</p>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Where the open popover sits (ticket 13). The stylesheet cannot do this on its
 * own: the popover has to be `position: fixed` (the rail is a scroll container -
 * see the note in the stylesheet), and a fixed box is placed against the
 * viewport, so the offsets have to be measured off the control at open time
 * rather than written down as a corner.
 *
 * The phone keeps the sheet the stylesheet gives it - a bar replacing a bar -
 * so it gets no inline offsets at all, which an `inset` rule would only have to
 * fight. `useMobileLayout` is the same breakpoint the stylesheet uses.
 */
function usePopoverPlacement(open: boolean): {
  controlRef: RefObject<HTMLButtonElement | null>
  popoverRef: RefObject<HTMLDivElement | null>
  offsets: AnchorPlacement | null
} {
  const controlRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const phone = useMobileLayout()
  const [offsets, setOffsets] = useState<AnchorPlacement | null>(null)

  useLayoutEffect(() => {
    if (!open || phone) {
      setOffsets(null)
      return
    }

    const place = (): void => {
      const control = controlRef.current
      const popover = popoverRef.current
      if (!control || !popover) return
      // A resize that crosses the breakpoint fires here as well as at
      // `useMobileLayout`'s listener, and inline offsets beat the sheet's
      // `inset` rule - so this reads the live query rather than depending on
      // which of the two listeners the browser runs first.
      if (window.matchMedia?.(MOBILE_QUERY).matches) {
        setOffsets(null)
        return
      }
      setOffsets(
        anchorPopover(anchorBoxFor(control), popover.getBoundingClientRect(), {
          width: window.innerWidth,
          height: window.innerHeight,
        }),
      )
    }

    // Before paint, so the popover never shows up in one place and jumps.
    place()
    // The rail scrolling under an open popover is deliberately ignored: picking
    // an element closes it, and it was fixed before this ticket too.
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, phone])

  return { controlRef, popoverRef, offsets }
}

/**
 * The box the popover opens against, taken off two elements on purpose: the
 * rail's edges horizontally, because the rail is the scroll container the
 * popover had to be lifted out of and opening inside its trailing padding
 * would read as sitting on it, and the control's own band vertically, because
 * the control is what the player clicked. The rail is the control's `nav`; with
 * no such ancestor the control speaks for both axes.
 */
function anchorBoxFor(control: HTMLElement): AnchorRect {
  const box = control.getBoundingClientRect()
  const rail = control.closest('nav')?.getBoundingClientRect()

  return {
    top: box.top,
    bottom: box.bottom,
    left: rail?.left ?? box.left,
    right: rail?.right ?? box.right,
  }
}
