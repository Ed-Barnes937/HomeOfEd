import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { COMMITTED_DEV_SECRETS } from '@hoe/deploy-guard'
import { describe, expect, it } from 'vitest'

import { resolvePipelineApiKey } from './env.ts'

// What a real deployment looks like: the shared key is not a committed value.
const deployable = {
  PIPELINE_API_KEY: 'Nf3hQ8wE1rY6uI0oP5aS2dF7gJ4kL9zX',
  NODE_ENV: 'production',
  FLY_APP_NAME: 'hoe-sprout-pipeline',
}

describe('resolvePipelineApiKey off Fly', () => {
  it('uses the key it is given, committed or not', () => {
    expect(
      resolvePipelineApiKey({ PIPELINE_API_KEY: 'dev-pipeline-key', NODE_ENV: 'production' }),
    ).toBe('dev-pipeline-key')
  })

  it('refuses to start in production without a key', () => {
    expect(() => resolvePipelineApiKey({ NODE_ENV: 'production' })).toThrow(
      /PIPELINE_API_KEY must be set in production/,
    )
  })

  it('falls back to the dev key outside production', () => {
    expect(resolvePipelineApiKey({})).toBe('dev-pipeline-key')
  })
})

describe('resolvePipelineApiKey on Fly', () => {
  it('uses a real key', () => {
    expect(resolvePipelineApiKey(deployable)).toBe(deployable.PIPELINE_API_KEY)
  })

  it('refuses to start without a key', () => {
    expect(() => resolvePipelineApiKey({ ...deployable, PIPELINE_API_KEY: undefined })).toThrow(
      'PIPELINE_API_KEY is required',
    )
  })

  it.each(COMMITTED_DEV_SECRETS)('refuses the committed value %s', (value) => {
    expect(() => resolvePipelineApiKey({ ...deployable, PIPELINE_API_KEY: value })).toThrow(
      /placeholder/,
    )
  })

  it('refuses anything too short to be unguessable', () => {
    expect(() => resolvePipelineApiKey({ ...deployable, PIPELINE_API_KEY: 'sh0rt' })).toThrow(
      /at least 32/,
    )
  })

  it('refuses NODE_ENV other than production, which would re-open the dev fallback', () => {
    expect(() => resolvePipelineApiKey({ ...deployable, NODE_ENV: 'development' })).toThrow(
      /NODE_ENV/,
    )
  })
})

/** Whatever the files commit must be refused on Fly, asserted per file. */
describe('the values this repo commits', () => {
  function readRepoFile(relative: string): string {
    return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
  }

  function pipelineService(compose: string): string {
    const block = compose.slice(compose.indexOf('\n  sprout-pipeline:') + 1)
    const end = block.search(/\n {2}[a-z]/)
    return end === -1 ? block : block.slice(0, end)
  }

  function committedValues(source: string, assign: string): string[] {
    const pattern = new RegExp(`^\\s*PIPELINE_API_KEY${assign}\\s*(.+)$`, 'gm')
    return [...source.matchAll(pattern)].map(([, value]) =>
      (value ?? '').trim().replace(/^['"]|['"]$/g, ''),
    )
  }

  it.each([
    ['apps/sprout-pipeline/.env.example', readRepoFile('../.env.example'), '='],
    [
      'compose.yml (the sprout-pipeline service)',
      pipelineService(readRepoFile('../../../compose.yml')),
      ':',
    ],
  ])('refuses the PIPELINE_API_KEY %s commits', (_label, source, assign) => {
    const values = committedValues(source, assign)

    expect(values.length).toBeGreaterThanOrEqual(1)
    for (const value of values) {
      expect(() => resolvePipelineApiKey({ ...deployable, PIPELINE_API_KEY: value })).toThrow()
    }
  })
})
