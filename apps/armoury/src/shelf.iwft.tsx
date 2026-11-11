import { smithyTest, test } from './testing/iwftTest.tsx'
import { ShopPom } from './testing/ShopPom.ts'

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

smithyTest(
  'a kept sword goes on the shelf under Swords, beside a wand, and comes back to the anvil',
  async ({ mountApp, page }) => {
    const { root } = await mountApp()
    await root.rename('Pip')
    await root.keep()
    await root.verifyKept('Pip is on your shelf.')
    await root.verifyShelfCount(1)
    await root.chooseKind('Dagger')

    const shelf = await root.openShelf()
    await shelf.verifyItems('sword', ['Pip'])
    await shelf.backToCounter()
    const wands = new ShopPom(page)
    await wands.keep()
    await wands.openShelf()
    await shelf.verifyItems('wand', ['The Smoky Spiral'])
    await shelf.verifyItems('sword', ['Pip'])

    await shelf.takeOut('Pip')
    await root.verifySwordName('Pip')
    await root.verifyStage({ family: 'knight' })
  },
)

smithyTest(
  'a shelf sword shows its label, and can be renamed and removed',
  async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.keep()
    const shelf = await root.openShelf()
    const name = (await shelf.itemNames('sword'))[0]!
    await shelf.rename(name, 'Old Oak')
    await shelf.verifyItems('sword', ['Old Oak'])
    await shelf.verifyLabel('Old Oak', /^Knight's sword, [a-z -]+ inches, satin steel$/)
    await shelf.remove('Old Oak')
    await shelf.verifyItems('sword', [])
  },
)
