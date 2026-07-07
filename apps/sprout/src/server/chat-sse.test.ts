// Integration test for the SSE route, exercised through the REAL D9
// `registerRoutes` hook + `createAppServer` (so it also proves the route is
// mounted ahead of the SPA fallback). A fake pipeline scripts the chunks; a
// FakeSproutStore proves flag persistence and the behavioural signals.
import { createContext, InMemoryBlobStore, ConsoleLogger } from '@hoe/backend-kit'
import { createAppServer } from '@hoe/backend-kit/server'
import { mkdtemp, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import type { ChildUser } from './auth/providers.ts'
import { registerChatSseRoute } from './chat-sse.ts'
import type { PipelineClient } from './pipeline/pipelineClient.ts'
import type { ChatStreamChunk } from '../lib/chatStream.ts'
import { readSseStream } from '../lib/sseFrames.ts'
import { createAppRouter } from './router.ts'
import { FakeSproutStore } from './testing/fakeSproutStore.ts'
import type { SproutStore } from './store.ts'

const CHILD_ID = '11111111-1111-4111-8111-111111111111'
const PARENT_ID = 'parent-1'

const silentLogger = new ConsoleLogger({ app: 'sprout-test' })
// Swallow the expected error line in the failure test.
silentLogger.error = () => undefined

async function freePort(): Promise<number> {
  const probe = net.createServer()
  await new Promise<void>((resolve) => probe.listen(0, resolve))
  const { port } = probe.address() as AddressInfo
  await new Promise<void>((resolve) => probe.close(() => resolve()))
  return port
}

async function makeStaticDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sprout-sse-'))
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><title>sprout</title>')
  return dir
}

function fakePipeline(chunks: ChatStreamChunk[]): PipelineClient {
  return {
    // eslint-disable-next-line @typescript-eslint/require-await
    async *streamChat(): AsyncIterable<ChatStreamChunk> {
      for (const chunk of chunks) yield chunk
    },
  }
}

async function seedChild(store: SproutStore): Promise<void> {
  await store.createUser({ id: PARENT_ID, name: 'P', email: 'p@test.com' })
  await store.createChild({
    id: CHILD_ID,
    parentId: PARENT_ID,
    displayName: 'Alex',
    username: 'alex1234',
    passwordHash: 'x',
    presetName: 'confident-reader',
  })
  await store.createPreset({ childId: CHILD_ID, name: 'confident-reader', sessionLimits: 3 })
}

async function startServer(opts: {
  store: SproutStore
  pipeline: PipelineClient
  resolveChild: () => ChildUser | null
}): Promise<{ url: string; close: () => Promise<void> }> {
  const port = await freePort()
  const router = createAppRouter({
    hasher: { hash: () => '', verify: () => false },
    summarise: () => Promise.reject(new Error('unused')),
    mintChildToken: () => '',
  })
  const server = createAppServer({
    router,
    createContext: createContext({
      store: opts.store,
      blobs: new InMemoryBlobStore(),
      logger: silentLogger,
    }),
    staticDir: await makeStaticDir(),
    logger: silentLogger,
    healthCheck: () => Promise.resolve({ ok: true }),
    registerRoutes: (app) =>
      registerChatSseRoute(app, {
        store: opts.store,
        pipeline: opts.pipeline,
        resolveChild: opts.resolveChild,
        logger: silentLogger,
      }),
  })
  await server.listen(port)
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() }
}

async function readChunks(res: Response): Promise<ChatStreamChunk[]> {
  const out: ChatStreamChunk[] = []
  if (!res.body) return out
  for await (const value of readSseStream(res.body)) out.push(value as ChatStreamChunk)
  return out
}

let close: (() => Promise<void>) | undefined
afterEach(async () => {
  await close?.()
  close = undefined
})

const authedChild: ChildUser = { id: CHILD_ID, role: 'child', parentId: PARENT_ID }

describe('POST /api/chat/stream', () => {
  it('401s an unauthenticated request', async () => {
    const store = new FakeSproutStore()
    const server = await startServer({
      store,
      pipeline: fakePipeline([]),
      resolveChild: () => null,
    })
    close = server.close
    const res = await fetch(`${server.url}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi', history: [] }),
    })
    expect(res.status).toBe(401)
  })

  it('streams pipeline tokens to the browser as SSE frames', async () => {
    const store = new FakeSproutStore()
    await seedChild(store)
    const server = await startServer({
      store,
      pipeline: fakePipeline([{ token: 'Hello ' }, { token: 'there!' }]),
      resolveChild: () => authedChild,
    })
    close = server.close
    const res = await fetch(`${server.url}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi', history: [] }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(await readChunks(res)).toEqual([{ token: 'Hello ' }, { token: 'there!' }])
  })

  it('persists a flag event to the DB and forwards it + the fallback token', async () => {
    const store = new FakeSproutStore()
    await seedChild(store)
    const flag = {
      type: 'blocked' as const,
      reason: 'Input blocklist triggered',
      childMessage: 'bad thing',
      topics: ['weapons'],
    }
    const server = await startServer({
      store,
      pipeline: fakePipeline([{ flag }, { token: "Let's talk about something else." }]),
      resolveChild: () => authedChild,
    })
    close = server.close
    const res = await fetch(`${server.url}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'bad thing', history: [] }),
    })
    const chunks = await readChunks(res)
    expect(chunks).toEqual([{ flag }, { token: "Let's talk about something else." }])

    const persisted = await store.listFlagsByChild(CHILD_ID)
    expect(persisted).toHaveLength(1)
    expect(persisted[0]).toMatchObject({
      childId: CHILD_ID,
      type: 'blocked',
      reason: 'Input blocklist triggered',
      topics: JSON.stringify(['weapons']),
    })
    // The flag also records a probe behavioural signal (6.5.6).
    const probes = await store.countBehaviouralEvents({
      kind: 'probe',
      since: new Date(0),
      childId: CHILD_ID,
    })
    expect(probes).toBe(1)
  })

  it('fails closed to an error frame when the pipeline throws mid-stream', async () => {
    const store = new FakeSproutStore()
    await seedChild(store)
    const brokenPipeline: PipelineClient = {
      // eslint-disable-next-line @typescript-eslint/require-await
      async *streamChat(): AsyncIterable<ChatStreamChunk> {
        yield { token: 'partial' }
        throw new Error('pipeline exploded')
      },
    }
    const server = await startServer({
      store,
      pipeline: brokenPipeline,
      resolveChild: () => authedChild,
    })
    close = server.close
    const res = await fetch(`${server.url}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi', history: [] }),
    })
    expect(await readChunks(res)).toEqual([
      { token: 'partial' },
      { error: 'Failed to get response' },
    ])
  })
})
