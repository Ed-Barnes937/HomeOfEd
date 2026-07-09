import { test } from './testing/iwftTest.tsx'

test('home page renders the wordmark, lede, and the live app links', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyBoidsLink()
  await root.verifyFridgeLink()
  await root.verifyWotdLink()
  await root.verifyEspyLink()
  await root.verifyHeigIsComingSoon()
})

test('home page renders a live preview canvas for every app card', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyPreviewsRender()
})
