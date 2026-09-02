// Shared scaffold for tests that drive the REAL app server through the D9
// `registerRoutes` hook (the inject / listening-server prior art shared by the
// geo-boundary, legal-docs, and chat-SSE tests): a router with inert deps, a
// throwaway static dir, and the composed `CreateAppServerOpts`. Tests that
// need a listening server (SSE) pass the opts to `createAppServer`; everything
// else uses `buildTestAppServer` + `inject`.
import { createContext, InMemoryBlobStore, ConsoleLogger, type Logger } from '@hoe/backend-kit'
import {
  buildAppServer,
  type CreateAppServerOpts,
  type FastifyInstance,
} from '@hoe/backend-kit/server'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { createAppRouter } from '../router.ts'
import type { SproutStore } from '../store.ts'
import { FakeSproutStore } from './fakeSproutStore.ts'

/** A real static dir with a stub index.html, so the SPA fallback resolves. */
export async function makeStaticDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sprout-test-'))
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><title>sprout</title>')
  return dir
}

export interface TestServerOpts {
  store?: SproutStore
  logger?: Logger
  registerRoutes?: CreateAppServerOpts['registerRoutes']
}

/** The composed `CreateAppServerOpts`: the real app router over inert deps,
 * a FakeSproutStore (unless one is injected), and a shallow health check. */
export async function testServerOpts(opts: TestServerOpts = {}): Promise<CreateAppServerOpts> {
  const logger = opts.logger ?? new ConsoleLogger({ app: 'sprout-test' })
  const router = createAppRouter({
    hasher: { hash: () => '', verify: () => false },
    summarise: () => Promise.reject(new Error('unused')),
    mintChildToken: () => '',
  })
  return {
    router,
    createContext: createContext({
      store: opts.store ?? new FakeSproutStore(),
      blobs: new InMemoryBlobStore(),
      logger,
    }),
    staticDir: await makeStaticDir(),
    logger,
    healthCheck: () => Promise.resolve({ ok: true }),
    registerRoutes: opts.registerRoutes,
  }
}

/** The non-listening server for `inject`-style tests. */
export async function buildTestAppServer(opts: TestServerOpts = {}): Promise<FastifyInstance> {
  return buildAppServer(await testServerOpts(opts))
}
