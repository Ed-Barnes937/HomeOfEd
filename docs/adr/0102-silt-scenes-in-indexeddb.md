# 0102 - silt keeps its scenes in IndexedDB, per player

- **Status:** Proposed (built as option 1 of estate-gate ticket 23; Ed has not
  yet chosen the option)
- **Date:** 2026-11-12
- **Related:** [ADR 0029](0029-silt-scene-persistence.md) (scene persistence in
  localStorage; its format and "never destructive" rules stand, its storage
  calls are replaced here), [ADR 0094](0094-per-profile-local-saves.md)
  (per-profile saves, amended for silt's one-time move),
  [ADR 0055](0055-silt-progression-belongs-to-the-scene.md). Tickets:
  `.scratch/estate-gate/issues/12-silt-gate.md` and `23-silt-scene-storage-quota.md`.

## Context

silt kept each scene in `localStorage`: a ~240,600 character envelope (three
base64 planes) and a ~15,000 to 80,000 character PNG data URL. The origin's
quota is 5,242,880 characters in Chromium, WebKit and Firefox, so a device held
about 16 to 19 scenes for everyone on it. Per-profile saves (ADR 0094) copy the
device's old scenes into each profile, which needs (profiles + 1) times the
space: three profiles fit only four old scenes. When a copy did not fit the
profile saw nothing, and could meet "storage full, delete a scene" with
nothing to delete.

## Decision

**1. Scenes move to IndexedDB.** Its quota is a share of the disk (hundreds of
megabytes at least), so every profile copying the device's scenes is fine and
ADR 0094's copy-on-first-open stands for silt. Field notes (a few kilobytes)
and the first-visit hint stay in `localStorage`.

**2. One database, `silt`, four stores.** `rows` (id, name, updatedAt, order),
`bodies`, `thumbs`, each keyed `[namespace, id]` with a `byNamespace` index,
and `namespaces` (which profiles have opened). The namespace is the account
id, or `''` for no account, by `profileScopedKey`'s rule, so signed-out silt
behaves as before. Each operation is one transaction: a scene's row, body and
thumbnail land together or not at all. ADR 0029's blob-before-index order and
the boot reconcile are no longer needed and are gone.

**3. Binary as binary, format unchanged.** A body is the codec's envelope with
`species`, `ra` and `rb` held as `Uint8Array` (60,000 bytes each); the
thumbnail is PNG bytes. `unpackScene` rebuilds the same JSON for `decodeScene`,
so the scene format's meaning is untouched. Text that does not parse as an
envelope is stored as text, so a corrupt scene stays listed with its error.
Measured per scene, painted (Chromium 149): 262,000 characters in
localStorage before; 196,500 logical bytes after (180,000 planes, ~500
envelope, ~16,000 PNG). On disk, by `navigator.storage.estimate()`: Chromium
about 40,000 bytes a scene (it compresses the mostly empty planes), Firefox
37,000 to 79,000, WebKit about 200,000.

**4. Behind a seam.** `SceneRecords` is the interface; `MemorySceneRecords`
is its in-memory fake, with a byte quota for the failure tests. One contract
suite runs against the fake and against the real implementation on
`fake-indexeddb`, so the fake cannot drift. It stays in silt: no other app
needs an asynchronous per-profile store yet.

**5. The one-time move.** On the first open after this ships, the device's
`silt:scenes`, `silt:scene:<id>` and `silt:thumb:<id>` keys are copied into
the device namespace in one transaction with strict durability, skipping any
id already there, and only after it commits are the keys removed, the index
last. Interrupted anywhere it reruns safely: nothing is removed before it is
safe, and what was moved is never copied twice. ADR 0029's repair rules carry
over: an orphan blob arrives as "recovered scene", a dangling row is dropped,
an orphan thumbnail is freed. Keys carrying `@` are never touched. This is the
one move ADR 0094 allows (see its amendment).

**6. Adoption.** A profile's first open copies the device namespace into its
own in one transaction and records the profile in `namespaces`, unless the
profile already holds scenes. A profile that later deletes every scene does not
adopt again. A failed copy (quota) is retried on the next open.

**7. Failure modes.**
- No IndexedDB (refused, disabled, or `indexedDB` throws): silt opens and
  plays, the popover says "scenes cannot be saved on this browser" and
  disables save. Nothing falls back to `localStorage`, and old scenes stay
  there untouched.
- A full quota on save: "storage full, delete a scene", nothing changed. A
  scene that fits only without its picture is saved without it, as before.
- Another tab upgrading the database: this tab closes its connection at
  once, so the upgrade is not held up, and says "silt was updated in another
  tab, reload to keep saving scenes". A newer tab held up by an older one says
  "close silt in your other tabs to open your scenes" until it can open.
- A transaction aborted mid-save rolls back whole: the previous scene stays
  as it was.

**8. Asynchronous, with the same UI.** `useScenes` runs operations one at a
time, in order, so a second save cannot race the first into two scenes; the
list appears only once read, so it never flashes empty; the world is read
when the save's turn comes. The library is bound to the namespace the page
opened for, so a save in flight when another player is picked lands in the
old player's namespace or, if the reload cuts it off, nowhere.

## Consequences

- An existing device moves its scenes on the first open; its `localStorage`
  is freed of them (about 4.2 million characters for 16 scenes).
- Probed with 16 scenes saved by the previous build: the move completes and
  three profiles each adopt all 16 and save a 17th, in Chromium 149, WebKit
  26.5 and Firefox 151.
- Scene operations are asynchronous, so the iwft POM waits on the scenes
  button's `data-busy` rather than reading the page straight after a click.
- Rolling back to a `localStorage` build after the move would show no scenes
  (they would be in IndexedDB). Not planned for; say so before reverting.
- One narrow case can bring a scene back: the move commits, the page dies
  before removing that scene's old key, and before the next open someone
  signed out deletes the scene. The rerun then re-adds it from the old key.
  Judged too unlikely to guard against.
