# 0025 — boop: the versioned boop save format

- **Status:** Accepted
- **Date:** 2026-08-05
- **Related:** [ADR 0008](0008-apps-without-a-database.md) (boop is stateless —
  everything persistent is `localStorage`), [ADR 0024](0024-boop-sequencer-engine-seam.md)
  (the `SequencerEngine` contract this format serialises), the spec's
  "Persistence" and "Sharing & export" sections
  ([`.scratch/music-app/spec.md`](../../.scratch/music-app/spec.md)).
  Implements ticket 19; consumed by tickets 20 (My boops) and 21 (share links).
  Terminology updated by ticket 35 ("groove" → "boop"; see note below) — the
  shape and this ADR's decisions are unchanged.

> **Ticket 35 note:** this format shipped under the name "groove"; the concept
> is now called "boop" everywhere except the bytes already on disk. The
> `boop:save` key, the document's `version`/`working`/`creations` fields, and
> the `#g=` share-link prefix (ADR 0026) are frozen — every save and every link
> already out there depends on them. `StoredCreation` (the TS type) is renamed
> `StoredBoop`; `creations` keeps its name as the field, holding `StoredBoop[]`.

## Context

Autosave is the first thing to write boop's state down, but two later features
read the same shape: "My boops" (a named list a child saves into) and the
URL-hash share codec (the whole boop in a link, no server). The spec also
names pattern chaining — several patterns per boop — as the confirmed V2
direction. Picking the shape once, here, is what stops V2 needing a migration
and stops the share link inventing a second encoding.

## Decision

1. **One versioned document, one key.** Everything boop stores lives under the
   single `localStorage` key `boop:save` as
   `{ version, working, creations }`. The version lives *inside* the document,
   not in the key, because the share codec carries the same version with no key
   to hang it on. `SAVE_FORMAT_VERSION` is bumped only for a breaking change.
2. **The boop is the unit.** A boop is
   `{ name, kitId, tempo, patterns: [...] }` — V1 always writes exactly one
   pattern, and V2 chaining appends to that array. Tempo and kit belong to the
   boop, not the pattern, because a chained song plays at one tempo on one
   kit. Boops have no id: the list is index-addressed, as
   `apps/karesansui`'s presets already are.
3. **The working grid is a slot, not a list entry.** `working` holds the
   autosaved grid (an unnamed boop); `creations` is the saved list. Keeping
   them separate means autosaving cannot disturb a saved boop, and saving into
   "My boops" is a copy of `working` with a name.
4. **A pattern is an object, rows are bitstrings.** `{ rows: [{ instrumentId,
   steps: "1000100010001000" }] }`. The object wrapper leaves room for
   per-pattern V2 fields (repeats, a name); the 16-character bitstring keeps a
   boop at a couple of hundred bytes, which matters for a share link that
   has to survive being pasted into a message. Rows carry their `instrumentId`
   rather than relying on position, so a kit that gains, loses or reorders an
   instrument still loads — unknown ids are dropped, absent rows come back
   empty, per the "nothing outside the manifest enumerates instrument ids" rule.
5. **Decode is total, and strict.** `parseSaveDocument` never throws: missing,
   unparseable, mistyped, or future-versioned input returns `EMPTY_DOCUMENT` and
   the child gets an empty grid. Within a document, validation is all-or-nothing
   — one malformed boop discards the document rather than leaving a
   half-decoded list to be reasoned about later.
6. **Autosave is a lull, a ceiling, and a flush.** Writes wait 2 s of quiet
   (Groove Pizza's reference — an external product, unrelated to this app's
   own pre-rename name) so drag-painting a row is one write; a burst that
   never lulls is written anyway every 10 s, so a crash or a killed tab costs
   seconds rather than a whole session; and `pagehide` / `visibilitychange`
   flush anything pending, so closing the tab cannot lose the last edit.
7. **Restore is a handshake, not an effect-ordering trick.** `useWorkingGrid`
   returns whether the autosave has been consulted, and the page waits for that
   before mirroring engine state into React. Otherwise the mirror would capture
   the empty pre-restore grid and autosave would write it back over the save.
   The first mirror after a restore is also skipped — reading state is not an
   edit, so an untouched visit writes nothing.

## Consequences

- Ticket 20 adds "My boops" by writing the `creations` array — no format
  change, no migration. Ticket 21 encodes a `StoredBoop` (not a document)
  into the URL fragment and reuses `decodeStoredBoop`'s defensiveness.
- V2 pattern chaining is additive: more entries in `patterns`.
- A corrupt document costs the child their whole saved list, not just the bad
  entry. Accepted: the data is small, written by us alone, and the alternative
  (partial recovery) is more code and more states to test than the risk earns.
- Adding a *non-breaking* field later means an older build reading a newer
  document rejects it wholesale (strict decode). Acceptable while boop is a
  single self-hosted app; if that changes, relax unknown-field handling before
  relaxing the version check.
