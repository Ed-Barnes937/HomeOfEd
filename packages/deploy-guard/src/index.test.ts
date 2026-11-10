import { describe, expect, it } from 'vitest'

import { assertFitForDeployment, COMMITTED_DEV_SECRETS, isDeployed } from './index.ts'

const floors = { SIGNING_SECRET: 32, INVITE_CODE: 16 } as const

// What a real deployment looks like: no committed value anywhere.
const deployed = {
  SIGNING_SECRET: 'Ck0u2b8VxQ6s1ZpN4mYtJ3rHgD7fL5eA',
  INVITE_CODE: 'xW7qPz2LmR4tB9kD',
  NODE_ENV: 'production',
  FLY_APP_NAME: 'hoe-example',
}

describe('isDeployed', () => {
  it('is true wherever Fly has injected FLY_APP_NAME', () => {
    expect(isDeployed({ FLY_APP_NAME: 'hoe-example' })).toBe(true)
  })

  it.each([undefined, ''])('is false when FLY_APP_NAME is %j', (flyAppName) => {
    expect(isDeployed({ FLY_APP_NAME: flyAppName })).toBe(false)
  })
})

describe('assertFitForDeployment', () => {
  it('passes a deployment whose every secret is real', () => {
    expect(() => assertFitForDeployment(deployed, floors)).not.toThrow()
  })

  it('does nothing where there is no Fly app, which is every local stack', () => {
    const local = {
      SIGNING_SECRET: 'dev-better-auth-secret-change-me',
      NODE_ENV: 'development',
    }

    expect(() => assertFitForDeployment(local, floors)).not.toThrow()
  })

  it('judges only the secrets it is given', () => {
    expect(() =>
      assertFitForDeployment({ ...deployed, UNRELATED: 'dev-unrelated' }, floors),
    ).not.toThrow()
  })

  describe.each(Object.keys(floors))('%s', (name) => {
    it.each([undefined, ''])('refuses a missing value (%j), naming it', (value) => {
      expect(() => assertFitForDeployment({ ...deployed, [name]: value }, floors)).toThrow(
        new RegExp(`${name} is required`),
      )
    })

    it.each(COMMITTED_DEV_SECRETS)('refuses the committed value %s', (value) => {
      expect(() => assertFitForDeployment({ ...deployed, [name]: value }, floors)).toThrow(
        /placeholder/,
      )
    })

    // A list only ever enumerates what somebody remembered; the pattern is the
    // rule. Each of these is long enough and absent from the list.
    it.each([
      'dev-whatever-someone-writes-next1',
      'insecure-but-long-enough-for-this',
      'change-me-before-you-ever-deploy1',
      'changeme-before-you-ever-deploy12',
      'placeholder-value-of-ample-length',
      'example-secret-of-ample-length123',
      'testing-secret-of-ample-length123',
      'A-LOUD-DEV-SECRET-OF-AMPLE-LENGTH',
    ])('refuses the unlisted placeholder %s', (value) => {
      expect(() => assertFitForDeployment({ ...deployed, [name]: value }, floors)).toThrow(
        /placeholder/,
      )
    })

    it('refuses anything shorter than its floor, naming the floor', () => {
      const floor = floors[name as keyof typeof floors]

      expect(() => assertFitForDeployment({ ...deployed, [name]: 'sh0rt' }, floors)).toThrow(
        `${name} must be at least ${floor} characters`,
      )
    })

    it('accepts a value exactly at its floor', () => {
      const floor = floors[name as keyof typeof floors]

      expect(() =>
        assertFitForDeployment({ ...deployed, [name]: 'k'.repeat(floor) }, floors),
      ).not.toThrow()
    })
  })

  it.each([undefined, 'development', 'test', 'Production'])('refuses NODE_ENV=%s', (nodeEnv) => {
    expect(() => assertFitForDeployment({ ...deployed, NODE_ENV: nodeEnv }, floors)).toThrow(
      /NODE_ENV must be "production"/,
    )
  })

  it('refuses a bad NODE_ENV even with no secrets to judge', () => {
    expect(() => assertFitForDeployment({ ...deployed, NODE_ENV: 'development' }, {})).toThrow(
      /NODE_ENV/,
    )
  })

  describe('a local-only setting', () => {
    const localOnly = ['STACK_SWITCH'] as const

    it.each(['on', 'off', ''])('refuses it on Fly whatever its value (%j), naming it', (value) => {
      expect(() =>
        assertFitForDeployment({ ...deployed, STACK_SWITCH: value }, floors, localOnly),
      ).toThrow(/STACK_SWITCH is a local-only setting/)
    })

    it('passes a deployment that does not set it', () => {
      expect(() => assertFitForDeployment(deployed, floors, localOnly)).not.toThrow()
    })

    it('allows it wherever there is no Fly app', () => {
      expect(() =>
        assertFitForDeployment({ STACK_SWITCH: 'on', NODE_ENV: 'production' }, floors, localOnly),
      ).not.toThrow()
    })
  })

  it('never puts a supplied value in the failure message', () => {
    const leaky = 'dev-super-secret-key-material-0000'

    expect(() => assertFitForDeployment({ ...deployed, SIGNING_SECRET: leaky }, floors)).toThrow(
      /SIGNING_SECRET/,
    )
    expect(() =>
      assertFitForDeployment({ ...deployed, SIGNING_SECRET: leaky }, floors),
    ).not.toThrow(leaky)
  })
})
