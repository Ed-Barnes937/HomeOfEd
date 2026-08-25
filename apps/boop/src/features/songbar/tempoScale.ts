import { MAX_BPM, MIN_BPM } from '../../engine/sequencerEngine.ts'

// Design handoff's log mapping (docs/reference/boop-design/README.md, "Tempo
// scale"): equal slider travel is equal tempo *ratio*, not equal bpm, so the
// slow end of the range doesn't get crushed into a sliver.
const RATIO = MAX_BPM / MIN_BPM

/** Slider percent (0–100) for a given bpm, per `percent = log(bpm/60) / log(200/60) × 100`. */
export function bpmToPercent(bpm: number): number {
  return (Math.log(bpm / MIN_BPM) / Math.log(RATIO)) * 100
}

/** Inverse of {@link bpmToPercent}: rounded to an integer bpm, clamped to [MIN_BPM, MAX_BPM]. */
export function percentToBpm(percent: number): number {
  const clampedPercent = Math.min(100, Math.max(0, percent))
  const bpm = MIN_BPM * RATIO ** (clampedPercent / 100)
  return Math.round(bpm)
}
