import { failedSmithyStageTest, failedStageTest } from './testing/iwftTest.tsx'

failedStageTest(
  'a wand stage that fails to load leaves the counter, tag and controls working',
  async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyNoStage()
    await root.choose('Oak')
    await root.verifyDescription('Twelve inches, oak, starlight core. Steady.')
  },
)

failedSmithyStageTest(
  'a sword stage that fails to load leaves the anvil, tag and controls working',
  async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyNoStage()
    await root.chooseIn('Steel', 'Mirror')
    await root.verifyDescription('mirror steel')
  },
)
