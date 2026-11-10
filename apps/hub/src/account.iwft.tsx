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
  await root.verifyRemembersNobody()
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
  await root.verifyRemembersWhoIsPlaying()
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
  await root.verifyRemembersNobody()
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
    await root.verifySignedInAs(FIXTURE_PARENT.name)
    await root.verifySharedItemNotOffered()
    await root.addProfile('Robin', 'robin')
    await root.pickWhoIsPlaying('Robin')

    await root.verifyReturnedTo(`${BOOP}#g=abc-123`)
  })

  test('arriving on /account/ with a trailing slash returns all the same', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123', '/account/')
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyArrived()

    await root.signIn()
    await root.pickWhoIsPlaying(FIXTURE_PARENT.name)

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

  test('an older cookie for the same profile cannot pass for a dropped write', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.givenPlaying(page, FIXTURE_PARENT.name, FIXTURE_PARENT.id)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyArrived()
    await root.signIn()
    await root.verifySignedInAs(FIXTURE_PARENT.name)

    await root.dropCookieWrites()
    await root.pickWhoIsPlaying(FIXTURE_PARENT.name)

    await root.verifyStillOnAccount()
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

test.describe('silent renewal: a parent signed in here, a family token gone', () => {
  const BOOP = 'https://boop.homeofed.com/play?bank=2'
  const remembersRobin = { signedIn: true, profiles: ['Robin'], remembered: 'Robin' }

  test('the remembered profile is re-minted and returned to with no screen', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.givenFamily(page, remembersRobin)
    await AccountPagePom.serveEstateApps(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifyReturnedTo(`${BOOP}#g=abc-123`)
    await root.verifyFamilySessionNames('Robin', 'child')
  })

  test('a remembered parent is re-minted too', async ({ mountApp, page }) => {
    await AccountPagePom.givenFamily(page, { ...remembersRobin, remembered: FIXTURE_PARENT.name })
    await AccountPagePom.serveEstateApps(page)
    await AccountPagePom.openFromGate(page, BOOP)
    const { root } = await mountApp()

    await root.verifyReturnedTo(BOOP)
    await root.verifyFamilySessionNames(FIXTURE_PARENT.name, 'parent')
  })

  test('a remembered profile deleted since falls through to the picker', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.givenFamily(page, { ...remembersRobin, rememberedDeleted: true })
    await AccountPagePom.serveEstateApps(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifySignedInAs(FIXTURE_PARENT.name)
    await root.verifyNobodyIsPlaying()
    await root.verifyStillOnAccount()
    await root.verifyNoFamilySession()
    await root.verifyNoTokenMinted()
    // The page reuses the answers renewal fetched rather than asking again.
    await root.verifyFamilyCalls('me', 1)
    await root.verifyFamilyCalls('listChildren', 1)
  })

  test('signed out, it falls through to sign in', async ({ mountApp, page }) => {
    await AccountPagePom.givenFamily(page, { ...remembersRobin, signedIn: false })
    await AccountPagePom.serveEstateApps(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifyOffersSignIn()
    await root.verifyOffersSharedItem('https://boop.homeofed.com/shared#g=abc-123')
    await root.verifyStillOnAccount()
    await root.verifyNoFamilySession()
    await root.verifyNoTokenMinted()
  })

  test('a real renewal records itself in the loop guard', async ({ mountApp, page }) => {
    await AccountPagePom.givenFamily(page, remembersRobin)
    await AccountPagePom.givenCookieWritesDropped(page)
    await AccountPagePom.serveEstateApps(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifySignedInAs(FIXTURE_PARENT.name)
    await root.verifyStillOnAccount()
    await root.verifyFamilyCalls('mintSessionToken', 1)
    await root.verifySilentRenewalRecorded(BOOP)
  })

  test('a loop guard that cannot be written means no silent renewal', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.givenFamily(page, remembersRobin)
    await AccountPagePom.givenSessionStorageRefusesWrites(page)
    await AccountPagePom.serveEstateApps(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifySignedInAs(FIXTURE_PARENT.name)
    await root.verifyNobodyIsPlaying()
    await root.verifyStillOnAccount()
    await root.verifyNoTokenMinted()
  })

  test('with the family service down, the shared item is offered at once', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.givenFamily(page, remembersRobin)
    await AccountPagePom.givenFamilyIsDown(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifyOffersSharedItem('https://boop.homeofed.com/shared#g=abc-123', {
      timeout: 1_000,
    })
    await root.verifyStillOnAccount()
    await root.verifyNoTokenMinted()
  })

  test('a family service that never answers holds the page for the time box only', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.givenFamily(page, remembersRobin)
    await AccountPagePom.givenFamilyHangs(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifyOffersSharedItem('https://boop.homeofed.com/shared#g=abc-123', {
      timeout: 1_000,
    })
    await root.verifyLoadingFamily()
    await root.verifyStillOnAccount()
    await root.verifyNoTokenMinted()
  })

  // The app's gate refused what hub just minted and sent the visitor straight back.
  test('a second arrival inside the loop guard shows the page, and a pick still returns', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.givenFamily(page, remembersRobin)
    await AccountPagePom.givenRenewedSilentlyMomentsAgo(page, BOOP)
    await AccountPagePom.serveEstateApps(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifySignedInAs(FIXTURE_PARENT.name)
    await root.verifyNobodyIsPlaying()
    await root.verifyStillOnAccount()

    await root.pickWhoIsPlaying('Robin')
    await root.verifyReturnedTo(`${BOOP}#g=abc-123`)
  })

  test('arriving with a live family token is a switch-player link: the picker shows', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.givenFamily(page, remembersRobin)
    await AccountPagePom.givenPlaying(page, 'Wren')
    await AccountPagePom.serveEstateApps(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifySignedInAs(FIXTURE_PARENT.name)
    await root.verifyPlayingNote('Wren')
    await root.verifyStillOnAccount()
  })
})

test('deleting the account takes a confirm step, and can be backed out of', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.pickWhoIsPlaying(FIXTURE_PARENT.name)
  await root.verifyRemembersWhoIsPlaying()

  await root.startThenAbandonDeletingTheAccount()
  await root.verifySignedInAs(FIXTURE_PARENT.name)

  await root.deleteAccount()
  await root.verifySignedOut()
  await root.verifyRemembersNobody()
})
