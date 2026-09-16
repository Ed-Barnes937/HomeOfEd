# 0056 - boop: clip persistence stays local; a clip is kept until deleted

- **Status:** Accepted
- **Date:** 2026-09-06
- **Related:** [ADR 0008](0008-apps-without-a-database.md) (boop is stateless),
  [ADR 0025](0025-boop-save-format.md) (the save document),
  [ADR 0026](0026-boop-share-links.md) (share links),
  [ADR 0032](0032-boop-save-format-songs.md) (clips and songs). Resolves
  [Clip persistence direction](../../.scratch/boop-clips/issues/02-clip-persistence-direction.md);
  spawns [New boop safety](../../.scratch/boop-clips/issues/03-new-boop-safety.md).

## Context

Removing the clip cap ([ticket 01](../../.scratch/boop-clips/issues/01-remove-clip-cap.md))
reopened the question of where clips live. The candidate concerns were
durability (localStorage is per-browser and evictable), size (would more clips
blow the quota?), and reach (the same boops on the family tablet and the
laptop). Measurement took size off the table: a clip serialises to roughly
400 bytes, so even a 35-clip boop is a few kilobytes against a ~5MB quota.
Only recorded sounds (`.scratch/boop-recorded-sounds/`) genuinely threaten
storage, and that idea is parked. Share links already move a single boop
between devices.

The real requirement, once asked, was retention semantics rather than a
storage substrate: a clip a child made must be kept - un-placing it from the
song, or replacing it at a position, must never destroy it. One deliberate
constraint on the conversation: the global account layer
(`.scratch/account-layer/`) was ruled out of scope - this direction is decided
as if accounts do not exist.

## Decision

1. **boop stays a stateless localStorage app.** The v1 save document (one key,
   frozen shapes, total decode) remains the single home for songs and their
   clips. No server, no `@hoe/db`, no IndexedDB, no export file.
2. **A clip belongs to its song and is kept until explicitly deleted.**
   Placements are arrangement, not ownership: un-placing a clip, replacing it
   at a position, or layering over it leaves the clip on its shelf, placeable
   again at any time. The only destroyers are the clip header's own delete and
   "New boop"'s whole-song reset. This is what the code already does; it is
   now the rule, not an accident.
3. **No clip library across boops.** Clips are not shared or reusable between
   saved boops; a boop wraps its own clips, whole. (Revisit only if a real kid
   asks for it.)
4. **localStorage's durability limits are accepted.** Per-browser, clearable,
   evictable; a share link remains the manual escape hatch for moving or
   backing up one boop.
5. **"New boop" losing unsaved clips is a recognised feel-bad**, tracked as
   its own narrow follow-up (ticket 03). That is a UX change, not a
   persistence change; nothing here blocks or prescribes its shape.

## Consequences

- Ticket 01 (cap removal) proceeds independently: it amends ADR 0032 and
  touches no storage substrate.
- Recorded sounds, if ever unparked, cannot live under this decision (audio
  blobs do not fit localStorage) and will have to reopen the direction - most
  likely as a consumer of the account layer, as its own ticket already notes.
- If the account layer ever arrives, boop's migration starts from here: one
  document, one key, total decode - exactly the inventory the account
  discovery brief lists.
