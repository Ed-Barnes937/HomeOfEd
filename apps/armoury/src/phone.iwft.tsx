import { test } from './testing/iwftTest.tsx'

test.use({ viewport: { width: 390, height: 844 } })

test('on a phone the parts live in tabs on a sheet', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.openTab('Core')
  await root.choose('Storm glass')
  await root.verifyStage({ core: 'stormglass' })
  await root.openTab('Wood')
  await root.choose('Oak')
  await root.verifyStage({ wood: 'oak' })
})
