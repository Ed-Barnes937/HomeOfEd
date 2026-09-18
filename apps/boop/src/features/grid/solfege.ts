/** What a lane cell is called wherever a pitch needs a name (spec §7), from the bottom up. */
const SOLFEGE = ['do', 're', 'mi', 'fa', 'so', 'la', 'ti', 'high do'] as const

export function solfegeName(pitchIndex: number): string {
  return SOLFEGE[pitchIndex] ?? ''
}

/** What a screen reader reads off a lane cell. */
export function laneCellLabel(pitchIndex: number, step: number, on: boolean): string {
  return `${solfegeName(pitchIndex)}, step ${step + 1}, ${on ? 'on' : 'off'}`
}
