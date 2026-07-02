// Build assertion (ADR 0001 §17): @electric-sql/pglite must be excludable
// from production bundles. Builds a prod-shaped fixture with vite using the
// documented exclusion (rollupOptions.external — see README "Keeping PGlite
// out of production") and asserts no pglite code lands in the output.
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'
import { describe, expect, it } from 'vitest'

const entry = fileURLToPath(new URL('./testing/prodEntry.ts', import.meta.url))

interface EmittedFile {
  name: string
  size: number
}

async function buildFixture(opts: { externalizePglite: boolean }): Promise<EmittedFile[]> {
  const outDir = await mkdtemp(join(tmpdir(), 'hoe-db-prod-build-'))
  try {
    await build({
      logLevel: 'silent',
      configFile: false,
      build: {
        outDir,
        minify: false,
        lib: { entry, formats: ['es'], fileName: 'entry' },
        rollupOptions: opts.externalizePglite ? { external: ['@electric-sql/pglite'] } : {},
      },
    })
    const names = await readdir(outDir, { recursive: true })
    const files: EmittedFile[] = []
    for (const name of names) {
      const stats = await stat(join(outDir, name))
      if (stats.isFile()) files.push({ name, size: stats.size })
    }
    return files
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
}

// Bundled pglite is unmissable: a multi-megabyte chunk (inlined WASM) and/or
// wasm/data assets. Every legitimate chunk (drizzle drivers) is well under 1MB.
const ONE_MB = 1024 * 1024
function containsPglite(files: EmittedFile[]): boolean {
  return files.some(
    (f) => /pglite/i.test(f.name) || /\.(wasm|data)$/.test(f.name) || f.size > ONE_MB,
  )
}

describe('production bundle', () => {
  it('with the documented exclusion, emits no pglite code', async () => {
    const files = await buildFixture({ externalizePglite: true })
    expect(files.length).toBeGreaterThan(0)
    expect(containsPglite(files)).toBe(false)
  }, 120_000)

  it('control: without the exclusion the detector fires (assertion has teeth)', async () => {
    const files = await buildFixture({ externalizePglite: false })
    expect(containsPglite(files)).toBe(true)
  }, 120_000)
})
