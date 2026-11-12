import { describe, expect, it } from 'vitest'

import { landingPath } from './landing.ts'

describe('landingPath', () => {
  it.each([
    ['a first visit', null, null, '/street'],
    ['a returning wand maker', null, 'wand', '/wands'],
    ['a returning sword maker', null, 'sword', '/swords'],
    ['a wand link, first visit', 'wand', null, '/wands'],
    ['a sword link, first visit', 'sword', null, '/swords'],
    ['a wand link to a sword maker', 'wand', 'sword', '/wands'],
    ['a sword link to a wand maker', 'sword', 'wand', '/swords'],
    ['a link to the shop they were last in', 'sword', 'sword', '/swords'],
  ] as const)('sends %s to the right door', (_, arrivalKind, lastShop, path) => {
    expect(landingPath({ arrivalKind, lastShop })).toBe(path)
  })
})
