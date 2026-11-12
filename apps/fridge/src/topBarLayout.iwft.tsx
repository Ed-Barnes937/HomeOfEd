import { setFamilyCookie } from './testing/familySession.ts'
import { test } from './testing/iwftTest.tsx'

const LONG_NAME = {
  sub: 'child-b',
  role: 'child',
  parentId: 'parent-1',
  name: 'Bartholomew Fitzgerald',
} as const

test('signed in at 1024px with a long name, the top bar keeps to one row above the saved fridges', async ({
  mountApp,
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  const first = await mountApp()
  await first.root.verifyIsShown()
  await page.reload()
  await setFamilyCookie(page, LONG_NAME)

  const { root } = await mountApp()
  await root.setNameInput('Mine')
  await root.clickSave()
  await root.verifyChip('Mine')
  await root.verifyTopBarFitsOneRow()
})
