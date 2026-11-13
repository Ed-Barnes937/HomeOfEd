import { describe, expect, it } from 'vitest'

import { playerCircleFor } from './index.ts'

describe('playerCircleFor', () => {
  it('links a production app to the account page alone, so a switch lands on hub home', () => {
    expect(playerCircleFor('ada', 'https://armoury.homeofed.com/wands?x=1#w=abc')).toEqual({
      initial: 'A',
      label: 'Playing as ada. Switch player',
      href: 'https://homeofed.com/account',
    })
  })

  it('links an app on its dev port to hub on its dev port', () => {
    expect(playerCircleFor('Bo', 'http://localhost:3002/').href).toBe(
      'http://localhost:3000/account',
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
