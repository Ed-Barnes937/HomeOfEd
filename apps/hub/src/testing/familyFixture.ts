// Shared by the .iwft harness (browser) and the specs + POM (Node): there is no
// live dev sign-in, so the account flows run against FakeFamilyClient and these
// are the credentials it starts with.
export const FAMILY_INVITE_CODE = 'dev-insecure-invite'

/** Set on the page before mounting; the harness then fails every family call. */
export const FAMILY_DOWN_KEY = '__hubFamilyDown'

/** Set on the page before mounting; `identity.me` then never answers. */
export const FAMILY_HANGS_KEY = '__hubFamilyHangs'

/** Where the harness counts calls to the family service, by method, on the page. */
export const FAMILY_CALLS_KEY = '__hubFamilyCalls'

export type CountedFamilyCall = 'me' | 'listChildren' | 'mintSessionToken'

export const FIXTURE_PARENT = {
  id: 'parent-ada',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'correct-horse-battery',
}

/** Set on the page before mounting; the harness arranges the household, then mounts. */
export const FAMILY_SEED_KEY = '__hubFamilySeed'

export interface FamilySeed {
  /** Whether FIXTURE_PARENT's cookie session is live when the page loads. */
  signedIn: boolean
  /** Child profiles by display name; the username is the name in lower case. */
  profiles: readonly string[]
  /** Who this device last picked: FIXTURE_PARENT's name or one of `profiles`. */
  remembered: string
  /** The remembered profile has since been deleted, on another device. */
  rememberedDeleted?: boolean
}
