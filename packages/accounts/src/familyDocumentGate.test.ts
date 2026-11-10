import { generateKeyPairSync } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { FAMILY_SESSION_COOKIE } from './claims.ts'
import { familyDocumentGate, familyDocumentGateFromEnv } from './familyDocumentGate.ts'
import { mintFamilyToken } from './familyToken.ts'
import { PRODUCTION_FAMILY_PUBLIC_KEY } from './familyVerifyingKey.ts'
import { mintTestToken } from './testing/mintTestToken.ts'
import { TEST_FAMILY_PRIVATE_KEY, TEST_FAMILY_PUBLIC_KEY } from './testing/testKeys.ts'

const now = () => new Date('2026-01-01T00:00:00Z')
const ACCOUNT = 'https://homeofed.com/account'
const gate = familyDocumentGate({
  accountUrl: ACCOUNT,
  publicPaths: ['/shared'],
  publicKeyPem: TEST_FAMILY_PUBLIC_KEY,
  now,
})

const child = mintTestToken(
  { sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' },
  { now },
)
const parent = mintTestToken({ sub: 'parent-1', role: 'parent', name: 'Ed' }, { now })
const cookieFor = (token: string) => `theme=dark; ${FAMILY_SESSION_COOKIE}=${token}`
const returnToOf = (location: string | null) =>
  location === null ? null : new URL(location).searchParams.get('returnTo')

describe('familyDocumentGate', () => {
  it('passes the public paths through for the server to skip', () => {
    expect(gate.publicPaths).toEqual(['/shared'])
  })

  it('lets a verified token of either role through', () => {
    for (const token of [child, parent])
      expect(
        gate.redirectFor({ host: 'boop.homeofed.com', url: '/', cookie: cookieFor(token) }),
      ).toBeNull()
  })

  it('sends a visitor with no cookie to the account page, returning to the same URL', () => {
    const location = gate.redirectFor({
      host: 'boop.homeofed.com',
      url: '/play/1?x=1',
      cookie: null,
    })
    expect(location).toBe(
      `${ACCOUNT}?returnTo=${encodeURIComponent('https://boop.homeofed.com/play/1?x=1')}`,
    )
  })

  it('refuses a token it cannot verify: tampered, expired, other key, garbage', () => {
    const [payload] = child.split('.')
    const expired = mintTestToken(
      { sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' },
      { now: () => new Date('2025-01-01T00:00:00Z'), ttlMs: 1000 },
    )
    const otherKey = generateKeyPairSync('ed25519')
      .privateKey.export({ type: 'pkcs8', format: 'pem' })
      .toString()
    const otherKeyToken = mintFamilyToken(
      { sub: 'parent-1', role: 'parent', name: 'Ed' },
      otherKey,
      {
        now,
      },
    )
    for (const cookie of [
      cookieFor(`${payload ?? ''}.AAAA`),
      cookieFor(expired),
      cookieFor(otherKeyToken),
      cookieFor('garbage'),
      'theme=dark',
      '',
    ])
      expect(gate.redirectFor({ host: 'boop.homeofed.com', url: '/', cookie })).not.toBeNull()
  })

  it('returns to http on localhost, where the docker stack and dev servers run', () => {
    const location = gate.redirectFor({ host: 'localhost:8088', url: '/', cookie: null })
    expect(returnToOf(location)).toBe('http://localhost:8088/')
  })

  it('keeps a protocol-relative-looking path on the request host', () => {
    const location = gate.redirectFor({
      host: 'boop.homeofed.com',
      url: '//evil.example/x',
      cookie: null,
    })
    expect(returnToOf(location)).toBe('https://boop.homeofed.com//evil.example/x')
  })

  it('drops returnTo when the request host or target cannot make an honest URL', () => {
    for (const req of [
      { host: 'boop.homeofed.com', url: 'http://evil.example/' },
      { host: 'boop.homeofed.com@evil.example', url: '/' },
      { host: 'evil.example/x', url: '/' },
      { host: '', url: '/' },
    ])
      expect(gate.redirectFor({ ...req, cookie: null })).toBe(ACCOUNT)
  })
})

describe('familyDocumentGate refuses bad config at construction, not per request', () => {
  const build = (accountUrl: string, publicKeyPem: string) => () =>
    familyDocumentGate({ accountUrl, publicPaths: [], publicKeyPem })

  it('refuses an empty public key', () => {
    expect(build(ACCOUNT, '')).toThrow(/publicKeyPem/)
  })

  it('refuses text that is not a key', () => {
    expect(build(ACCOUNT, 'not a pem')).toThrow(/publicKeyPem/)
  })

  it('refuses a private key passed as the public key', () => {
    expect(build(ACCOUNT, TEST_FAMILY_PRIVATE_KEY)).toThrow(/private key/)
  })

  it('refuses a public key that is not Ed25519', () => {
    const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
    expect(build(ACCOUNT, pem)).toThrow(/Ed25519/)
  })

  it('refuses a relative account URL', () => {
    expect(build('/account', TEST_FAMILY_PUBLIC_KEY)).toThrow(/accountUrl/)
  })

  it('refuses an account URL with no scheme', () => {
    expect(build('homeofed.com/account', TEST_FAMILY_PUBLIC_KEY)).toThrow(/accountUrl/)
  })

  it('refuses an account URL that is not http(s)', () => {
    expect(build('javascript:alert(1)', TEST_FAMILY_PUBLIC_KEY)).toThrow(/accountUrl/)
  })
})

describe('familyDocumentGateFromEnv', () => {
  const ON_FLY = { FLY_APP_NAME: 'hoe-boop' }
  const otherPair = generateKeyPairSync('ed25519')
  const otherKey = otherPair.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const fromEnv = (env: Record<string, string>) =>
    familyDocumentGateFromEnv(env, { publicPaths: ['/shared'], now })

  it('is off, and resolves no key, without FAMILY_ACCOUNT_URL', () => {
    expect(fromEnv({})).toBeUndefined()
    expect(fromEnv({ ...ON_FLY })).toBeUndefined()
    expect(fromEnv({ ...ON_FLY, FAMILY_TOKEN_PUBLIC_KEY: TEST_FAMILY_PUBLIC_KEY })).toBeUndefined()
  })

  it('builds the gate from the account URL, public paths and the override key', () => {
    const gate = fromEnv({
      FAMILY_ACCOUNT_URL: 'http://localhost:8080/account',
      FAMILY_TOKEN_PUBLIC_KEY: TEST_FAMILY_PUBLIC_KEY.replace(/\n/g, '\\n'),
    })
    const req = { host: 'localhost:8088', url: '/' }

    expect(gate?.publicPaths).toEqual(['/shared'])
    expect(gate?.redirectFor({ ...req, cookie: cookieFor(child) })).toBeNull()
    expect(gate?.redirectFor({ ...req, cookie: null })).toBe(
      'http://localhost:8080/account?returnTo=http%3A%2F%2Flocalhost%3A8088%2F',
    )
  })

  it('verifies on Fly with a key that is not the test key', () => {
    const gate = fromEnv({
      ...ON_FLY,
      FAMILY_ACCOUNT_URL: ACCOUNT,
      FAMILY_TOKEN_PUBLIC_KEY: otherKey,
    })
    const token = mintFamilyToken(
      { sub: 'parent-1', role: 'parent', name: 'Ed' },
      otherPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      { now },
    )
    const req = { host: 'boop.homeofed.com', url: '/' }

    expect(gate?.redirectFor({ ...req, cookie: cookieFor(token) })).toBeNull()
    expect(gate?.redirectFor({ ...req, cookie: cookieFor(child) })).not.toBeNull()
  })

  it('refuses to boot on Fly with the test key', () => {
    const build = () =>
      fromEnv({
        ...ON_FLY,
        FAMILY_ACCOUNT_URL: ACCOUNT,
        FAMILY_TOKEN_PUBLIC_KEY: TEST_FAMILY_PUBLIC_KEY,
      })

    expect(build).toThrow(/committed @hoe\/accounts\/testing key/)
  })

  it('refuses to boot on Fly with no key until the production key is committed', () => {
    const build = () => fromEnv({ ...ON_FLY, FAMILY_ACCOUNT_URL: ACCOUNT })

    if (PRODUCTION_FAMILY_PUBLIC_KEY === null) expect(build).toThrow(/no family verifying key/)
    else expect(build()?.publicPaths).toEqual(['/shared'])
  })

  it('refuses a bad account URL, as the gate itself does', () => {
    const build = () =>
      fromEnv({ FAMILY_ACCOUNT_URL: '/account', FAMILY_TOKEN_PUBLIC_KEY: TEST_FAMILY_PUBLIC_KEY })

    expect(build).toThrow(/accountUrl/)
  })
})
