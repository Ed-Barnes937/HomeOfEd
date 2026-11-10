// fridge behind the estate gate (ADR 0093): shared boards stay public, everything
// else needs a family session. Transport behaviour, so it binds a real port.
import { mkdtemp, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { FAMILY_SESSION_COOKIE } from '@hoe/accounts'
import { mintTestToken, TEST_FAMILY_PUBLIC_KEY } from '@hoe/accounts/testing'
import { ConsoleLogger, createContext, InMemoryBlobStore } from '@hoe/backend-kit'
import { buildAppServer } from '@hoe/backend-kit/server'
import { freshTestDb } from '@hoe/db'
import { afterEach, describe, expect, it } from 'vitest'

import type { StoredBoard } from './boardSchema.ts'
import { fridgeDocumentGate } from './documentGate.ts'
import { migrations } from './migrations.ts'
import { appRouter } from './router.ts'
import { fridgeSchema } from './schema.ts'
import { DrizzleFridgeStore } from './store.ts'

const ACCOUNT = 'http://localhost:8080/account'
const INDEX_HTML = '<!doctype html><title>fridge</title>'
const SHARED_ID = 'SeedBoard1'
const BOARD: StoredBoard = {
  name: 'Shared Hello',
  finish: 'mint',
  wall: 'warm',
  magnets: [{ type: 'letter', label: 'H', deg: 0, color: 'red', x: 300, y: 60, rot: 0 }],
}

const closers: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()))
})

// One PGlite for the file: booting it is most of each test's time.
const seededStore = (async () => {
  const store = new DrizzleFridgeStore(await freshTestDb(fridgeSchema, migrations))
  await store.insertSharedBoard(SHARED_ID, BOARD.name, BOARD)
  return store
})()

async function serve(env: Record<string, string | undefined>): Promise<string> {
  const staticDir = await mkdtemp(path.join(os.tmpdir(), 'hoe-fridge-gate-'))
  await writeFile(path.join(staticDir, 'index.html'), INDEX_HTML)
  const store = await seededStore
  const logger = new ConsoleLogger({ app: 'fridge', mode: 'test' })
  const app = await buildAppServer({
    router: appRouter,
    createContext: createContext({ store, blobs: new InMemoryBlobStore(), logger }),
    staticDir,
    logger,
    healthCheck: () => Promise.resolve({ ok: true }),
    documentGate: fridgeDocumentGate(env),
  })
  await app.listen({ port: 0, host: '127.0.0.1' })
  closers.push(() => app.close())
  return `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
}

const GATE_ON = { FAMILY_ACCOUNT_URL: ACCOUNT, FAMILY_TOKEN_PUBLIC_KEY: TEST_FAMILY_PUBLIC_KEY }
const get = (base: string, url: string, headers: Record<string, string> = {}) =>
  fetch(`${base}${url}`, { redirect: 'manual', headers })

describe('fridge with the gate on', () => {
  it('serves a shared board to a visitor with no session', async () => {
    const base = await serve(GATE_ON)
    const res = await get(base, `/b/${SHARED_ID}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^text\/html/)
    expect(await res.text()).toBe(INDEX_HTML)
  })

  it('answers the board a shared link fetches with no session', async () => {
    const base = await serve(GATE_ON)
    const input = encodeURIComponent(JSON.stringify({ id: SHARED_ID }))
    const res = await get(base, `/api/trpc/board.get?input=${input}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { data: StoredBoard } }
    expect(body.result.data).toEqual(BOARD)
  })

  it('sends a visitor with no session at the root, or at keep, to the account page', async () => {
    const base = await serve(GATE_ON)
    for (const url of ['/', `/keep/${SHARED_ID}`, '/bx']) {
      const res = await get(base, url)
      expect(res.status, url).toBe(302)
      expect(res.headers.get('cache-control'), url).toBe('no-store')
      const location = new URL(res.headers.get('location') ?? '')
      expect(`${location.origin}${location.pathname}`, url).toBe(ACCOUNT)
      expect(location.searchParams.get('returnTo'), url).toMatch(new RegExp(`${url}$`))
    }
  })

  it('lets a player with a family session in at the root', async () => {
    const base = await serve(GATE_ON)
    const token = mintTestToken({
      sub: 'child-ada',
      role: 'child',
      parentId: 'parent-1',
      name: 'Ada',
    })
    const res = await get(base, '/', { cookie: `${FAMILY_SESSION_COOKIE}=${token}` })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(INDEX_HTML)
  })
})

describe('fridge with the gate off', () => {
  it('serves the root to anyone, as before the gate', async () => {
    const base = await serve({})
    const res = await get(base, '/')
    expect(res.status).toBe(200)
  })
})
