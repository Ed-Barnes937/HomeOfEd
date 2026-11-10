// Browser-safe surface; node-only code is behind `@hoe/accounts/server`.
export type { FamilyRole, FamilyTokenClaims } from './claims.ts'
export { FAMILY_SESSION_COOKIE } from './claims.ts'
export type { EstateApp } from './estateApps.ts'
export { ESTATE_APPS, HUB_LOCAL_PORTS } from './estateApps.ts'
export { FamilyClientError } from './familyClientError.ts'
export type { FamilyUser } from './familyAuthProvider.ts'
export type { CookieJar, FamilySessionCookieOptions } from './familySessionCookie.ts'
export {
  clearFamilySession,
  familySessionCookieString,
  writeFamilySession,
} from './familySessionCookie.ts'
export type { CreateFamilyIdentityClientOpts } from './identityClient.ts'
export { createFamilyIdentityClient } from './identityClient.ts'
export type {
  AddChildInput,
  ChildProfileView,
  DeleteAccountOutput,
  DeleteChildInput,
  DeleteChildOutput,
  FamilyAuthContract,
  FamilyIdentityContract,
  FamilyIdentityRouterContract,
  IdentityMeOutput,
  ListChildrenOutput,
  MintSessionTokenInput,
  MintSessionTokenOutput,
  RenameChildInput,
  SaveSummaryEntry,
  SaveSummaryOutput,
  SignInInput,
  SignUpInput,
} from './identityContract.ts'
export {
  addChildInput,
  childProfileView,
  compareSaveSummaryEntries,
  deleteAccountInput,
  deleteAccountOutput,
  deleteChildInput,
  deleteChildOutput,
  identityMeOutput,
  listChildrenOutput,
  mintSessionTokenInput,
  mintSessionTokenOutput,
  renameChildInput,
  saveSummaryEntry,
  saveSummaryOutput,
} from './identityContract.ts'
export type { KeyValueStorage } from './profileScopedKey.ts'
export { adoptLegacyDocument, profileScopedKey } from './profileScopedKey.ts'
export type { ReadFamilySessionOpts } from './readFamilySession.ts'
export type { SafeReturnToOpts } from './returnTo.ts'
export { accountUrl, accountUrlFor, safeReturnTo, sharedUrl } from './returnTo.ts'
export { MAX_ACCOUNT_BYTES, MAX_ACCOUNT_SLOTS, MAX_SLOT_BYTES } from './saveLimits.ts'
export { readFamilySession } from './readFamilySession.ts'
export type {
  FamilySaveContract,
  SaveDeleteInput,
  SaveDeleteOutput,
  SaveGetInput,
  SaveGetOutput,
  SaveListInput,
  SaveListOutput,
  SavePutInput,
  SavePutOutput,
  SaveSlotMeta,
} from './saveContract.ts'
export {
  saveDeleteInput,
  saveDeleteOutput,
  saveGetInput,
  saveGetOutput,
  saveListInput,
  saveListOutput,
  savePutInput,
  savePutOutput,
  saveSlotMeta,
} from './saveContract.ts'
export type { CreateFamilySaveClientOpts } from './saveClient.ts'
export { createFamilySaveClient } from './saveClient.ts'
