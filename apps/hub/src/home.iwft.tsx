import { test } from './testing/iwftTest.tsx'

test('home page renders the wordmark, lede, and the live app links', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyBoidsLink()
  await root.verifyFridgeLink()
})
