# 23 - silt: saved scenes do not fit per profile in localStorage

**Status:** needs-info
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 7, 8; the open call on quota
Blocked by: Ed's answer below. Blocks: 12 (PR #206, built, held out of the
feature branch)

Measured by ticket 12 (numbers in its Comments):

- Quota is 5,242,880 characters per origin (Chromium, WebKit, Firefox).
- One saved scene is about 270,000 to 320,000 characters (a fixed ~240,000
  blob plus a thumbnail). The app has no scene limit, so a device holds 16 to
  19 scenes in total, across everyone, before profiles exist at all.
- If every profile copies the old scenes: one profile fits 8 to 9 old scenes,
  two fit 5 to 6, three fit 4 with no room left to save.
- When the copy does not fit, the profile sees no old scenes, the old scenes
  keep the quota, and a first save can say "storage full, delete a scene" with
  an empty list. Only clearing site data recovers.
- The spec's fallback (only the first profile copies) does not hold either: a
  set over half the quota cannot be copied even once.

Per-profile saves are live for anyone with a family cookie as soon as the
epic merges, gate or no gate, so merging ticket 12 as built can strand a
household that already has more than a handful of scenes.

**Ed's call.** Options:

1. **Move scene storage to IndexedDB** (recommended). The quota problem is
   silt's own and exists today; IndexedDB gives hundreds of megabytes, after
   which every profile copying the old scenes is fine and ticket 12's design
   stands. Cost: scene storage becomes asynchronous, a one-time move of
   existing scenes out of localStorage, and silt is gated later than the
   other apps.
2. **The first profile to open silt on a device takes the old scenes** (a
   move, not a copy; ADR 0094 says never move, so it would be an exception
   for silt). Small; the wrong child may end up owning them.
3. **Shrink the saved scene** (compress the blob). Buys headroom, does not
   remove the ceiling.

Also for this ticket:

- "Forget discoveries" deletes the field-notes key, so old device field notes
  are copied back in on the next open and forgotten discoveries return. Fix:
  write an empty record instead of deleting.
- Ticket 12 changed `scripts/docker-stack-gate-round-trip.mjs` to read the
  gate's 302 from a response listener, because Playwright WebKit drops the
  redirect chain when the 302 carries `Cross-Origin-Opener-Policy` (every
  silt response does). Keep that change whatever is chosen.

## Comments
