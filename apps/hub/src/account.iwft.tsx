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
  await root.openSettings()
  await root.verifySettingsSignedInAs(FIXTURE_PARENT.name)
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

test('too many sign-in tries say so plainly, and pause the button for a minute', async ({
  page,
  mountApp,
}) => {
  await page.clock.install()
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.signInWithWrongPasswordUntilRateLimited()

  await root.verifyInlineError('Too many tries. Wait a minute and try again.')
  await root.verifySignInPaused()
  await root.waitOutTheRateLimitPause()
  await root.signIn()
  await root.verifySignedInAs(FIXTURE_PARENT.name)
})

test('too many registration tries say so plainly, and pause that button too', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.registerWithWrongInviteCodeUntilRateLimited()

  await root.verifyInlineError('Too many tries. Wait a minute and try again.')
  await root.verifyRegisterPaused()
})

test('a signed-in parent adds, lists and renames a child profile', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.verifySignedInAs(FIXTURE_PARENT.name)
  await root.openSettings()

  await root.addProfile('Robin', 'robin')
  await root.verifyProfileListed('Robin', 'robin')

  await root.editProfile('Robin', { displayName: 'Bobbin' })
  await root.verifyProfileListed('Bobbin', 'robin')
})

test('a mistyped username is corrected in place', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.openSettings()
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
  await root.openSettings()
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
  await root.openSettings()
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
  await root.openSettings()
  await root.addProfile('Robin', 'robin')
  await root.backToPicker()
  await root.pickWhoIsPlaying('Robin')
  await root.verifyLandedHomePlayingAs('Robin')
  await root.verifyIsShown()
  await root.verifyPlayingNow('Robin')

  await root.openSettings()
  await root.deleteProfile('Robin')
  await root.backToPicker()

  await root.verifyNobodyIsPlaying()
  await root.verifyNoFamilySession()
  await root.verifyRemembersNobody()
})

test('a taken username is a message on the form, not a crash', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.openSettings()

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
  await root.openSettings()

  await root.verifyNameFieldsAreBounded()
  await root.addProfile('x'.repeat(33), 'y'.repeat(33))

  await root.verifyProfileListed('x'.repeat(32), 'y'.repeat(32))
  await root.verifyNoMachineOutputIsShown()
})

test('a blank or whitespace-only profile cannot be submitted at all', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.openSettings()

  await root.verifyAddProfileIsRefusedUntilBothFieldsHaveContent()
})

// The schema trims, so the screen must show what the service really stored.
test('a name typed with stray spaces is listed trimmed', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.openSettings()

  await root.addProfile('  Robin  ', '  robin  ')

  await root.verifyProfileListed('Robin', 'robin')
})

test('signed in, the picker shows a circle per profile and no settings cards', async ({
  mountApp,
  page,
}) => {
  await AccountPagePom.givenFamily(page, {
    signedIn: true,
    profiles: ['robin', 'Wren', 'Juniper', 'Ivy', 'Oak'],
    remembered: FIXTURE_PARENT.name,
  })
  const { root } = await mountApp()
  await root.verifyIsShown()

  await root.verifyPickerShows([
    { name: FIXTURE_PARENT.name, initial: 'A' },
    { name: 'robin', initial: 'R' },
    { name: 'Wren', initial: 'W' },
    { name: 'Juniper', initial: 'J' },
    { name: 'Ivy', initial: 'I' },
    { name: 'Oak', initial: 'O' },
  ])
  await root.verifyNobodyIsPlaying()
  await root.verifyNoSettingsOnPicker()
  await root.verifyEachProfileHasItsOwnColour()
  await root.verifySettingsCogIsTouchSized()
})

test('picking with no returnTo lands on hub home with the session set', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.openSettings()
  await root.addProfile('Robin', 'robin')
  await root.verifyProfileListed('Robin', 'robin')
  await root.backToPicker()
  await root.verifyNobodyIsPlaying()

  await root.pickWhoIsPlaying('Robin')

  await root.verifyLandedHomePlayingAs('Robin')
  await root.verifyFamilySessionNames('Robin', 'child')
  await root.verifyFamilyCookieAttributes()
  await root.verifyRemembersWhoIsPlaying()
})

test('the parent can be the one playing too, and lands home the same way', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()

  await root.pickWhoIsPlaying(FIXTURE_PARENT.name)

  await root.verifyLandedHomePlayingAs(FIXTURE_PARENT.name)
  await root.verifyFamilySessionNames(FIXTURE_PARENT.name, 'parent')
})

test('the profile playing on this device is marked on the picker', async ({ mountApp, page }) => {
  await AccountPagePom.givenFamily(page, {
    signedIn: true,
    profiles: ['Robin', 'Wren'],
    remembered: FIXTURE_PARENT.name,
  })
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.pickWhoIsPlaying('Wren')
  await root.verifyLandedHomePlayingAs('Wren')

  await root.verifyIsShown()

  await root.verifyPlayingNow('Wren')
})

test('signing out clears the family cookie as well as the session', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.pickWhoIsPlaying(FIXTURE_PARENT.name)
  await root.verifyLandedHomePlayingAs(FIXTURE_PARENT.name)
  await root.verifyIsShown()
  await root.openSettings()

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
    await root.pickWhoIsPlaying(FIXTURE_PARENT.name)

    await root.verifyReturnedTo(`${BOOP}#g=abc-123`)
  })

  test('a returnTo survives a trip to settings and back', async ({ mountApp, page }) => {
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyArrived()
    await root.signIn()

    await root.openSettings()
    await root.addProfile('Robin', 'robin')
    await root.verifyProfileListed('Robin', 'robin')
    await root.backToPicker()
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

  test('a returnTo off the estate is ignored, and the pick lands on hub home', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.openFromGate(page, 'https://boop.homeofed.com.evil.example/', '#g=abc')
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyOffersNoSharedItem()

    await root.signIn()
    await root.pickWhoIsPlaying(FIXTURE_PARENT.name)

    await root.verifyLandedHomePlayingAs(FIXTURE_PARENT.name)
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
    await root.verifyPickSettled()

    await root.verifyStillOnAccount()
    await root.verifyNoFamilySession()
    await root.verifyNobodyIsPlaying()
    await root.verifyRemembersNobody()
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
    await AccountPagePom.givenFamily(page, {
      signedIn: true,
      profiles: ['Robin'],
      remembered: 'Robin',
      playing: 'Robin',
    })
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()
    await root.serveEstateApps()

    await root.verifyPlayingNow('Robin')
    await root.verifyStillOnAccount()
    await root.verifyNoTokenMinted()
    await root.pickWhoIsPlaying(FIXTURE_PARENT.name)

    await root.verifyReturnedTo(`${BOOP}#g=abc-123`)
    await root.verifyFamilySessionNames(FIXTURE_PARENT.name, 'parent')
  })

  test('signing out in settings goes back to the picker, keeping the returnTo', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()
    await root.serveEstateApps()
    await root.verifyArrived()
    await root.signIn()
    await root.openSettings()

    await root.signOut()

    await root.verifySignedOut()
    await root.verifyStillOnAccount()
    await root.signIn()
    await root.verifySignedInAs(FIXTURE_PARENT.name)
    await root.pickWhoIsPlaying(FIXTURE_PARENT.name)
    await root.verifyReturnedTo(`${BOOP}#g=abc-123`)
  })

  test('opening settings directly never renews silently', async ({ mountApp, page }) => {
    await AccountPagePom.givenFamily(page, { signedIn: true, profiles: ['Robin'], remembered: 'Robin' })
    await AccountPagePom.serveEstateApps(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123', '/account/settings')
    const { root } = await mountApp()

    await root.verifyOnSettings()
    await root.verifyProfileListed('Robin', 'robin')
    await root.verifyNoTokenMinted()
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

  // Each call answers just after the 2 s time box closes: nothing may follow it.
  test('a mint answering after the time box writes nothing and leaves the visitor here', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.givenFamily(page, remembersRobin)
    await AccountPagePom.givenFamilyAnswersLate(page, { mintSessionToken: 2_300 })
    await AccountPagePom.serveEstateApps(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifySignedInAs(FIXTURE_PARENT.name)
    await root.waitForFamilyAnswers('mintSessionToken')
    await root.verifyStillOnAccount()
    await root.verifyNobodyIsPlaying()
    await root.verifyNoFamilySession()
  })

  // The parent is remembered, so no children.list check stands between me and the mint.
  test('identity.me answering after the time box mints nothing', async ({ mountApp, page }) => {
    await AccountPagePom.givenFamily(page, { ...remembersRobin, remembered: FIXTURE_PARENT.name })
    await AccountPagePom.givenFamilyAnswersLate(page, { me: 2_300 })
    await AccountPagePom.serveEstateApps(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifySignedInAs(FIXTURE_PARENT.name)
    await root.waitForFamilyAnswers('me')
    await root.verifyStillOnAccount()
    await root.verifyNoTokenMinted()
  })

  test('children.list answering after the time box mints nothing', async ({ mountApp, page }) => {
    await AccountPagePom.givenFamily(page, remembersRobin)
    await AccountPagePom.givenFamilyAnswersLate(page, { listChildren: 2_300 })
    await AccountPagePom.serveEstateApps(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifyPickerOffers('Robin')
    await root.waitForFamilyAnswers('listChildren')
    await root.verifyStillOnAccount()
    await root.verifyNoTokenMinted()
  })

  test('a family service that never answers holds the page for the time box only', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.givenFamily(page, remembersRobin)
    await AccountPagePom.givenFamilyAnswersLate(page, { me: 'never' })
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
    await AccountPagePom.givenPlaying(page, FIXTURE_PARENT.name, FIXTURE_PARENT.id)
    await AccountPagePom.serveEstateApps(page)
    await AccountPagePom.openFromGate(page, BOOP, '#g=abc-123')
    const { root } = await mountApp()

    await root.verifySignedInAs(FIXTURE_PARENT.name)
    await root.verifyPlayingNow(FIXTURE_PARENT.name)
    await root.verifyStillOnAccount()
    await root.verifyNoTokenMinted()
  })
})

test('signing out and back in lists the household again', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.openSettings()
  await root.addProfile('Robin', 'robin')
  await root.verifyProfileListed('Robin', 'robin')
  await root.signOut()
  await root.verifySignedOut()
  await root.verifyStillOnAccount()

  await root.signIn()

  await root.verifyPickerOffers('Robin')
  await root.openSettings()
  await root.verifyProfileListed('Robin', 'robin')
})

test('deleting the account takes a confirm step, and can be backed out of', async ({
  mountApp,
}) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.signIn()
  await root.pickWhoIsPlaying(FIXTURE_PARENT.name)
  await root.verifyRemembersWhoIsPlaying()
  await root.verifyIsShown()
  await root.openSettings()

  await root.startThenAbandonDeletingTheAccount()
  await root.verifySettingsSignedInAs(FIXTURE_PARENT.name)

  await root.deleteAccount()
  await root.verifySignedOut()
  await root.verifyRemembersNobody()
})

test.describe('when each profile last saved', () => {
  const MINUTE = 60_000
  const HOUR = 60 * MINUTE
  const DAY = 24 * HOUR
  const household = { signedIn: true, profiles: ['Robin', 'Wren'], remembered: FIXTURE_PARENT.name }

  test('one quiet line per app with a save, under whoever saved it', async ({ mountApp, page }) => {
    await AccountPagePom.givenFamily(page, {
      ...household,
      saves: [
        { by: 'Robin', appId: 'boop', agoMs: 2 * DAY + HOUR },
        { by: 'Robin', appId: 'silt', agoMs: 3 * HOUR + MINUTE },
        { by: FIXTURE_PARENT.name, appId: 'boop', agoMs: 10 * MINUTE + 5_000 },
      ],
    })
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openSettings()

    await root.verifyLastSaved('Robin', ['boop: saved 2 days ago', 'silt: saved 3 hours ago'])
    await root.verifyLastSaved(FIXTURE_PARENT.name, ['boop: saved 10 minutes ago'])
    await root.verifyNoLastSaved('Wren')
  })

  test('a household with no saves shows no lines', async ({ mountApp, page }) => {
    await AccountPagePom.givenFamily(page, household)
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openSettings()
    await root.verifyProfileListed('Robin', 'robin')
    await root.waitForFamilyAnswers('saveSummary')

    await root.verifyNoLastSaved('Robin')
    await root.verifyNoLastSaved('Wren')
    await root.verifyNoLastSaved(FIXTURE_PARENT.name)
    await root.verifyProfileRowShowsOnlyItsNames('Robin', 'robin')
    await root.verifySignedInShowsOnlyWhoIsSignedIn()
  })

  test('a failed read shows nothing, not an error', async ({ mountApp, page }) => {
    await AccountPagePom.givenFamily(page, {
      ...household,
      saves: [
        { by: 'Robin', appId: 'boop', agoMs: DAY },
        { by: FIXTURE_PARENT.name, appId: 'boop', agoMs: DAY },
      ],
    })
    await AccountPagePom.givenSaveSummaryFails(page)
    await page.clock.install()
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openSettings()
    await root.verifyProfileListed('Robin', 'robin')

    await root.outlastSaveSummaryRetries()

    await root.verifyNoErrorShown()
    await root.verifyProfileRowShowsOnlyItsNames('Robin', 'robin')
    await root.verifySignedInShowsOnlyWhoIsSignedIn()
  })

  test('nothing shows while the read is still out', async ({ mountApp, page }) => {
    await AccountPagePom.givenFamily(page, {
      ...household,
      saves: [
        { by: 'Robin', appId: 'boop', agoMs: DAY },
        { by: FIXTURE_PARENT.name, appId: 'boop', agoMs: DAY },
      ],
    })
    await AccountPagePom.givenFamilyAnswersLate(page, { saveSummary: 'never' })
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openSettings()
    await root.verifyProfileListed('Robin', 'robin')
    await root.verifyFamilyCalls('saveSummary', 1)

    await root.verifyProfileRowShowsOnlyItsNames('Robin', 'robin')
    await root.verifySignedInShowsOnlyWhoIsSignedIn()
  })

  test('the summary is asked for alongside the profiles, not after them', async ({
    mountApp,
    page,
  }) => {
    await AccountPagePom.givenFamily(page, household)
    await AccountPagePom.givenFamilyAnswersLate(page, { listChildren: 'never' })
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openSettings()
    await root.verifySettingsSignedInAs(FIXTURE_PARENT.name)

    await root.waitForFamilyAnswers('saveSummary')
  })

  test('the wording moves on while the page stays open', async ({ mountApp, page }) => {
    await page.clock.install()
    await AccountPagePom.givenFamily(page, {
      ...household,
      saves: [{ by: 'Robin', appId: 'boop', agoMs: 5 * MINUTE + 5_000 }],
    })
    const { root } = await mountApp()
    await root.verifyIsShown()
    await root.openSettings()
    await root.verifyLastSaved('Robin', ['boop: saved 5 minutes ago'])

    await page.clock.runFor(2 * MINUTE)

    await root.verifyLastSaved('Robin', ['boop: saved 7 minutes ago'])
  })
})
