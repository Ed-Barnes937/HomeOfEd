import { type ChildProcess, spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'

import { FAMILY_SESSION_COOKIE } from '@hoe/accounts'
import { mintTestToken, TEST_FAMILY_PUBLIC_KEY } from '@hoe/accounts/testing'
import { afterEach, describe, expect, it } from 'vitest'

const ACCOUNT_URL = 'https://homeofed.com/account'
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
    stdio: 'ignore',
  })
  running.push(child)
  const base = `http://localhost:${port}`
  for (const deadline = Date.now() + 10_000; Date.now() < deadline;) {
    if (child.exitCode !== null) throw new Error(`main.ts exited with ${child.exitCode}`)
    const up = await fetch(`${base}/health`).then(
      (res) => res.ok,
      () => false,
    )
    if (up) return base
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('main.ts did not answer /health within 10s')
}

const getDocument = (base: string, cookie?: string) =>
  fetch(`${base}/`, { redirect: 'manual', headers: cookie ? { cookie } : {} })

describe('the production entrypoint', () => {
  it('does not gate documents when FAMILY_ACCOUNT_URL is unset', async () => {
    const base = await startMain({})

    const res = await getDocument(base)

    expect(res.status).not.toBe(302)
    expect(res.headers.get('location')).toBeNull()
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

  it('lets a document request with a family session through', async () => {
    const base = await startMain({
      FAMILY_ACCOUNT_URL: ACCOUNT_URL,
      FAMILY_TOKEN_PUBLIC_KEY: TEST_FAMILY_PUBLIC_KEY,
    })
    const token = mintTestToken({ sub: 'ada', role: 'parent', name: 'Ada' })

    const res = await getDocument(base, `${FAMILY_SESSION_COOKIE}=${token}`)

    expect(res.status).not.toBe(302)
    expect(res.headers.get('location')).toBeNull()
  })
})
