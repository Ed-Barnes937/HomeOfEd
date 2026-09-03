/**
 * Field notes' entry point in the header, beside SCENES (spec §6): the words,
 * plus how many interactions have been witnessed out of the roster's total.
 *
 * The chip is the whole progress display - there is no badge and no persistent
 * completion cosmetic (decision 4). It greys its numerals until the first
 * witness, inverts for a beat each time one lands, and inverts for good at
 * `n/n`, which is the last thing it ever does.
 */
import { useEffect, useRef, useState } from 'react'

import styles from './FieldNotesButton.module.scss'

/** How long the chip inverts when the count goes up (spec §6). */
export const TICK_MS = 250

export interface FieldNotesButtonProps {
  /** Witnessed interactions, and the roster's total - both derived, never stored. */
  seen: number
  total: number
  open: boolean
  onToggle: () => void
}

export function FieldNotesButton(props: FieldNotesButtonProps) {
  const [ticking, setTicking] = useState(false)
  const previous = useRef(props.seen)

  useEffect(() => {
    // Only upwards: "forget discoveries" drops the count to zero, and that is
    // not something to celebrate with a tick.
    if (props.seen <= previous.current) {
      previous.current = props.seen
      return
    }
    previous.current = props.seen
    setTicking(true)
    const timer = setTimeout(() => setTicking(false), TICK_MS)
    return () => clearTimeout(timer)
  }, [props.seen])

  const complete = props.total > 0 && props.seen === props.total
  const className = [
    styles.button,
    props.seen === 0 ? styles.untouched : '',
    complete || ticking ? styles.inverted : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={className}
      data-testid="field-notes-button"
      aria-expanded={props.open}
      onClick={props.onToggle}
    >
      <span className={styles.label}>field notes</span>
      <span className={styles.count} data-testid="field-notes-count">
        {props.seen}/{props.total}
      </span>
    </button>
  )
}
