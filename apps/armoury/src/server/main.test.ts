import { type ChildProcess, spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'

import { FAMILY_SESSION_COOKIE } from '@hoe/accounts'
import { mintTestToken, TEST_FAMILY_PUBLIC_KEY } from '@hoe/accounts/testing'
import { afterEach, describe, expect, it } from 'vitest'

const ACCOUNT_URL = 'https://homeofed.com/account'
const START_DEADLINE_MS = 10_000
// Ungated: the index with a built dist/, 404 without one.
const NOT_REDIRECTED = [200, 404]
const appDir = fileURLToPath(new URL('../..', import.meta.url))
const running: ChildProcess[] = []

afterEach(() => {
  for (const child of running.splice(0)) child.kill()
})

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer().listen(0, () => {
      const { port } = probe.address() as { port: number }
      probe.close(() => resolve(port))
    })
    probe.on('error', reject)
  })
}

// The real entrypoint on a real port, with only the env this test names.
async function startMain(env: Record<string, string>): Promise<string> {
  const port = await freePort()
  const child = spawn(process.execPath, ['src/server/main.ts'], {
    cwd: appDir,
    env: { PATH: process.env.PATH ?? '', PORT: String(port), ...env },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  running.push(child)
  let stderr = ''
  child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
  const base = `http://localhost:${port}`
  for (const deadline = Date.now() + START_DEADLINE_MS; Date.now() < deadline;) {
    if (child.exitCode !== null) {
      throw new Error(`main.ts exited with ${child.exitCode}:\n${stderr}`)
    }
    // Any answer means it is listening; a database-backed /health may be 503 here.
    const up = await fetch(`${base}/health`).then(
      () => true,
      () => false,
    )
    if (up) return base
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`main.ts did not answer within ${START_DEADLINE_MS}ms:\n${stderr}`)
}

const getDocument = (base: string, cookie?: string, path = '/') =>
  fetch(`${base}${path}`, { redirect: 'manual', headers: cookie ? { cookie } : {} })

describe('the production entrypoint', { timeout: START_DEADLINE_MS + 5_000 }, () => {
  it('does not gate documents when FAMILY_ACCOUNT_URL is unset', async () => {
    const base = await startMain({})

    const res = await getDocument(base)

    expect(NOT_REDIRECTED).toContain(res.status)
  })

  it('sends a document request with no family session to the account URL', async () => {
    const base = await startMain({
      FAMILY_ACCOUNT_URL: ACCOUNT_URL,
      FAMILY_TOKEN_PUBLIC_KEY: TEST_FAMILY_PUBLIC_KEY,
    })

    const res = await getDocument(base)

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(
      `${ACCOUNT_URL}?returnTo=${encodeURIComponent(`${base}/`)}`,
    )
  })

  it('leaves /shared open to a visitor with no family session', async () => {
    const base = await startMain({
      FAMILY_ACCOUNT_URL: ACCOUNT_URL,
      FAMILY_TOKEN_PUBLIC_KEY: TEST_FAMILY_PUBLIC_KEY,
    })

    const res = await getDocument(base, undefined, '/shared')

    expect(NOT_REDIRECTED).toContain(res.status)
  })

  it('lets a document request with a family session through', async () => {
    const base = await startMain({
      FAMILY_ACCOUNT_URL: ACCOUNT_URL,
      FAMILY_TOKEN_PUBLIC_KEY: TEST_FAMILY_PUBLIC_KEY,
    })
    const token = mintTestToken({ sub: 'ada', role: 'parent', name: 'Ada' })

    const res = await getDocument(base, `${FAMILY_SESSION_COOKIE}=${token}`)

    expect(NOT_REDIRECTED).toContain(res.status)
  })
})
