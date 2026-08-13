import { expect } from '@playwright/experimental-ct-react'

import { test } from './testing/iwftTest.tsx'

test('shows a back-to-hub link pointing at home of ed', async ({ mountApp, page }) => {
  await mountApp()
  const back = page.getByRole('link', { name: /back to home of ed/i })
  await expect(back).toHaveAttribute('href', 'http://localhost:3000')
})

// Self-contained seed (serialised via fn.toString() across the Node→browser
// boundary — no imports/closures, raw SQL only). `for_date` matches the
// harness's pinned `ctx.now()` (2026-07-05T00:00:00Z).
const seed = async (db: { execute: (sql: string) => Promise<unknown> }) => {
  await db.execute(`insert into words (word, definition, example_sentence, alternatives, difficulty, for_date, word_type, respelling) values
    ('brave','showing courage','The brave child spoke up.', ARRAY['bold','fearless','daring'], 'beginner', '2026-07-05', 'adjective', 'BRAYV'),
    ('curious','eager to learn','A curious mind asks questions.', ARRAY['inquisitive','keen','nosy'], 'intermediate', '2026-07-05', 'adjective', 'KYOOR·ee·uhs'),
    ('resilient','recovers quickly','A resilient team bounces back.', ARRAY['tough','hardy','adaptable'], 'advanced', '2026-07-05', 'adjective', 'rih·ZIL·yuhnt'),
    ('ephemeral','lasting briefly','The ephemeral mist lifted.', ARRAY['fleeting','transient','brief'], 'expert', '2026-07-05', 'adjective', 'ih·FEM·er·uhl')`)
}

test('home page shows four level cards, each with its age hint', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyLevelCard('beginner')
  await root.verifyLevelCard('intermediate')
  await root.verifyLevelCard('advanced')
  await root.verifyLevelCard('expert')
})

test('clicking a level card shows that level\'s seeded word', async ({ mountApp }) => {
  const { root } = await mountApp({ seed })
  await root.verifyIsShown()
  await root.clickLevel('advanced')
  await root.verifyWotdPageIsShown()
  await root.verifyWord('resilient')
  await root.verifyWordType('adjective')
  await root.verifyRespelling('rih·ZIL·yuhnt')
  await root.verifyDefinitionHidden()
  await root.toggleDefinition()
  await root.verifyDefinition('recovers quickly')
  await root.verifySentence('A resilient team bounces back.')
  await root.verifySynonyms(['tough', 'hardy', 'adaptable'])
})

test('the back link returns from the word page to the level picker', async ({ mountApp }) => {
  const { root } = await mountApp({ seed })
  await root.clickLevel('advanced')
  await root.verifyWotdPageIsShown()
  await root.clickBack()
  await root.verifyIsShown()
})

test('the speak button plays the word through the Web Speech API', async ({ mountApp }) => {
  const { root } = await mountApp({ seed })
  await root.clickLevel('advanced')
  await root.verifyWotdPageIsShown()
  await root.stubSpeech()
  await root.clickSpeak()
  await root.verifySpoken('resilient')
})

test('the speaker icon shows a playing state while the word plays', async ({ mountApp }) => {
  const { root } = await mountApp({ seed })
  await root.clickLevel('advanced')
  await root.verifyWotdPageIsShown()
  await root.stubSpeech()
  await root.clickSpeak()
  await root.verifyPlayingState(false)
  await root.beginPlayback()
  await root.verifyPlayingState(true)
  await root.finishPlayback()
  await root.verifyPlayingState(false)
})

test('the hear-it button is absent when speech is unsupported', async ({ mountApp }) => {
  const { root } = await mountApp({ seed })
  await root.verifyIsShown()
  await root.disableSpeech()
  await root.gotoPath('/wotd?level=beginner')
  await root.verifyWord('brave')
  await root.verifySpeakAbsent()
})

test('the level colour carries through the pill, badge and primary button', async ({
  mountApp,
}) => {
  const { root } = await mountApp({ seed })
  const levels = ['beginner', 'intermediate', 'advanced', 'expert'] as const
  for (const [index, level] of levels.entries()) {
    await root.gotoPath(`/wotd?level=${level}`)
    await root.verifyLevelColourCarryThrough(level, index + 1)
  }
})

// A deliberately long, unbroken word to stress the card's overflow-wrap.
const longWordSeed = async (db: { execute: (sql: string) => Promise<unknown> }) => {
  await db.execute(`insert into words (word, definition, example_sentence, alternatives, difficulty, for_date) values
    ('pneumonoultramicroscopicsilicovolcanoconiosis','a lung disease','The long word filled the card.', ARRAY['long'], 'beginner', '2026-07-05')`)
}

for (const width of [320, 390]) {
  test(`the word page has no horizontal overflow at ${width}px`, async ({ mountApp, page }) => {
    await page.setViewportSize({ width, height: 780 })
    const { root } = await mountApp({ seed: longWordSeed })
    await root.gotoPath('/wotd?level=beginner')
    await root.verifyWotdPageIsShown()
    await root.verifyNoHorizontalOverflow()
  })
}

// A pre-redesign row: no word_type / respelling columns — the page must render
// the word without either (and without empty separators).
const nullFieldsSeed = async (db: { execute: (sql: string) => Promise<unknown> }) => {
  await db.execute(`insert into words (word, definition, example_sentence, alternatives, difficulty, for_date) values
    ('brave','showing courage','The brave child spoke up.', ARRAY['bold','fearless','daring'], 'beginner', '2026-07-05')`)
}

test('a word stored without type or respelling renders cleanly without either', async ({
  mountApp,
}) => {
  const { root } = await mountApp({ seed: nullFieldsSeed })
  await root.gotoPath('/wotd?level=beginner')
  await root.verifyWotdPageIsShown()
  await root.verifyWord('brave')
  await root.verifyNoWordTypeOrRespelling()
})

test('the theme toggle flips the theme and the choice survives a reload', async ({
  mountApp,
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyTheme('light')
  await root.toggleTheme()
  await root.verifyTheme('dark')
  await page.reload()
  const { root: reloaded } = await mountApp()
  await reloaded.verifyIsShown()
  await reloaded.verifyTheme('dark')
})

test('a first visit with no stored choice follows the system preference', async ({
  mountApp,
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyTheme('dark')
})

test('an invalid level in the URL falls back to beginner', async ({ mountApp }) => {
  const { root } = await mountApp({ seed })
  await root.gotoPath('/wotd?level=bogus')
  await root.verifyWotdPageIsShown()
  await root.verifyWord('brave')
  await root.toggleDefinition()
  await root.verifyDefinition('showing courage')
})
