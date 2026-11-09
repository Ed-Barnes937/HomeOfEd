import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { TEST_FAMILY_PRIVATE_KEY } from '@hoe/accounts/testing'
import { describe, expect, it } from 'vitest'

import { COMMITTED_DEV_SECRETS, loadFamilyEnv } from './env.ts'

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
 * On deployed infrastructure nothing this repo publishes may be in use. Local
 * stacks set such values on purpose, which is safe only because `FLY_APP_NAME`
 * is absent there.
 */
describe('the deployment guard', () => {
  // What a real deployment looks like: no committed value anywhere.
  const deployable = {
    ...complete,
    REGISTRATION_INVITE_CODE: 'xW7qPz2LmR4tB9kD',
    BETTER_AUTH_SECRET: 'Ck0u2b8VxQ6s1ZpN4mYtJ3rHgD7fL5eA',
    NODE_ENV: 'production',
    FLY_APP_NAME: 'hoe-family',
  }

  it('boots on Fly when every secret is real', () => {
    expect(() => loadFamilyEnv(deployable)).not.toThrow()
  })

  it('boots locally with every committed dev value, which is the docker stack', () => {
    expect(() => loadFamilyEnv(complete)).not.toThrow()
  })

  describe('the signing key', () => {
    const escaped = TEST_FAMILY_PRIVATE_KEY.replace(/\n/g, '\\n')

    it.each([
      ['as a literal PEM', TEST_FAMILY_PRIVATE_KEY],
      ['with the newlines escaped, as Fly carries it', escaped],
      ['without its trailing newline', TEST_FAMILY_PRIVATE_KEY.trimEnd()],
      ['with the PEM body rewrapped', TEST_FAMILY_PRIVATE_KEY.replace(/\n/g, '\n ')],
    ])('refuses the committed test key %s', (_label, key) => {
      expect(() => loadFamilyEnv({ ...deployable, FAMILY_TOKEN_PRIVATE_KEY: key })).toThrow(
        /@hoe\/accounts\/testing key/,
      )
    })

    it('allows the committed test key where there is no Fly app', () => {
      expect(() => loadFamilyEnv({ ...complete, FAMILY_TOKEN_PRIVATE_KEY: escaped })).not.toThrow()
    })

    it('names no key material when it refuses', () => {
      try {
        loadFamilyEnv({ ...deployable, FAMILY_TOKEN_PRIVATE_KEY: TEST_FAMILY_PRIVATE_KEY })
        expect.unreachable('the guard should have thrown')
      } catch (err) {
        expect((err as Error).message).not.toContain('MC4CAQAwBQYDK2Vw')
      }
    })
  })

  // ADR 0057 item 2 makes the invite code THE mechanism of the legal gate, so a
  // committed one reaching Fly would open registration to anyone who can read
  // the repo, with a green health check and no other signal.
  describe.each(['REGISTRATION_INVITE_CODE', 'BETTER_AUTH_SECRET'] as const)('%s', (name) => {
    it.each(COMMITTED_DEV_SECRETS)('refuses the committed value %s', (value) => {
      expect(() => loadFamilyEnv({ ...deployable, [name]: value })).toThrow(
        /committed to this repo/,
      )
    })

    it('refuses anything too short to be unguessable', () => {
      expect(() => loadFamilyEnv({ ...deployable, [name]: 'sh0rt' })).toThrow(/at least/)
    })

    it('allows a short value where there is no Fly app', () => {
      expect(() => loadFamilyEnv({ ...complete, [name]: 'sh0rt' })).not.toThrow()
    })
  })

  describe('NODE_ENV', () => {
    it.each([undefined, 'development', 'test', 'Production'])(
      'refuses to run on Fly with NODE_ENV=%s',
      (nodeEnv) => {
        expect(() => loadFamilyEnv({ ...deployable, NODE_ENV: nodeEnv })).toThrow(/NODE_ENV/)
      },
    )
  })
})

/**
 * The guard's literal list is only as good as its agreement with the files that
 * actually set these values, and nothing else can catch that drift.
 */
describe('COMMITTED_DEV_SECRETS', () => {
  function readRepoFile(relative: string): string {
    return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
  }

  it.each([
    [
      '.env.example',
      '../../.env.example',
      /^\s*(?:REGISTRATION_INVITE_CODE|BETTER_AUTH_SECRET)=(.+)$/gm,
    ],
    [
      'compose.yml',
      '../../../../compose.yml',
      /^\s*(?:REGISTRATION_INVITE_CODE|BETTER_AUTH_SECRET):\s*(.+)$/gm,
    ],
  ])('covers every value %s commits', (_label, relative, pattern) => {
    const values = [...readRepoFile(relative).matchAll(pattern)].map(([, value]) =>
      (value ?? '').trim().replace(/^['"]|['"]$/g, ''),
    )

    // Both names, and in compose.yml sprout's copies too - equally dangerous.
    expect(values.length).toBeGreaterThanOrEqual(2)
    for (const value of values) expect(COMMITTED_DEV_SECRETS).toContain(value)
  })
})
