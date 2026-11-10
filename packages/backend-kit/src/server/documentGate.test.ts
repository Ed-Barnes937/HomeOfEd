// The document gate (ADR 0093) asserts transport behaviour, so every test here
// binds a real port: fastify.inject() is not the wire (README). Paths fetch
// would rewrite before sending (dot segments, backslashes) go over a raw socket.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { fixtureContext, fixtureRouter, freshDrizzleNotesStore } from '../testSupport/fixtureApp.ts'
import type { Logger } from '../logger.ts'
import { NoopLogger } from '../testSupport/noopLogger.ts'
import { buildAppServer, type CreateAppServerOpts } from './createAppServer.ts'

const INDEX_HTML = '<!doctype html><title>fixture spa</title>'
const ASSET_JS = 'console.log("fixture asset")'
const OTHER_HTML = '<!doctype html><title>other page</title>'
const HTM_PAGE = '<!doctype html><title>htm page</title>'

async function makeStaticDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'hoe-backend-kit-gate-'))
  await writeFile(path.join(dir, 'index.html'), INDEX_HTML)
  await writeFile(path.join(dir, 'other.html'), OTHER_HTML)
  await writeFile(path.join(dir, 'page.htm'), HTM_PAGE)
  await writeFile(path.join(dir, 'page.xhtml'), HTM_PAGE)
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

function raw(base: string, target: string, headers: Record<string, string> = {}): Promise<Seen> {
  const lines = [`GET ${target} HTTP/1.1`, 'Connection: close']
  if (!('host' in headers)) lines.push('Host: boop.example')
  for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`)
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(new URL(base).port), '127.0.0.1', () => {
      socket.write(`${lines.join('\r\n')}\r\n\r\n`)
    })
    let response = ''
    socket.on('data', (chunk) => (response += chunk.toString()))
    socket.on('error', reject)
    socket.on('end', () => {
      const [head = '', body = ''] = response.split('\r\n\r\n')
      const [statusLine = '', ...headerLines] = head.split('\r\n')
      const header = (name: string) =>
        headerLines
          .find((l) => l.toLowerCase().startsWith(`${name}:`))
          ?.slice(name.length + 1)
          .trim() ?? null
      resolve({
        status: Number(statusLine.split(' ')[1]),
        contentType: header('content-type'),
        cacheControl: header('cache-control'),
        location: header('location'),
        body,
      })
    })
  })
}

class RecordingLogger implements Logger {
  readonly errors: { message: string; fields?: Record<string, unknown> }[] = []
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(message: string, fields?: Record<string, unknown>): void {
    this.errors.push({ message, fields })
  }
  child(): Logger {
    return this
  }
}

// Each would reach a file or the SPA by a path two parsers can read differently.
const AMBIGUOUS_PATHS = [
  '/x.js%2Fy/..',
  '/index.html/x.js%2Fy/..',
  '/api/a%2Fb/../..',
  '/api/x.js%2Fy/../../index.html',
  '/health/a%2Fb/../..',
  '/api/a%2Fb/../../other.html',
  '/shared/a%2Fb/../../other.html',
  '/shared/..%2Findex.html',
  '/shared/../index.html',
  '/./index.html',
  '/a/%2E%2e/index.html',
  '/a/.%2E/other.html',
  '/a/%2e/other.html',
  '/a%2fb',
  '/a%5Cb',
  '/a%5cb',
  '/a\\b',
  '/%E0%A4%A',
]

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

  it('answers ambiguous paths and other HTML files exactly as before the gate existed', async () => {
    const base = await serve()
    const seen: Record<string, Seen> = {}
    for (const target of [...AMBIGUOUS_PATHS, '/other.html', '/page.htm']) {
      seen[target] = await raw(base, target)
    }
    expect(seen).toMatchInlineSnapshot(`
      {
        "/%E0%A4%A": {
          "body": "{"error":"Bad Request","code":"FST_ERR_BAD_URL","message":"'/%E0%A4%A' is not a valid url component","statusCode":400}",
          "cacheControl": null,
          "contentType": "application/json",
          "location": null,
          "status": 400,
        },
        "/./index.html": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/a%2fb": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/a%5Cb": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/a%5cb": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/a/%2E%2e/index.html": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/a/%2e/other.html": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/a/.%2E/other.html": {
          "body": "<!doctype html><title>other page</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/a\\b": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/api/a%2Fb/../..": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/api/a%2Fb/../../other.html": {
          "body": "<!doctype html><title>other page</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/api/x.js%2Fy/../../index.html": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/health/a%2Fb/../..": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/index.html/x.js%2Fy/..": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/other.html": {
          "body": "<!doctype html><title>other page</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/page.htm": {
          "body": "<!doctype html><title>htm page</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/shared/..%2Findex.html": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/shared/../index.html": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/shared/a%2Fb/../../other.html": {
          "body": "<!doctype html><title>other page</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
        "/x.js%2Fy/..": {
          "body": "<!doctype html><title>fixture spa</title>",
          "cacheControl": "public, max-age=0",
          "contentType": "text/html; charset=utf-8",
          "location": null,
          "status": 200,
        },
      }
    `)
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

    await raw(base, '/deep?a=1', { host: 'localhost:5181' })
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

  it('refuses 400 any path with a dot segment, an encoded or literal slash-like character, or bad encoding, signed in or not', async () => {
    const { gate, asked } = fakeGate(['/shared'])
    const base = await serve({ documentGate: gate })

    for (const target of AMBIGUOUS_PATHS) {
      for (const headers of [{}, SIGNED_IN]) {
        const seen = await raw(base, target, headers)
        expect({
          target,
          status: seen.status,
          json: seen.contentType?.startsWith('application/json'),
        }).toEqual({
          target,
          status: 400,
          json: true,
        })
      }
    }
    expect(asked).toEqual([])
  })

  it('refuses /shared/..%2Findex.html too: an encoded slash is ambiguous even under a public path', async () => {
    const { gate } = fakeGate(['/shared'])
    const base = await serve({ documentGate: gate })

    expect((await raw(base, '/shared/..%2Findex.html')).status).toBe(400)
    expect((await raw(base, '/shared/deep')).status).toBe(200)
  })

  it('keeps an allowed document uncacheable on a 304 revalidation', async () => {
    const { gate } = fakeGate()
    const base = await serve({ documentGate: gate })
    const first = await fetch(`${base}/`, { headers: SIGNED_IN })
    const etag = first.headers.get('etag')
    const lastModified = first.headers.get('last-modified')
    expect(etag).not.toBeNull()
    expect(lastModified).not.toBeNull()

    const conditionals: Record<string, string>[] = [
      { 'if-none-match': etag! },
      { 'if-modified-since': lastModified! },
    ]
    for (const conditional of conditionals) {
      const seen = await raw(base, '/', { ...SIGNED_IN, ...conditional })
      expect({ status: seen.status, cacheControl: seen.cacheControl }).toEqual({
        status: 304,
        cacheControl: 'no-store',
      })
    }
  })

  it('lets no HTML out unless its request was classified a document or public path', async () => {
    const { gate, asked } = fakeGate()
    const base = await serve({
      documentGate: gate,
      registerRoutes: (app) => {
        app.get('/api/page', (_req, reply) => reply.type('text/html').send('<p>app-owned</p>'))
      },
    })

    // `.htm` is not a document by extension, but static serves it as text/html.
    const signedOut = await raw(base, '/page.htm')
    expect(signedOut).toMatchObject({ status: 302, cacheControl: 'no-store', body: '' })
    expect(signedOut.location).toContain(encodeURIComponent('/page.htm'))

    const signedIn = await raw(base, '/page.htm', SIGNED_IN)
    expect(signedIn).toMatchObject({ status: 200, cacheControl: 'no-store', body: HTM_PAGE })

    expect(await raw(base, '/api/page')).toMatchObject({ status: 200, body: '<p>app-owned</p>' })
    expect(asked.map((a) => a.url)).toEqual(['/page.htm', '/page.htm'])
  })

  it('counts XHTML and any casing of text/html as HTML', async () => {
    const { gate } = fakeGate()
    const base = await serve({
      documentGate: gate,
      registerRoutes: (app) => {
        app.get('/shouty.txt', (_req, reply) => reply.type('Text/HTML').send('<p>shouty</p>'))
      },
    })

    for (const target of ['/page.xhtml', '/shouty.txt']) {
      const seen = await raw(base, target)
      expect({ target, status: seen.status, cacheControl: seen.cacheControl }).toEqual({
        target,
        status: 302,
        cacheControl: 'no-store',
      })
    }
  })

  it('puts a 304 for HTML it did not classify through the gate', async () => {
    const { gate } = fakeGate()
    const base = await serve({ documentGate: gate })
    const first = await fetch(`${base}/page.htm`, { headers: SIGNED_IN })
    const conditionals: Record<string, string>[] = [
      { 'if-none-match': first.headers.get('etag')! },
      { 'if-modified-since': first.headers.get('last-modified')! },
    ]

    for (const conditional of conditionals) {
      const signedOut = await raw(base, '/page.htm', conditional)
      expect(signedOut).toMatchObject({ status: 302, cacheControl: 'no-store' })
      const signedIn = await raw(base, '/page.htm', { ...SIGNED_IN, ...conditional })
      expect(signedIn).toMatchObject({ status: 304, cacheControl: 'no-store' })
    }

    // A signed-out /shared page revalidates its assets; those 304s stay ungated.
    const asset = await fetch(`${base}/assets/app.js`)
    const revalidated = await raw(base, '/assets/app.js', {
      'if-none-match': asset.headers.get('etag')!,
    })
    expect(revalidated).toMatchObject({ status: 304, cacheControl: 'public, max-age=0' })
  })

  it.each([
    ['returns a URL with a CR LF in it', () => 'https://a.example/x\r\nSet-Cookie: pwn=1'],
    ['returns a URL with a non-ASCII character', () => 'https://a.example/€'],
    [
      'throws',
      () => {
        throw new Error('secret detail')
      },
    ],
    ['returns an empty string', () => ''],
    ['returns a relative URL', () => '/account'],
  ])('answers a generic 500 and logs when redirectFor %s', async (_name, redirectFor) => {
    const logger = new RecordingLogger()
    const base = await serve({ logger, documentGate: { publicPaths: [], redirectFor } })

    const seen = await raw(base, '/')

    expect(seen).toMatchObject({
      status: 500,
      cacheControl: 'no-store',
      location: null,
      body: '{"error":"Internal Server Error"}',
    })
    expect(logger.errors).toHaveLength(1)
    expect(logger.errors[0]?.message).toBe('document gate failed')
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
