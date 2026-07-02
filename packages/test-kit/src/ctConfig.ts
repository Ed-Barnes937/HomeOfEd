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
    use: {
      ctPort: opts.ctPort,
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
