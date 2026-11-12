import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { fakeSword } from '../items/testing/fakeItem.ts'
import { wandItem } from '../wand/item.ts'
import { wandSchema } from '../wand/wandSchema.ts'
import {
  buildShareUrl,
  decodeShare,
  decodeShareHash,
  encodeShare,
  SHARE_FORMAT_VERSION,
  SHARE_HASH_PREFIX,
} from './shareLink.ts'

const wand = {
  params: normalise(wandSchema, { wood: 'cherry', core: 'emberstone' }),
  name: 'Flicker',
}
const sword = { params: { ...fakeSword.firstVisit(), guard: 'ring' }, name: 'Needle' }
const bothKinds = { wand: wandItem, sword: fakeSword }

const token = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString('base64url')

describe('share links', () => {
  it('round-trip a wand, name and all', () => {
    const url = buildShareUrl('https://armoury.homeofed.com', 'wand', wand)
    expect(url).toMatch(/^https:\/\/armoury\.homeofed\.com\/#w=[A-Za-z0-9_-]+$/)
    expect(decodeShareHash(new URL(url).hash)).toEqual({ kind: 'wand', item: wand })
  })

  it('read anything else as no wand at all', () => {
    const token = encodeShare('wand', wand)
    expect(decodeShareHash('')).toBeNull()
    expect(decodeShareHash(`#g=${token}`)).toBeNull()
    expect(decodeShareHash(`${SHARE_HASH_PREFIX}${token.slice(0, -9)}`)).toBeNull()
    expect(decodeShareHash(`${SHARE_HASH_PREFIX}!!!`)).toBeNull()
  })

  it('ignore a link from a future share format', () => {
    const future = btoa(JSON.stringify({ version: 2, wand })).replace(/=+$/, '')
    expect(decodeShareHash(`${SHARE_HASH_PREFIX}${future}`)).toBeNull()
  })
})

describe('share links, now that the payload names the kind', () => {
  it('still open a link made before there were kinds, as a wand', () => {
    const old =
      'eyJ2ZXJzaW9uIjoxLCJ3YW5kIjp7InBhcmFtcyI6eyJ3b29kIjoib2FrIiwiY29yZSI6IndpbGR3b29kIiwibGVuZ3RoQ20iOjMxfSwibmFtZSI6Ik9sZCBGYWl0aGZ1bCJ9fQ'
    expect(decodeShareHash(`#w=${old}`)).toEqual({
      kind: 'wand',
      item: {
        params: normalise(wandSchema, { wood: 'oak', core: 'wildwood', lengthCm: 31 }),
        name: 'Old Faithful',
      },
    })
  })

  it('write a wand link exactly as they always have', () => {
    expect(SHARE_FORMAT_VERSION).toBe(1)
    expect(SHARE_HASH_PREFIX).toBe('#w=')
    expect(encodeShare('wand', wand)).toBe(token({ version: 1, wand }))
  })

  it('name the kind as the field that holds the item', () => {
    expect(encodeShare('sword', sword)).toBe(token({ version: 1, sword }))
    const url = buildShareUrl('https://armoury.homeofed.com', 'sword', sword)
    expect(url).toMatch(/^https:\/\/armoury\.homeofed\.com\/#w=[A-Za-z0-9_-]+$/)
    expect(decodeShareHash(new URL(url).hash, bothKinds)).toEqual({ kind: 'sword', item: sword })
    expect(decodeShare(encodeShare('wand', wand), bothKinds)).toEqual({ kind: 'wand', item: wand })
  })

  it('read a link for a kind this build does not have as an ordinary visit', () => {
    expect(decodeShare(encodeShare('sword', sword), { wand: wandItem })).toBeNull()
    expect(decodeShare(token({ version: 1, axe: sword }), bothKinds)).toBeNull()
    expect(decodeShare(token({ version: 1 }), bothKinds)).toBeNull()
  })

  it('take the first kind that decodes, wands first', () => {
    expect(decodeShare(token({ version: 1, sword, wand }), bothKinds)).toEqual({
      kind: 'wand',
      item: wand,
    })
    expect(decodeShare(token({ version: 1, wand: 'nope', sword }), bothKinds)).toEqual({
      kind: 'sword',
      item: sword,
    })
  })

  it('decode each kind by its own schema', () => {
    const odd = { params: { guard: 'basket', length: 9, wood: 'oak' } }
    expect(decodeShare(token({ version: 1, sword: odd }), bothKinds)).toEqual({
      kind: 'sword',
      item: { params: { ...fakeSword.firstVisit(), length: 1 } },
    })
  })

  it.each([
    ['null', null],
    ['a number', 7],
    ['a string', 'wand'],
    ['a list', [{ version: 1, wand }]],
    ['no version', { wand }],
    ['a version in words', { version: '1', wand }],
    ['a wand that is nothing', { version: 1, wand: null }],
    ['a wand that is a list', { version: 1, wand: [wand] }],
    ['a wand with no params', { version: 1, wand: { name: 'Flicker' } }],
    ['a wand whose name is not words', { version: 1, wand: { ...wand, name: 7 } }],
    ['a kind hidden in the prototype', { version: 1, constructor: wand, toString: wand }],
  ])('never throw, and read %s as no item at all', (_, payload) => {
    expect(decodeShare(token(payload), bothKinds)).toBeNull()
    expect(decodeShareHash(`${SHARE_HASH_PREFIX}${token(payload)}`, bothKinds)).toBeNull()
  })

  it.each(['', '=', 'not base64!', '%%%', '/wAA', 'e30', 'bnVsbA'])(
    'never throw on the token %j',
    (junk) => {
      expect(decodeShare(junk, bothKinds)).toBeNull()
    },
  )

  it('always point at the root, whichever page built the link', () => {
    expect(buildShareUrl('http://localhost:3011', 'wand', wand)).toBe(
      `http://localhost:3011/#w=${encodeShare('wand', wand)}`,
    )
  })
})
