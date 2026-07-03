import { test } from './testing/iwftTest.tsx'

test('the boids page renders a sized, animating canvas', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifySimulationAdvances()
})
