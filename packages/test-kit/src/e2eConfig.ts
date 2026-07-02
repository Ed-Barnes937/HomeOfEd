// Standard Playwright config for future real-browser E2E tests. Currently
// INERT: no `*.e2e.*` files exist anywhere and no app instantiates this
// config — it only reserves the extension so the three runners never overlap
// (Vitest owns *.test.*, Playwright CT owns *.iwft.tsx, this owns *.e2e.*).
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

export function defineE2eConfig(opts?: { overrides?: PlaywrightTestConfig }) {
  return defineConfig({
    testDir: './src',
    testMatch: '**/*.e2e.{ts,tsx}',
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    ...opts?.overrides,
  })
}
