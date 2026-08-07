# 0029 — silt: scene persistence calls not fixed by the spec

- **Status:** Accepted
- **Date:** 2026-08-06
- **Related:** `.scratch/sand-sim/spec.md` §8 (the locked format — versioned
  envelope, planar base64, remap by name, the storage layout, bottom-centre
  paste, loud failure) and §9 (the popover). Implemented in silt ticket 09.

## Context

The spec fixes the scene *format* and the failure policy. It leaves open where
the seams sit between the format, the browser's storage, and the running
simulation — and a couple of those choices decide whether the feature can be
tested at all without a browser.

## Decision

### 1. Three layers, and the format layer is headless

`sceneCodec.ts` is pure: bytes in, envelope out, and back. It never touches
`localStorage`, React, or the DOM (`btoa`/`atob` are the only globals, and they
exist in Node). `sceneStore.ts` owns keys, the index and quota, against a
`SceneStorage` interface `localStorage` happens to satisfy. `useScenes.ts` owns
the page's list and its error messages.

Every rule that can make a load go wrong — a renumbered registry, a retired
element, a differently sized world, a truncated plane — is therefore decided in
vitest, in milliseconds, with no browser anywhere near it.

### 2. `decodeScene` returns planes sized to the *current* grid

The bottom-centre paste is applied during decode rather than during apply, so
the thing handed to the simulation is always exactly `width × height × 3` and
the sim never learns that scenes can be smaller than worlds. `Sim.restore` is
correspondingly dumb: three full planes, clear, write, wake.

### 3. `Sim.restore` wakes every cell it writes

Chunk sleeping means a world can be present in the buffer and still be scanned
by nothing. Restore therefore `activate`s each occupied cell, exactly as
painting does — a loaded pile of sand must fall the moment play is pressed.
`clock` is not restored: `clear()` rewinds the generation to 0 and every cell is
written at that clock, which is the same settled state a fresh world has.

### 4. Thumbnails live in their own key, not in the index

The index is read on every render of the popover and rewritten on every rename;
carrying a PNG data URL inside it would make both operations proportional to the
number of scenes and their pixels. Thumbnails are `silt:thumb:<id>` instead —
written after the blob, best-effort, and dropped without complaint if they do
not fit. A scene with no thumbnail still loads; the row shows an empty frame,
and the boot reconcile frees thumbnails whose scene has gone.

It is a third key class beyond the two spec §8 names, so it is charged to the
same budget: **exactly one thumbnail per scene, never more**. A save writes over
the scene's own thumbnail key rather than adding one, and a save whose picture
will not fit removes the previous one — it shows a world the scene no longer
holds, and its bytes would sit in the quota unclaimed. The picture is one pixel
per cell (300×200 PNG), small beside the ~240KB blob, so §8's twenty-scene
budget stands with the thumbnail counted in.

This keeps the index exactly the `[{id, name, updatedAt}]` the spec specifies.

### 5. A partial save leaves an orphan blob on purpose

The spec's write order (blob, then index) means a save interrupted between the
two writes leaves a blob nothing references. Rather than roll it back, the boot
reconcile adopts it as *recovered scene*. Rolling back would mean deleting data
on a failure path, which is the one thing §8 says never to do.

Delete runs the ordering the other way round — blob and thumbnail first, index
last — because there the index write is the one that needs room, and delete is
the only escape from a full quota. Interrupted, it leaves a dangling row the
next boot reconciles away, which is the cheap failure; the other order strands
the bytes with the escape hatch broken. For the same reason the boot reconcile
only rewrites the index when it actually repaired something.

### 6. Saving updates the scene you are on

**Revised 2026-08-07 (silt ticket 13). This section previously read "saving
always creates a new row"; that is reversed.**

The page holds a *current scene* — an id, or none for a world that has never
been saved. A load sets it, a first save creates a row and adopts it, and every
save after that writes over that row: same blob key, same thumbnail key, a new
`updatedAt`. The header names it, and follows a rename of it.

The no-overwrite model was the safer-looking call, but it degenerated:
`updatedAt` could only ever be written once, which is not what spec §8's field
is for; §9's inline rename implies a slot you keep rather than a log of
attempts; and §8's budget of *"~240KB worst case per scene ≈ 20 scenes"* only
holds if re-saving replaces. Paint, save, adjust, save hit the quota wall in
about twenty saves, and the only escape §8 gives is deleting rows the user
never meant to create.

Overwrite does need "the scene I am editing" to be right, so it is state on the
scenes controller rather than an inference from the header text — the header
now reads *from* it, not the other way round. Deleting the current scene clears
it, so the next save creates rather than resurrecting a deleted row.

Forking is what this costs, so `copy` on each row buys it back: the stored
bytes duplicated under a new id and `<name> copy`. It leaves the current scene
alone — you load the copy to carry on inside the fork — which keeps "which
scene does save write to?" answerable by looking at the header.

### 7. `ElementRegistry.all()`

Remapping by name needs both directions of the id↔name mapping and the registry
only had `get(id)`. `all()` returns the roster as registered, without the
engine's `empty`/`wall` pseudo-elements, and the codec builds whichever index it
needs from it.

## Consequences

- Adding compression later (`encoding` is the seam) touches `sceneCodec.ts`
  only; the store moves opaque strings and the sim sees planes either way.
- Renaming an element in the roster is a breaking change for saved scenes: the
  cells load as empty with a warning. Ids may be renumbered freely.
- The popover reads `localStorage` synchronously on open. At the ~240KB-per-
  scene worst case and a 5MB quota that is at most twenty rows, so no paging.
- Silt now has UI state (the scene list) that survives a reload while remaining
  a stateless app under [ADR 0008](0008-apps-without-a-database.md) — nothing is
  server-owned, and the popover footer says "this browser only" out loud.
