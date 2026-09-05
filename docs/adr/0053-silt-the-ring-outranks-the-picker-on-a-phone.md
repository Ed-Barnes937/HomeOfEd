# 0053 - silt: the ring outranks the picker on a phone, and no child of `.app` sizes the document

- **Status:** accepted
- **Date:** 2026-09-05
- **Context:** ticket 26 (`.scratch/silt-discovery-tree/issues/26-viewport-meta-harness-lie.md`)
- **Supersedes:** nothing. Refines
  [0052](0052-silt-the-reading-line.md) and ticket 21's ring sizing.

## Context

`apps/silt/playwright/index.html` had neither a doctype nor a viewport meta, so
every mobile-project `.iwft` rendered in quirks mode at Chromium's 980px
fallback and merely *looked* like a phone. Fixing the harness turned three
layout bugs from invisible into failing tests, and answering them needed two
calls that are policy rather than mechanics.

## Decision

### 1. No child of `.app` may size the document

`.app` is a grid, and a grid item's automatic minimum is its **min-content**, so
the widest child sets the column and the column sets the document. The silt
header - the one row of chrome that can neither scroll nor wrap - had a
min-content of 451px (458px once the field-notes chip carries a two-digit
count). Against a 390px viewport that pushed the whole page sideways by **69px**
behind the bottom bar and **76px** behind the field-notes sheet, dragging the
world canvas off the glass with it.

**Every full-width child of `.app` carries `min-width: 0`**, and each such row
nominates one elastic child that gives. For the header that is the scene name,
which already ellipsizes; the title and the buttons on their 44px touch floor
hold their size. `.stage` had carried this rule since the app was built; the
header simply never did.

The rejected alternative was to let the rail or the header scroll sideways. A
control the player has to find by scrolling a header is a control they do not
find - the same argument ticket 22 made about the ring key.

### 2. On a phone, the ring outranks the picker

The field-notes sheet stacks a wrapped picker over the ring. In an `auto` grid
row the picker took every row the roster asked for - **231px of an 844px
sheet** - which pinned the ring to its 340px `RING_MIN_PX` floor and, on a
shorter phone, left it 13px of room in which to draw 340px.

**The ring is what the panel is for**, so the picker takes a fixed share of the
glass (`$picker-max-share`, 18dvh, with a `$picker-min` of 64px so one 48px tile
row stays whole) and scrolls past it - exactly as its desktop column already
does. The ring then gets what is left, and on a 390x844 phone it is width-bound
at 380px rather than floored at 340px.

The rejected alternative was shrinking the ring's floor. The floor is not
cosmetic: below it the ring's fixed-pixel tiles overlap and the capacity that
decides when spokes group becomes a lie (`ringGeometry`).

## Consequences

- A new full-width row under `.app` that forgets `min-width: 0` reintroduces the
  bug silently on desktop and visibly on a phone. `verifyNoHorizontalPageOverflow`
  at a true 390px is the guard, and it is only honest because the harness now
  matches the app.
- **The harness and the app share a head and a stylesheet.** `playwright/index.html`
  carries the app's doctype and meta, and `playwright/index.ts` imports the same
  `src/global.scss`. A style or a tag one loads and the other does not is a
  harness that lays out differently from the app.
- Two mobile assertions had been calibrated against the 980px fallback and were
  re-measured, not relaxed: the height-bound-but-above-the-floor case moved from
  390x480 to 390x810, and the below-the-floor case from 390x200 (smaller than
  the panel's own 244px of chrome) to 390x480.
- **Every other app has the same harness gap** -
  `apps/{boop,boids,espy,fridge,hub,karesansui,sprout,wotd}/playwright/index.html`
  and `templates/starter/playwright/index.html`. Out of scope for ticket 26 and
  worth its own; the starter is the one that stops it reaching the next app.
