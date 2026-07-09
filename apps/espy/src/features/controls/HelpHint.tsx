import { useId, useState } from 'react'

import styles from './HelpHint.module.scss'

export interface HelpHintProps {
  /** The hint text to reveal (the same copy as the header subtitle). */
  text: string
}

/**
 * A `?` button that reveals the how-to-play hint in a tooltip. Hidden by
 * default; a container query shows it only when the header subtitle is hidden
 * (narrow viewports — spec §11.1). `open` is derived from hover and focus:
 * pointer hover and keyboard focus both reveal it, and on touch a tap focuses
 * the button (revealing it) while tapping away blurs it (hiding it).
 */
export function HelpHint({ text }: HelpHintProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const tipId = useId()
  const open = hovered || focused

  return (
    <div
      className={styles.wrap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-label="How to play"
        aria-expanded={open}
        aria-describedby={tipId}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        ?
      </button>
      <span id={tipId} role="tooltip" className={styles.tip} data-open={open}>
        {text}
      </span>
    </div>
  )
}
