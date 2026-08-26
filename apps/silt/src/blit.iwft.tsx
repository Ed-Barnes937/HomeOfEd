// The two frame paths side by side (120fps ticket 01): a parity gate that the
// WebGL shader draws exactly the palette colours the CPU path rasterises, and
// an env-gated measurement of the blit itself (the audit's one unmeasured
// row). The bench is a tool, not a gate — run it with:
//
//   SILT_BLIT_BENCH=1 pnpm --filter silt exec playwright test -c playwright-ct.config.ts blit.iwft.tsx
//
// and record the numbers in .scratch/silt-120fps/issues/01-webgl-renderer.md.
import { expect } from '@playwright/experimental-ct-react'
import type { Page } from '@playwright/test'

import { DIRT, EMPTY, STONE, WATER } from './sim/index.ts'
import { BlitProbe } from './testing/BlitProbe.tsx'
import { BLIT_PROBE_KEY, type BlitProbeApi } from './testing/blitProbeApi.ts'
import { test } from './testing/iwftTest.tsx'

async function waitForProbe(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate((key) => key in window, BLIT_PROBE_KEY)).toBe(true)
}

test('the WebGL path draws the same colours the palette rasterises', async ({ mount, page }) => {
  await mount(<BlitProbe />)
  await waitForProbe(page)

  // One cell per painted material, plus an empty one — read back from the
  // WebGL framebuffer, expected from the registry palette (spec §9 parity).
  for (const [x, y, species] of [
    [5, 198, STONE],
    [50, 190, WATER],
    [250, 190, DIRT],
    [10, 10, EMPTY],
  ] as const) {
    const result = await page.evaluate(
      ({ key, x, y }) => (window as unknown as Record<string, BlitProbeApi>)[key]!.compareCell(x, y),
      { key: BLIT_PROBE_KEY, x, y },
    )
    expect(result.species).toBe(species)
    expect(result.webgl).toEqual(result.palette)
  }

  const margin = await page.evaluate(
    (key) => (window as unknown as Record<string, BlitProbeApi>)[key]!.compareMargin(),
    BLIT_PROBE_KEY,
  )
  expect(margin.webgl).toEqual(margin.world)
})

test('measure the blit: Canvas 2D vs WebGL draw cost', async ({ mount, page }) => {
  test.skip(!process.env.SILT_BLIT_BENCH, 'measurement tool — set SILT_BLIT_BENCH=1 to run')

  await mount(<BlitProbe />)
  await waitForProbe(page)

  const timings = await page.evaluate(
    (key) => (window as unknown as Record<string, BlitProbeApi>)[key]!.benchDraw(300),
    BLIT_PROBE_KEY,
  )
  console.log(
    `blit bench (300 frames, 1240x800 canvas, dpr 1):\n` +
      `  canvas2d (rasterise + putImageData + drawImage): ${timings.canvas2d.toFixed(3)} ms/frame\n` +
      `  webgl2   (texSubImage2D + draw):                 ${timings.webgl.toFixed(3)} ms/frame\n` +
      `  webgl2 incl. gl.finish():                        ${timings.webglFinished.toFixed(3)} ms/frame`,
  )
  expect(timings.canvas2d).toBeGreaterThan(0)
})
