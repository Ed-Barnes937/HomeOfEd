// Browser evidence: PGlite (WASM) migrates and round-trips in a real
// Chromium page, loading the generated migrations via the documented Vite
// `import.meta.glob(..., { query: '?raw' })` pattern (see DbRoundTrip.tsx).
import { expect, test } from '@playwright/experimental-ct-react'

import { DbRoundTrip } from './testing/DbRoundTrip.tsx'

test('PGlite migrates and round-trips in the browser (WASM)', async ({ mount, page }) => {
  await mount(<DbRoundTrip />)
  await expect(page.getByTestId('db-roundtrip')).toHaveText('hello from browser pglite', {
    timeout: 30_000,
  })
})
