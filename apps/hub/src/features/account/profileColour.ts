/** Mid-tone paper inks, each holding the cream initial at 3:1 or better in both themes. */
export const PROFILE_COLOURS = [
  '#c07a35',
  '#4f7d6f',
  '#b5573f',
  '#4f6f8f',
  '#8a5d7e',
  '#7c7a3a',
] as const

/** The avatar colour for the profile at `position` in the picker; repeats only past six. */
export function profileColour(position: number): string {
  return PROFILE_COLOURS[position % PROFILE_COLOURS.length]!
}
