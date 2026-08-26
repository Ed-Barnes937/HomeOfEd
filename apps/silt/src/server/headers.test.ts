import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConsoleLogger, createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { buildAppServer } from '@hoe/backend-kit/server'
import { describe, expect, it } from 'vitest'

import { addCrossOriginIsolation } from './headers.ts'
import { appRouter } from './router.ts'

async function buildServer() {
  const staticDir = await mkdtemp(join(tmpdir(), 'silt-headers-'))
  await writeFile(join(staticDir, 'index.html'), '<!doctype html><title>silt</title>')
  const logger = new ConsoleLogger()
  return buildAppServer({
    router: appRouter,
    createContext: createContext<void>({ store: undefined, blobs: new InMemoryBlobStore(), logger }),
    staticDir,
    logger,
    healthCheck: () => Promise.resolve({ ok: true as const }),
    registerRoutes: addCrossOriginIsolation,
  })
}

describe('cross-origin isolation headers', () => {
  it('sends COOP and COEP on the SPA page — what unlocks the sim worker', async () => {
    const app = await buildServer()

    const res = await app.inject({ method: 'GET', url: '/' })

    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin')
    expect(res.headers['cross-origin-embedder-policy']).toBe('require-corp')
  })

  it('sends them on every route, static and API alike', async () => {
    const app = await buildServer()

    for (const url of ['/health', '/index.html']) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.headers['cross-origin-opener-policy'], url).toBe('same-origin')
      expect(res.headers['cross-origin-embedder-policy'], url).toBe('require-corp')
    }
  })
})
