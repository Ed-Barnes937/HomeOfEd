import { test } from './testing/iwftTest.tsx'

test('the boids page renders', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
})
