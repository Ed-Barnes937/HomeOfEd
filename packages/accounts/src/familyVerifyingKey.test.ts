import { createPublicKey, generateKeyPairSync } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { familyDocumentGate } from './familyDocumentGate.ts'
import { familyVerifyingKey, PRODUCTION_FAMILY_PUBLIC_KEY } from './familyVerifyingKey.ts'
import { TEST_FAMILY_PUBLIC_KEY } from './testing/testKeys.ts'

const otherKey = generateKeyPairSync('ed25519').publicKey.export({
  type: 'spki',
  format: 'pem',
}) as string
const productionKey = generateKeyPairSync('ed25519').publicKey.export({
  type: 'spki',
  format: 'pem',
}) as string
const oneLine = (pem: string) => pem.replace(/\n/g, '\\n')
const ON_FLY = { FLY_APP_NAME: 'hoe-boop' }

describe('familyVerifyingKey', () => {
  it('prefers FAMILY_TOKEN_PUBLIC_KEY over the production key', () => {
    expect(familyVerifyingKey({ FAMILY_TOKEN_PUBLIC_KEY: otherKey }, productionKey)).toBe(otherKey)
  })

  it('unescapes a one-line PEM, the form compose.yml and Fly carry', () => {
    expect(familyVerifyingKey({ FAMILY_TOKEN_PUBLIC_KEY: oneLine(otherKey) }, null)).toBe(otherKey)
  })

  it('falls back to the production key when no override is set', () => {
    expect(familyVerifyingKey({}, productionKey)).toBe(productionKey)
    expect(familyVerifyingKey({ ...ON_FLY, FAMILY_TOKEN_PUBLIC_KEY: '' }, productionKey)).toBe(
      productionKey,
    )
  })

  it('accepts an override on Fly that is not the test key', () => {
    expect(familyVerifyingKey({ ...ON_FLY, FAMILY_TOKEN_PUBLIC_KEY: otherKey }, null)).toBe(
      otherKey,
    )
  })

  it('returns the test key off Fly, as the docker stack needs', () => {
    expect(
      familyVerifyingKey({ FAMILY_TOKEN_PUBLIC_KEY: oneLine(TEST_FAMILY_PUBLIC_KEY) }, null),
    ).toBe(TEST_FAMILY_PUBLIC_KEY)
  })

  it('refuses the test key on Fly in any formatting', () => {
    const forms = [
      TEST_FAMILY_PUBLIC_KEY,
      oneLine(TEST_FAMILY_PUBLIC_KEY),
      TEST_FAMILY_PUBLIC_KEY.trimEnd(),
    ]
    for (const form of forms)
      expect(() =>
        familyVerifyingKey({ ...ON_FLY, FAMILY_TOKEN_PUBLIC_KEY: form }, productionKey),
      ).toThrow(/FAMILY_TOKEN_PUBLIC_KEY is the committed @hoe\/accounts\/testing key/)
  })

  it('refuses to run without a key, naming both ways to supply one', () => {
    for (const env of [{}, ON_FLY])
      expect(() => familyVerifyingKey(env, null)).toThrow(
        /no family verifying key.*FAMILY_TOKEN_PUBLIC_KEY.*PRODUCTION_FAMILY_PUBLIC_KEY/s,
      )
  })
})

describe('PRODUCTION_FAMILY_PUBLIC_KEY', () => {
  it('is unset, or an Ed25519 public key the gate accepts that is not the test key', () => {
    const pem = PRODUCTION_FAMILY_PUBLIC_KEY
    if (pem === null) return

    expect(pem).not.toContain('PRIVATE KEY')
    expect(createPublicKey(pem).asymmetricKeyType).toBe('ed25519')
    expect(familyVerifyingKey(ON_FLY)).toBe(pem)
    expect(() =>
      familyDocumentGate({
        accountUrl: 'https://homeofed.com/account',
        publicPaths: [],
        publicKeyPem: pem,
      }),
    ).not.toThrow()
  })
})
