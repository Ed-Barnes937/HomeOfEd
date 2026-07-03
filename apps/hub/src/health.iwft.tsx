import { test } from './testing/iwftTest.tsx'

test('home page renders the health value served by the in-browser backend', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyHealthValue('hello from postgres')
  await root.verifyBoidsLink()
})

test('a seeded row is what the page renders', async ({ mountApp }) => {
  const { root } = await mountApp({
    // Self-contained: serialised across the Node→browser boundary.
    seed: async (db) => {
      await db.execute("update health set value = 'seeded by iwft'")
    },
  })
  await root.verifyIsShown()
  await root.verifyHealthValue('seeded by iwft')
})

test('an injected failure on health surfaces as the query error state', async ({ mountApp }) => {
  const { root } = await mountApp({ failures: [{ path: 'health', mode: 'error' }] })
  await root.verifyIsShown()
  await root.verifyHealthError()
})
