import { hubUrlFor, playerCircleFor, profileStorage, reloadOnPlayerChange } from '@hoe/accounts'
import { useEffect, useState } from 'react'

import { Toolbar } from '../features/controls/Toolbar.tsx'
import { FluidTuner } from '../features/doodle/FluidTuner.tsx'
import { PROFILE_KEYS } from '../features/doodle/profileKeys.ts'
import { useDoodle } from '../features/doodle/useDoodle.ts'
import { IntroSplash } from '../features/intro/IntroSplash.tsx'
import { hubUrl } from '../hubUrl.ts'
import { usePlayer } from '../player/PlayerContext.tsx'
import styles from './DoodlePage.module.scss'

/** TEMPORARY: show the fluid tuner only when the URL has `?tune`. */
const TUNE =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('tune')

/** The one-line "how to play" hint. Shown as the header subtitle on wider
 * viewports; surfaced through the toolbar's `?` tooltip when the subtitle is
 * hidden (narrow viewports). Single source so the two never drift. */
export const HINT_TEXT =
  'Add a few lines - legs, a tail, whiskers, a smile. Then give it eyes, and the ink comes alive.'

/** Sketchbook shell (spec §11.1): header → canvas card → toolbar footer. */
export function DoodlePage() {
  const { session, native } = usePlayer()
  const accountId = session?.sub ?? null
  const [storage] = useState(() => profileStorage(window.localStorage, accountId, PROFILE_KEYS))
  // The native shell has no family cookie to watch.
  useEffect(() => (native ? undefined : reloadOnPlayerChange(accountId)), [native, accountId])
  const { canvasRef, tool, setTool, nib, setNib, newPage, undo, canUndo, save } = useDoodle(storage)

  return (
    <main className={styles.page}>
      {TUNE && <FluidTuner onRegenerate={newPage} />}
      <IntroSplash />
      <header className={styles.header}>
        <a
          className={styles.back}
          href={
            // The native shell keeps its pre-estate target (ADR 0094); see ticket 13.
            native ? hubUrl(window.location.hostname) : hubUrlFor(window.location.href)
          }
          aria-label="Back to home of ed"
        >
          <svg
            width="20"
            height="20"
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
        <div className={styles.titleBlock}>
          <h1 className={styles.wordmark}>espy</h1>
          <p className={styles.subtitle} data-testid="hint-subtitle">
            {HINT_TEXT}
          </p>
        </div>
        {session !== null && <PlayerLink name={session.name} />}
      </header>

      <div className={styles.canvasArea}>
        <div className={styles.card}>
          <canvas
            ref={canvasRef}
            data-testid="doodle-canvas"
            className={styles.canvas}
            data-tool={tool}
          />
        </div>
      </div>

      <footer className={styles.toolbar}>
        <Toolbar
          tool={tool}
          setTool={setTool}
          nib={nib}
          setNib={setNib}
          newPage={newPage}
          undo={undo}
          canUndo={canUndo}
          save={save}
          hint={HINT_TEXT}
        />
      </footer>
    </main>
  )
}

/** Who is drawing, as an avatar circle linking to hub to switch player and come back (spec
 *  decision 10). Outside the estate there is no hub to switch at, so it only names the player. */
export function PlayerLink({ name }: { name: string }) {
  const { initial, label, href } = playerCircleFor(name, window.location.href)
  return href === null ? (
    <span
      className={styles.player}
      role="img"
      aria-label={label}
      title={name}
      data-testid="player"
    >
      {initial}
    </span>
  ) : (
    <a
      className={styles.player}
      href={href}
      aria-label={label}
      title={name}
      data-testid="player"
    >
      {initial}
    </a>
  )
}
