// flags.* — STUB for P3b. Empty router keeps types clean; copy the children
// group's shape to fill it.
//
// Source: apps/web/src/server/api-handlers.ts (handleGetFlags, handleCreateFlag,
// handleUpdateFlag).
//
// Procedures to implement:
//
//  list — input { childId? } → the parent's flags, newest-first.
//    Auth: requireParent. Store: listChildrenByParent(parent.id) to get the
//    owned childIds; if input.childId is given, it MUST be in that set (else
//    return [] or ForbiddenError). Then listFlagsByChildren(childIds) (or
//    listFlagsByChild for a single). Out: each flag + `childDisplayName` resolved
//    from the owned-children map. Deriving the child set from ctx.auth (not from
//    a client-sent parentId) is what closes the #35 IDOR here.
//
//  create — input { childId, conversationId?, messageId?, type, reason,
//           childMessage?, aiResponse?, topics?: string[], deviceToken? }.
//    Auth: this is written on the chat path — scope it to the CHILD
//    (requireChild; childId === child.id) OR keep it internal to the SSE route
//    (P5) which already authenticated the child. Store: createFlag({ ...,
//    topics: topics ? JSON.stringify(topics) : null }) — topics is a JSON string
//    in a text column (see schema faithfulness note). Then, UNLESS type ===
//    'reported' (a child-initiated report, not a probe), record a probe signal:
//    recordEvent(ctx.store, { kind: 'probe', childId, deviceToken }) from
//    behavioural-limits.ts. Out: { id }.
//
//  review — input { flagId, reviewed } → the flag review state machine.
//    Auth: requireParent + ownership. Store: getFlag(flagId) → if null
//    NotFoundError; verifyChildOwnership(ctx, flag.childId) (403 cross-family);
//    setFlagReviewed(flagId, reviewed). Out: the updated flag. The "state
//    machine" is just the boolean `reviewed` toggle (unreviewed → reviewed);
//    there is no richer status in the source.
//
// FlagType (source packages/shared types/chat.ts): 'sensitive' | 'blocked' |
// 'validation-failed' | 'reported'. Define it as a zod enum in the create input.
//
// All Store methods above are ALREADY declared/implemented — do NOT edit
// store.ts / fakeSproutStore.ts / trpc.ts / router.ts / makeCtx.
import { router } from './trpc.ts'

export const flagsRouter = router({})
