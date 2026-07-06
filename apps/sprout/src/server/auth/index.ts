export { createSproutAuth } from './betterAuth.ts'
export type { CreateSproutAuthOpts, SproutAuth } from './betterAuth.ts'
export {
  DEFAULT_CHILD_TOKEN_TTL_MS,
  mintChildToken,
  verifyChildToken,
} from './childToken.ts'
export type { ChildTokenClaims, MintChildTokenInput, MintChildTokenOpts } from './childToken.ts'
export {
  CHILD_SESSION_COOKIE,
  childAuthProvider,
  fixedAuthProvider,
  readChildToken,
  resolveParentUser,
} from './providers.ts'
export type { ChildUser, ParentUser, SessionResolver, SproutUser } from './providers.ts'
