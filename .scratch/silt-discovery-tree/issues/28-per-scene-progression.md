# 28 - Field note progression is global; tie it to the scene

**Status:** done (built on silt-per-scene-notes, 2026-09-06)
**Type:** task
**Reported:** 2026-09-06, user bug report via Ed

Field note progression is one global localStorage key, deliberately so
(`fieldNotesStore.ts:2` - "Progression is **global, not per scene**",
`PROGRESS_KEY = 'silt:fieldNotes'`, spec §5). Scenes persist separately
(`sceneStore.ts`: `silt:scenes` index + `silt:scene:<id>` blobs). So loading a
scene changes the world but keeps whatever progression the browser has
accumulated across all scenes.

Ed's direction: for now, progression belongs to the scene. Loading a scene
loads that scene's field note progression. The user can still reset. A future
global-account layer (see `.scratch/account-layer/`) may revisit this - do not
build for that future, just make the scene the unit today.

## Design sketch

- The live session keeps using `PROGRESS_KEY` as the **working progression**
  (the canvas you are playing on right now). Nothing about witnessing,
  derivation (`entries.ts`), or the panel changes.
- **Save scene** snapshots the stored `Progress` (edges + reviewed watermark)
  into the scene, alongside the world. Prefer embedding it in the scene
  envelope over a parallel `silt:fieldNotes:<id>` key: the scene stays
  self-contained, saves stay atomic, and `sceneStore`'s orphan cleanup does
  not grow a third prefix. `sceneStore` treats the envelope as opaque JSON, so
  the change lands in the scene format module, not the store.
- **Load scene** replaces the working progression with the scene's snapshot.
- **Reset** already has UI: the "Forget discoveries" button in the panel
  (`FieldNotesPanel.tsx:390`, behind its armed confirm, wired to
  `fieldNotes.reset` at `HomePage.tsx:271`). Keep it, and pin its meaning
  under the new model: it clears the **working** progression; a subsequent
  save persists the cleared state into that scene. Saved snapshots are
  untouched until saved over.

## Decisions (Ed, 2026-09-06)

- A scene saved before this change carries no progression snapshot. Loading
  it **clears** the field notes - exactly as if a scene with an empty
  snapshot had been loaded. Strict per-scene semantics; no special case for
  old scenes. (The player's pre-existing global progression survives only as
  the working progression until they load a scene, and in any scene they
  save from here on.)
- No migration of the existing global blob: it simply continues as the
  working progression.
- "New scene" / clearing the world keeps today's behaviour
  (`fieldNotesStore.ts:151` - clearing the world never resets notes). Only an
  explicit scene **load** replaces progression.

## Acceptance

- [x] Saving a scene and loading it on a fresh profile restores its field
      notes (edges and the NEW-chip watermark)
- [x] Loading scene A then scene B shows B's progression, not A's or a merge
- [x] Loading a pre-change scene (no snapshot) clears the notes, same as an
      empty snapshot
- [x] The panel's "Forget discoveries" button still clears (working
      progression only), and save-after-forget persists the cleared state
- [x] Unknown edge keys in a snapshot survive a save/load cycle (spec §5
      forward-compat holds per scene)
- [x] Unit tests at the store/format layer; one `.iwft` for
      save-load-restores-notes through the UI (pragmatic split)
