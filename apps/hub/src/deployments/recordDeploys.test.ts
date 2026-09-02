import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Deployments } from './mergeDeploys.ts'

const cli = fileURLToPath(new URL('./recordDeploys.ts', import.meta.url))
const at = '2026-08-25T20:44:07Z'
const seeded =
  '{\n  "silt": {\n    "firstDeployedAt": "2026-08-07T00:00:00Z",\n    "lastDeployedAt": "2026-08-07T00:00:00Z"\n  }\n}\n'

let file: string

beforeEach(() => {
  file = join(mkdtempSync(join(tmpdir(), 'record-deploys-')), 'deployments.json')
  writeFileSync(file, seeded)
})

const run = (args: string[]): { status: number; stderr: string } => {
  try {
    execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', stdio: 'pipe' })
    return { status: 0, stderr: '' }
  } catch (error) {
    const failure = error as { status: number; stderr: string }
    return { status: failure.status, stderr: failure.stderr }
  }
}

describe('recordDeploys CLI', () => {
  it('records a deploy against the file on disk', () => {
    expect(run(['--at', at, '--file', file, 'silt']).status).toBe(0)
    expect((JSON.parse(readFileSync(file, 'utf8')) as Deployments).silt).toEqual({
      firstDeployedAt: '2026-08-07T00:00:00Z',
      lastDeployedAt: at,
    })
  })

  it('keeps apps it was not told about — the file, not a hard-coded list, is the source', () => {
    writeFileSync(file, seeded.replace('"silt"', '"boop"'))
    run(['--at', at, '--file', file, 'silt'])
    expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')) as Deployments).sort()).toEqual([
      'boop',
      'silt',
    ])
  })

  it('writes nothing and exits green when no app deployed', () => {
    expect(run(['--at', at, '--file', file]).status).toBe(0)
    expect(readFileSync(file, 'utf8')).toBe(seeded)
  })

  it('refuses an unparseable timestamp rather than poisoning the file', () => {
    const { status, stderr } = run(['--at', 'yesterday', '--file', file, 'silt'])
    expect(status).toBe(1)
    expect(stderr).toContain('--at')
    expect(readFileSync(file, 'utf8')).toBe(seeded)
  })

  it('refuses a missing --at', () => {
    expect(run(['--file', file, 'silt']).status).toBe(1)
  })

  it('refuses a file that is not there — a wrong path must not be a silent no-op', () => {
    expect(run(['--at', at, '--file', join(tmpdir(), 'nope.json'), 'silt']).status).toBe(1)
  })
})
