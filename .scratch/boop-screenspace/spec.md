# boop screenspace — the two containers stop competing

**Status:** direction chosen and specified (2026-08-25). Tickets in
[`issues/`](issues/) — ready for implementation.

## The problem

The grid well and the song bar are both permanently on screen and both
permanently squeezed. ADR 0030 and boop-loops ticket 23 pushed the "both
visible, both shrink" model to its end: the phone grid has a
three-rows-plus-loop-map floor, the phone song bar has a `max-height`, the
laptop dock is capped at `max(32dvh, 100px)`, and below 505px of viewport
height the fixed frame is abandoned entirely and the page scrolls. That last
exception is the tell — there is no arrangement left that keeps both play
buttons reachable while both surfaces are up.

## What was tried

A throwaway UI prototype, four variants on the real `/` route at every width
(`apps/boop/src/prototype/`, `?variant=`):

| Key | On the frame | Behind a tap |
|---|---|---|
| `now` | both, both squeezed | — |
| `song-dialog` | grid | song |
| `clip-dialog` | **song** | **grid** |
| `tabs` | one at a time | the other, no standing presence |

**The prototype is captured, not lost.** All four variants and the switcher live
on the throwaway branch **`boop-screenspace-prototype`** (`ec2a461`), branched
off `boop-screenspace`. It is not for merge — it exists so the losing variants
stay readable, because they are what make the winner's reasoning legible later.
Nothing on the implementation chain carries it.

```
git show boop-screenspace-prototype:apps/boop/src/prototype/PrototypeFrame.tsx
```

## Decision — `clip-dialog` (2026-08-25, owner)

**The song bar is the home surface. The grid opens as a card.**

The song is already the less discoverable half of the app, so hiding it makes a
real problem worse. `tabs` hides it hardest — behind a tab, with no standing
presence at all — and was rejected for exactly that. `song-dialog` is the same
mistake in a softer form.

Pointing the dialog the other way puts the arrangement in front of the child by
default and makes the grid the focused thing they choose to open. Two routes
in: a tap on any clip chip, and a labelled launcher in the dock.

Supporting measurements from the prototype (grid scroller height):

| Variant | Phone 390x844 | Tablet 1100x800 | Laptop 1440x900 |
|---|---|---|---|
| `now` | 327px | 323px | 385px |
| one-surface variants | 332px | 388px | 439px |

`clip-dialog` is also the only variant that keeps every shared control
permanently reachable at >=1024: Speed lives in `SongBar`'s header, and that
header is now always on screen.

## Notes the implementation must honour

### 1. Adding a clip must not start playback

`HomePage.tsx`'s `pickClip` currently ends with:

```ts
const landed = addClipToSong(() => samplePattern(kit, sample.rows), sample.label)
if (landed && !engine.isPlaying()) void engine.start()
```

Picking a sample clip from "+ New clip" auto-starts the clip loop. That must
go. Adding a clip is an edit, not a transport command — the child decides when
sound happens. (Blank clips already don't auto-play; only the sample-clip path
does, so the two paths are currently inconsistent as well.)

### 2. No second pinned bar under the launcher

On the phone the dock was stacking the clip launcher over `Transport`, and both
led with clip play — two identical play buttons, one above the other. Only the
launcher survives: it also names the clip and is the way back into the grid.

Applied in the prototype already.

### 3. Phone Speed moves into the song bar's header

**Settled 2026-08-25 (owner).** Note 2 leaves Speed homeless: it lives in
`Transport`, and `PhoneSongBar` has none of its own, so removing the transport
would remove the tempo control at phone widths.

Speed moves into **`PhoneSongBar`'s header, beside song play** — exactly where
the laptop's `SongBar` already puts it. The two widths finally agree, the
control has one home instead of two, and in this variant the song bar is on
screen at every width so Speed is always reachable.

Rejected: inside the clip editor card (tempo is song-wide, not clip-scoped, and
it would read as a property of the clip); the "..." menu (buries a control that
is half the fun of the toy).

Its own ticket ([02](issues/02-speed-into-the-song-bar-header.md)) and it lands
**first**, on the current layout, so the move is reviewable before the frame
changes underneath it.

## The tickets

| # | Ticket | Blocked by |
|---|---|---|
| 01 | [Adding a clip must not start playback](issues/01-no-autoplay-on-add-clip.md) | — |
| 02 | [Speed moves into the song bar's header](issues/02-speed-into-the-song-bar-header.md) | — |
| 03 | [The song bar becomes the home surface](issues/03-song-bar-is-the-home-surface.md) | 02 |
| 04 | [Retire the two-surface compromises, write the ADR](issues/04-retire-the-two-surface-compromises.md) | 03 |
| 05 | [Capture the prototype, keep it off main](issues/05-capture-and-delete-the-prototype.md) | — — **done** |

01 and 02 are both unblocked and independent of each other.

## What this overturns

ADR 0030 says both bars are always visible and the grid absorbs the squeeze.
That is no longer true, so this needs its own ADR. Likely retired with it: the
phone's three-row grid floor, the laptop dock's `max(32dvh, 100px)` cap, and
the 505px short-window page-scroll exception — all three exist only to hold two
surfaces at once.

**The prototype is not the implementation.** It was written under prototype
rules (no tests, minimal error handling, components rehoused not rewritten).
Rebuild the winner properly — the branch above is a reference, never a source
to copy from.
