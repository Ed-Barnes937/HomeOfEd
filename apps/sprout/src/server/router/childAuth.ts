// childAuth.* — STUB for P3b. Empty router keeps types clean; fill it by
// copying the children group's shape (Handler class + zod input + wire here).
//
// Source: apps/web/src/server/api-handlers.ts (handleChildLoginWithPassword,
// handleChildLoginWithPin, handleChangeChildPassword, handleGetChildrenForDevice).
//
// IMPORTANT ownership/identity note: these are the CHILD-auth procedures — they
// run BEFORE a child session exists (login) or to bootstrap one, so they are
// PUBLIC (no requireParent / no child session yet). They must NOT trust any
// parentId from input. On successful login, the handler mints a signed child
// token (auth/childToken.ts `mintChildToken`) — the transport sets it as the
// `CHILD_SESSION_COOKIE` (auth/providers.ts). Returning the raw token vs setting
// a cookie is a P5/transport decision; the handler produces the identity.
//
// Procedures to implement:
//
//  loginPassword — input { username, password, deviceToken }
//    Store: getChildByUsername → verifySecret(password, child.passwordHash);
//           getDeviceByToken → if absent, createDevice({ parentId: child.parentId, deviceToken }).
//    Out: the child profile { id, displayName, username, presetName, parentId,
//         mustChangePassword } (+ a minted child token). Invalid creds → throw
//         UnauthorizedError (source returned a generic "Invalid username or
//         password." — keep the message generic; do not leak which field failed).
//    password.ts: import { verifySecret } from '../password.ts'.
//
//  loginPin — input { childId, pin, deviceToken }
//    Store: getChild(childId). PIN brute-force lockout via behavioural-limits.ts:
//           evaluatePinAttempt(ctx.store, { childId }, ctx.now) → if locked, throw
//           (source used a friendly "Too many incorrect PIN attempts" — map to a
//           domain error, e.g. ForbiddenError/ValidationError). On a wrong/missing
//           pinHash: recordEvent(ctx.store, { kind: 'pin_fail', childId, deviceToken })
//           then throw UnauthorizedError('Incorrect PIN.'). On success return the
//           child profile (+ minted token).
//
//  changePassword — input { childId, newPassword, password?, pin? }
//    First-login forced change (mustChangePassword must be set, else reject —
//    this endpoint cannot overwrite an established child's password). Prove
//    identity with the temp password OR the PIN (verifySecret). Enforce
//    MIN_PASSWORD_LENGTH (6) and newPassword !== username → ValidationError.
//    Store: getChild → updateChild(childId, { passwordHash: hashSecret(newPassword),
//           mustChangePassword: false }). Out: the updated child profile.
//
//  deviceChildren — input { deviceToken }  (PUBLIC — the device-picker screen)
//    Store: getDeviceByToken → if none, { children: [] }; else
//           listChildrenByParent(device.parentId) → { children: [{ id, displayName,
//           presetName }] }. No auth: a device token is the bearer here.
//
// All Store methods above are ALREADY declared on SproutStore and implemented in
// DrizzleSproutStore + FakeSproutStore — do NOT edit store.ts / fakeSproutStore.ts.
import { router } from './trpc.ts'

export const childAuthRouter = router({})
