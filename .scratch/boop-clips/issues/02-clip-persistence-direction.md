# 02 - Talk through how clips are persisted

**Status:** resolved
**Type:** grilling
**Reported:** 2026-09-06, Ed

Ed wants a conversation about clip persistence direction - explicitly a chat,
not a build ticket.

Current state, as grounding for that chat:

- Everything lives in one localStorage document under `boop:save`
  (`storage.ts:21`, ADR 0025): the autosaved working grid plus the explicit
  "My boops" list, `SAVE_FORMAT_VERSION = 1`, total decode (anything
  unreadable degrades to empty rather than erroring at a child).
- Clips are `StoredPattern`s inside a song (ADR 0032); there is no per-clip
  storage, no server, no `@hoe/db` layer in boop (stateless app, ADR 0008).
- A share codec reuses the same shapes.

Things the chat probably needs to settle:

- Is the concern durability (localStorage is per-browser and evictable),
  size (ticket 01 removes the clip cap; recorded sounds - see
  `.scratch/boop-recorded-sounds/` - would blow localStorage entirely), or
  reach (same boops on the family tablet and the laptop)?
- Server-side persistence means boop grows a DB and, realistically, waits on
  or shapes the account layer epic (`.scratch/account-layer/`) - saves need
  an owner. Decide the ordering.
- Whatever direction, keep decode-is-total and the frozen v1 readable.

## Answer

Settled in a grilling session with Ed, 2026-09-06 - recorded as
[ADR 0056](../../../docs/adr/0056-boop-clips-stay-local.md). The short form:

- The concern behind the ticket was neither durability, size, nor reach: Ed
  wanted the guarantee that a clip, once made, is kept - un-placing or
  replacing it in the song must never destroy it. That is already today's
  behaviour; the ADR promotes it from accident to rule.
- boop stays a stateless localStorage app. The account layer was deliberately
  ruled out of this conversation ("pretend it doesn't exist"); no server, no
  IndexedDB, no export file. localStorage's per-browser/evictable limits are
  accepted, with share links as the manual escape hatch.
- Size was measured out of the question for clips (~400 bytes each); only
  recorded sounds threaten the quota, and that ticket already points at a
  future account-layer home.
- One feel-bad survived the session: "New boop" resets the working song and
  loses unsaved clips. Spun out as ticket 03 (New boop safety), a UX
  follow-up, not a persistence change.

## Comments

- 2026-09-06 (grilling session): resolved as above; see ADR 0056 for the full
  context and consequences.
