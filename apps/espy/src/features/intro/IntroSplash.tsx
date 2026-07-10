import { useEffect, useState } from 'react'

import styles from './IntroSplash.module.scss'

/** How long the definition holds before it begins to fade (feedback: ~1–2s). */
const HOLD_MS = 1400
/** Fade-out duration; kept in step with the CSS transition below. */
const FADE_MS = 400

/**
 * A calm, one-shot intro shown on every load: the dictionary definition of
 * "espy" for ~1.5s, then it fades and unmounts to reveal the canvas.
 *
 * `pointer-events: none` (in the module) means it never blocks the canvas
 * mounting/warming underneath — an eager tap draws straight through it. Under
 * `prefers-reduced-motion` the CSS transition is dropped; the same timers still
 * unmount it, so nothing animates.
 */
export function IntroSplash() {
  const [phase, setPhase] = useState<'hold' | 'leaving' | 'gone'>('hold')

  useEffect(() => {
    const toLeaving = window.setTimeout(() => setPhase('leaving'), HOLD_MS)
    const toGone = window.setTimeout(() => setPhase('gone'), HOLD_MS + FADE_MS)
    return () => {
      clearTimeout(toLeaving)
      clearTimeout(toGone)
    }
  }, [])

  if (phase === 'gone') return null

  return (
    <div
      className={`${styles.splash} ${phase === 'leaving' ? styles.leaving : ''}`}
      data-testid="intro-splash"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Announced to assistive tech; the visible copy below is decorative flavour. */}
      <span className={styles.srOnly}>Loading espy…</span>
      <div className={styles.entry}>
        <h1 className={styles.word}>espy</h1>
        <p className={styles.pronunciation}>/ɪˈspʌɪ/ &middot; verb</p>
        <p className={styles.definition}>
          catch sight of; suddenly notice something, especially something distant or partly hidden.
        </p>
        {/* Gentle "still working" motion for sighted users; hidden from AT. */}
        <div className={styles.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}
