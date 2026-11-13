import { appDates } from './pages/appDates.ts'
import { playAs } from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'

// The pill dates come from what CI recorded, and CI rewrites that file on every
// deploy — so these tests pick their clock relative to silt's own recorded
// dates rather than pinning an instant that would rot on the next release.
const silt = appDates('silt')

function daysAfter(iso: string | undefined, days: number): Date {
  if (!iso) throw new Error('silt has no recorded deploy — the seeded file lost an app')
  return new Date(Date.parse(iso) + days * 24 * 60 * 60 * 1000)
}

test('home page renders the wordmark, lede, and the live app links', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyBoidsLink()
  await root.verifyFridgeLink()
  await root.verifyWotdLink()
  await root.verifyEspyLink()
  await root.verifyKaresansuiLink()
  await root.verifyBoopLink()
  await root.verifyHeigIsComingSoon()
  await root.verifySiltLink()
  await root.verifyArmouryLink()
})

test('with nobody playing, the home page offers Sign in, which opens /account', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyWhosPlayingChip('Sign in')

  await root.openWhosPlayingChip('Sign in')

  await root.verifyOnAccountPage()
})

test('with a profile playing, the home page shows its avatar circle, linking to /account', async ({
  page,
  mountApp,
}) => {
  await playAs(page, 'Robin')
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyPlayerCircle('Robin')
  await root.openPlayerCircle('Robin')

  await root.verifyOnAccountPage()
})

test('a name with nothing visible in it is treated as nobody playing', async ({
  page,
  mountApp,
}) => {
  await playAs(page, ' \u200b ')
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyWhosPlayingChip('Sign in')
})

test('coming back to the page after the player changed shows the new player', async ({
  page,
  mountApp,
}) => {
  await playAs(page, 'Robin')
  const { root } = await mountApp()
  await root.verifyPlayerCircle('Robin')

  await playAs(page, 'Wren')
  await root.returnFromBackForwardCache()

  await root.verifyPlayerCircle('Wren')
})

for (const [width, height] of [
  [390, 844],
  [744, 1133],
  [1440, 900],
] as const) {
  test(`the avatar circle sits top right of the header at ${width}x${height}`, async ({
    page,
    mountApp,
  }) => {
    await page.setViewportSize({ width, height })
    await playAs(page, 'Robin')
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyPlayerCircleSitsTopRight()
  })
}

// The widths where the left column is narrowest beside the rail.
for (const [width, height] of [
  [1024, 768],
  [820, 1180],
  [800, 600],
  [768, 1024],
  [744, 1133],
] as const) {
  test(`the avatar circle stays clear of the app rail at ${width}x${height}`, async ({
    page,
    mountApp,
  }) => {
    await page.setViewportSize({ width, height })
    await playAs(page, 'Robin')
    const { root } = await mountApp()
    await root.verifyIsShown()

    await root.verifyPlayerCircleClearOfTheRail()
  })
}

test('home page renders a live preview canvas for every app card', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyPreviewsRender()
})

test('prefers-reduced-motion gives every preview one static frame, not a loop', async ({
  page,
  mountApp,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPreviewsAreStaticAndPainted()
})

test('without prefers-reduced-motion the previews keep animating', async ({ page, mountApp }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyPreviewsAnimate()
})

test('a theme toggle repaints the static frames under prefers-reduced-motion', async ({
  page,
  mountApp,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyStaticPreviewsRepaintOnThemeChange()
})

test('home page keeps the wordmark reachable on a narrow phone viewport', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyWordmarkReachableOnNarrowViewport()
})

test('a card wears the New pill for two weeks after the app first went live', async ({
  page,
  mountApp,
}) => {
  await page.clock.setFixedTime(daysAfter(silt.deployedAt, 1))
  const { root } = await mountApp()
  await root.verifyCardShowsNewPill('Silt')
})

test('a card wears the Updated pill after a later deploy, once New has aged out', async ({
  page,
  mountApp,
}) => {
  await page.clock.setFixedTime(daysAfter(silt.updatedAt, 1))
  const { root } = await mountApp()
  await root.verifyCardShowsUpdatedPill('Silt')
})

test('a card wears no pill once both windows have closed', async ({ page, mountApp }) => {
  await page.clock.setFixedTime(daysAfter(silt.updatedAt, 100))
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyNoCardShowsAPill()
})
