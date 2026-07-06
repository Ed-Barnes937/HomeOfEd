import { test } from './testing/iwftTest.tsx'

test('renders the default greeting served by the in-browser backend', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyGreeting('hello from the sprout')
})

test('greets the authed user — auth seam, no database', async ({ mountApp }) => {
  const { root } = await mountApp({ user: { id: 'ada' } })
  await root.verifyIsShown()
  await root.verifyGreeting('hello, ada')
})

test('an injected failure on greeting surfaces as the query error state', async ({ mountApp }) => {
  const { root } = await mountApp({ failures: [{ path: 'greeting', mode: 'error' }] })
  await root.verifyIsShown()
  await root.verifyGreetingError()
})
