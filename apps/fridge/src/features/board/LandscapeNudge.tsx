import { useEffect, useState } from 'react'

import styles from './LandscapeNudge.module.scss'

const QUERY = '(orientation: portrait) and (max-width: 820px)'

/**
 * A lightweight, dismissible hint (ADR 0022 — "Nudge to landscape") shown on a
 * portrait phone: the fixed 3:2 canvas scales down to a short band in portrait,
 * so rotating gives the board more room. Non-blocking — editing still works in
 * portrait via the view zoom/pan. Dismissal lasts the session.
 */
export function LandscapeNudge() {
  const [portrait, setPortrait] = useState(false)
  const [dismissed, setDismissed] = useState(
    () => globalThis.sessionStorage?.getItem('fridge:landscape-nudge') === 'dismissed',
  )

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const update = () => setPortrait(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  if (!portrait || dismissed) return null

  return (
    <div className={styles.nudge} role="status" data-testid="landscape-nudge">
      <span>Rotate your phone for more room to arrange magnets.</span>
      <button
        type="button"
        aria-label="dismiss"
        onClick={() => {
          setDismissed(true)
          globalThis.sessionStorage?.setItem('fridge:landscape-nudge', 'dismissed')
        }}
      >
        ×
      </button>
    </div>
  )
}
