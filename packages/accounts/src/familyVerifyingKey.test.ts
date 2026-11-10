import { createPublicKey, generateKeyPairSync } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { familyDocumentGate } from './familyDocumentGate.ts'
import { familyVerifyingKey, PRODUCTION_FAMILY_PUBLIC_KEY } from './familyVerifyingKey.ts'
import { TEST_FAMILY_PUBLIC_KEY } from './testing/testKeys.ts'

const newPublicKey = () =>
  generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString()
const envKey = newPublicKey()
const productionKey = newPublicKey()
const oneLine = (pem: string) => pem.replace(/\n/g, '\\n')
const ON_FLY = { FLY_APP_NAME: 'hoe-boop', NODE_ENV: 'production' }

describe('familyVerifyingKey off Fly', () => {
  it('prefers FAMILY_TOKEN_PUBLIC_KEY over the production key', () => {
    expect(familyVerifyingKey({ FAMILY_TOKEN_PUBLIC_KEY: envKey }, productionKey)).toBe(envKey)
  })

  it('unescapes a one-line PEM, the form compose.yml carries', () => {
    expect(familyVerifyingKey({ FAMILY_TOKEN_PUBLIC_KEY: oneLine(envKey) }, null)).toBe(envKey)
  })

  it('falls back to the production key when FAMILY_TOKEN_PUBLIC_KEY is unset or empty', () => {
    expect(familyVerifyingKey({}, productionKey)).toBe(productionKey)
    expect(familyVerifyingKey({ FAMILY_TOKEN_PUBLIC_KEY: '' }, productionKey)).toBe(productionKey)
  })

  it('refuses to run with neither, naming both remedies', () => {
    expect(() => familyVerifyingKey({}, null)).toThrow(
      /no family verifying key.*FAMILY_TOKEN_PUBLIC_KEY.*PRODUCTION_FAMILY_PUBLIC_KEY/s,
    )
  })
})

describe('familyVerifyingKey on Fly', () => {
  it('uses the committed production key', () => {
    expect(familyVerifyingKey(ON_FLY, productionKey)).toBe(productionKey)
  })

  it('refuses FAMILY_TOKEN_PUBLIC_KEY whatever it holds, as a local-only setting', () => {
    for (const value of [envKey, TEST_FAMILY_PUBLIC_KEY, ''])
      expect(() =>
        familyVerifyingKey({ ...ON_FLY, FAMILY_TOKEN_PUBLIC_KEY: value }, productionKey),
      ).toThrow(/FAMILY_TOKEN_PUBLIC_KEY is a local-only setting/)
  })

  it('refuses to boot until the production key is committed, naming the constant', () => {
    expect(() => familyVerifyingKey(ON_FLY, null)).toThrow(
      /PRODUCTION_FAMILY_PUBLIC_KEY is not committed/,
    )
  })
})

// Gated app images delete src/testing, so a runtime import of it would crash the boot.
describe('runtime sources', () => {
  const src = fileURLToPath(new URL('.', import.meta.url))
  const runtime = readdirSync(src).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
  )

  it.each(runtime)('%s imports nothing from src/testing', (name) => {
    expect(readFileSync(join(src, name), 'utf8')).not.toMatch(/from '\.\/testing\//)
  })
})

describe('PRODUCTION_FAMILY_PUBLIC_KEY', () => {
  it('is unset, or an Ed25519 public key the gate accepts that is not the test key', () => {
    const pem = PRODUCTION_FAMILY_PUBLIC_KEY
    if (pem === null) return
    const spki = (value: string) => createPublicKey(value).export({ type: 'spki', format: 'der' })

    expect(pem).not.toContain('PRIVATE KEY')
    expect(createPublicKey(pem).asymmetricKeyType).toBe('ed25519')
    expect(spki(pem).equals(spki(TEST_FAMILY_PUBLIC_KEY))).toBe(false)
    expect(() =>
      familyDocumentGate({
        accountUrl: 'https://homeofed.com/account',
        publicPaths: [],
        publicKeyPem: pem,
      }),
    ).not.toThrow()
  })
})

// On Fly a gated app with no committed key refuses to boot, so no deploy may switch one on yet.
describe('apps/*/fly.toml', () => {
  const repo = fileURLToPath(new URL('../../..', import.meta.url))
  const flyTomls = readdirSync(join(repo, 'apps'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `apps/${entry.name}/fly.toml`)
    .filter((path) => existsSync(join(repo, path)))

  it.each(flyTomls)(
    '%s sets FAMILY_ACCOUNT_URL only once PRODUCTION_FAMILY_PUBLIC_KEY is committed',
    (path) => {
      const setsGate = /^\s*FAMILY_ACCOUNT_URL\s*=/m.test(readFileSync(join(repo, path), 'utf8'))
      expect(setsGate && PRODUCTION_FAMILY_PUBLIC_KEY === null).toBe(false)
    },
  )
})
