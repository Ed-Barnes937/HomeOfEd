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
