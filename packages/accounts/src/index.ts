// Browser-safe surface; node-only code is behind `@hoe/accounts/server`.
export type { FamilyRole, FamilyTokenClaims } from './claims.ts'
export { FAMILY_SESSION_COOKIE } from './claims.ts'
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
  FamilyAuthContract,
  FamilyIdentityContract,
  FamilyIdentityRouterContract,
  IdentityMeOutput,
  ListChildrenOutput,
  MintSessionTokenInput,
  MintSessionTokenOutput,
  RenameChildInput,
  SignInInput,
  SignUpInput,
} from './identityContract.ts'
export {
  addChildInput,
  childProfileView,
  deleteAccountInput,
  deleteAccountOutput,
  identityMeOutput,
  listChildrenOutput,
  mintSessionTokenInput,
  mintSessionTokenOutput,
  renameChildInput,
} from './identityContract.ts'
export type { ReadFamilySessionOpts } from './readFamilySession.ts'
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
