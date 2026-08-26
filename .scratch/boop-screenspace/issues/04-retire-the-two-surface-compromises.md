# Retire the compromises that held two surfaces at once, and write the ADR

Type: task
Status: ready-for-agent

**Blocked by:** 03

## What to remove

Every one of these exists only because the grid and the song bar had to share
the screen. Once ticket 03 lands they are protecting nothing, and left in place
they will quietly distort the new layout:

- **The phone grid floor** — `PhoneGrid.module.scss`'s `$grid-floor` /
  `$floor-rows` `min-height` on `.well`, and its `max-height` twin under
  `@media (max-height: 504px)`.
- **The laptop dock cap** — `HomePage.module.scss`'s
  `max-height: max(32dvh, 100px)` on `.transportDock`, and the `flex: 0 1 auto`
  / `min-height: 0` that go with it.
- **The 505px short-window exception** — the `short-window` mixin and every
  block inside it. boop can be a fixed frame at every height again, which was
  always the intent; 505 was the height at which no arrangement could keep both
  play buttons clear, and there is only one surface now.

Remove them **with their tests**, replacing each with a test of the new
promise rather than dropping the coverage. `playBarPinned.iwft.tsx`'s 504/505
pair is the obvious one: it pins a boundary that will no longer exist.

## Why it is its own ticket

Ticket 03 is the arrangement. This is the cleanup that the arrangement makes
possible, and it touches a different set of files and a different set of tests.
Keeping them apart keeps both diffs reviewable — and if the cleanup turns up
something the arrangement actually still needs, that is a finding worth seeing
on its own rather than buried in a large diff.

**Do not assume all three go.** Verify each by removing it and measuring. The
prototype showed the phone grid gains only ~5px from the freed space (its rows
are a fixed 44px and its real constraint is horizontal), so a floor there may
still earn its keep for a different reason than the one it was written for. If
one survives, say why in the ADR.

## The ADR

ADR 0030 says both bars are always visible and the grid absorbs the squeeze.
That is no longer true, so this needs a new ADR superseding it — MADR-lite in
`docs/adr/NNNN-title.md`, per the repo's convention.

It must record:

- The decision: the song bar is the home surface, the grid opens as a card.
- Why the song was the half that stayed (discoverability — see
  [`../spec.md`](../spec.md) for the reasoning and the measurements).
- Which compromises were retired and which, if any, survived and why.
- Where the laptop playhead readout ended up (ticket 03 decides it).

Update `apps/boop/CLAUDE.md`'s Layout and Rules sections to match — several
rules there quote the retired numbers verbatim.

## Verify

- `pnpm --filter boop run lint | typecheck | test` all green.
- No orphaned SCSS variables or mixins left behind by the removals.
- A short window (e.g. 390x460) and a short laptop (1280x600) both still reach
  every control without the page scrolling.
