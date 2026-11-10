import { describe, expect, it } from 'vitest'

import { KEEPALIVE_MAX_BYTES, withKeepalive } from './keepaliveFetch.ts'

describe('withKeepalive', () => {
  it('keeps a bodyless request alive - the pull as well as the push', () => {
    expect(withKeepalive({ credentials: 'include' })).toEqual({
      credentials: 'include',
      keepalive: true,
    })
  })

  it('keeps a save document alive, which is the whole point', () => {
    expect(withKeepalive({ body: '{"version":1}' }).keepalive).toBe(true)
  })

  it('takes the budget as bytes, not characters', () => {
    const atTheLimit = 'a'.repeat(KEEPALIVE_MAX_BYTES)
    // Half the limit in characters, but half again over it in bytes.
    const underTheLimitInCharacters = '€'.repeat(KEEPALIVE_MAX_BYTES / 2)

    expect(withKeepalive({ body: atTheLimit }).keepalive).toBe(true)
    expect(withKeepalive({ body: `${atTheLimit}a` }).keepalive).toBe(false)
    expect(withKeepalive({ body: underTheLimitInCharacters }).keepalive).toBe(false)
  })

  it('falls back to a plain fetch for a body it cannot measure', () => {
    expect(withKeepalive({ body: new Uint8Array([1, 2, 3]) }).keepalive).toBe(false)
  })
})
