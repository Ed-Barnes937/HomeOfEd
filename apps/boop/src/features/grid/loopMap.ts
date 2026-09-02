import { STEPS_PER_PATTERN, type Pattern } from '../../engine/sequencerEngine.ts'

/**
 * What one tick of the "WHOLE LOOP" map shows. The three states carry the
 * handoff's three tick heights and colours (16px cyan / 12px ink-50 / 5px
 * ink-18) — see `LoopMap.module.scss`.
 */
export type LoopTickState = 'playhead' | 'note' | 'empty'

/**
 * The 16 ticks under the phone grid (design handoff, "Whole loop map").
 * Always all 16, whatever the step window is showing — that is the whole point
 * of the map: the playhead is never lost, it just moves from the grid to here.
 * The playhead tick wins over a note on the same step, so the child's eye
 * always finds one unambiguous marker.
 *
 * A tick aggregates **every** row of the clip, so the map already reads the
 * clip's own row count (ADR 0041) — one row or the whole roster — and its
 * reserved 44px band under the grid never has to grow to keep up. That is
 * deliberate: the band is a step readout, not a miniature of the grid.
 */
export function loopMapTicks(
  pattern: Pattern,
  playheadStep: number | null,
): readonly LoopTickState[] {
  return Array.from({ length: STEPS_PER_PATTERN }, (_, step) => {
    if (step === playheadStep) return 'playhead'
    return pattern.some((row) => row.steps[step] === true) ? 'note' : 'empty'
  })
}
