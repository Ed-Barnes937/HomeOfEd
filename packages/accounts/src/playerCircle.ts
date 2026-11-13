import { profileInitial } from './profileInitial.ts'
import { switchPlayerUrlFor } from './returnTo.ts'

export interface PlayerCircle {
  initial: string
  /** The accessible name: the initial alone does not say who is playing. */
  label: string
  /** Hub's account page to switch player and come back, or null outside the estate. */
  href: string | null
}

/** What an app's avatar circle shows for `name` on the page at `currentHref`. */
export function playerCircleFor(name: string, currentHref: string): PlayerCircle {
  const href = switchPlayerUrlFor(currentHref)
  return {
    initial: profileInitial(name),
    label: href === null ? `Playing as ${name}` : `Playing as ${name}. Switch player`,
    href,
  }
}
