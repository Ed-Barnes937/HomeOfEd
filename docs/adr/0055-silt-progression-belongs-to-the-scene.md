# 0055 - silt: field-note progression belongs to the scene

- **Status:** Accepted (2026-09-06, landed with
  `.scratch/silt-discovery-tree/issues/28-per-scene-progression.md`)
- **Date:** 2026-09-06
- **Related:** `.scratch/silt-discovery-tree/spec.md` §5 (amended by this
  change: progression was deliberately global);
  [ADR 0029](0029-silt-scene-persistence.md) for the envelope the snapshot
  rides in; [ADR 0048](0048-silt-discovery-witness-in-the-sim-core.md) for the
  witness recorder, which this change does not touch. Implemented in
  `apps/silt/src/features/scenes/sceneCodec.ts` (`SceneFieldNotes`),
  `fieldNotesStore.ts` (`replace`) and `useMoments.ts` (the generation).

## Context

Field-note progression was one global localStorage key by design (spec §5):
loading a scene changed the world but kept whatever progression the browser had
accumulated across all scenes. A user bug report (2026-09-06) found that
surprising, and Ed ruled: for now, progression belongs to the scene. A future
global-account layer (`.scratch/account-layer/`) may revisit this; nothing here
builds for that future.

## Decision

1. **The snapshot rides in the scene envelope**, as an optional `fieldNotes`
   field - never a parallel `silt:fieldNotes:<id>` key. The scene stays
   self-contained, saves stay atomic, and `sceneStore`'s orphan cleanup does
   not grow a third prefix. `sceneStore` keeps treating the envelope as opaque
   JSON: the change lives in `sceneCodec`, which declares the shape
   structurally so scenes still import nothing from fieldNotes.
2. **The live key is the working progression.** Save snapshots it into the
   scene; load `replace`s it with the scene's snapshot, wholesale, never a
   merge. "Forget discoveries" clears the working progression only; a
   subsequent save persists the cleared state into that scene.
3. **Strict per-scene semantics, no migration** (Ed, 2026-09-06). A scene saved
   before this change has no snapshot and loads exactly as an empty one -
   clearing the notes. The pre-existing global blob simply continues as the
   working progression until a load replaces it. No version bump: the field's
   absence already means the right thing.
4. **A load is an arrival, not a witness.** The moment cards are a diff of two
   views, and a load can add edges - so `useFieldNotes` counts a `generation`
   that `replace` advances, and `useMoments` resynchronises its baseline when
   it moves instead of diffing across it. The 100% line follows the same rule
   as a page that boots complete (`resyncCompletion`): a loaded-complete chart
   had its moment wherever it was earned. The sim-side witness recorder was
   untouched by this change: within a session it never re-reported what it had
   seen, whatever the working progression said (ADR 0048).

   **Amended by discovery ticket 32** (2026-09-06): that last sentence was the
   bug. A snapshot can be *emptier* than the chart it replaces - a scene saved
   before snapshots existed is the extreme case - so a load can drop an entry
   the session has already reported, and the recorder went on swallowing the
   re-earn until a reload (ticket 30). The load now sends the resync ticket 31
   built, carrying the snapshot's edges, in the same breath as the `replace`
   and after it. It is still not a witness: the resync tells the sim what the
   page knows and raises nothing, so a *fuller* scene stays as quiet as this
   point's generation rule already made it.

## Consequences

- Saving a scene and loading it on a fresh profile restores its field notes,
  edges and NEW-chip watermark alike; loading A then B shows B's progression.
- An empty working progression is still "no key": `replace` with an empty
  snapshot removes the key exactly as `reset` does, so no blob ever claims a
  player who has witnessed nothing.
- Unknown edge keys ride through a scene's snapshot untouched - spec §5's
  forward compatibility now holds per scene - and a malformed snapshot reads
  as empty with a warning, never failing the world that carries it.
