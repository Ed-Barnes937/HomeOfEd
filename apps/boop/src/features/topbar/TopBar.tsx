import { hubUrl } from '../../hubUrl.ts'
import styles from './TopBar.module.scss'

/**
 * The top bar: back-to-hub arrow, wordmark, and the chrome buttons from the
 * design handoff. "My grooves", "Share" and "?" are style-only placeholders
 * here — their behaviour lands in later tickets (My grooves, sharing, the
 * hint sheet); this ticket only wires the grid and play/pause.
 */
export function TopBar() {
  return (
    <header className={styles.bar}>
      <a className={styles.back} href={hubUrl(window.location.hostname)} aria-label="Back to home of ed">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
      </a>
      <span className={styles.wordmark}>boop</span>
      <div className={styles.spacer} />
      <button type="button" className={styles.ghost} aria-disabled="true">
        My grooves
      </button>
      <button type="button" className={styles.primary} aria-disabled="true">
        Share
      </button>
      <button type="button" className={styles.help} aria-label="How boop works" aria-disabled="true">
        ?
      </button>
    </header>
  )
}
