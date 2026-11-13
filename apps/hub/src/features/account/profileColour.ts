/** How many avatar colours `AccountPage.module.scss` defines (`--avatar-0` onwards). */
export const PROFILE_COLOURS = 6

/** A profile's avatar colour slot, derived from its id alone so it never moves. */
export function profileColour(id: string): number {
  let hash = 0
  for (const char of id) hash = (Math.imul(hash, 31) + char.codePointAt(0)!) | 0
  return Math.abs(hash) % PROFILE_COLOURS
}
