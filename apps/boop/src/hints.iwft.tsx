import { test } from './testing/iwftTest.tsx'

test('the hint sheet never auto-opens on load', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyHintSheetHidden()
})

test('tapping "?" opens the hint sheet; the close button dismisses it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.openHints()
  await root.verifyHintSheetShown()

  await root.closeHints()
  await root.verifyHintSheetHidden()
})

test('tapping outside the sheet dismisses it', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.openHints()
  await root.verifyHintSheetShown()

  await root.dismissHintsByOutsideTap()
  await root.verifyHintSheetHidden()
})

test('pressing Escape dismisses the hint sheet', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.openHints()
  await root.verifyHintSheetShown()

  await root.dismissHintsByEscape()
  await root.verifyHintSheetHidden()
})
