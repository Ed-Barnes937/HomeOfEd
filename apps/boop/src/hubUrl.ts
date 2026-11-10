import { accountUrlFor } from '@hoe/accounts'

const PRODUCTION_HUB = 'https://homeofed.com'

/**
 * Where the back arrow points: the hub on boop's own tier (production, `pnpm
 * dev` or the docker stack), from the estate registry. Anywhere else, such as a
 * Fly preview host, gets the production hub so the arrow always lands somewhere real.
 */
export function hubUrl(href: string): string {
  const account = accountUrlFor(href)
  return account === null ? PRODUCTION_HUB : new URL(account).origin
}

/**
 * Hub's account page, returning here once a player is picked (spec decision
 * 10), or `null` outside the estate. The fragment stays behind: boop has
 * already loaded what it carried, and replaying it would reopen a shared boop
 * over the new player's work.
 */
export function switchPlayerUrl(href: string): string | null {
  const hashAt = href.indexOf('#')
  return accountUrlFor(hashAt === -1 ? href : href.slice(0, hashAt))
}
