import { switchPlayerUrlFor } from '@hoe/accounts'
import { type RefObject, useLayoutEffect, useRef, useState } from 'react'

import styles from './PlayerLink.module.scss'

function PlayerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="6" r="3" />
      <path d="M3 15.5 c0.8 -3 3.2 -4.5 6 -4.5 s5.2 1.5 6 4.5" />
    </svg>
  )
}

/** Whether the element's text is cut off (ellipsis, or hidden on a narrow room), kept current on resize. */
function useTruncated(ref: RefObject<HTMLElement | null>): boolean {
  const [truncated, setTruncated] = useState(false)
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current
      setTruncated(el !== null && el.scrollWidth > el.clientWidth)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [ref])
  return truncated
}

/** Whose presets these are, and the way to hub to switch player and come back (ADR 0094). */
export function PlayerLink({ name }: { name: string }) {
  const href = switchPlayerUrlFor(window.location.href)
  const nameRef = useRef<HTMLSpanElement>(null)
  const title = useTruncated(nameRef) ? name : undefined
  const content = (
    <>
      <PlayerIcon />
      <span ref={nameRef} className={styles.name}>
        {name}
      </span>
    </>
  )
  // Outside the estate there is no hub to switch at, so it is the name alone.
  return href === null ? (
    <span className={styles.player} title={title} data-testid="player">
      {content}
    </span>
  ) : (
    <a
      className={styles.player}
      href={href}
      title={title}
      aria-label={`Playing as ${name}. Switch player`}
      data-testid="player"
    >
      {content}
    </a>
  )
}
