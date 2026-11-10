import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { wandSchema } from '../wand/wandSchema.ts'
import {
  buildShareUrl,
  decodeShareHash,
  encodeShare,
  keepFragment,
  keepSharedUrl,
  SHARE_HASH_PREFIX,
} from './shareLink.ts'

const wand = {
  params: normalise(wandSchema, { wood: 'cherry', core: 'emberstone' }),
  name: 'Flicker',
}

describe('share links', () => {
  it('round-trip a wand, name and all, through the open /shared view', () => {
    const url = buildShareUrl('https://armoury.homeofed.com', wand)
    expect(url).toMatch(/^https:\/\/armoury\.homeofed\.com\/shared#w=[A-Za-z0-9_-]+$/)
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

describe('keeping a shared wand', () => {
  it('goes to the root, where the gate asks who is playing', () => {
    expect(keepSharedUrl('http://localhost:8091', '#w=%7B%22a%22%3A1%7D')).toBe(
      'http://localhost:8091/#w=%7B%22a%22%3A1%7D',
    )
  })

  it('carries the arrival fragment byte for byte when nothing changed', () => {
    const opened = encodeShare(wand)
    expect(keepFragment(`${SHARE_HASH_PREFIX}${opened}`, opened, opened)).toBe(
      `${SHARE_HASH_PREFIX}${opened}`,
    )
  })

  it('carries no fragment when nothing changed and there was no wand to open', () => {
    const shown = encodeShare(wand)
    expect(keepFragment('#w=%7Bescaped%7D', shown, shown)).toBe('')
    expect(keepFragment('', shown, shown)).toBe('')
  })

  it('carries the wand as it is now after an edit', () => {
    const opened = encodeShare(wand)
    const edited = encodeShare({ ...wand, name: 'Spark' })
    expect(keepFragment('#w=%7Bescaped%7D', opened, edited)).toBe(`${SHARE_HASH_PREFIX}${edited}`)
  })
})
