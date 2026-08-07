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

### 6. Saving always creates a new row

There is no overwrite. `save current` writes the first unused `scene N` and the
row is renamed inline afterwards. Overwriting needs a notion of "the scene I am currently
editing" that the header's scene name only approximates, and getting it wrong
destroys a scene — the expensive mistake in a feature whose whole policy is
"never destructive".

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
