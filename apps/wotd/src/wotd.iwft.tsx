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
  await db.execute(`insert into words (word, definition, example_sentence, alternatives, difficulty, for_date) values
    ('brave','showing courage','The brave child spoke up.', ARRAY['bold','fearless','daring'], 'beginner', '2026-07-05'),
    ('curious','eager to learn','A curious mind asks questions.', ARRAY['inquisitive','keen','nosy'], 'intermediate', '2026-07-05'),
    ('resilient','recovers quickly','A resilient team bounces back.', ARRAY['tough','hardy','adaptable'], 'advanced', '2026-07-05'),
    ('ephemeral','lasting briefly','The ephemeral mist lifted.', ARRAY['fleeting','transient','brief'], 'expert', '2026-07-05')`)
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

test('an invalid level in the URL falls back to beginner', async ({ mountApp }) => {
  const { root } = await mountApp({ seed })
  await root.gotoPath('/wotd?level=bogus')
  await root.verifyWotdPageIsShown()
  await root.verifyWord('brave')
  await root.toggleDefinition()
  await root.verifyDefinition('showing courage')
})
