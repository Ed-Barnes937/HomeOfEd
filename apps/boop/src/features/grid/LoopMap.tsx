import type { CSSProperties } from 'react'

import type { Pattern } from '../../engine/sequencerEngine.ts'
import { loopMapTicks } from './loopMap.ts'
import styles from './LoopMap.module.scss'
import { PHONE_BRACKET_WIDTH_PERCENT, phoneBracketLeftPercent } from './phoneWindow.ts'

interface LoopMapProps {
  pattern: Pattern
  /** The playhead's step, or `null` while stopped. */
  playheadStep: number | null
  /** The step window's current horizontal scroll, in strip pixels. */
  scrollLeft: number
}

/**
 * The "WHOLE LOOP" band under the phone grid (design handoff, "Main screen —
 * small phone" → "Whole loop map"). All 16 steps, always — a tick per step
 * showing playhead / has-notes / empty, plus a bracket marking the half of the
 * loop the step window is showing.
 *
 * This is the answer to the small-phone problem: because the map never
 * scrolls, the playhead is never lost. It simply moves from the grid to here
 * when the child has swiped somewhere else.
 */
export function LoopMap({ pattern, playheadStep, scrollLeft }: LoopMapProps) {
  const ticks = loopMapTicks(pattern, playheadStep)
  const bracketStyle = {
    left: `${phoneBracketLeftPercent(scrollLeft)}%`,
    width: `${PHONE_BRACKET_WIDTH_PERCENT}%`,
  } satisfies CSSProperties

  return (
    <div className={styles.map} data-testid="loop-map">
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
              data-testid={`loop-tick-${step}`}
            />
          ))}
        </div>
        <div className={styles.bracket} style={bracketStyle} data-testid="loop-window-bracket" />
      </div>
    </div>
  )
}
