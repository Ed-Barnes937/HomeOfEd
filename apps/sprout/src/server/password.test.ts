import { describe, expect, it } from 'vitest'

import { hashSecret, verifySecret } from './password.ts'

describe('hashSecret / verifySecret', () => {
  it('round-trips a correct secret', () => {
    const stored = hashSecret('1234')
    expect(verifySecret('1234', stored)).toBe(true)
  })

  it('rejects an incorrect secret', () => {
    const stored = hashSecret('1234')
    expect(verifySecret('0000', stored)).toBe(false)
  })

  it('produces a salt:hash format with a unique salt per call', () => {
    const a = hashSecret('1234')
    const b = hashSecret('1234')
    expect(a).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
    expect(a).not.toBe(b) // random salt → different stored value
    // ...but both still verify
    expect(verifySecret('1234', a)).toBe(true)
    expect(verifySecret('1234', b)).toBe(true)
  })

  it('fails closed for legacy plaintext rows (no salt:hash structure)', () => {
    // A pre-hashing row stored the raw PIN / username. It must not validate.
    expect(verifySecret('1234', '1234')).toBe(false)
    expect(verifySecret('alice123', 'alice123')).toBe(false)
  })

  it('returns false for malformed stored values instead of throwing', () => {
    expect(verifySecret('1234', '')).toBe(false)
    expect(verifySecret('1234', 'nocolon')).toBe(false)
    expect(verifySecret('1234', 'salt:')).toBe(false)
    expect(verifySecret('1234', ':hash')).toBe(false)
    expect(verifySecret('1234', 'salt:nothex')).toBe(false)
    expect(verifySecret('1234', 'abcd:dead')).toBe(false) // hash too short
  })

  it('returns false for non-string input rather than throwing', () => {
    const stored = hashSecret('1234')
    // Simulate a JSON body sending the wrong type for the secret.
    expect(verifySecret(undefined as unknown as string, stored)).toBe(false)
    expect(verifySecret(1234 as unknown as string, stored)).toBe(false)
    expect(verifySecret('1234', null as unknown as string)).toBe(false)
  })

  it('hashSecret throws on non-string input', () => {
    expect(() => hashSecret(undefined as unknown as string)).toThrow(TypeError)
    expect(() => hashSecret(1234 as unknown as string)).toThrow(TypeError)
  })
})
