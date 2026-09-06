# 02 - Talk through how clips are persisted

**Status:** ready-for-human
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

## Comments
