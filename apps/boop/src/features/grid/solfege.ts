/**
 * What a lane cell is called, everywhere a pitch needs a name (spec §7): the
 * one naming decision, so nothing else has to pick between solfège, letters and
 * ordinals. Indexed from the bottom like every other `pitchIndex`, and the top
 * cell is "high do" - the same note as the bottom one, an octave up.
 */
const SOLFEGE = ['do', 're', 'mi', 'fa', 'so', 'la', 'ti', 'high do'] as const

export function solfegeName(pitchIndex: number): string {
  return SOLFEGE[pitchIndex] ?? ''
}

/** What a screen reader reads off a lane cell. */
export function laneCellLabel(pitchIndex: number, step: number, on: boolean): string {
  return `${solfegeName(pitchIndex)}, step ${step + 1}, ${on ? 'on' : 'off'}`
}
