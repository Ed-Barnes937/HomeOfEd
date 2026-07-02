import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // PGlite's WASM boot can take >5s on a cold CI runner.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
