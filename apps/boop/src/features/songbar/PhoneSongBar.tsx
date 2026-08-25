import type { CSSProperties, KeyboardEvent } from 'react'

import { MAX_CLIPS, SONG_POSITIONS } from '../../persistence/saveFormat.ts'
import type { Song } from '../../song/song.ts'
import { clipTint } from '../clips/clipTints.ts'
import { useDragPaint } from '../grid/useDragPaint.ts'
import { useGridKeyboardNav } from '../grid/useGridKeyboardNav.ts'
import {
  playheadReadout,
  playheadValueText,
  type SongPlayheadView,
} from '../playhead/songPlayhead.ts'
import { SCRUB_SEGMENT_ATTR, scrubKeyMove, useScrubDrag } from '../playhead/useScrubDrag.ts'
import { bpmToPercent, percentToBpm } from '../transport/tempoScale.ts'
import styles from './PhoneSongBar.module.scss'

const GROUP_SIZE = 4
const GROUPS = Array.from({ length: SONG_POSITIONS / GROUP_SIZE }, (_, i) => i)

interface PhoneSongBarProps {
  song: Song
  bpm: number
  onTempoChange: (bpm: number) => void
  /** Puts that clip on the grid. Stops the song when it is playing (spec §9). */
  onSelectClip: (index: number) => void
  /** A lane-square toggle: place or tap off. Every lane is its own toggle, so a position can hold several clips. */
  onTogglePlacement: (clipIndex: number, position: number) => void
  /** Opens the "+ New clip" picker (ticket 17): Blank first, then the sample clips. */
  onAddClip: () => void
  /** Play or stop the song: placements left to right, looping (spec §9). */
  onToggleSong: () => void
  songPlaying: boolean
  /** The song position currently sounding, or `null` — drives the ruler and the playing ring. */
  playingPosition: number | null
  /** Where the playhead sits, playing or stopped (boop-playhead ticket 06). */
  playhead: SongPlayheadView
  /**
   * Scrub to a fraction of the WHOLE SONG band, 0 at its left edge — the band is
   * one continuous track over the song's real length, so the fraction is the
   * whole answer (spec §7.2). The caller turns it into a global bar.
   */
  onScrubToFraction: (fraction: number) => void
  /** Scrub to a global bar: the band's arrow keys and Home (spec §4). */
  onScrubToBar: (globalBar: number) => void
}

/**
 * The phone song bar (boop-loops ticket 21, spec §5 — variant B). It lives
 * *inside the scrolling region*, below the grid well — nothing new is pinned
 * (ADR 0030's default home); clip play stays in the pinned transport.
 * A header (the 36px cyan song play circle, "Your boop", the bars count, and
 * Speed), then the lanes on the step window's exact geometry: a pinned 92px chip
 * column (compact chips — tint dot, truncating name, ×n — with "+ New"
 * beneath) beside a snap-scrolling strip whose squares sit column-for-column
 * under the grid's cells.
 *
 * Paint vs scroll follows PhoneGrid's rules (ADR 0027): the browser owns
 * horizontal pans (`touch-action: pan-x`), a tap toggles, and a drag paints
 * only after crossing a square boundary (`applyOnPointerDown: false`). The
 * squares keep the grid's arrow-key model (spec §14).
 *
 * The **WHOLE SONG** band between the header and the lanes is boop-playhead
 * ticket 06: the song scrubber, and — like the loop map — the non-scrolling
 * kind, so the playhead is on a band that never moves however far the lanes
 * have been swiped.
 */
export function PhoneSongBar({
  song,
  bpm,
  onTempoChange,
  onSelectClip,
  onTogglePlacement,
  onAddClip,
  onToggleSong,
  songPlaying,
  playingPosition,
  playhead,
  onScrubToFraction,
  onScrubToBar,
}: PhoneSongBarProps) {
  const percent = bpmToPercent(bpm)
  const placedCount = song.placements.filter((clips) => clips.length > 0).length
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

  // --- The WHOLE SONG band (boop-playhead ticket 06, spec §7.2) ---

  // The band's geometry is *derived*: one segment per placed position, so the
  // count changes as placements do. Each wears its topmost clip's tint, the way
  // the laptop strip's cells do.
  const segments = song.placements.flatMap((clipIndices, position) => {
    const clipIndex = clipIndices[0]
    return clipIndex === undefined ? [] : [{ position, clip: song.clips[clipIndex]! }]
  })

  // One continuous segment rather than one per bar: the track is the song's real
  // length divided into `barCount` equal bars, so the fraction across it *is*
  // the answer, and `globalBarAtFraction` does the arithmetic (spec §4). Held
  // back to a move or a release, like the loop map, so a vertical pan of the
  // scrolling region that starts on the band moves nothing.
  const bandScrub = useScrubDrag(({ fraction }) => onScrubToFraction(fraction), {
    applyOnPointerDown: false,
  })

  /** Arrows move one bar, Home returns to the song's start (spec §4). */
  const onBandKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const bar = playhead.bar ?? 0
    const moved = scrubKeyMove(event.key, {
      onStep: (delta) => onScrubToBar(bar + delta),
      onSongStart: () => onScrubToBar(0),
    })
    if (moved) event.preventDefault()
  }

  return (
    <section className={styles.bar} aria-label="Your boop (song)" data-testid="phone-song-bar">
      <div className={styles.header}>
        <div className={styles.headerRow}>
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
        {/* Speed, moved out of the transport (screenspace ticket 02) into the
            header the laptop `SongBar` already keeps it in. Its own line
            rather than beside song play: the phone header has 316px inside it
            at 360px and play, the title and the bars count take 176 of them,
            which would leave the slider a 60px track — 30px at 320px — against
            the 84px it had in the transport. A line of its own gives it 146px
            at 360 and 106 at 320, so the move costs no track at any phone
            width. */}
        <div className={styles.speed} data-testid="song-speed">
          <span className={styles.speedLabel} id="tempo-label">
            Speed
          </span>
          <span className={styles.speedReadout} data-testid="tempo-readout">
            {bpm} BPM
          </span>
          <span className={styles.endpoint}>Slow</span>
          <input
            type="range"
            className={styles.slider}
            style={{ '--tempo-percent': `${percent}%` } as CSSProperties}
            min={0}
            max={100}
            step="any"
            value={percent}
            onChange={(event) => onTempoChange(percentToBpm(Number(event.target.value)))}
            aria-labelledby="tempo-label"
            aria-valuetext={`${bpm} BPM`}
            data-testid="tempo-slider"
          />
          <span className={styles.endpoint}>Fast</span>
        </div>
      </div>
      {/* The WHOLE SONG band: a caption row carrying the phone's readout, then
          one continuous track over the song's placed length. Divided by an
          inset rather than a gap so the marker's arithmetic stays exact
          (handoff "WHOLE SONG"). */}
      <div className={styles.songCaption}>
        <span className={styles.songLabel}>WHOLE SONG</span>
        <span className={styles.songReadout} data-testid="phone-playhead-readout">
          {playheadReadout(playhead)}
        </span>
      </div>
      <div
        className={styles.songBand}
        role="slider"
        tabIndex={0}
        aria-label="Whole song. Drag to move the playhead."
        aria-valuemin={0}
        aria-valuemax={Math.max(0, playhead.barCount - 1)}
        aria-valuenow={playhead.bar ?? 0}
        aria-valuetext={playheadValueText(playhead)}
        onKeyDown={onBandKeyDown}
        onPointerDown={bandScrub.onPointerDown}
        onPointerMove={bandScrub.onPointerMove}
        onPointerUp={bandScrub.onPointerUp}
        onPointerCancel={bandScrub.onPointerCancel}
        data-testid="song-band"
      >
        <div
          className={styles.songTrack}
          style={{ '--bar-count': Math.max(1, playhead.barCount) } as CSSProperties}
        >
          <div className={styles.songSegments} {...{ [SCRUB_SEGMENT_ATTR]: '' }}>
            {segments.map(({ position, clip }) => (
              <span
                key={position}
                className={styles.songSegment}
                style={{ '--segment-tint': clipTint(clip.tint) } as CSSProperties}
                data-tint={clip.tint}
                data-testid={`song-band-segment-${position}`}
              />
            ))}
          </div>
          {playhead.bar !== null && (
            <>
              <span
                className={styles.songMarker}
                style={{ '--bar': playhead.bar } as CSSProperties}
                data-playing={playhead.playing}
                data-bar={playhead.bar}
                data-testid="song-band-marker"
              />
              <span
                className={styles.songCap}
                style={{ '--bar': playhead.bar } as CSSProperties}
                data-playing={playhead.playing}
                data-bar={playhead.bar}
                data-testid="song-band-cap"
                aria-hidden="true"
              >
                <span className={styles.songGrip} />
                <span className={styles.songGrip} />
                <span className={styles.songGrip} />
              </span>
            </>
          )}
        </div>
      </div>
      <div className={styles.lanes} data-testid="phone-song-lanes">
        <div className={styles.chipColumn}>
          <div className={styles.rulerSpacer} aria-hidden="true" />
          <div className={styles.chipRows}>
            {song.clips.map((clip, clipIndex) => {
              const count = song.placements.filter((clips) => clips.includes(clipIndex)).length
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
                        const on = song.placements[position]!.includes(clipIndex)
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
