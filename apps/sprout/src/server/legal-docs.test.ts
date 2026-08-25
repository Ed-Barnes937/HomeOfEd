// Unit tests for the ToS/Privacy draft documents (ADR-0015 items 2–3),
// exercised through the REAL D9 `registerRoutes` hook + `buildAppServer`
// (inject style — backend-kit's app-server tests are the prior art). The pages
// are static skeletons whose headings mirror docs/legal-content-requirements.md.
import { createContext, InMemoryBlobStore, ConsoleLogger } from '@hoe/backend-kit'
import { buildAppServer } from '@hoe/backend-kit/server'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { registerLegalDocRoutes } from './legal-docs.ts'
import { createAppRouter } from './router.ts'
import { FakeSproutStore } from './testing/fakeSproutStore.ts'

const testLogger = new ConsoleLogger({ app: 'sprout-test' })

async function makeStaticDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sprout-legal-'))
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><title>sprout</title>')
  return dir
}

async function buildServer() {
  const router = createAppRouter({
    hasher: { hash: () => '', verify: () => false },
    summarise: () => Promise.reject(new Error('unused')),
    mintChildToken: () => '',
  })
  return buildAppServer({
    router,
    createContext: createContext({
      store: new FakeSproutStore(),
      blobs: new InMemoryBlobStore(),
      logger: testLogger,
    }),
    staticDir: await makeStaticDir(),
    logger: testLogger,
    healthCheck: () => Promise.resolve({ ok: true }),
    registerRoutes: (app) => registerLegalDocRoutes(app),
  })
}

const TERMS_HEADINGS = [
  'UK-only use',
  'Who may hold an account',
  'UK residence',
  'The AI is not a person',
  'Parental visibility',
  'How agreement is captured',
  'Termination and erasure',
]

const PRIVACY_HEADINGS = [
  'What is collected',
  'Children’s data',
  'Who processes it',
  'Retention windows',
  'Parental access',
  'Erasure',
  'UK-only service',
]

describe('the legal draft documents', () => {
  it('serves /terms as a self-contained draft skeleton', async () => {
    const app = await buildServer()
    const res = await app.inject({ method: 'GET', url: '/terms' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toContain('Terms of Service')
    expect(res.body).toContain('Draft — not yet in force')
    for (const heading of TERMS_HEADINGS) expect(res.body).toContain(heading)
    await app.close()
  })

  it('serves /privacy as a self-contained draft skeleton', async () => {
    const app = await buildServer()
    const res = await app.inject({ method: 'GET', url: '/privacy' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toContain('Privacy Policy')
    expect(res.body).toContain('Draft — not yet in force')
    for (const heading of PRIVACY_HEADINGS) expect(res.body).toContain(heading)
    await app.close()
  })

  it('references no external assets or scripts', async () => {
    const app = await buildServer()
    for (const url of ['/terms', '/privacy']) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.body).not.toContain('<script')
      expect(res.body).not.toContain('<link')
      expect(res.body).not.toContain('src=')
    }
    await app.close()
  })
})
