import { test } from './testing/iwftTest.tsx'

test('kept wands go on the shelf, and come back out onto the counter', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.keep()
  await root.choose('Oak')
  await root.choose('Wildwood')
  await root.rename('Acorn')
  await root.keep()
  await root.verifyShelfCount(2)

  const shelf = await root.openShelf()
  await shelf.verifyWands(['The Smoky Spiral', 'Acorn'])
  await shelf.takeOut('The Smoky Spiral')
  await root.verifyWandName('The Smoky Spiral')
  await root.verifyStage({ wood: 'cherry', core: 'starlight' })
})

test('a shelf wand can be renamed and removed', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.keep()
  await root.choose('Maple')
  await root.choose('Forest')
  await root.keep()

  const shelf = await root.openShelf()
  await shelf.rename('The Smoky Spiral', 'Old Faithful')
  await shelf.verifyWands(['Old Faithful', 'The Green Spiral'])
  await shelf.remove('Old Faithful')
  await shelf.verifyWands(['The Green Spiral'])
})

test('the shelf survives a reload', async ({ mountApp }) => {
  const first = await mountApp()
  await first.root.rename('Keeper')
  await first.root.keep()
  await first.root.reload()
  const { root } = await mountApp()
  await root.verifyShelfCount(1)
  const shelf = await root.openShelf()
  await shelf.verifyWands(['Keeper'])
})
