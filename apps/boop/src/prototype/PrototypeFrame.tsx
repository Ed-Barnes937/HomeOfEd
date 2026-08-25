// PROTOTYPE — throwaway. See ./README.md. Delete this folder once a variant wins.
import { useState, type ReactNode } from 'react'

import type { Variant } from './usePrototypeVariant.ts'
import styles from './PrototypeFrame.module.scss'

interface PrototypeFrameProps {
  /** `now` never reaches here — HomePage keeps its own JSX for the control. */
  variant: Exclude<Variant, 'now'>
  /** The real `PhoneBar` (<1024) or `TopBar` (>=1024). */
  chrome: ReactNode
  /** The real `ClipHeader`. */
  clipHeader: ReactNode
  /** The real `PhoneGrid` (<1024) or `Grid` with its `ClipControl` footer (>=1024). */
  grid: ReactNode
  /** The real `PhoneSongBar` (<1024) or `SongBar` (>=1024) — rehoused, not rewritten. */
  songBar: ReactNode
  /**
   * The real `Transport` — phone only. At >=1024 there is no transport: the
   * shipped laptop layout folded clip play into `ClipControl` (inside the grid
   * well) and tempo into `SongBar`'s Speed, so this is `null` there.
   */
  transport: ReactNode | null
  /** Song play, for `song-dialog`'s launcher row. */
  songPlaying: boolean
  onToggleSong: () => void
  /** How many of the 16 positions hold anything — the launcher's "N bars". */
  placedCount: number
  /** The active clip, for `clip-dialog`'s launcher row. */
  clipName: string
  clipTint: string
  clipPlaying: boolean
  onToggleClip: () => void
  /**
   * `clip-dialog`'s editor is **controlled** by HomePage, unlike
   * `song-dialog`'s card. It has to be: tapping a clip chip in the song bar is
   * the natural way into the editor, and the song bar is an opaque slot here,
   * so only HomePage can turn a chip tap into an open.
   */
  clipOpen: boolean
  onClipOpenChange: (open: boolean) => void
}

/**
 * Every variant of the screenspace question, at **every** width, sharing one
 * three-section frame (chrome / one scroller / pinned dock) so only the
 * *arrangement* differs — the components inside are the shipped ones, and
 * HomePage picks the right cast for the width before handing them over.
 *
 * The point both variants make: the grid and the song surface stop being on
 * screen together, so the grid takes the whole scrolling region and every
 * compromise the shipped layout needs to hold both — the phone's three-row
 * grid floor, the laptop dock's `max-height: max(32dvh, 100px)` cap, the 505px
 * page-scroll exception — stops doing any work.
 */
export function PrototypeFrame({
  variant,
  chrome,
  clipHeader,
  grid,
  songBar,
  transport,
  songPlaying,
  onToggleSong,
  placedCount,
  clipName,
  clipTint,
  clipPlaying,
  onToggleClip,
  clipOpen,
  onClipOpenChange,
}: PrototypeFrameProps) {
  const [songOpen, setSongOpen] = useState(false)
  const [tab, setTab] = useState<'clip' | 'song'>('clip')

  // --- Variant C: Clip / Song tabs -----------------------------------------
  // One surface at a time, no overlay and no second pinned bar.
  //
  // Where the shared controls end up differs by width, and both are worth
  // arguing about:
  //  - <1024: the transport stays put in both tabs, because Speed belongs to
  //    both. Song play is in `PhoneSongBar`'s own header, so it is on screen
  //    whenever the SONG tab is.
  //  - >=1024: there is no dock at all. Clip play rides inside the grid well
  //    (`ClipControl`) and song play plus Speed ride inside `SongBar`, so each
  //    tab already carries its own transport — but Speed is then unreachable
  //    from the CLIP tab, which is the variant's real cost at this width.
  if (variant === 'tabs') {
    return (
      <main className={styles.stage}>
        <div className={styles.chrome}>
          <div className={styles.column}>
            {chrome}
            <div className={styles.tabs} role="tablist" aria-label="Clip or song">
              <button
                type="button"
                role="tab"
                className={styles.tab}
                aria-selected={tab === 'clip'}
                data-active={tab === 'clip'}
                onClick={() => setTab('clip')}
                data-testid="proto-tab-clip"
              >
                CLIP
              </button>
              <button
                type="button"
                role="tab"
                className={styles.tab}
                aria-selected={tab === 'song'}
                data-active={tab === 'song'}
                onClick={() => setTab('song')}
                data-testid="proto-tab-song"
              >
                SONG
                {placedCount > 0 && <span className={styles.tabCount}>{placedCount * 4}</span>}
              </button>
            </div>
          </div>
        </div>
        <div className={styles.scroller} data-testid="stage-scroller">
          <div className={`${styles.column} ${styles.stack}`}>
            {tab === 'clip' ? (
              <>
                {clipHeader}
                {grid}
              </>
            ) : (
              songBar
            )}
          </div>
        </div>
        {transport && (
          <div className={styles.dock}>
            <div className={styles.column}>{transport}</div>
          </div>
        )}
      </main>
    )
  }

  // --- The two dialog variants -------------------------------------------
  // Same frame, opposite answers to "which surface deserves the screen?".
  //
  //  `song-dialog`  the grid owns the frame, the arrangement opens as a card.
  //  `clip-dialog`  the arrangement owns the frame, the grid opens as a card.
  //
  // Either way the hidden surface keeps a one-line launcher in the dock, so
  // its play button stays one tap away (spec §9) and there is a standing,
  // labelled way back to it — which is the discoverability cost the tabs
  // variant does not pay.
  const songIsHidden = variant === 'song-dialog'

  const launcher = songIsHidden ? (
    <Launcher
      playing={songPlaying}
      onToggle={onToggleSong}
      playLabel={songPlaying ? 'Stop the song' : 'Play the song'}
      playTestId="song-play-button"
      title="Your boop"
      detail={`${placedCount * 4} bars`}
      onOpen={() => setSongOpen(true)}
      openTestId="proto-open-song"
    />
  ) : (
    <Launcher
      playing={clipPlaying}
      onToggle={onToggleClip}
      playLabel={clipPlaying ? 'Stop this clip' : 'Play this clip'}
      playTestId="clip-play-button"
      title={clipName}
      detail="Edit"
      tint={clipTint}
      onOpen={() => onClipOpenChange(true)}
      openTestId="proto-open-clip"
    />
  )

  return (
    <main className={styles.stage}>
      <div className={styles.chrome}>
        <div className={styles.column}>{chrome}</div>
      </div>
      <div className={styles.scroller} data-testid="stage-scroller">
        <div className={`${styles.column} ${styles.stack}`}>
          {songIsHidden ? (
            <>
              {clipHeader}
              {grid}
            </>
          ) : (
            songBar
          )}
        </div>
      </div>
      <div className={styles.dock}>
        <div className={styles.column}>
          {launcher}
          {/* `clip-dialog` drops the transport (owner's call, 2026-08-25). On
              the phone the dock was stacking the launcher over `Transport` and
              both led with clip play — two identical play buttons, one above
              the other. The launcher is the one that stays, because it also
              names the clip and is the way back into the grid.

              This leaves phone Speed homeless: it lives in `Transport` and
              `PhoneSongBar` has no Speed of its own. Deliberately not solved
              here — see the spec's open question. */}
          {songIsHidden && transport}
        </div>
      </div>
      {songIsHidden && songOpen && (
        <Card title="Your boop" onClose={() => setSongOpen(false)} testId="proto-song-dialog">
          {songBar}
        </Card>
      )}
      {!songIsHidden && clipOpen && (
        // No card title: `ClipHeader` is already "You're changing ● <name>",
        // and stating the clip twice reads as a bug.
        <Card onClose={() => onClipOpenChange(false)} testId="proto-clip-dialog">
          {clipHeader}
          {grid}
        </Card>
      )}
    </main>
  )
}

interface LauncherProps {
  playing: boolean
  onToggle: () => void
  playLabel: string
  playTestId: string
  title: string
  detail: string
  tint?: string
  onOpen: () => void
  openTestId: string
}

/** The dock's one-line stand-in for whichever surface the variant hid. */
function Launcher({
  playing,
  onToggle,
  playLabel,
  playTestId,
  title,
  detail,
  tint,
  onOpen,
  openTestId,
}: LauncherProps) {
  return (
    <div className={styles.launcher}>
      <button
        type="button"
        className={styles.launcherPlay}
        onClick={onToggle}
        aria-pressed={playing}
        aria-label={playLabel}
        data-playing={playing}
        data-testid={playTestId}
      >
        {playing ? (
          <span className={styles.pause} aria-hidden="true">
            <span className={styles.pauseBar} />
            <span className={styles.pauseBar} />
          </span>
        ) : (
          <span className={styles.triangle} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className={styles.launcherOpen}
        onClick={onOpen}
        data-testid={openTestId}
      >
        {tint && (
          <span
            className={styles.launcherDot}
            style={{ background: tint }}
            aria-hidden="true"
          />
        )}
        <span className={styles.launcherTitle}>{title}</span>
        <span className={styles.launcherBars}>{detail}</span>
        <span className={styles.launcherChevron} aria-hidden="true">
          ›
        </span>
      </button>
    </div>
  )
}

interface CardProps {
  /** Omitted for the clip editor — `ClipHeader` inside it is already the title. */
  title?: string
  onClose: () => void
  testId: string
  children: ReactNode
}

/** The paper-card shape `BoopsPanel` and `NewClipPicker` already use. */
function Card({ title, onClose, testId, children }: CardProps) {
  return (
    <div className={styles.overlay} data-testid={testId}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>{title}</span>
          <button type="button" className={styles.cardClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.cardBody}>{children}</div>
      </div>
    </div>
  )
}
