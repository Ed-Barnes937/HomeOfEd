// conversations.* — STUB for P3b. Empty router keeps types clean; copy the
// children group's shape to fill it.
//
// Source: apps/web/src/server/api-handlers.ts (handleCreateConversation,
// handleGetConversations, handleGetConversationMessages, handleSaveMessage,
// handleGetConversationSummary, handleSummariseAndPurge, handleDeleteConversation).
//
// OWNERSHIP RULE (plan §5.1 — add `verifyConversationOwnership` to handlers/authz.ts):
// a conversation is owned via its child. Implement, mirroring verifyChildOwnership:
//   load getConversation(id) → if null NotFoundError; then reuse
//   verifyChildOwnership(ctx, convo.childId) so the authenticated parent must own
//   the child. Use it in get/messages/summary/delete/summariseAndPurge.
// NB in the source these ran WITHOUT auth (a known gap #35) — closing it is the
// point of this migration. Decide per procedure whether the caller is the PARENT
// (dashboard: list/summary/delete) or the CHILD (chat: create/saveMessage). For a
// child-scoped procedure, use requireChild(ctx) and check convo.childId === childUser.id.
//
// Procedures to implement:
//
//  create — input { childId, title? } → the child creates a conversation.
//    Auth: requireChild; childId must equal the authenticated child. Store:
//    createConversation({ childId, title }). Out: { id, childId, title,
//    createdAt, updatedAt } (ISO strings).
//
//  list — input { childId } → conversations newest-first.
//    Auth: parent (verifyChildOwnership) OR child (self). Store:
//    listConversationsByChild(childId). Out: [{ id, title, summary, createdAt,
//    updatedAt }] (ISO strings).
//
//  messages — input { conversationId } → ordered oldest-first.
//    Auth: verifyConversationOwnership. Store: listMessages(conversationId).
//    Out: [{ id, conversationId, role, content, flagged, createdAt }].
//
//  saveMessage — input { conversationId, role, content, flagged? }.
//    Auth: the child in that conversation. Store: addMessage(...) then
//    touchConversation(conversationId) (bumps updatedAt). Out: the saved message.
//
//  summary — input { conversationId } → { summary: string | null }.
//    Auth: verifyConversationOwnership. Store: getConversation → .summary.
//
//  summariseAndPurge — input { conversationId } → { summary: string }.
//    PIPELINE DEPENDENCY (plan §5.1 / §5.5): this calls the pipeline's
//    /summarise over the private network. For P3 DO NOT make the HTTP call —
//    inject a summariser seam (e.g. constructor arg `summarise: (msgs) =>
//    Promise<string>`), the same pattern as CreateChildHandler's username seam,
//    and leave a TODO(P5) to wire the real pipeline client in main.ts/chat-sse.
//    Logic: listMessages(conversationId); if empty return the existing summary
//    (getConversation); else summary = await summarise(messages); then
//    ctx.store.summariseAndPurgeConversation(conversationId, summary) — the Store
//    method sets the summary and deletes the messages ATOMICALLY (was a db.tx).
//
//  delete — input { conversationId } → { success: true }.
//    Auth: verifyConversationOwnership. Store: deleteConversation(conversationId).
//
// All Store methods above are ALREADY declared/implemented — do NOT edit
// store.ts / fakeSproutStore.ts / trpc.ts / router.ts / makeCtx.
import { router } from './trpc.ts'

export const conversationsRouter = router({})
