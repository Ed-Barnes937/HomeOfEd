# 07 - boop sync: push, pull, import, merge hook

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) §7
Blocked by: 01, 05

boop becomes the first SaveStore client. New `apps/boop/src/sync/` module
beside `persistence/`, which is **untouched**: localStorage stays the source
of truth, every write lands there first (copy never move, decision 12);
service down = boop behaves exactly as today.

- **Push:** piggyback the existing autosave flush (`autosave.ts` lull): after
  a local write, if `readFamilySession()` is live,
  `save.put({ appId: 'boop', slotKey: 'boop:save', blob: <exact localStorage
  value> })`. Fire-and-forget; failures retry on the next save.
- **Pull:** on app start with a live session, `save.get`; if a remote doc
  exists, run the merge hook against local, write the result to localStorage,
  push back if the merge changed the remote.
- **Import (first link):** no `boop:syncedAccount` marker for this accountId
  -> offer "keep these boops on your account?"; accept = merge+put and stamp,
  decline = stamp without pushing. localStorage never cleared on any path.
  `boop:syncedAccount` is a new additive key; frozen `boop:save` v1 (ADR
  0025) untouched.
- **Merge hook** (decision 12), one pure function in `apps/boop`:
  `mergeSaveDocuments(local, remote)` - creations: remote list then
  local-only creations (dedupe by deep equality of `StoredBoop`); working:
  local if non-null else remote. Idempotent union; runs at import and
  whenever a pull would drop local-only creations. Honest limit accepted:
  deletes can resurrect via union.
- **Affordance:** a small "synced as {name}" chip linking to
  `homeofed.com/account`; nothing else in boop's UI changes (decode-is-total
  stays: a bad remote blob degrades to empty, never errors at a child).

TDD (pragmatic split): unit tests for `mergeSaveDocuments`; iwft for
import-offer, push-on-save, pull-on-start, offline degradation (fake client
erroring = today's behaviour).

## Comments
