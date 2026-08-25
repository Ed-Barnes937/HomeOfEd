# 0031 — boop reports "is this in My boops?", never "you have unsaved work"

- **Status:** Accepted
- **Date:** 2026-08-09
- **Related:** [ADR 0025](0025-boop-save-format.md) (the working grid vs the
  saved list, which is what makes this question answerable at all), the design
  handoff ([`docs/reference/boop-design/README.md`](../reference/boop-design/README.md),
  §1 "Top bar", §3 "Main screen — small phone" and §4 "My boops", all amended).
  Implements ticket 31.

## Context

Ed's V1.1 feedback was that it isn't obvious whether a boop has been saved.
The obvious reading — "warn me before I lose work" — does not apply to boop.
ADR 0025 gives the app two kinds of saving: the **working grid**, autosaved
after a 2s lull and flushed on `pagehide`, and a **saved boop**, a named copy
in "My boops". The working grid is never lost. So an indicator that said
"unsaved" would be describing a risk that does not exist.

There is a real question underneath it, though, and it is narrower: *is this
grid a row in My boops, or has it drifted from the row it came from?*

## Decision

### 1. The indicator answers only that question

Three renderings of two states: `Boop 3` while the grid still matches the
saved boop it was loaded from, `Boop 3 • edited` once it has diverged, and
`Not saved yet` when the grid is not a row in the list at all. Desktop gets
the words, after the wordmark and before the spacer, at half ink — quiet
chrome, not a status bar. The phone's 52px strip has no horizontal room for
them, so it gets a dot on the save icon instead: filled when unsaved, hollow
when saved. The save icon is the one spot in the phone chrome that already
means "saving".

### 2. There is no `beforeunload` guard, and never will be

The browser's own confirm text is unreadable to a 6-year-old, and it would be
warning about nothing: the working grid is already flushed on `pagehide`. A
whole-frontend test asserts the absence, covering both the listener and the
legacy `window.onbeforeunload` property — the constraint is easier to
re-introduce by accident than to notice.

### 3. One definition of "changed" for the whole app: a cell toggle *or* a tempo move

Tempo is part of a saved boop, so a boop whose tempo you moved genuinely
differs from the one on disk. This **reverses** the starter-ring rule ticket 36
documented, where `activePreset` deliberately survived a tempo change on the
argument that nudging the tempo doesn't stop it being the boop you picked.
That argument is defensible in isolation, but keeping it would leave the app
with two definitions of "changed" a few lines apart — and the one the child
sees would be the one that disagrees with the indicator. The exemption is
removed rather than left alongside.

### 4. Identity is the boop's row, and it is session-only

A `StoredBoop` has no id (ADR 0025), so the loaded boop is `{ index, name,
edited }` keyed on its position in the list. That makes every mutation of
"My boops" a transition the identity has to follow: a save adopts it, a rename
keeps it, deleting it ends it, deleting a row above it shifts it up one. Those
transitions are pure functions in `apps/boop/src/savedState.ts`, unit-tested,
rather than arithmetic spread through the dialog.

It is **not** restored on reload. The indicator describes this session's
loading and saving, not what is on disk — the autosave already guarantees the
grid comes back, and reading `Boop 3` after a reload would claim a relationship
the app has not actually tracked.

### 5. Starters get no identity

Loading a starter reads `Not saved yet`, the same as a blank grid: a starter is
never a row in "My boops" either. Which starter is loaded stays a concern of
the "New boop" dialog's card ring (ticket 36) and never reaches the main screen.

## Consequences

- Keying on the row is the part that will break first. It is safe today because
  `BoopsPanel` is the only thing that mutates the list; a second mutation site,
  or any reordering of "My boops", has to go through the same transitions or
  the ring lands on the wrong boop. Giving `StoredBoop` a real id would end the
  problem, at the cost of a save-format change ADR 0025 does not otherwise need.
- Ticket 32's just-saved highlight and this ring are the same cyan from handoff
  §4, deliberately: one means "that press landed", the other "this is the one
  you are playing". The ring carries no animation, because it is a standing
  fact rather than an event.
- The indicator has no "Saved today"-style meta, and should not grow one. It
  answers one question; a second line would turn it into the status bar the
  design rules out.

## Amendment (2026-08-13): "changed" grows to "any mutation of the song"

The clip-lanes feature (the boop-loops map,
[The "edited" definition grows](../../.scratch/boop-loops/issues/08-edited-definition.md))
gives a boop more ways to mutate than a cell toggle or a tempo move. The single
definition grows to cover them all: a cell toggle, a speed (tempo) change, a
placement change, a clip add, a clip delete, a clip rename, and a lane reorder
all count as "edited". The principle of decision 3 is unchanged — there is
exactly one app-wide definition, and it is "any mutation of the song".

One adjacent change from the same map
([Starters and New boop vs clips](../../.scratch/boop-loops/issues/07-starters-and-new-boop.md)):
"Clear grid" becomes clip-scoped and is an *edit* under this definition — it no
longer drops the loaded boop. Decision 5's starters are retired in favour of
sample clips, which likewise get no identity.
