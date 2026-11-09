import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { wandSchema } from '../wand/wandSchema.ts'
import { buildShareUrl, decodeShareHash, encodeShare, SHARE_HASH_PREFIX } from './shareLink.ts'

const wand = {
  params: normalise(wandSchema, { wood: 'cherry', core: 'emberstone' }),
  name: 'Flicker',
}

describe('share links', () => {
  it('round-trip a wand, name and all', () => {
    const url = buildShareUrl({ origin: 'https://armoury.homeofed.com', pathname: '/' }, wand)
    expect(url).toMatch(/^https:\/\/armoury\.homeofed\.com\/#w=[A-Za-z0-9_-]+$/)
    expect(decodeShareHash(new URL(url).hash)).toEqual(wand)
  })

  it('read anything else as no wand at all', () => {
    const token = encodeShare(wand)
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
