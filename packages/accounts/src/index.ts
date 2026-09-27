// Browser-safe surface; node-only code is behind `@hoe/accounts/server`.
export type { FamilyRole, FamilyTokenClaims } from './claims.ts'
export { FAMILY_SESSION_COOKIE } from './claims.ts'
export type { FamilyUser } from './familyAuthProvider.ts'
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
export { createFamilySaveClient, FamilyClientError } from './saveClient.ts'
