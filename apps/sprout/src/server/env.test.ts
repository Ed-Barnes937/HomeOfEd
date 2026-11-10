import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { COMMITTED_DEV_SECRETS } from '@hoe/deploy-guard'
import { describe, expect, it } from 'vitest'

import { loadSproutWebEnv, loadSproutWorkerEnv } from './env.ts'

// The docker stack: the prod image (NODE_ENV=production) with committed values.
const dockerStack = {
  BETTER_AUTH_SECRET: 'dev-better-auth-secret',
  CHILD_SESSION_SECRET: 'dev-child-session-secret',
  PIPELINE_API_KEY: 'dev-pipeline-key',
  REGISTRATION_INVITE_CODE: 'dev-invite-code',
  NODE_ENV: 'production',
}

// What a real deployment looks like: no committed value anywhere.
const deployable = {
  BETTER_AUTH_SECRET: 'Ck0u2b8VxQ6s1ZpN4mYtJ3rHgD7fL5eA',
  CHILD_SESSION_SECRET: 'Rj5nW1qZ8vT3kB6yH0mX4cL7pF2sG9dU',
  PIPELINE_API_KEY: 'Nf3hQ8wE1rY6uI0oP5aS2dF7gJ4kL9zX',
  REGISTRATION_INVITE_CODE: 'xW7qPz2LmR4tB9kD',
  NODE_ENV: 'production',
  FLY_APP_NAME: 'hoe-sprout',
}

const WEB_SECRETS = [
  'BETTER_AUTH_SECRET',
  'CHILD_SESSION_SECRET',
  'PIPELINE_API_KEY',
  'REGISTRATION_INVITE_CODE',
] as const

describe('loadSproutWebEnv off Fly', () => {
  it('boots the docker stack on its committed values', () => {
    expect(loadSproutWebEnv(dockerStack)).toEqual({
      BETTER_AUTH_SECRET: 'dev-better-auth-secret',
      CHILD_SESSION_SECRET: 'dev-child-session-secret',
      PIPELINE_API_KEY: 'dev-pipeline-key',
      REGISTRATION_INVITE_CODE: 'dev-invite-code',
    })
  })

  it('always requires CHILD_SESSION_SECRET', () => {
    expect(() => loadSproutWebEnv({ ...dockerStack, CHILD_SESSION_SECRET: undefined })).toThrow(
      'CHILD_SESSION_SECRET is required',
    )
  })

  it.each(['PIPELINE_API_KEY', 'REGISTRATION_INVITE_CODE'])('requires %s in production', (name) => {
    expect(() => loadSproutWebEnv({ ...dockerStack, [name]: undefined })).toThrow(
      `${name} is required in production`,
    )
  })

  it('outside production falls back to the dev pipeline key and an open registration', () => {
    const env = loadSproutWebEnv({ CHILD_SESSION_SECRET: 'dev-child-session-secret' })

    expect(env.PIPELINE_API_KEY).toBe('dev-pipeline-key')
    expect(env.REGISTRATION_INVITE_CODE).toBeUndefined()
  })
})

/** Anything this public repo publishes would let a reader forge a session. */
describe('loadSproutWebEnv on Fly', () => {
  it('boots when every secret is real', () => {
    expect(loadSproutWebEnv(deployable)).toEqual({
      BETTER_AUTH_SECRET: deployable.BETTER_AUTH_SECRET,
      CHILD_SESSION_SECRET: deployable.CHILD_SESSION_SECRET,
      PIPELINE_API_KEY: deployable.PIPELINE_API_KEY,
      REGISTRATION_INVITE_CODE: deployable.REGISTRATION_INVITE_CODE,
    })
  })

  describe.each(WEB_SECRETS)('%s', (name) => {
    it('refuses to boot without it', () => {
      expect(() => loadSproutWebEnv({ ...deployable, [name]: undefined })).toThrow(
        `${name} is required`,
      )
    })

    it.each(COMMITTED_DEV_SECRETS)('refuses the committed value %s', (value) => {
      expect(() => loadSproutWebEnv({ ...deployable, [name]: value })).toThrow(/placeholder/)
    })

    it('refuses anything too short to be unguessable', () => {
      expect(() => loadSproutWebEnv({ ...deployable, [name]: 'sh0rt' })).toThrow(/at least/)
    })
  })

  it('refuses NODE_ENV other than production, which would re-open the dev fallbacks', () => {
    expect(() => loadSproutWebEnv({ ...deployable, NODE_ENV: 'development' })).toThrow(/NODE_ENV/)
  })
})

describe('loadSproutWorkerEnv', () => {
  const worker = {
    PIPELINE_API_KEY: deployable.PIPELINE_API_KEY,
    NODE_ENV: 'production',
    FLY_APP_NAME: 'hoe-sprout',
  }

  it('needs only the pipeline key, even on Fly', () => {
    expect(loadSproutWorkerEnv(worker)).toEqual({ PIPELINE_API_KEY: worker.PIPELINE_API_KEY })
  })

  it('refuses a committed pipeline key on Fly', () => {
    expect(() => loadSproutWorkerEnv({ ...worker, PIPELINE_API_KEY: 'dev-pipeline-key' })).toThrow(
      /placeholder/,
    )
  })

  it('refuses a missing pipeline key on Fly', () => {
    expect(() => loadSproutWorkerEnv({ ...worker, PIPELINE_API_KEY: undefined })).toThrow(
      'PIPELINE_API_KEY is required',
    )
  })

  it('requires the pipeline key in production off Fly', () => {
    expect(() => loadSproutWorkerEnv({ NODE_ENV: 'production' })).toThrow(
      'PIPELINE_API_KEY is required in production',
    )
  })

  it('outside production falls back to the dev pipeline key', () => {
    expect(loadSproutWorkerEnv({})).toEqual({ PIPELINE_API_KEY: 'dev-pipeline-key' })
  })
})

/**
 * Whatever the files commit must be refused on Fly. Asserted per file per name,
 * because a per-file count lets one of them stop being scanned unnoticed.
 */
describe('the values this repo commits', () => {
  function readRepoFile(relative: string): string {
    return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
  }

  /** compose.yml holds every app; slice out one top-level service block. */
  function composeService(compose: string, service: string): string {
    const block = compose.slice(compose.indexOf(`\n  ${service}:`) + 1)
    const end = block.search(/\n {2}[a-z]/)
    return end === -1 ? block : block.slice(0, end)
  }

  function committedValues(source: string, name: string, assign: string): string[] {
    const pattern = new RegExp(`^\\s*${name}${assign}\\s*(.+)$`, 'gm')
    return [...source.matchAll(pattern)].map(([, value]) =>
      (value ?? '').trim().replace(/^['"]|['"]$/g, ''),
    )
  }

  const compose = readRepoFile('../../../../compose.yml')
  const cases = [
    [
      'apps/sprout/.env.example',
      readRepoFile('../../.env.example'),
      '=',
      ['BETTER_AUTH_SECRET', 'CHILD_SESSION_SECRET', 'PIPELINE_API_KEY'],
    ],
    ['compose.yml (the sprout service)', composeService(compose, 'sprout'), ':', WEB_SECRETS],
    [
      'compose.yml (the sprout-worker service)',
      composeService(compose, 'sprout-worker'),
      ':',
      ['PIPELINE_API_KEY'],
    ],
  ] as const

  describe.each(cases)('%s', (_label, source, assign, names) => {
    it.each(names)('refuses the %s it commits', (name) => {
      const values = committedValues(source, name, assign)

      expect(values.length).toBeGreaterThanOrEqual(1)
      for (const value of values) {
        expect(() => loadSproutWebEnv({ ...deployable, [name]: value })).toThrow()
      }
    })
  })
})
