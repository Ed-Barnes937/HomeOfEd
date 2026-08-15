import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'

import { MAX_CLIPS, SONG_POSITIONS } from '../../persistence/saveFormat.ts'
import type { Song } from '../../song/song.ts'
import { clipTint } from '../clips/clipTints.ts'
import { useDragPaint } from '../grid/useDragPaint.ts'
import { useGridKeyboardNav } from '../grid/useGridKeyboardNav.ts'
import { bpmToPercent, percentToBpm } from '../transport/tempoScale.ts'
import styles from './SongBar.module.scss'
import { useChipDrag, type ChipDragState } from './useChipDrag.ts'

interface SongBarProps {
  song: Song
  bpm: number
  onTempoChange: (bpm: number) => void
  /** Puts that clip on the grid. Stops the song when it is playing (spec §9). */
  onSelectClip: (index: number) => void
  /** A lane-square toggle: place or tap off. Every lane is its own toggle, so a position can hold several clips. */
  onTogglePlacement: (clipIndex: number, position: number) => void
  /** A lane reorder (ticket 18): chip drag or Ctrl/Cmd+ArrowUp/Down. Counts as edited. */
  onMoveClip: (from: number, to: number) => void
  /** Opens the "+ New clip" picker (ticket 17): Blank first, then the sample clips. */
  onAddClip: () => void
  /** Play or stop the song: placements left to right, looping (spec §9). */
  onToggleSong: () => void
  songPlaying: boolean
  /** The song position currently sounding, or `null` — drives the ruler and the playing ring. */
  playingPosition: number | null
}

const POSITIONS = Array.from({ length: SONG_POSITIONS }, (_, i) => i)

/**
 * The pinned song bar (design handoff §5): header row with the boop's name,
 * length and Speed (the old transport's tempo slider, moved here), then the
 * song play column and the lane grid — one lane per clip: a chip (tint dot,
 * name, ×n count) and 16 placement squares. Placement paints exactly like
 * grid cells (`useDragPaint`), and the squares follow the grid's arrow-key
 * model (`useGridKeyboardNav`): plain arrows move, Enter toggles, Backspace
 * removes.
 */
export function SongBar({
  song,
  bpm,
  onTempoChange,
  onSelectClip,
  onTogglePlacement,
  onMoveClip,
  onAddClip,
  onToggleSong,
  songPlaying,
  playingPosition,
}: SongBarProps) {
  const percent = bpmToPercent(bpm)
  const placedCount = song.placements.filter((clips) => clips.length > 0).length
  // The dashed "next" hint on the active clip's lane: the first empty position.
  const nextFree = song.placements.findIndex((clips) => clips.length === 0)
  const atClipCap = song.clips.length >= MAX_CLIPS

  const toggleByLane = (laneId: string, position: number) =>
    onTogglePlacement(Number(laneId), position)
  const paint = useDragPaint({ onToggleCell: toggleByLane, applyOnPointerDown: true })
  const keyboardNav = useGridKeyboardNav({
    rowCount: song.clips.length,
    stepCount: SONG_POSITIONS,
    onToggleCell: toggleByLane,
    instrumentIdAt: (rowIndex) => (rowIndex < song.clips.length ? String(rowIndex) : undefined),
    cellTestId: (laneId, position) => `lane-${laneId}-${position}`,
  })

  // --- Lane reordering (ticket 18, spec §8) ---

  const chipDrag = useChipDrag({
    laneCount: song.clips.length,
    containerRef: keyboardNav.containerRef,
    onMove: onMoveClip,
    onTap: onSelectClip,
  })

  // The moved clip's new index after a keyboard reorder. Chips are keyed by
  // index, so the reorder re-renders the focused element with a *different*
  // clip — focus must chase the moved one for the next press to keep moving it.
  const pendingChipFocus = useRef<number | null>(null)
  useEffect(() => {
    if (pendingChipFocus.current === null) return
    keyboardNav.containerRef.current
      ?.querySelector<HTMLButtonElement>(`[data-testid="clip-chip-${pendingChipFocus.current}"]`)
      ?.focus()
    pendingChipFocus.current = null
  })

  /** Ctrl/Cmd+ArrowUp/Down moves the chip's lane; plain arrows are untouched (spec §14). */
  const onChipKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!event.ctrlKey && !event.metaKey) return
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const to = index + (event.key === 'ArrowUp' ? -1 : 1)
    if (to < 0 || to >= song.clips.length) return
    onMoveClip(index, to)
    pendingChipFocus.current = to
  }

  /** The live make-way: lanes between the drag's origin and target step one pitch aside. */
  const laneShift = (drag: ChipDragState | null, index: number): string | undefined => {
    if (!drag) return undefined
    if (index === drag.from) {
      // The dragged lane follows the pointer, but never past the lane list —
      // the drop target clamps to the lanes, so the chip stops with it.
      const dy = Math.max(
        -drag.from * drag.rowPitch,
        Math.min((song.clips.length - 1 - drag.from) * drag.rowPitch, drag.dy),
      )
      return `translateY(${dy}px)`
    }
    if (drag.from < drag.to && index > drag.from && index <= drag.to)
      return `translateY(${-drag.rowPitch}px)`
    if (drag.from > drag.to && index >= drag.to && index < drag.from)
      return `translateY(${drag.rowPitch}px)`
    return undefined
  }

  return (
    <div className={styles.bar} data-testid="song-bar">
      <div className={styles.header}>
        <span className={styles.title}>Your boop</span>
        <span className={styles.bars} data-testid="song-length">
          {placedCount * 4} bars
        </span>
        <div className={styles.spacer} />
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
      <div className={styles.body}>
        <div className={styles.playColumn}>
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
          <span className={styles.playLabel}>{songPlaying ? 'Stop' : 'Song'}</span>
        </div>
        <div className={styles.divider} aria-hidden="true" />
        <div className={styles.lanes}>
          <div className={styles.ruler} aria-hidden="true">
            {POSITIONS.map((position) => (
              <span
                key={position}
                className={styles.rulerNumeral}
                data-playing={position === playingPosition}
                data-testid={`song-position-numeral-${position}`}
              >
                {position + 1}
              </span>
            ))}
          </div>
          <div
            ref={keyboardNav.containerRef}
            className={styles.laneRows}
            role="application"
            aria-label="Song lanes. One row per clip, 16 positions. Tap a square to place that clip there. Arrow keys move, Enter places or removes, Backspace removes. On a clip's chip, Control or Command with up and down moves its lane."
            data-drag-live={chipDrag.drag !== null || undefined}
          >
            {song.clips.map((clip, clipIndex) => {
              const count = song.placements.filter((clips) => clips.includes(clipIndex)).length
              const active = clipIndex === song.activeClipIndex
              const laneStyle = {
                '--lane-tint': clipTint(clip.tint),
                transform: laneShift(chipDrag.drag, clipIndex),
              } as CSSProperties
              return (
                <div
                  key={clipIndex}
                  className={styles.lane}
                  style={laneStyle}
                  data-dragging={chipDrag.drag?.from === clipIndex || undefined}
                >
                  <button
                    type="button"
                    className={styles.chip}
                    data-active={active}
                    data-tint={clip.tint}
                    onClick={() => chipDrag.onClick(clipIndex)}
                    onPointerDown={(event) => chipDrag.onPointerDown(event, clipIndex)}
                    onPointerMove={chipDrag.onPointerMove}
                    onPointerUp={chipDrag.onPointerUp}
                    onPointerCancel={chipDrag.onPointerCancel}
                    onKeyDown={(event) => onChipKeyDown(event, clipIndex)}
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
                  {POSITIONS.map((position) => {
                    const on = song.placements[position]!.includes(clipIndex)
                    const laneId = String(clipIndex)
                    return (
                      <button
                        key={position}
                        type="button"
                        className={styles.square}
                        data-on={on}
                        data-playing={on && position === playingPosition}
                        data-hint={active && !on && position === nextFree}
                        aria-pressed={on}
                        aria-label={`${clip.name}, position ${position + 1}, ${on ? 'on' : 'off'}`}
                        data-testid={`lane-${clipIndex}-${position}`}
                        onPointerDown={(event) => paint.onPointerDown(event, laneId, position, on)}
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
              )
            })}
          </div>
          <div className={styles.newClipRow}>
            <button
              type="button"
              className={styles.newClip}
              onClick={onAddClip}
              disabled={atClipCap}
              data-testid="new-clip-button"
            >
              + New clip
            </button>
            <span className={styles.newClipHint}>Add another layer</span>
          </div>
        </div>
      </div>
    </div>
  )
}
