// Shared by the .iwft harness (browser) and the specs + POM (Node): there is no
// live dev sign-in, so the account flows run against FakeFamilyClient and these
// are the credentials it starts with.
export const FAMILY_INVITE_CODE = 'dev-insecure-invite'

export const FIXTURE_PARENT = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'correct-horse-battery',
}
