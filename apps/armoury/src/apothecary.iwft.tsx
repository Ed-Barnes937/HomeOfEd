import { expect } from '@playwright/experimental-ct-react'
import type { Page } from '@playwright/test'

import type { Params } from './engine/schema.ts'
import { POTION_SAVE_KEY } from './persistence/storage.ts'
import { potionItem } from './potion/item.ts'
import { MIX_REVEAL_SECONDS, MIX_REVEAL_SECONDS_REDUCED } from './potion/mixBeats.ts'
import { potionPresets } from './potion/presets.ts'
import { withPours } from './potion/pours.ts'
import { apothecaryTest as test, failedApothecaryStageTest } from './testing/iwftTest.tsx'
import { ShopPom } from './testing/ShopPom.ts'

test('a first visit finds a potion on the table, labelled and ready', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyAt('/potions')
  await root.verifyPotionName('Moonmilk, Rosehip and Starpetal')
  expect(await root.potionNumber()).toMatch(/^No\. \d{4}$/)
  await root.verifyDescription(
    'Three layers in a teardrop flask. Cloudy, then swirly, then sparkly.',
  )
  await root.verifyHint('Tap the bottle to mix it')
  await root.verifyStage({ pours: 'moonmilk,rosehip,starpetal', shape: 'teardrop', glass: 'clear' })
})

test('choosing the bottle and its finish changes what is drawn and the card', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  const number = await root.potionNumber()

  await root.chooseIn('Shape', 'Gourd bottle')
  await root.chooseIn('Glass', 'Amber')
  await root.chooseIn('Stopper', 'Sealed with wax')
  await root.chooseIn('Label', 'Tag on a string')

  await root.verifyStage({ shape: 'gourd', glass: 'amber', stopper: 'wax', label: 'tag' })
  await root.verifyPotionName('Moonmilk, Rosehip and Starpetal')
  await root.verifyDescription('Three layers in a gourd bottle. Cloudy, then swirly, then sparkly.')
  expect(await root.potionNumber()).not.toBe(number)
})

test('Try another keeps a kept bottle, never pours fewer than two, and offers no way back', async ({
  mountApp,
  page,
}) => {
  const { root } = await mountApp()
  // A fixed seed, so Try another always makes the same potion.
  await page.evaluate(() => {
    Math.random = () => 0.25
  })
  await root.chooseIn('Shape', 'Tall bottle')
  await root.lock('bottle')
  const before = await root.stageFact('pours')

  await root.tryAnother()
  await root.verifyStage({ shape: 'tall' })
  const pours = await root.stageFact('pours')
  expect(pours).not.toBe(before)
  expect(pours.split(',').length).toBeGreaterThanOrEqual(2)
  await expect(page.getByRole('button', { name: 'Put the last one back' })).toHaveCount(0)
})

test('a renamed potion keeps its name and its shape after a reload', async ({ mountApp }) => {
  const first = await mountApp()
  await first.root.chooseIn('Shape', 'Round flask')
  await first.root.rename('Fizz')
  await first.root.verifyPotionName('Fizz')
  await first.root.reload()

  const { root } = await mountApp()
  await root.verifyPotionName('Fizz')
  await root.verifyStage({ shape: 'round' })
})

test('the potion and the wand each stay as they were left', async ({ mountApp, page }) => {
  const first = await mountApp()
  await first.root.chooseIn('Shape', 'Gourd bottle')
  const wands = await (await first.root.backToStreet()).enterWandShop()
  await wands.verifyWandName('The Smoky Spiral')
  await wands.choose('Oak')
  await wands.reload()

  const { root } = await mountApp()
  await root.verifyStage({ shape: 'gourd' })
  await (await root.backToStreet()).enterWandShop()
  await new ShopPom(page).verifyStage({ wood: 'oak' })
})

test('walking between all three shops keeps each bench its own item and locks, and the wand shop its put-back', async ({
  mountApp,
  page,
}) => {
  const lockOf = (part: string) =>
    page.getByRole('button', { name: `Keep the ${part} when trying another` })
  const putBackButton = page.getByRole('button', { name: 'Put the last one back' })

  const { root: potions } = await mountApp()
  await potions.lock('bottle')
  await potions.tryAnother()
  const potion = await potions.potionNumber()

  const wands = await (await potions.backToStreet()).enterWandShop()
  await wands.lock('core')
  await wands.tryAnother()
  const wand = await wands.wandNumber()

  const smithy = await (await wands.backToStreet()).enterSmithy()
  await smithy.lock('guard')
  await smithy.tryAnother()
  const sword = await smithy.swordNumber()

  const back = async (steps: number) => {
    for (let i = 0; i < steps; i++) await page.goBack()
  }
  const forward = async (steps: number) => {
    for (let i = 0; i < steps; i++) await page.goForward()
  }

  await back(2)
  await wands.verifyIsShown()
  expect(await wands.wandNumber()).toBe(wand)
  await expect(lockOf('core')).toHaveAttribute('aria-pressed', 'true')
  await expect(putBackButton).toBeVisible()

  await back(2)
  await potions.verifyIsShown()
  expect(await potions.potionNumber()).toBe(potion)
  await expect(lockOf('bottle')).toHaveAttribute('aria-pressed', 'true')
  await expect(putBackButton).toHaveCount(0)

  await forward(4)
  await smithy.verifyIsShown()
  expect(await smithy.swordNumber()).toBe(sword)
  await expect(lockOf('guard')).toHaveAttribute('aria-pressed', 'true')
  await smithy.putBack()
  await expect(putBackButton).toHaveCount(0)
})

test('the street still has only its two open doors', async ({ mountApp }) => {
  const { root } = await mountApp()
  const street = await root.backToStreet()
  await street.verifyOnlyOpenShopsAreDoors()
})

test('a tap on the bottle shows it up close, flourishing on arrival and again on each tap', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  const closeUp = await root.openCloseLook()
  await closeUp.verifyFlourishes(1)
  await closeUp.tapPotion()
  await closeUp.verifyFlourishes(2)
  await closeUp.putBack()
  await closeUp.verifyIsHidden()
})

const savedPotion = (params: Params) => ({
  ...potionItem.firstVisit(),
  ...params,
})

async function startWith(page: Page, params: Params, reload: () => Promise<void>): Promise<void> {
  await reload()
  await page.evaluate(
    ([key, saved]) => window.localStorage.setItem(key, saved),
    [
      POTION_SAVE_KEY,
      JSON.stringify({ version: 1, working: { params: savedPotion(params) }, shelf: [] }),
    ] as const,
  )
}

const stage = (page: Page) => page.getByTestId('stage')
const revealMs = MIX_REVEAL_SECONDS * 1000

async function stopTheClock(page: Page): Promise<void> {
  await page.clock.install()
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000)
}

test('the tap that lifts the bottle mixes it once the reveal has played, and a reload keeps it', async ({
  mountApp,
  page,
}) => {
  const { root } = await mountApp()
  await stopTheClock(page)
  await root.verifyPotionName('Moonmilk, Rosehip and Starpetal')

  const closeUp = await root.openCloseLook()
  await page.clock.runFor(revealMs - 100)
  await root.verifyStage({ pours: 'moonmilk,rosehip,starpetal' })
  await expect(stage(page)).toHaveAttribute('data-mixed', 'no')
  await page.clock.runFor(200)
  await expect(stage(page)).toHaveAttribute('data-mixed', 'yes')
  await closeUp.putBack()
  await root.verifyPotionName('Dreamy Rosehip Potion')

  await page.clock.resume()
  await root.reload()
  const { root: again } = await mountApp()
  await again.verifyPotionName('Dreamy Rosehip Potion')
  await expect(stage(page)).toHaveAttribute('data-mixed', 'yes')
})

test('putting the bottle back before the reveal still mixes it', async ({ mountApp, page }) => {
  const { root } = await mountApp()
  await stopTheClock(page)
  const closeUp = await root.openCloseLook()
  await closeUp.putBack()
  await root.verifyPotionName('Dreamy Rosehip Potion')
  await expect(stage(page)).toHaveAttribute('data-mixed', 'yes')
})

test('a second tap before the reveal restarts the wait', async ({ mountApp, page }) => {
  const { root } = await mountApp()
  await stopTheClock(page)
  const closeUp = await root.openCloseLook()
  await page.clock.runFor(revealMs - 500)
  await closeUp.tapPotion()
  await page.clock.runFor(revealMs - 500)
  await expect(stage(page)).toHaveAttribute('data-mixed', 'no')
  await page.clock.runFor(600)
  await expect(stage(page)).toHaveAttribute('data-mixed', 'yes')
})

test('the close look announces the reveal once, and says nothing before it', async ({
  mountApp,
  page,
}) => {
  const { root } = await mountApp()
  await stopTheClock(page)
  const closeUp = await root.openCloseLook()
  const announcement = page.getByRole('dialog').getByRole('status')
  await expect(announcement).toHaveText('')
  await page.clock.runFor(revealMs + 100)
  await expect(announcement).toContainText('Dreamy Rosehip Potion.')
  const said = await announcement.textContent()
  await closeUp.tapPotion()
  await page.clock.runFor(revealMs + 100)
  await expect(announcement).toHaveText(said ?? '')
})

test('under reduced motion the reveal comes at 0.3 seconds', async ({ mountApp, page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { root } = await mountApp()
  await stopTheClock(page)
  await root.openCloseLook()
  await page.clock.runFor(MIX_REVEAL_SECONDS_REDUCED * 1000 - 50)
  await expect(stage(page)).toHaveAttribute('data-mixed', 'no')
  await page.clock.runFor(100)
  await expect(stage(page)).toHaveAttribute('data-mixed', 'yes')
})

test('a mixed potion picked up again stays mixed and keeps its name', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await startWith(page, { mixed: 'yes' }, () => first.root.reload())
  const { root } = await mountApp()
  await stopTheClock(page)
  await root.verifyPotionName('Dreamy Rosehip Potion')
  const closeUp = await root.openCloseLook()
  await closeUp.tapPotion()
  await page.clock.runFor(revealMs + 100)
  await closeUp.putBack()
  await root.verifyPotionName('Dreamy Rosehip Potion')
  await expect(stage(page)).toHaveAttribute('data-mixed', 'yes')
})

test('a bottle with fewer than three ingredients stays unmixed when tapped', async ({
  mountApp,
  page,
}) => {
  const first = await mountApp()
  await startWith(page, withPours(['moonmilk', 'rosehip']), () => first.root.reload())
  const { root } = await mountApp()
  await stopTheClock(page)
  const closeUp = await root.openCloseLook()
  await closeUp.tapPotion()
  await page.clock.runFor(revealMs + 100)
  await closeUp.putBack()
  await expect(stage(page)).toHaveAttribute('data-mixed', 'no')
  await root.verifyPotionName('Moonmilk and Rosehip')
})

test('a mixed secret blend shows its name and the gold flag', async ({ mountApp, page }) => {
  const first = await mountApp()
  const secretBlend = potionPresets.find((preset) => preset.name === 'Early Riser')!
  await startWith(page, secretBlend.params, () => first.root.reload())
  const { root } = await mountApp()
  await root.verifyPotionName('Sunrise in a Bottle')
  await expect(stage(page)).toHaveAttribute('data-gold', 'yes')
})

test('Picture saves a png named after the potion', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.rename('Fizz')
  expect(await root.savePicture()).toBe('fizz.png')
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("the sheet's tabs are the potion's parts", async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyTabs(['Pours', 'Bottle', 'Finish'])
    await root.openTab('Bottle')
    await root.chooseIn('Shape', 'Square shoulders')
    await root.verifyStage({ shape: 'shoulder' })
  })
})

// The generated texts that wrap to the most lines, found by setting every name and tag line on the card.
const LONGEST_TEXTS: [Params, string][] = [
  [
    { ...withPours(['emberroot', 'thundercloud', 'starpetal']), shape: 'shoulder' },
    'Emberroot, Thundercloud and Starpetal',
  ],
  [
    { ...withPours(['frogfizz', 'thundercloud', 'thundercloud']), shape: 'shoulder', mixed: 'yes' },
    'Sparkling Thundercloud Wonder',
  ],
]

for (const size of [
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 900, height: 700 },
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
]) {
  test.describe(`at ${size.width} by ${size.height}`, () => {
    test.use({ viewport: size })

    test('the longest card and the hint are whole and apart, mixed or not', async ({
      mountApp,
      page,
    }) => {
      let { root } = await mountApp()
      for (const [params, name] of LONGEST_TEXTS) {
        await startWith(page, params, () => root.reload())
        ;({ root } = await mountApp())
        await root.verifyPotionName(name)
        await root.verifyCardAndHintFit()
      }
    })
  })
}

failedApothecaryStageTest(
  'a potion stage that fails to load leaves the table, card and controls working',
  async ({ mountApp }) => {
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.verifyNoStage()
    await root.chooseIn('Shape', 'Gourd bottle')
    await root.verifyDescription(
      'Three layers in a gourd bottle. Cloudy, then swirly, then sparkly.',
    )
  },
)
