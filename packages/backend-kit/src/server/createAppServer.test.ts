// Transport (c): the prod Fastify server. Same fixture router as the other
// two transports (src/transports.test.ts). Assertions go through
// fastify.inject() via buildAppServer; the frozen createAppServer wrapper
// gets one real listen-and-fetch smoke test.
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fixtureContext, fixtureRouter, freshDrizzleNotesStore } from '../testSupport/fixtureApp.ts'
import { NoopLogger } from '../testSupport/noopLogger.ts'
import { buildAppServer, createAppServer } from './createAppServer.ts'

async function makeStaticDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'hoe-backend-kit-static-'))
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><title>fixture spa</title>')
  await mkdir(path.join(dir, 'assets'))
  await writeFile(path.join(dir, 'assets', 'app.js'), 'console.log("fixture asset")')
  return dir
}

async function makeServer(opts?: { healthCheck?: () => Promise<{ ok: true }> }) {
  return buildAppServer({
    router: fixtureRouter,
    createContext: fixtureContext(await freshDrizzleNotesStore()),
    staticDir: await makeStaticDir(),
    logger: new NoopLogger(),
    healthCheck: opts?.healthCheck ?? (() => Promise.resolve({ ok: true })),
  })
}

describe('createAppServer (Fastify prod transport)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await makeServer()
  })
  afterAll(async () => {
    await app.close()
  })

  it('serves the same router over tRPC at /api/trpc', async () => {
    const added = await app.inject({
      method: 'POST',
      url: '/api/trpc/addNote',
      headers: { 'content-type': 'application/json' },
      payload: '"buy milk"',
    })
    expect(added.statusCode).toBe(200)
    expect(added.json()).toMatchObject({ result: { data: { id: 1, title: 'buy milk' } } })

    const got = await app.inject({ method: 'GET', url: '/api/trpc/getNote?input=1' })
    expect(got.statusCode).toBe(200)
    expect(got.json()).toMatchObject({ result: { data: { id: 1, title: 'buy milk' } } })
  })

  it('translates domain errors with the taxonomy HTTP status', async () => {
    const missing = await app.inject({ method: 'GET', url: '/api/trpc/getNote?input=999' })
    expect(missing.statusCode).toBe(404)
    expect(missing.json()).toMatchObject({
      error: { data: { code: 'NOT_FOUND', httpStatus: 404 } },
    })
  })

  it('serves static files from staticDir', async () => {
    const asset = await app.inject({ method: 'GET', url: '/assets/app.js' })
    expect(asset.statusCode).toBe(200)
    expect(asset.headers['content-type']).toContain('javascript')
    expect(asset.body).toBe('console.log("fixture asset")')
  })

  it('falls back to index.html for unknown non-API GETs (SPA routing)', async () => {
    for (const url of ['/', '/notes/42', '/deep/client/route']) {
      const response = await app.inject({ method: 'GET', url })
      expect(response.statusCode).toBe(200)
      expect(response.body).toContain('fixture spa')
    }
  })

  it('does NOT fall back to index.html for API paths or non-GETs', async () => {
    const unknownApi = await app.inject({ method: 'GET', url: '/api/nope' })
    expect(unknownApi.statusCode).toBe(404)
    expect(unknownApi.body).not.toContain('fixture spa')

    const post = await app.inject({ method: 'POST', url: '/not-a-route' })
    expect(post.statusCode).toBe(404)
    expect(post.body).not.toContain('fixture spa')
  })

  it('GET /health awaits the injected healthCheck', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
  })

  it('GET /health returns 503 when the healthCheck throws', async () => {
    const sick = await makeServer({
      healthCheck: () => Promise.reject(new Error('db unreachable')),
    })
    const response = await sick.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ ok: false })
    await sick.close()
  })
})

describe('createAppServer().listen (frozen wrapper)', () => {
  it('listens on the given port and serves over real HTTP', async () => {
    // find a free port, then hand it to the frozen listen(port) signature
    const probe = net.createServer()
    await new Promise<void>((resolve) => probe.listen(0, resolve))
    const { port } = probe.address() as AddressInfo
    await new Promise<void>((resolve) => probe.close(() => resolve()))

    const server = createAppServer({
      router: fixtureRouter,
      createContext: fixtureContext(await freshDrizzleNotesStore()),
      staticDir: await makeStaticDir(),
      logger: new NoopLogger(),
      healthCheck: () => Promise.resolve({ ok: true }),
    })
    await server.listen(port)
    try {
      const health = await fetch(`http://127.0.0.1:${port}/health`)
      expect(health.status).toBe(200)
      expect(await health.json()).toEqual({ ok: true })
    } finally {
      await server.close()
    }
  })
})
