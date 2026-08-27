# 03 — Child chat deletion becomes a soft delete

**What to build:** `conversations.delete` (child-callable, the chat page's
delete button) is currently a HARD delete — `store.deleteConversation` removes
the row and, via `onDelete: cascade`, its messages **and its safety flags**
(`schema.ts` flags.conversationId / flags.messageId). That means a child can
erase exactly the history the parent-visibility posture depends on. Convert to
soft delete: the child's view tidies up, the parent's view keeps everything.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] `conversations` gains a `deletedAt` timestamp (nullable); the delete
      handler sets it instead of deleting rows. Messages and flags are
      untouched.
- [ ] Child-facing reads (`conversations.list` for the child, the chat continue
      flow) exclude soft-deleted conversations; parent-facing reads include
      them, marked as deleted-by-child in the DTO so the dashboard can label
      them.
- [ ] Flags survive: a flag raised in a conversation the child later deletes
      still appears on the parent's flags page. Regression test for this — it
      is the safeguarding point of the ticket.
- [ ] The retention worker (`runRetentionSweep`) treats soft-deleted
      conversations the same as live ones — the retention windows remain the
      only path to hard deletion.
- [ ] Migration for the new column; store + handler unit tests; `.iwft` for the
      child flow (delete → gone from child list) and parent flow (still
      visible, labelled).

## Comments

**2026-08-27 (Ed, pilot feedback):** Children should be able to tidy their own
chat list, but a parent must still be able to see the history. Agent note: the
flag-cascade erasure discovered while writing this ticket makes the current
hard delete a live safeguarding gap, not just a UX preference — worth
prioritising.
