import type { CSSProperties, KeyboardEvent } from 'react'

import { STEPS_PER_PATTERN, type Pattern } from '../../engine/sequencerEngine.ts'
import { SCRUB_SEGMENT_ATTR, scrubKeyMove, useScrubDrag } from '../playhead/useScrubDrag.ts'
import { loopMapTicks } from './loopMap.ts'
import styles from './LoopMap.module.scss'
import { PHONE_BRACKET_WIDTH_PERCENT, phoneBracketLeftPercent } from './phoneWindow.ts'

interface LoopMapProps {
  pattern: Pattern
  /** The playhead's step, or `null` while nothing has sounded and nothing has been scrubbed. */
  playheadStep: number | null
  /** Playing or stopped: the cap's cyan / `--ink` rule (boop-playhead ticket 06). */
  playheadPlaying: boolean
  /** The step window's current horizontal scroll, in strip pixels. */
  scrollLeft: number
  /** Move the playhead within the clip's 16 steps, snapped to a step (spec §4). */
  onScrubToStep: (step: number) => void
  /** Home on either scrub band: back to the start of the song (spec §4). */
  onScrubToSongStart: () => void
}

/**
 * The "WHOLE LOOP" band under the phone grid (design handoff, "Main screen —
 * small phone" → "Whole loop map"; boop-playhead handoff, "WHOLE LOOP becomes
 * the clip scrubber"). All 16 steps, always — a tick per step showing playhead
 * / has-notes / empty, plus a bracket marking the half of the loop the step
 * window is showing.
 *
 * This is the answer to the small-phone problem: because the map never
 * scrolls, the playhead is never lost. It simply moves from the grid to here
 * when the child has swiped somewhere else.
 *
 * Since boop-playhead ticket 06 the band is also the phone's **clip scrubber**
 * — the laptop's clip rail, on a band that already existed. Its geometry is
 * unchanged: what it gains is the pointer handlers, a grip cap above the
 * current step and the slider role. Snapping hit-tests the 16 ticks the browser
 * laid out, the same way the laptop strips do, so the `flex: 1` ticks and the
 * snap can never drift apart.
 */
export function LoopMap({
  pattern,
  playheadStep,
  playheadPlaying,
  scrollLeft,
  onScrubToStep,
  onScrubToSongStart,
}: LoopMapProps) {
  const ticks = loopMapTicks(pattern, playheadStep)
  const bracketStyle = {
    left: `${phoneBracketLeftPercent(scrollLeft)}%`,
    width: `${PHONE_BRACKET_WIDTH_PERCENT}%`,
  } satisfies CSSProperties

  // Held back to the first move or the release: the band lives inside the one
  // scrolling region (ADR 0030), so a vertical pan that starts on it must scroll
  // the page and move nothing.
  const scrub = useScrubDrag(({ segment }) => onScrubToStep(segment), {
    applyOnPointerDown: false,
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = playheadStep ?? 0
    const moved = scrubKeyMove(event.key, {
      // `scrubToStep` clamps to the pattern, so the band never leaves its clip.
      onStep: (delta) => onScrubToStep(step + delta),
      onSongStart: onScrubToSongStart,
    })
    if (moved) event.preventDefault()
  }

  return (
    <div
      className={styles.map}
      role="slider"
      tabIndex={0}
      aria-label="Whole loop. Drag to move the playhead."
      aria-valuemin={0}
      aria-valuemax={STEPS_PER_PATTERN - 1}
      aria-valuenow={playheadStep ?? 0}
      aria-valuetext={`Step ${(playheadStep ?? 0) + 1}`}
      onKeyDown={onKeyDown}
      onPointerDown={scrub.onPointerDown}
      onPointerMove={scrub.onPointerMove}
      onPointerUp={scrub.onPointerUp}
      onPointerCancel={scrub.onPointerCancel}
      data-testid="loop-map"
    >
      <span className={styles.label}>WHOLE LOOP</span>
      <div className={styles.track}>
        <div className={styles.ticks}>
          {ticks.map((state, step) => (
            <span
              // Ticks are a fixed 16-slot readout of the loop, so the index is
              // the identity — there is nothing to reorder.
              key={step}
              className={styles.tick}
              data-state={state}
              {...{ [SCRUB_SEGMENT_ATTR]: '' }}
              data-testid={`loop-tick-${step}`}
            />
          ))}
        </div>
        <div className={styles.bracket} style={bracketStyle} data-testid="loop-window-bracket" />
        {playheadStep !== null && (
          <div
            className={styles.cap}
            style={{ '--step': playheadStep } as CSSProperties}
            data-playing={playheadPlaying}
            data-step={playheadStep}
            data-testid="loop-map-cap"
            aria-hidden="true"
          >
            <span className={styles.grip} />
            <span className={styles.grip} />
          </div>
        )}
      </div>
    </div>
  )
}
