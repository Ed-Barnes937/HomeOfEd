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

**2026-11-12, option 1 built in PR #206 (for Ed to merge or decline).**
Status stays `needs-info` until Ed picks an option. What was built is
recorded in ADR 0102 (new) and in an amendment to ADR 0094:

- **Storage.** Scenes and thumbnails are in IndexedDB, in a database named
  `silt` with stores `rows`, `bodies`, `thumbs` and `namespaces`.
  - Every record is keyed `[namespace, id]`. The namespace is the account id,
    or `''` signed out, so signed-out silt is as before.
  - The three planes are stored as bytes and the thumbnail as PNG bytes. The
    scene format's meaning is unchanged: `unpackScene` rebuilds the same
    envelope.
  - Field notes and `silt:seen` stay in localStorage.
- **Seam.** `SceneRecords`, with an in-memory fake. One contract suite runs
  against the fake and the IndexedDB code on `fake-indexeddb`. It is kept in
  silt.
- **The move.** On first open, the device's localStorage scenes are copied
  into the device namespace. The old keys are removed only after that write
  commits (index last). It is safe to interrupt and rerun, which is tested at
  every removal. Each profile then adopts the device namespace once, and no
  profile writes the device namespace.
- **Forget discoveries** now writes an empty record instead of removing the
  key.

**Measured.** Probe: 16 scenes saved through `origin/main`'s silt UI, then
this branch opened on the same origin and profile; real quota, Playwright
builds.

| | Chromium 149 | WebKit 26.5 | Firefox 151 |
|---|---|---|---|
| localStorage used by 16 scenes, before (chars) | 4,192,651 | 4,209,235 | 4,076,107 |
| localStorage room left, before (chars) | 1,050,209 | 1,033,625 | 1,166,753 |
| silt scene keys left after the move | 0 | 0 | 0 |
| device scenes after the move | 16 | 16 | 16 |
| three profiles: scenes adopted, then after one save | 16, 17 each | 16, 17 each | 16, 17 each |
| `storage.estimate()` usage after move + 3 profiles | 2.7MB | 13.3MB | 7.3MB |

Per painted scene:

- **Before:** about 262,000 localStorage characters: a 240,600 blob plus a
  ~21,000 thumbnail.
- **After:** 196,500 bytes of record (180,000 plane bytes, ~500 envelope,
  ~16,000 PNG).
- **On disk:** about 40,000 bytes in Chromium, 37,000 to 79,000 in Firefox,
  and about 200,000 in WebKit.

**2026-11-12, review fixes (PR #206).**

- **Adoption.**
  - A profile no longer adopts on an open where the move from localStorage
    failed.
  - A failed adoption is retried on every open, even after the profile saved
    scenes of its own (copied per id, so nothing collides).
- **Writes.** Any throw inside an IndexedDB operation now aborts its
  transaction, so a row can no longer commit without its body.
- **Moved ids.** The move records every moved id in the same transaction, in a
  new `imported` store. A rerun after a crash now only frees the old keys, so
  a scene deleted in between stays deleted. Moved batches are ordered after
  the namespace's last row.
- **Eviction.** After the first save that lands, silt asks
  `navigator.storage.persist()`, but only when the permission is already
  decided, so no prompt can show.
- **Tests from mutation testing.** A double-click on save makes one scene, and
  a contract test proves adoption is all or nothing, against both the fake and
  IndexedDB.
- **ADR 0102** now covers eviction, roll-forward-only rollback and a tab still
  on the old build during a deploy.
