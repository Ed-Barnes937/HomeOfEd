import { appDates } from './pages/appDates.ts'
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
})

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
