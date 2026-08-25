// Unit tests for the UK geo boundary (ADR-0011/0012/0013): the load-bearing
// app-level `onRequest` hook, exercised through the REAL D9 `registerRoutes`
// hook + `buildAppServer` (inject style — legal-docs/chat-sse prior art).
// Every refusal-matrix row is asserted per path, exempt and non-exempt.
import { createContext, InMemoryBlobStore, ConsoleLogger } from '@hoe/backend-kit'
import { buildAppServer } from '@hoe/backend-kit/server'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  assertGeoEnvSafe,
  geoEnforcementEnabled,
  registerGeoBoundary,
  REFUSAL_HTML,
} from './geo-boundary.ts'
import { registerLegalDocRoutes } from './legal-docs.ts'
import { createAppRouter } from './router.ts'
import { FakeSproutStore } from './testing/fakeSproutStore.ts'

const testLogger = new ConsoleLogger({ app: 'sprout-test' })

async function makeStaticDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sprout-geo-'))
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><title>sprout</title>')
  return dir
}

async function buildServer(env: Record<string, string | undefined> = {}) {
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
    // Mirrors main.ts wiring: the geo boundary first (env-gated), then the
    // app routes.
    registerRoutes: (app) => {
      if (geoEnforcementEnabled(env)) registerGeoBoundary(app)
      registerLegalDocRoutes(app)
    },
  })
}

/** The ADR-0012 refusal matrix: header value → refused? */
const MATRIX: Array<{ label: string; header: string | undefined; refused: boolean }> = [
  { label: 'GB (UK visitor)', header: 'GB', refused: false },
  { label: 'US (known non-UK)', header: 'US', refused: true },
  { label: 'XX (geolocation unknown)', header: 'XX', refused: true },
  { label: 'T1 (Tor)', header: 'T1', refused: true },
  { label: 'missing header (fail-closed)', header: undefined, refused: true },
]

const NON_EXEMPT_PATHS = [
  '/', // the SPA shell sits behind the boundary
  '/api/trpc/children.list', // tRPC (registered BEFORE registerRoutes runs)
  '/api/auth/get-session', // explicitly enforced per ADR-0011 item 2
  '/terms?x=1', // query-stringed variant of an exempt path is NOT exempt
  '/healthx', // near-miss: no prefix matching
]

// Exempt paths with a body fingerprint proving the REAL route answered (not a
// refusal, not the SPA fallback), and its expected content type.
const EXEMPT_PATHS: Array<{ url: string; bodyContains: string; contentType: string }> = [
  { url: '/health', bodyContains: '"ok":true', contentType: 'application/json' },
  { url: '/terms', bodyContains: 'Terms of Service', contentType: 'text/html' },
  { url: '/privacy', bodyContains: 'Privacy Policy', contentType: 'text/html' },
]

function headersFor(header: string | undefined): Record<string, string> {
  return header === undefined ? {} : { 'cf-ipcountry': header }
}

describe('the UK geo boundary refusal matrix', () => {
  for (const row of MATRIX) {
    for (const url of NON_EXEMPT_PATHS) {
      it(`${row.refused ? 'refuses' : 'allows'} ${row.label} on ${url}`, async () => {
        const app = await buildServer()
        const res = await app.inject({ method: 'GET', url, headers: headersFor(row.header) })

        if (row.refused) {
          expect(res.statusCode).toBe(451)
          expect(res.headers['content-type']).toBe('text/html; charset=utf-8')
          expect(res.headers['cache-control']).toBe('no-store')
          expect(res.body).toBe(REFUSAL_HTML)
        } else {
          expect(res.statusCode).not.toBe(451)
          expect(res.body).not.toBe(REFUSAL_HTML)
        }
        await app.close()
      })
    }

    for (const { url, bodyContains, contentType } of EXEMPT_PATHS) {
      it(`passes ${row.label} on exempt ${url}`, async () => {
        const app = await buildServer()
        const res = await app.inject({ method: 'GET', url, headers: headersFor(row.header) })

        expect(res.statusCode).toBe(200)
        expect(res.headers['content-type']).toContain(contentType)
        expect(res.body).toContain(bodyContains)
        await app.close()
      })
    }
  }
})

describe('the refused-visitor response (ADR-0013)', () => {
  it('is the status notice: 451, status-code-first, the two lines, the headers', async () => {
    const app = await buildServer()
    const res = await app.inject({ method: 'GET', url: '/' })

    expect(res.statusCode).toBe(451)
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8')
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body).toContain('451 Unavailable For Legal Reasons')
    expect(res.body).toContain('Sprout is only available in the United Kingdom.')
    expect(res.body).toContain('Sprout is UK-only while we complete our safety and legal work.')
    await app.close()
  })

  it('is one generic body for every refused matrix row — no country named', async () => {
    const app = await buildServer()
    const bodies = new Set<string>()
    for (const row of MATRIX.filter((r) => r.refused)) {
      const res = await app.inject({
        method: 'GET',
        url: '/',
        headers: headersFor(row.header),
      })
      bodies.add(res.body)
    }
    expect(bodies.size).toBe(1)
    await app.close()
  })

  it('is self-contained and under 1 KB: no assets, no scripts', async () => {
    const app = await buildServer()
    const res = await app.inject({ method: 'GET', url: '/' })

    expect(Buffer.byteLength(res.body, 'utf-8')).toBeLessThan(1024)
    expect(res.body).not.toContain('<script')
    expect(res.body).not.toContain('<link')
    expect(res.body).not.toContain('src=')
    await app.close()
  })
})

describe('the environment escape hatch (ADR-0012 item 4)', () => {
  it('enforces by default and for any value other than off', () => {
    expect(geoEnforcementEnabled({})).toBe(true)
    expect(geoEnforcementEnabled({ GEO_ENFORCEMENT: 'on' })).toBe(true)
    expect(geoEnforcementEnabled({ GEO_ENFORCEMENT: 'off' })).toBe(false)
  })

  it('GEO_ENFORCEMENT=off disables the hook: headerless requests pass', async () => {
    const app = await buildServer({ GEO_ENFORCEMENT: 'off' })
    const res = await app.inject({ method: 'GET', url: '/' })

    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('the boot guard throws if GEO_ENFORCEMENT is set on real infrastructure', () => {
    expect(() =>
      assertGeoEnvSafe({ GEO_ENFORCEMENT: 'off', FLY_APP_NAME: 'hoe-sprout' }),
    ).toThrow(/GEO_ENFORCEMENT/)
    expect(() =>
      assertGeoEnvSafe({ GEO_ENFORCEMENT: 'on', FLY_APP_NAME: 'hoe-sprout' }),
    ).toThrow(/GEO_ENFORCEMENT/)
  })

  it('the boot guard passes the docker stack (no FLY_APP_NAME) and Fly (no variable)', () => {
    expect(() => assertGeoEnvSafe({ GEO_ENFORCEMENT: 'off' })).not.toThrow()
    expect(() => assertGeoEnvSafe({ FLY_APP_NAME: 'hoe-sprout' })).not.toThrow()
    expect(() => assertGeoEnvSafe({})).not.toThrow()
  })
})
