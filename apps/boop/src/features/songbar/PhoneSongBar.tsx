import type { CSSProperties } from 'react'

import { MAX_CLIPS, SONG_POSITIONS } from '../../persistence/saveFormat.ts'
import type { Song } from '../../song/song.ts'
import { clipTint } from '../clips/clipTints.ts'
import { useDragPaint } from '../grid/useDragPaint.ts'
import { useGridKeyboardNav } from '../grid/useGridKeyboardNav.ts'
import styles from './PhoneSongBar.module.scss'

const GROUP_SIZE = 4
const GROUPS = Array.from({ length: SONG_POSITIONS / GROUP_SIZE }, (_, i) => i)

interface PhoneSongBarProps {
  song: Song
  /** Puts that clip on the grid. Stops the song when it is playing (spec §9). */
  onSelectClip: (index: number) => void
  /** A lane-square toggle: place, tap off, or replace (one clip per position). */
  onTogglePlacement: (clipIndex: number, position: number) => void
  /** Opens the "+ New clip" picker (ticket 17): Blank first, then the sample clips. */
  onAddClip: () => void
  /** Play or stop the song: placements left to right, looping (spec §9). */
  onToggleSong: () => void
  songPlaying: boolean
  /** The song position currently sounding, or `null` — drives the ruler and the playing ring. */
  playingPosition: number | null
}

/**
 * The phone song bar (boop-loops ticket 21, spec §5 — variant B). It lives
 * *inside the scrolling region*, below the grid well — nothing new is pinned
 * (ADR 0030's default home); clip play and Speed stay in the pinned transport.
 * A header row (the 36px cyan song play circle, "Your boop", the bars count),
 * then the lanes on the step window's exact geometry: a pinned 92px chip
 * column (compact chips — tint dot, truncating name, ×n — with "+ New"
 * beneath) beside a snap-scrolling strip whose squares sit column-for-column
 * under the grid's cells.
 *
 * Paint vs scroll follows PhoneGrid's rules (ADR 0027): the browser owns
 * horizontal pans (`touch-action: pan-x`), a tap toggles, and a drag paints
 * only after crossing a square boundary (`applyOnPointerDown: false`). The
 * squares keep the grid's arrow-key model (spec §14).
 */
export function PhoneSongBar({
  song,
  onSelectClip,
  onTogglePlacement,
  onAddClip,
  onToggleSong,
  songPlaying,
  playingPosition,
}: PhoneSongBarProps) {
  const placedCount = song.placements.filter((held) => held !== null).length
  const atClipCap = song.clips.length >= MAX_CLIPS

  const toggleByLane = (laneId: string, position: number) =>
    onTogglePlacement(Number(laneId), position)
  const paint = useDragPaint({ onToggleCell: toggleByLane, applyOnPointerDown: false })
  const keyboardNav = useGridKeyboardNav({
    rowCount: song.clips.length,
    stepCount: SONG_POSITIONS,
    onToggleCell: toggleByLane,
    instrumentIdAt: (rowIndex) => (rowIndex < song.clips.length ? String(rowIndex) : undefined),
    cellTestId: (laneId, position) => `lane-${laneId}-${position}`,
  })

  return (
    <section className={styles.bar} aria-label="Your boop (song)" data-testid="phone-song-bar">
      <div className={styles.header}>
        <button
          type="button"
          className={styles.songPlay}
          onClick={onToggleSong}
          aria-pressed={songPlaying}
          aria-label={songPlaying ? 'Stop the song' : 'Play the song'}
          data-playing={songPlaying}
          data-testid="song-play-button"
        >
          {songPlaying ? (
            <span className={styles.pause} aria-hidden="true">
              <span className={styles.pauseBar} />
              <span className={styles.pauseBar} />
            </span>
          ) : (
            <span className={styles.triangle} aria-hidden="true" />
          )}
        </button>
        <span className={styles.title}>Your boop</span>
        <span className={styles.bars} data-testid="song-length">
          {placedCount * 4} bars
        </span>
      </div>
      <div className={styles.lanes}>
        <div className={styles.chipColumn}>
          <div className={styles.rulerSpacer} aria-hidden="true" />
          <div className={styles.chipRows}>
            {song.clips.map((clip, clipIndex) => {
              const count = song.placements.filter((held) => held === clipIndex).length
              const active = clipIndex === song.activeClipIndex
              return (
                <button
                  key={clipIndex}
                  type="button"
                  className={styles.chip}
                  style={{ '--lane-tint': clipTint(clip.tint) } as CSSProperties}
                  onClick={() => onSelectClip(clipIndex)}
                  data-active={active}
                  data-tint={clip.tint}
                  aria-pressed={active}
                  data-testid={`clip-chip-${clipIndex}`}
                >
                  <span className={styles.chipDot} aria-hidden="true" />
                  <span className={styles.chipName}>{clip.name}</span>
                  {count > 0 && (
                    <span className={styles.chipCount} data-testid={`clip-count-${clipIndex}`}>
                      ×{count}
                    </span>
                  )}
                </button>
              )
            })}
            <button
              type="button"
              className={styles.newClip}
              onClick={onAddClip}
              disabled={atClipCap}
              data-testid="new-clip-button"
            >
              + New
            </button>
          </div>
        </div>
        <div className={styles.window} data-testid="phone-lane-window">
          <div className={styles.strip}>
            <div className={styles.ruler} aria-hidden="true">
              {GROUPS.map((group) => (
                <div key={group} className={styles.rulerGroup}>
                  {Array.from({ length: GROUP_SIZE }, (_, i) => {
                    const position = group * GROUP_SIZE + i
                    return (
                      <span
                        key={position}
                        className={styles.rulerNumeral}
                        data-playing={position === playingPosition}
                        data-testid={`song-position-numeral-${position}`}
                      >
                        {position + 1}
                      </span>
                    )
                  })}
                </div>
              ))}
            </div>
            <div
              ref={keyboardNav.containerRef}
              className={styles.laneRows}
              role="application"
              aria-label="Song lanes. One row per clip, 16 positions. Tap a square to place that clip there. Arrow keys move, Enter places or removes, Backspace removes. Swipe sideways for the other positions."
            >
              {song.clips.map((clip, clipIndex) => (
                <div
                  key={clipIndex}
                  className={styles.lane}
                  style={{ '--lane-tint': clipTint(clip.tint) } as CSSProperties}
                >
                  {GROUPS.map((group) => (
                    <div key={group} className={styles.group}>
                      {Array.from({ length: GROUP_SIZE }, (_, i) => {
                        const position = group * GROUP_SIZE + i
                        const on = song.placements[position] === clipIndex
                        const laneId = String(clipIndex)
                        return (
                          <button
                            key={position}
                            type="button"
                            className={styles.square}
                            data-on={on}
                            data-playing={on && position === playingPosition}
                            aria-pressed={on}
                            aria-label={`${clip.name}, position ${position + 1}, ${on ? 'on' : 'off'}`}
                            data-testid={`lane-${clipIndex}-${position}`}
                            onPointerDown={(event) =>
                              paint.onPointerDown(event, laneId, position, on)
                            }
                            onPointerEnter={(event) =>
                              paint.onPointerEnter(event, laneId, position, on)
                            }
                            onClick={(event) => paint.onClick(event, laneId, position)}
                            onKeyDown={(event) =>
                              keyboardNav.onCellKeyDown(event, clipIndex, position, laneId, on)
                            }
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
