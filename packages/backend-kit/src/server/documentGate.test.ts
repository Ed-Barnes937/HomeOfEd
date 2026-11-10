// The document gate (ADR 0093) asserts transport behaviour, so every test here
// binds a real port and uses fetch: fastify.inject() is not the wire (README).
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { fixtureContext, fixtureRouter, freshDrizzleNotesStore } from '../testSupport/fixtureApp.ts'
import { NoopLogger } from '../testSupport/noopLogger.ts'
import { buildAppServer, type CreateAppServerOpts } from './createAppServer.ts'

const INDEX_HTML = '<!doctype html><title>fixture spa</title>'
const ASSET_JS = 'console.log("fixture asset")'

async function makeStaticDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'hoe-backend-kit-gate-'))
  await writeFile(path.join(dir, 'index.html'), INDEX_HTML)
  await mkdir(path.join(dir, 'assets'))
  await writeFile(path.join(dir, 'assets', 'app.js'), ASSET_JS)
  return dir
}

const closers: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()))
})

async function serve(extra: Partial<CreateAppServerOpts> = {}): Promise<string> {
  const app = await buildAppServer({
    router: fixtureRouter,
    createContext: fixtureContext(await freshDrizzleNotesStore()),
    staticDir: await makeStaticDir(),
    logger: new NoopLogger(),
    healthCheck: () => Promise.resolve({ ok: true }),
    ...extra,
  })
  await app.listen({ port: 0, host: '127.0.0.1' })
  closers.push(() => app.close())
  return `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
}

interface Seen {
  status: number
  contentType: string | null
  cacheControl: string | null
  location: string | null
  body: string
}

async function see(base: string, url: string, init: RequestInit = {}): Promise<Seen> {
  const res = await fetch(base + url, { redirect: 'manual', ...init })
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    cacheControl: res.headers.get('cache-control'),
    location: res.headers.get('location'),
    body: await res.text(),
  }
}

function rawStatus(port: number, target: string, host = 'boop.example'): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(`GET ${target} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`)
    })
    let head = ''
    socket.on('data', (chunk) => (head += chunk.toString()))
    socket.on('end', () => resolve(Number(head.split(' ')[1])))
    socket.on('error', reject)
  })
}

describe('createAppServer without a documentGate', () => {
  it('serves every path exactly as before the gate existed', async () => {
    const base = await serve()
    const spa = {
      status: 200,
      contentType: 'text/html; charset=utf-8',
      cacheControl: 'public, max-age=0',
      location: null,
      body: INDEX_HTML,
    }

    expect(await see(base, '/')).toEqual(spa)
    expect(await see(base, '/index.html')).toEqual(spa)
    expect(await see(base, '/deep/client/route')).toEqual(spa)
    expect(await see(base, '/assets/missing.js')).toEqual(spa)
    expect(await see(base, '/', { method: 'HEAD' })).toEqual({ ...spa, body: '' })
    expect(await see(base, '/assets/app.js')).toEqual({
      ...spa,
      contentType: 'application/javascript; charset=utf-8',
      body: ASSET_JS,
    })
    expect(await see(base, '/health')).toEqual({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      cacheControl: null,
      location: null,
      body: '{"ok":true}',
    })
    expect(await see(base, '/api/nope')).toEqual({
      status: 404,
      contentType: 'application/json; charset=utf-8',
      cacheControl: null,
      location: null,
      body: '{"error":"Not Found"}',
    })
    expect(await see(base, '/', { method: 'POST' })).toEqual({
      status: 404,
      contentType: 'application/json; charset=utf-8',
      cacheControl: null,
      location: null,
      body: '{"error":"Not Found"}',
    })
  })
})

const ACCOUNT = 'https://homeofed.com/account'
const SIGNED_IN = { cookie: 'hoe_family=good' }

function fakeGate(publicPaths: readonly string[] = []) {
  const asked: { host: string; url: string; cookie: string | null }[] = []
  return {
    asked,
    gate: {
      publicPaths,
      redirectFor: (req: { host: string; url: string; cookie: string | null }) => {
        asked.push(req)
        if (req.cookie?.includes('hoe_family=good')) return null
        return `${ACCOUNT}?returnTo=${encodeURIComponent(`https://${req.host}${req.url}`)}`
      },
    },
  }
}

describe('createAppServer with a documentGate', () => {
  it('redirects a signed-out document request to the account URL, uncached', async () => {
    const { gate, asked } = fakeGate()
    const base = await serve({ documentGate: gate })
    const host = new URL(base).host

    const seen = await see(base, '/?x=1')

    expect(seen.status).toBe(302)
    expect(seen.location).toBe(`${ACCOUNT}?returnTo=${encodeURIComponent(`https://${host}/?x=1`)}`)
    expect(seen.cacheControl).toBe('no-store')
    expect(seen.body).not.toContain('fixture spa')
    expect(asked).toEqual([{ host, url: '/?x=1', cookie: null }])
  })

  it('hands redirectFor the raw Host header, port included, and the raw Cookie header', async () => {
    const { gate, asked } = fakeGate()
    const base = await serve({ documentGate: gate })

    await rawStatus(Number(new URL(base).port), '/deep?a=1', 'localhost:5181')
    await see(base, '/', { headers: { cookie: 'a=1; hoe_family=good' } })

    expect(asked).toEqual([
      { host: 'localhost:5181', url: '/deep?a=1', cookie: null },
      { host: new URL(base).host, url: '/', cookie: 'a=1; hoe_family=good' },
    ])
  })

  it('covers /index.html, a deep client route and HEAD, which static and the fallback would serve', async () => {
    const { gate } = fakeGate()
    const base = await serve({ documentGate: gate })

    for (const [url, method] of [
      ['/index.html', 'GET'],
      ['/INDEX.HTML', 'GET'],
      ['/deep/client/route', 'GET'],
      ['/', 'HEAD'],
      ['/deep/client/route', 'HEAD'],
    ] as const) {
      const seen = await see(base, url, { method })
      expect({ url, method, status: seen.status, cacheControl: seen.cacheControl }).toEqual({
        url,
        method,
        status: 302,
        cacheControl: 'no-store',
      })
      expect(seen.location).toContain(encodeURIComponent(url))
    }
  })

  it('serves a signed-in document request as before, but never cacheable', async () => {
    const { gate, asked } = fakeGate()
    const base = await serve({ documentGate: gate })

    for (const url of ['/', '/index.html', '/deep/client/route']) {
      const seen = await see(base, url, { headers: SIGNED_IN })
      expect({ url, ...seen }).toEqual({
        url,
        status: 200,
        contentType: 'text/html; charset=utf-8',
        cacheControl: 'no-store',
        location: null,
        body: INDEX_HTML,
      })
    }
    expect(asked.map((a) => a.cookie)).toEqual(Array(3).fill('hoe_family=good'))
  })

  it('leaves assets, /api, /health and non-GETs alone and never consults the gate for them', async () => {
    const { gate, asked } = fakeGate()
    const base = await serve({ documentGate: gate })

    const asset = await see(base, '/assets/app.js')
    expect(asset).toMatchObject({ status: 200, cacheControl: 'public, max-age=0', body: ASSET_JS })

    const trpc = await see(base, '/api/trpc/getNote?input=999')
    expect(trpc.status).toBe(404)
    expect(JSON.parse(trpc.body)).toMatchObject({ error: { data: { code: 'NOT_FOUND' } } })

    expect(await see(base, '/health')).toMatchObject({ status: 200, body: '{"ok":true}' })
    expect(await see(base, '/', { method: 'POST' })).toMatchObject({
      status: 404,
      body: '{"error":"Not Found"}',
    })
    expect(asked).toEqual([])
  })

  it('lets public paths through on whole path segments, as before', async () => {
    const { gate, asked } = fakeGate(['/shared', '/b/'])
    const base = await serve({ documentGate: gate })

    for (const url of ['/shared', '/shared/', '/shared?x=1', '/shared/deep', '/b/abc123']) {
      const seen = await see(base, url)
      expect({
        url,
        status: seen.status,
        cacheControl: seen.cacheControl,
        body: seen.body,
      }).toEqual({
        url,
        status: 200,
        cacheControl: 'public, max-age=0',
        body: INDEX_HTML,
      })
    }
    expect(asked).toEqual([])

    for (const url of ['/sharedx', '/b', '/elsewhere/shared']) {
      expect({ url, status: (await see(base, url)).status }).toEqual({ url, status: 302 })
    }
  })

  it('classifies the path static will resolve, so dot segments cannot slip past', async () => {
    const { gate } = fakeGate(['/shared'])
    const base = await serve({ documentGate: gate })
    const { port } = new URL(base)

    // fetch normalises dot segments before sending, so these go over a raw socket.
    for (const target of [
      '/shared/../index.html',
      '/shared/..%2Findex.html',
      '/shared/%2e%2e/index.html',
      '/api/../index.html',
      '/assets/../index.html',
    ]) {
      expect({ target, status: await rawStatus(Number(port), target) }).toEqual({
        target,
        status: 302,
      })
    }
  })

  it('answers a missing asset 404 instead of an ungated index.html', async () => {
    const { gate } = fakeGate()
    const base = await serve({ documentGate: gate })

    for (const url of ['/assets/missing.js', '/anything.', '/anything.json']) {
      const seen = await see(base, url)
      expect({ url, status: seen.status, body: seen.body }).toEqual({
        url,
        status: 404,
        body: '{"error":"Not Found"}',
      })
    }
  })
})
