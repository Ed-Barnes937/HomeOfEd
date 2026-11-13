import { describe, expect, it } from 'vitest'

import { playerCircleFor } from './index.ts'

describe('playerCircleFor', () => {
  it('links a production app to hub to switch player and come back, fragment left behind', () => {
    expect(playerCircleFor('ada', 'https://armoury.homeofed.com/wands#w=abc')).toEqual({
      initial: 'A',
      label: 'Playing as ada. Switch player',
      href: 'https://homeofed.com/account?returnTo=https%3A%2F%2Farmoury.homeofed.com%2Fwands',
    })
  })

  it('links an app on its dev port to hub on its dev port', () => {
    expect(playerCircleFor('Bo', 'http://localhost:3002/').href).toBe(
      'http://localhost:3000/account?returnTo=http%3A%2F%2Flocalhost%3A3002%2F',
    )
  })

  it('only names the player outside the estate, where there is no hub to switch at', () => {
    expect(playerCircleFor('Ada', 'http://localhost:3111/')).toEqual({
      initial: 'A',
      label: 'Playing as Ada',
      href: null,
    })
  })
})
