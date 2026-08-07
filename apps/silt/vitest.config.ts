import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    // The determinism tests sim two whole 300x200 worlds for 120+ ticks — ~350ms
    // here, but a CI runner sharing itself between every package's suite runs
    // them ~15x slower, which overruns vitest's 5s default. Same headroom the
    // DB-backed apps take for PGlite's WASM boot.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
