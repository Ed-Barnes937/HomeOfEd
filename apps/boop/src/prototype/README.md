# PROTOTYPE — the phone screenspace question

**Throwaway.** This whole folder, plus the block marked `PROTOTYPE (screenspace)`
in `pages/HomePage.tsx`, comes out once a variant wins.

## The question

At phone widths the grid well and the phone song bar are both permanently on
screen and both permanently squeezed. ADR 0030 and boop-loops ticket 23 have
already pushed the "both visible, both shrink" model to its end: the grid has a
three-rows-plus-loop-map floor, the phone song bar has a `max-height`, and below
505px of viewport height the fixed frame is abandoned entirely and the page
scrolls. That exception is the tell — there is no arrangement left that keeps
both play buttons reachable while both surfaces are up.

**Does showing one surface at a time solve it, and which shape does a 6-year-old
follow?**

## The variants

Four variants on the existing `/` route, switchable via `?variant=`, at
**every width** — phone (<1024), tablet (1024–1279) and laptop (>=1280).

| Key | Name | Shape |
|---|---|---|
| `now` (default) | Shipped layout — the control | Grid well and song bar stacked, exactly as it ships |
| `song-dialog` | Grid on the frame, song in a dialog | The grid owns the frame; the arrangement opens as a card |
| `clip-dialog` | Song on the frame, grid in a dialog | The arrangement owns the frame; the grid opens as a card |
| `tabs` | Clip / Song tabs | A CLIP / SONG segmented control under the chrome. One surface at a time, no overlay, no second bar |

**The two dialog variants are the same mechanism pointed opposite ways**, and
that is the point: which surface deserves the screen, and which can afford to
be behind a tap? The song is already the less discoverable half, so hiding it
(`song-dialog`) may make a real problem worse, while hiding the grid
(`clip-dialog`) makes the arrangement the home a child lands on and the grid
the focused thing they open. `tabs` hides the song *hardest* — it is behind a
tab with no standing presence at all.

Either dialog variant keeps a **one-line launcher** in the dock for whatever it
hid: that surface's play button, its name, and a labelled way back in. In
`clip-dialog` a tap on any clip chip in the song bar also opens the editor,
which is the natural route in.

Both new variants share `PrototypeFrame.tsx`, which mirrors HomePage's
three-section frame *minus* every compromise above — no grid floor, no dock cap,
no short-window exception — because a layout that shows one surface at a time
should not need them. Whether it really doesn't is part of what the prototype
is checking.

The components inside are the **shipped** ones, rehoused rather than rewritten,
so what you are judging is the arrangement and not a redraw. HomePage picks the
cast for the width and hands it over as slots:

| Slot | <1024 | >=1024 |
|---|---|---|
| chrome | `PhoneBar` | `TopBar` |
| clipHeader | `ClipHeader` (slimmed by CSS) | `ClipHeader` with the playhead readout |
| grid | `PhoneGrid` | `Grid` + its `ClipControl` well footer |
| songBar | `PhoneSongBar` | `SongBar` |
| transport | `Transport` | **none** — the laptop has no transport; clip play is in `ClipControl` and tempo is `SongBar`'s Speed |

That last row is what makes the two widths behave differently, and it is the
thing to argue with. See the rough edges below.

## Running it

```
pnpm --filter boop run dev
```

Then, at any width:

- http://localhost:3008/ — `now`, the control
- http://localhost:3008/?variant=song-dialog
- http://localhost:3008/?variant=clip-dialog
- http://localhost:3008/?variant=tabs

The magenta bar at the bottom cycles variants — `Alt` + left/right arrow also
work. Alt, not bare arrows: the grid, the loop map and both scrub strips own
the arrow keys for real behaviour. It shows the live measurements the question
is about: grid scroller height, visible song surface height, viewport. It is
hidden in production builds.

## Known rough edges — deliberate, not oversights

**Where Speed ends up is the open question at >=1024**, because the laptop has
no transport to park it in. Both variants have to answer it and both answers
are arguable:

- **`tabs` at >=1024 puts Speed in the SONG tab only** — it rides inside
  `SongBar`'s header. So you cannot change the tempo while editing a clip
  without switching tabs, which is a real regression for a toy where tempo is
  half the fun. Below 1024 the transport stays in both tabs and the problem
  does not arise.
- **`song-dialog` at >=1024 puts Speed inside the song card.** Same cost, plus
  the card has to be open to reach it. The dock's launcher row could grow a
  Speed slider instead — the prototype doesn't, because that means recreating
  `SongBar`'s slider markup for a throwaway.
- **`clip-dialog` does not have this problem at all.** The song bar is the home
  surface, so Speed is always on screen. It is the only variant that keeps
  every shared control permanently reachable at >=1024.
- **Each dialog variant shows its hidden surface's play button twice** while
  the card is open — once on the launcher, once inside the card. The real
  version drops one.
- **`clip-dialog`'s editor is controlled from HomePage**, not the frame, so a
  clip-chip tap can open it. `song-dialog`'s card keeps its state inside the
  frame. That asymmetry is wiring convenience, not a design position.
- No tests, no `.iwft`, and the variant is not routed through TanStack Router's
  search params (that would be a production change).

## Verdict (2026-08-25)

**`clip-dialog` wins.** The song is the less discoverable half, so it is the
half that stays on the frame. Recorded, with the reasoning and the two notes
the implementation must honour, in
[`.scratch/boop-screenspace/spec.md`](../../../../.scratch/boop-screenspace/spec.md).

## When it's done

Fold the winner into the real layout properly (it will want an ADR — this
overturns ADR 0030's "both bars are always visible" and probably retires the
505px exception). Then commit this folder to a throwaway branch, note the
verdict and the branch on the ticket, and delete it from main.
