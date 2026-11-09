import { TEST_FAMILY_PRIVATE_KEY } from '@hoe/accounts/testing'
import { describe, expect, it } from 'vitest'

import { loadFamilyEnv } from './env.ts'

const complete = {
  FAMILY_TOKEN_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----\\n',
  REGISTRATION_INVITE_CODE: 'dev-insecure-invite',
  BETTER_AUTH_SECRET: 'dev-insecure-secret',
  BETTER_AUTH_URL: 'http://localhost:3010',
}

describe('loadFamilyEnv', () => {
  it('accepts a complete environment', () => {
    expect(loadFamilyEnv(complete)).toMatchObject({
      REGISTRATION_INVITE_CODE: 'dev-insecure-invite',
      BETTER_AUTH_SECRET: 'dev-insecure-secret',
      BETTER_AUTH_URL: 'http://localhost:3010',
    })
  })

  it('restores the PEM newlines the environment escaped', () => {
    expect(loadFamilyEnv(complete).FAMILY_TOKEN_PRIVATE_KEY).toBe(
      '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----\n',
    )
  })

  it.each([
    'FAMILY_TOKEN_PRIVATE_KEY',
    'REGISTRATION_INVITE_CODE',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
  ])('crashes when %s is missing, naming it', (name) => {
    expect(() => loadFamilyEnv({ ...complete, [name]: undefined })).toThrow(name)
  })

  it('crashes when a secret is present but empty', () => {
    expect(() => loadFamilyEnv({ ...complete, BETTER_AUTH_SECRET: '' })).toThrow(
      'BETTER_AUTH_SECRET',
    )
  })

  it('never puts a supplied value in the failure message', () => {
    const leaky = {
      ...complete,
      FAMILY_TOKEN_PRIVATE_KEY: 'super-secret-key-material',
      BETTER_AUTH_URL: 'not-a-url',
    }

    expect(() => loadFamilyEnv(leaky)).toThrow(/BETTER_AUTH_URL/)
    expect(() => loadFamilyEnv(leaky)).not.toThrow(/super-secret-key-material|not-a-url/)
  })
})

/**
 * The committed fixture is public knowledge, so signing with it on deployed
 * infrastructure would let anyone mint tokens for the whole estate. compose.yml
 * sets it on purpose, which is safe only because `FLY_APP_NAME` is absent there.
 */
describe('the committed-test-key boot guard', () => {
  const escaped = TEST_FAMILY_PRIVATE_KEY.replace(/\n/g, '\\n')

  it.each([
    ['as a literal PEM', TEST_FAMILY_PRIVATE_KEY],
    ['with the newlines escaped, as Fly carries it', escaped],
    ['without its trailing newline', TEST_FAMILY_PRIVATE_KEY.trimEnd()],
    ['with the PEM body rewrapped', TEST_FAMILY_PRIVATE_KEY.replace(/\n/g, '\n ')],
  ])('refuses to boot on Fly with the test key %s', (_label, key) => {
    expect(() =>
      loadFamilyEnv({ ...complete, FAMILY_TOKEN_PRIVATE_KEY: key, FLY_APP_NAME: 'hoe-family' }),
    ).toThrow(/@hoe\/accounts\/testing key/)
  })

  it('allows the test key where there is no Fly app, which is the docker stack', () => {
    expect(() => loadFamilyEnv({ ...complete, FAMILY_TOKEN_PRIVATE_KEY: escaped })).not.toThrow()
  })

  it('allows a real key on Fly', () => {
    expect(() => loadFamilyEnv({ ...complete, FLY_APP_NAME: 'hoe-family' })).not.toThrow()
  })

  it('names no key material when it refuses', () => {
    try {
      loadFamilyEnv({
        ...complete,
        FAMILY_TOKEN_PRIVATE_KEY: TEST_FAMILY_PRIVATE_KEY,
        FLY_APP_NAME: 'hoe-family',
      })
      expect.unreachable('the guard should have thrown')
    } catch (err) {
      expect((err as Error).message).not.toContain('MC4CAQAwBQYDK2Vw')
    }
  })
})
