import { test } from './testing/accountIwftTest.tsx'
import { FIXTURE_PARENT } from './testing/familyFixture.ts'

test('signed out, /account offers sign in', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.verifyOffersSignIn()
})

test('a parent registers with the invite code and lands signed in', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.register()

  await root.verifySignedInAs(FIXTURE_PARENT.name)
  await root.verifyNoProfiles()
})

test('registering with the wrong invite code says so, on the form', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.register({ inviteCode: 'guessed' })

  await root.verifyInlineError('A valid invite code is required to register.')
})

test('a wrong password says so, on the form', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.signInWithWrongPassword()

  await root.verifyInlineError('Invalid email or password')
})

test('a signed-in parent adds, lists and renames a child profile', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.verifySignedInAs(FIXTURE_PARENT.name)

  await root.addProfile('Robin', 'robin')
  await root.verifyProfileListed('Robin', 'robin')

  await root.renameProfile('Robin', 'Bobbin')
  await root.verifyProfileListed('Bobbin', 'robin')
})

test('a taken username is a message on the form, not a crash', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()

  await root.addProfile('Robin', 'robin')
  await root.verifyProfileListed('Robin', 'robin')
  await root.addProfile('Robin two', 'robin')

  await root.verifyInlineError('that username is already taken')
  await root.verifyProfileListed('Robin', 'robin')
})

/**
 * A 33-character nickname is a plausible first thing to type here, and it used
 * to reach the server and come back as tRPC's stringified zod issue array. The
 * field now carries the contract's own bound, so the name is cut rather than
 * refused and nothing machine-written reaches the screen. The mapper that would
 * catch it anyway is pinned against the real payload in `accountError.test.ts`,
 * and the fake refuses the over-long name itself in `@hoe/accounts`.
 */
test('a name longer than the bound is cut in the browser, not refused by the server', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()

  await root.verifyNameFieldsAreBounded()
  await root.addProfile('x'.repeat(33), 'y'.repeat(33))

  await root.verifyProfileListed('x'.repeat(32), 'y'.repeat(32))
  await root.verifyNoMachineOutputIsShown()
})

test('a blank or whitespace-only profile cannot be submitted at all', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()

  await root.verifyAddProfileIsRefusedUntilBothFieldsHaveContent()
})

// The schema trims, so the screen must show what the service really stored.
test('a name typed with stray spaces is listed trimmed', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()

  await root.addProfile('  Robin  ', '  robin  ')

  await root.verifyProfileListed('Robin', 'robin')
})

test('picking who is playing sets the estate-wide family cookie', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.addProfile('Robin', 'robin')
  await root.verifyProfileListed('Robin', 'robin')
  await root.verifyNobodyIsPlaying()

  await root.pickWhoIsPlaying('Robin')

  await root.verifyPlayingNow('Robin')
  await root.verifyFamilySessionNames('Robin', 'child')
  await root.verifyFamilyCookieAttributes()
})

test('the parent can be the one playing too', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()

  await root.pickWhoIsPlaying(FIXTURE_PARENT.name)

  await root.verifyPlayingNow(FIXTURE_PARENT.name)
})

test('signing out clears the family cookie as well as the session', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.pickWhoIsPlaying(FIXTURE_PARENT.name)
  await root.verifyPlayingNow(FIXTURE_PARENT.name)

  await root.signOut()

  await root.verifySignedOut()
  await root.verifyNoFamilySession()
})

test('deleting the account takes a confirm step, and can be backed out of', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()

  await root.startThenAbandonDeletingTheAccount()
  await root.verifySignedInAs(FIXTURE_PARENT.name)

  await root.deleteAccount()
  await root.verifySignedOut()
})
