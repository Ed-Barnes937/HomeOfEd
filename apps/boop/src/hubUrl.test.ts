import { ESTATE_APPS, HUB_LOCAL_PORTS } from '@hoe/accounts'
import { describe, expect, it } from 'vitest'

import { hubUrl, switchPlayerUrl } from './hubUrl.ts'

const boop = ESTATE_APPS.find((app) => app.appId === 'boop')!
const devBoop = `http://localhost:${boop.devPort}`
const stackBoop = `http://localhost:${boop.composePort}`

describe('hubUrl', () => {
  it.each([
    ['production', `https://${boop.host}/`, 'https://homeofed.com'],
    ['pnpm dev', `${devBoop}/`, `http://localhost:${HUB_LOCAL_PORTS.devPort}`],
    ['the docker stack', `${stackBoop}/shared#g=abc`, `http://localhost:${HUB_LOCAL_PORTS.composePort}`],
    ['anywhere outside the estate', 'https://hoe-boop.fly.dev/', 'https://homeofed.com'],
  ])('points the back arrow at the hub beside boop in %s', (_tier, href, hub) => {
    expect(hubUrl(href)).toBe(hub)
  })
})

describe('switchPlayerUrl', () => {
  it('sends the player to hub’s account page, returning to where they are', () => {
    expect(switchPlayerUrl(`${stackBoop}/?x=1`)).toBe(
      `http://localhost:${HUB_LOCAL_PORTS.composePort}/account?returnTo=${encodeURIComponent(`${stackBoop}/?x=1`)}`,
    )
  })

  it('leaves the fragment behind, because boop has already loaded what it carried', () => {
    expect(switchPlayerUrl(`https://${boop.host}/#g=abc`)).toBe(
      `https://homeofed.com/account?returnTo=${encodeURIComponent(`https://${boop.host}/`)}`,
    )
  })

  it('is null outside the estate, where there is no hub to switch at', () => {
    expect(switchPlayerUrl('https://hoe-boop.fly.dev/')).toBeNull()
  })
})
