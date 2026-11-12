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
`bodies`, `thumbs` and `imported` (every id a namespace has taken in, by the
move or from the device), each keyed `[namespace, id]` with a `byNamespace`
index. The namespace is the account
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
the device namespace in one transaction with strict durability, and only after
it commits are the keys removed, the index last. The same transaction records
every moved id in `imported`, and an id recorded there is never added again,
so a rerun only frees the keys. Interrupted anywhere it reruns safely: nothing
is removed before it is safe, nothing is copied twice, and a moved scene
deleted before the rerun stays deleted. That last case is real: Chromium and
Firefox were measured keeping removed localStorage keys on disk for a second or
more after the IndexedDB commit. A moved batch is ordered after the
namespace's last row, so it never ties with scenes from an earlier move. ADR
0029's repair rules carry over: an orphan blob arrives as "recovered scene", a dangling row is dropped,
an orphan thumbnail is freed. Keys carrying `@` are never touched. This is the
one move ADR 0094 allows (see its amendment).

**6. Adoption, per scene id.** Every open copies, in one transaction, each
device scene whose id the profile has never taken in and does not hold, and
records every id it offered in the profile's `imported`.
- A scene the profile deleted stays deleted, even if it deleted everything.
- A scene moved in later (a rollback, an old-build tab) reaches every profile
  on its next open.
- A profile's own scene sharing an id with a device scene is never
  overwritten.
- A failed copy (quota) writes and records nothing, so it is retried on every
  open until it succeeds, even if the profile saved scenes of its own
  meanwhile. Their ids are new, so nothing collides. This is kinder than ADR
  0094's general rule (a profile that saved first never adopts), and safe here
  because adoption is per id.
- No profile adopts on an open where the move from localStorage failed; it
  waits until the device namespace holds the moved scenes.

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
- **Eviction, accepted.** Chromium may evict IndexedDB under disk pressure,
  where `localStorage` was exempt, so on a nearly full disk Chromium could
  remove saved scenes. Nothing is done about it. Asking for persistent storage
  without risking a permission prompt in front of a child was tried and found
  inert: Chromium 149 and Firefox 151 report `persistent-storage` as
  `'prompt'` by default, and WebKit throws on the query, so the request was
  never made. Firefox and Safari keep IndexedDB as they kept localStorage.
- **Rollback is roll-forward only.** A rollback to the localStorage build hides
  the scenes, which sit in IndexedDB. Redeploying this build brings them back,
  and anything saved during the rollback, being in localStorage again, is moved
  too.
- **A tab still on the old build during a deploy** finds its scene gone from
  the localStorage index once another tab has moved it, so its save creates a
  new scene there. The next open moves that in as a second scene, usually with
  the same name, and every profile receives it.
- **The move's window.** It runs from the move reading localStorage to its
  removing the keys, which includes the whole strict-durability commit. An
  old-build tab editing an existing scene inside it loses that edit: IndexedDB
  keeps the content read before it. A brand new scene saved inside it
  survives, but its index row goes with the old index, so it arrives on the
  next open as "recovered scene", without its name.
- **A crash between commit and removal**, followed by an old-build edit of a
  moved scene and then a rerun, drops that edit, because the rerun skips ids
  already moved. Both cases need an old-build tab or a rollback at that exact
  moment.
