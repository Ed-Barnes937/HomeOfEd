// Playwright Component Testing config factory. Node-only — imported from an
// app's playwright-ct.config.ts via '@hoe/test-kit/ct-config'.
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/experimental-ct-react'
import react from '@vitejs/plugin-react'

/**
 * Shared .iwft runner config: CT mounts the SPA, `*.iwft.tsx` only (Vitest
 * owns `*.test.*`), PGlite excluded from Vite's dep optimizer so its WASM
 * assets load correctly in the browser bundle.
 */
export function defineIwftConfig(opts: {
  /** Unique per app — CT dev-server port. */
  ctPort: number
  overrides?: PlaywrightTestConfig
}) {
  return defineConfig({
    testDir: './src',
    testMatch: '**/*.iwft.tsx',
    // Per-test budget above the default 30s to absorb the same cold start.
    timeout: 60_000,
    // The first trampolined query per test pays the in-browser PGlite cold
    // start (WASM init + migrations); on a loaded CI runner that can run into
    // several seconds — well past Playwright's 5s default. Give assertions and
    // actions a generous window so these WASM-DB-backed tests aren't flaky
    // under CI load (the default is fine on a fast dev box, tight on CI).
    expect: { timeout: 20_000 },
    use: {
      ctPort: opts.ctPort,
      actionTimeout: 20_000,
      ctViteConfig: {
        plugins: [react()],
        optimizeDeps: {
          exclude: ['@electric-sql/pglite'],
        },
      },
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    ...opts.overrides,
  })
}
