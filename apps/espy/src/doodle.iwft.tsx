import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

test('renders a sized canvas with the initial field already drawn', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  const counts = await root.counts()
  expect(counts.fields).toBe(1)
  expect(counts.blots).toBeGreaterThanOrEqual(1)
})

test('a pen drag commits one stroke', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  const before = await root.counts()

  await root.drawStroke({ x: 40, y: 40 }, { x: 140, y: 140 })

  const after = await root.counts()
  expect(after.strokes).toBe(before.strokes + 1)
})

test('the eyes tool stamps an eye on tap', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  const before = await root.counts()

  await root.selectTool('Eyes')
  await root.stampEye(80, 80)

  const after = await root.counts()
  expect(after.eyes).toBe(before.eyes + 1)
})

test('New page starts a fresh field, and undo restores the prior counts', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  const before = await root.counts()

  await root.clickNewPage()
  const afterNewPage = await root.counts()
  expect(afterNewPage.fields).toBe(before.fields + 1)
  expect(afterNewPage.blots).toBeGreaterThan(before.blots)

  await root.clickUndo()
  const afterUndo = await root.counts()
  expect(afterUndo).toEqual(before)
})

test('New page resets the active tool back to the pen', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.selectTool('Eyes')
  await root.verifyToolActive('Eyes')

  await root.clickNewPage()

  await root.verifyToolActive('Pen')
})

test('shows the espy definition splash on load, then reveals the canvas', async ({ mountApp }) => {
  const { root } = await mountApp()

  await root.verifyIntroShown()
  await root.verifyIntroGone()
})

test('undo never drops below the initial field', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.clickNewPage()
  await root.clickNewPage()

  await root.pressUndoShortcut()
  await root.pressUndoShortcut()
  await root.pressUndoShortcut() // already at the floor — a no-op
  await root.pressUndoShortcut()

  const counts = await root.counts()
  expect(counts.fields).toBe(1)
  await root.verifyUndoDisabled()
})

test('a drawn stroke is written to the session key for a reload to restore', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.drawStroke({ x: 30, y: 30 }, { x: 120, y: 120 })

  await expect
    .poll(async () => (await root.readSession())?.some((op) => op.type === 'stroke') ?? false)
    .toBe(true)
})

test('prefers-reduced-motion renders the initial field immediately, without an alpha ramp', async ({
  mountApp,
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // Spy on the one canvas API the bloom ramp (spec §7) actually drives —
  // globalAlpha — rather than reading pixels. Under reduced motion every
  // render call uses alpha=1 directly (surface.ts renderOps(ops, theme, 1));
  // a running ramp would set fractional values on the way there.
  //
  // page.addInitScript() only fires on navigation, and the CT `page` fixture
  // has already navigated to the harness bundle before this test body runs
  // (mount() just calls window.playwrightMount on that same loaded page) — so
  // patch the already-loaded page directly, before mountApp() triggers React.
  await page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'globalAlpha')
    // eslint-disable-next-line @typescript-eslint/unbound-method -- re-bound via .call(this) below
    const originalGet = descriptor?.get as ((this: CanvasRenderingContext2D) => number) | undefined
    // eslint-disable-next-line @typescript-eslint/unbound-method -- re-bound via .call(this) below
    const originalSet = descriptor?.set as
      | ((this: CanvasRenderingContext2D, value: number) => void)
      | undefined
    const log: number[] = []
    ;(window as unknown as { __alphaLog: number[] }).__alphaLog = log
    if (originalGet && originalSet) {
      Object.defineProperty(proto, 'globalAlpha', {
        get(this: CanvasRenderingContext2D): number {
          return originalGet.call(this)
        },
        set(this: CanvasRenderingContext2D, value: number) {
          log.push(value)
          originalSet.call(this, value)
        },
      })
    }
  })

  const { root } = await mountApp()
  await root.verifyIsShown()
  expect((await root.counts()).fields).toBe(1)

  // Give a running ramp (~250ms, spec §7) ample time to have set intermediate
  // alpha values if reduced motion hadn't skipped it.
  await page.waitForTimeout(400)

  const alphaLog = await page.evaluate(
    () => (window as unknown as { __alphaLog: number[] }).__alphaLog,
  )
  expect(alphaLog.length).toBeGreaterThan(0)
  expect(alphaLog.every((alpha) => alpha === 1)).toBe(true)
})

test('wide viewport shows the subtitle and hides the ? help hint', async ({ mountApp, page }) => {
  await page.setViewportSize({ width: 1000, height: 720 })
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifySubtitleShown()
  await root.verifyHelpHintHidden()
})

test('narrow viewport hides the subtitle and reveals the hint via the ? tooltip', async ({
  mountApp,
  page,
}) => {
  await page.setViewportSize({ width: 380, height: 720 })
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifySubtitleHidden()
  await root.verifyHelpHintShown()
  await root.openHelpHintAndVerify('Add a few lines')
})

test('Save uses the native share sheet on a touch-primary device', async ({ mountApp, page }) => {
  // page.addInitScript() only fires on navigation, which already happened
  // before this test body ran — patch the already-loaded page directly.
  await page.evaluate(() => {
    // A phone/tablet: touch-primary + Web Share with files. Both are stubbed so
    // the test doesn't depend on what headless Chromium implements.
    Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, configurable: true })
    Object.defineProperty(window.navigator, 'canShare', { value: () => true, configurable: true })
    const shares: string[][] = []
    ;(window as unknown as { __shareCalls: string[][] }).__shareCalls = shares
    Object.defineProperty(window.navigator, 'share', {
      value: (data: { files?: File[] }) => {
        shares.push((data.files ?? []).map((f) => f.name))
        return Promise.resolve()
      },
      configurable: true,
    })
  })

  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.clickSave()

  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __shareCalls: string[][] }).__shareCalls),
    )
    .toEqual([['espy.png']])
})

test('Save downloads the drawing via an anchor when the Web Share API is unavailable', async ({
  mountApp,
  page,
}) => {
  // page.addInitScript() only fires on navigation, which already happened
  // before this test body ran (see the reduced-motion test above) — patch
  // the already-loaded page directly, before mountApp() triggers React.
  await page.evaluate(() => {
    // Guard the capability branch: force the anchor-download fallback
    // regardless of the host browser's real Web Share support, so the test
    // doesn't depend on what headless Chromium happens to implement.
    Object.defineProperty(window.navigator, 'canShare', {
      value: undefined,
      configurable: true,
    })
    const clicks: string[] = []
    ;(window as unknown as { __anchorClicks: string[] }).__anchorClicks = clicks
    // eslint-disable-next-line @typescript-eslint/unbound-method -- re-bound via .call(this) below
    const originalClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicks.push(this.download)
      return originalClick.call(this)
    }
  })

  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.clickSave()

  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __anchorClicks: string[] }).__anchorClicks),
    )
    .toEqual(['espy.png'])
})
