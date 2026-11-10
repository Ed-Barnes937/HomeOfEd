// Shared by the .iwft harness (browser) and the specs + POM (Node): there is no
// live dev sign-in, so the account flows run against FakeFamilyClient and these
// are the credentials it starts with.
export const FAMILY_INVITE_CODE = 'dev-insecure-invite'

/** Set on the page before mounting; the harness then fails every family call. */
export const FAMILY_DOWN_KEY = '__hubFamilyDown'

export const FIXTURE_PARENT = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'correct-horse-battery',
}
