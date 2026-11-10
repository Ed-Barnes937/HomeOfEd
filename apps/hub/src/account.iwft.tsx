import { test } from './testing/accountIwftTest.tsx'
import { AccountPagePom } from './testing/AccountPagePom.ts'
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

  await root.editProfile('Robin', { displayName: 'Bobbin' })
  await root.verifyProfileListed('Bobbin', 'robin')
})

test('a mistyped username is corrected in place', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.addProfile('Robin', 'robni')
  await root.verifyProfileListed('Robin', 'robni')

  await root.editProfile('Robin', { username: 'robin' })

  await root.verifyProfileListed('Robin', 'robin')
  await root.verifyProfileNotListed('robni')
})

test('changing to a username another profile has says so, on the edit form', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.addProfile('Robin', 'robin')
  await root.addProfile('Wren', 'wren')
  await root.verifyProfileListed('Wren', 'wren')

  await root.editProfile('Wren', { username: 'robin' })

  await root.verifyInlineError('that username is already taken')
  await root.cancelEditingProfile()
  await root.verifyProfileListed('Wren', 'wren')
})

test('deleting a profile takes a confirm step, and removes only that profile', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.addProfile('Robin', 'robin')
  await root.addProfile('Wren', 'wren')
  await root.verifyProfileListed('Wren', 'wren')

  await root.startThenAbandonDeletingProfile('Robin')
  await root.verifyProfileListed('Robin', 'robin')

  await root.deleteProfile('Robin')

  await root.verifyProfileNotListed('robin')
  await root.verifyProfileListed('Wren', 'wren')
})

test('deleting the profile playing on this device stops it playing here', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.addProfile('Robin', 'robin')
  await root.pickWhoIsPlaying('Robin')
  await root.verifyPlayingNow('Robin')

  await root.deleteProfile('Robin')

  await root.verifyNobodyIsPlaying()
  await root.verifyNoFamilySession()
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

test.describe('arriving from an estate app', () => {
  const BOOP = 'https://boop.homeofed.com/play?bank=2'

  test('signing in and picking who is playing returns to the app, fragment and all', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyArrived()

    await root.signIn()
    await root.addProfile('Robin', 'robin')
    await root.pickWhoIsPlaying('Robin')

    await root.verifyReturnedTo(`${BOOP}#g=abc-123`)
  })

  test('a percent-escaped fragment reaches the app byte for byte', async ({ mountApp, page }) => {
    const fragment = '#w=%7B%22a%22%3A1%7D&n=%E2%9C%93'
    await AccountPagePom.openFromGate(page, BOOP, fragment)
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyArrived()

    await root.signIn()
    await root.pickWhoIsPlaying(FIXTURE_PARENT.name)

    await root.verifyReturnedTo(`${BOOP}${fragment}`)
  })

  test('a parent who registers on the way is returned after the pick too', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyArrived()

    await root.register()
    await root.verifySignedInAs(FIXTURE_PARENT.name)
    await root.pickWhoIsPlaying(FIXTURE_PARENT.name)

    await root.verifyReturnedTo(`${BOOP}#g=abc-123`)
  })

  test('going back from the app does not land on the account page', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyArrived()
    await root.signIn()
    await root.pickWhoIsPlaying(FIXTURE_PARENT.name)
    await root.verifyReturnedTo(`${BOOP}#g=abc-123`)

    await root.goBack()

    await root.verifyNotOnAccount()
  })

  test('a returnTo off the estate is ignored, and the pick stays here', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.openFromGate(page, 'https://boop.homeofed.com.evil.example/', '#g=abc')
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyOffersNoSharedItem()

    await root.signIn()
    await root.pickWhoIsPlaying(FIXTURE_PARENT.name)

    await root.verifyPlayingNow(FIXTURE_PARENT.name)
    await root.verifyStillOnAccount()
  })

  test('a cookie the browser drops means no return, so the gate is not met again', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyArrived()
    await root.signIn()
    await root.verifySignedInAs(FIXTURE_PARENT.name)

    await root.dropCookieWrites()
    await root.pickWhoIsPlaying(FIXTURE_PARENT.name)

    await root.verifyStillOnAccount()
    await root.verifyNoFamilySession()
  })

  test('a token the device already counts as expired means no return', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyArrived()
    await root.signIn()
    await root.verifySignedInAs(FIXTURE_PARENT.name)

    await root.moveDeviceClockPastTokenExpiry()
    await root.pickWhoIsPlaying(FIXTURE_PARENT.name)

    await root.verifyNobodyIsPlaying()
    await root.verifyStillOnAccount()
  })

  test('signed out with a shared fragment, the shared item opens without an account', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyOffersSignIn()
    await root.verifyOffersSharedItem('https://boop.homeofed.com/shared#g=abc-123')

    await root.openSharedItem()

    await root.verifyReturnedTo('https://boop.homeofed.com/shared#g=abc-123')
  })

  test('with the family service down, the shared item is still offered', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.givenFamilyIsDown(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifyFamilyIsDown()
    await root.verifyOffersSharedItem('https://boop.homeofed.com/shared#g=abc-123')
  })

  test('with no fragment there is nothing shared to offer', async ({ mountApp, page }) => {
    await AccountPagePom.openFromGate(page, BOOP)
    const { root } = await mountApp()

    await root.verifyOffersNoSharedItem()
  })

  // An app's switch-player link arrives in the same shape as the gate, with a session live.
  test('someone already playing is shown the picker, and the new pick returns', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.givenPlaying(page, 'Robin')
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyArrived()

    await root.signIn()
    await root.verifyPlayingNote('Robin')
    await root.verifyStillOnAccount()
    await root.pickWhoIsPlaying(FIXTURE_PARENT.name)

    await root.verifyReturnedTo(`${BOOP}#g=abc-123`)
  })
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
