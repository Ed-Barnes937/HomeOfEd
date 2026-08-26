# apps/boop — scoped rules

A kid-friendly (6+) music toy at `boop.homeofed.com`: a 6-instrument x 16-step
step-sequencer, music-first (no reactive visual layer in V1). The grid always
edits one **clip**; clips arrange into a **song** on the lane grid (the
boop-loops effort — spec: [`.scratch/boop-loops/spec.md`](../../.scratch/boop-loops/spec.md)).
Original product spec: [`.scratch/music-app/spec.md`](../../.scratch/music-app/spec.md).
Visual references: [`docs/reference/boop-design/README.md`](../../docs/reference/boop-design/README.md)
(the main screen) and
[`docs/reference/design_handoff_clip_lanes/README.md`](../../docs/reference/design_handoff_clip_lanes/README.md)
(the ≥1280px clip-lanes frame) — high-fidelity handoffs; read them before
touching anything visual: colours, type, spacing, radii, shadows and grid
geometry are final and exact.
Domain vocabulary: [`CONTEXT.md`](CONTEXT.md).

**Stateless** ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)) —
copy base is `templates/starter`. The working grid, tempo, and saved boops
("My boops") persist to `localStorage`. Sharing a boop is URL-hash encoded,
no server and no store ([ADR 0026](../../docs/adr/0026-boop-share-links.md)); a
server-backed short link stays a possible later addition, modelled on
`apps/fridge`'s `board.share`/`board.get` handlers.

The `SequencerEngine` and the launch kit manifest have landed (ticket 12) —
Tone.js behind a TypeScript interface, no `packages/*` extraction (the spec is
explicit this stays in-app). The grid, the play buttons and the working-grid
autosave now consume it; "My boops" and share links are later tickets.

## Layout

```
src/
  engine/           the SequencerEngine: contract, implementation, kit manifest
    sequencerEngine.ts   the interface + payload types (no Tone.js in here)
    createSequencerEngine.ts  the implementation: ticks, hits, songPos, events
    audioDriver.ts    the seam to the audio library
    toneAudioDriver.ts  the only file importing Tone.js
    kitManifest.ts    manifest parse/load (kits are pure data)
    testing/fakeAudioDriver.ts  hand-cranked clock the contract tests use
  server/           the app's backend (runs in Node for dev/prod, in-browser for .iwft)
    handlers/       Handler classes — business logic, AppContext only, no Store
    router.ts       tRPC router; createTRPC<void>() (no Store); exports AppRouter
    simulator.ts    backendSimulator wiring: real router, no Store, no PGlite
    main.ts         prod entrypoint: createAppServer + shallow /health
    greeting.test.ts  Vitest unit — placeholder handler exercised over the auth seam
  persistence/      the save format + autosave (ADR 0025) — no React except the hook
    saveFormat.ts     pure: the versioned save document, encode/parse (total decode)
    storage.ts        the localStorage seam; never throws
    autosave.ts       debounced (2 s lull) writer of the working song
    useWorkingSong.ts hook: restore the whole song on mount, autosave on edit,
                      flush on pagehide, and seed a first visit (tickets 36/17)
  song/             the working-song domain (ticket 14) — pure, no React
    song.ts           Song/Clip types, StoredBoop↔Song conversions, and the
                      mutation kinds (placement, add/delete/rename clip, lane
                      reorder) later tickets wire to UI
    songConductor.ts  song playback (ticket 16): the ~30-line layer above the
                      SequencerEngine seam — swap at step 15 on onBeat, the
                      sounding position advances on onDrawBeat
    songTimeline.ts   the global-bar axis (boop-playhead ticket 02): which
                      positions are placed, global bar ↔ (position, bar) ↔
                      tick, clamping, and the snap both scrub strips need
    songScrub.ts      what a scrub does, and only that (ticket 04): a seek
                      through the conductor or the engine, no edit and no stop
  export/           WAV export: offline render → PCM mix → WAV encode, plus the
                    share-sheet/download action and the slugged filename. Pure
                    but for `sampleDecoder.ts`, the AudioContext seam.
  share/            URL-hash share links (ADR 0026) — pure, no server
    shareLink.ts      encode/decode a creation to `#g=<base64url>`; total decode
    shareAction.ts    share sheet vs clipboard, behind an injected ShareTarget
  features/grid/    the grid well. Two renderers, one behaviour:
                    Grid.tsx      laptop/tablet — the full 6x16 laid out flat
                    PhoneGrid.tsx <1024px — pinned rail + snap-scrolling step
                                  window + the "WHOLE LOOP" map (ticket 27),
                                  which is also the phone's clip scrubber
                                  (boop-playhead ticket 06)
                    phoneWindow.ts / loopMap.ts  pure geometry + tick derivation
                    useDragPaint.ts  latched drag-paint, shared by both
  features/boops/   BoopsPanel.tsx — the "My boops" dialog: the always-on save
                    form (ticket 32), the list, per-row load/rename/delete/export
  features/clips/   the clip chrome (boop-loops tickets 15/20/21, rehoused by
                    screenspace ticket 03):
                    ClipEditorCard.tsx — the dialog the grid opens in, over the
                    song bar; ClipLauncher.tsx — the dock's one row (clip play,
                    the tint dot, the clip's name, "Edit");
                    ClipHeader.tsx (tint dot, inline rename, copy, delete — the
                    card's first row at every width; ≤1023px slims it with CSS),
                    ClipControl.tsx (Play this clip inside the grid well at
                    every width, plus clip-scoped Clear grid at ≥1024 only),
                    clipTints.ts (the fixed 5-tint list)
  features/songbar/ SongBar.tsx — the song bar (≥1024, tickets 15/20; the
                    tablet band shrinks the lane grid to fit). The home surface
                    since screenspace ticket 03, in the scrolling region: a
                    header row carrying the song play button (wired to the
                    songConductor, ticket 16), the playhead readout and Speed
                    (the old tempo slider), then the lane grid below it —
                    chips (tap-to-select and open the editor, drag-to-reorder
                    via useChipDrag.ts, ticket 18), placement squares
                    (drag-paint + the grid's keyboard model), "+ New clip".
                    PhoneSongBar.tsx — the phone song bar (≤1023px, ticket 21,
                    variant B): the home surface in the scrolling region since
                    screenspace ticket 03, on the step window's exact geometry
                    (which the grid still matches inside its card), compact chips +
                    "+ New" in a pinned 92px column, snap-scrolling lane strip
                    under PhoneGrid's paint-vs-scroll rules; its header
                    carries Speed too (screenspace ticket 02 — the one home
                    for the control at every width); clip play is the clip
                    launcher's, in the dock. The non-scrolling
                    "WHOLE SONG" band above the lanes is the phone's song
                    scrubber (boop-playhead ticket 06)
  features/playhead/ the scrub strips' shared parts (boop-playhead ticket 05):
                    scrubGeometry.ts (which drawn segment a pointer is over —
                    pure), useScrubDrag.ts (the pointer-capture gesture both
                    strips hang off, deliberately not useDragPaint), and
                    songPlayhead.ts (the one view shape the strips, the ruler
                    and the readout all read)
  features/picker/  the "+ New clip" picker (ticket 17, replacing the retired
                    starters): NewClipPicker.tsx (the paper-card dialog —
                    Blank first, then the sample clips), sampleClips.ts (the
                    eight-clip roster + the first-visit seed, pure data), and
                    PatternThumbnail.tsx (the dot-matrix preview, shared with
                    "My boops")
  features/topbar/  TopBar.tsx (desktop, incl. the plain New boop reset) and
                    PhoneBar.tsx (the 52px strip + "⋯" menu); `useIsPhone.ts`
                    (at src/) picks the layout: ≥1024 is clip-lanes (the
                    tablet band 1024–1279 shrinks the lane grid via CSS,
                    ticket 20), <1024 is the phone
  pages/            HomePage — the whole app as a fixed frame at every height
                    (ADR 0030, narrowed by ADR 0035): pinned chrome, the
                    scrolling region (the song bar, the home surface), the
                    pinned dock (the clip launcher); the grid opens as a card
                    over the top. No height-keyed exception, no dock cap
  styles/tokens.scss  design tokens from the handoff (stage/well/ink/instrument
                      hues, radii, shadows) + self-hosted Chivo / Chivo Mono
  testing/          IwftApp harness (in-browser backend) + iwft fixture + page objects
  savedState.ts     pure: the loaded boop, its label, and the transitions a
                    save/rename/delete/edit puts it through (ADR 0031)
  *.iwft.tsx        whole-frontend suites via the in-browser backend
public/fonts/       self-hosted Chivo + Chivo Mono (latin-subset variable woff2)
public/kits/launch/ the V1 kit: kit.json manifest, placeholder one-shots and
                    artwork (both replaced by ticket 18)
scripts/            generatePlaceholderSamples.mjs — synthesizes those one-shots
vite.config.ts      react + simulatorPlugin (dev simulator mode)
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3108 })
```

No `schema.ts`, `store.ts`, `migrations/`, `migrate.ts`, or `drizzle.config.ts`,
and no `@hoe/db` dependency — stateless, per ADR 0008. Add them (copy from
`apps/hub`) only if a later ticket needs server persistence beyond the
share-link snapshot.

## Commands

- `pnpm dev --filter=boop` — simulator mode on port **3008** (real router, no
  *server* persistence — the grid still autosaves to `localStorage`; restart to
  pick up server changes).
- `pnpm test --filter=boop` — Vitest (`*.test.ts`) then Playwright CT
  (`*.iwft.tsx`).
- Prod (container): `pnpm build` then `pnpm start` (default port 8080).

## Rules

- Server code changes go through TDD: unit test against the injected seams
  first, `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks
  to erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native
  Node.
- Ports: dev 3008, CT 3108, compose host 8088 — see the registry in
  [docs/how-to/adding-an-app.md](../../docs/how-to/adding-an-app.md#1-create-the-app-both-paths).
- **Styles.** `src/styles/tokens.scss` is the global side-effect stylesheet
  (design tokens as `:root` custom properties + font-faces + the html/body
  reset), imported once from the page component — fridge's pattern. New
  features get SCSS modules organised the same way as `apps/fridge/src/features/*`.
  Recreate the design handoff pixel-close; don't approximate its numbers.
- **Fonts.** Chivo + Chivo Mono are self-hosted in `public/fonts/` (latin-subset
  variable woff2 each) — no runtime Google Fonts, per
  [`docs/reference/fridge-magnets/fonts/FONTS.md`](../../docs/reference/fridge-magnets/fonts/FONTS.md)'s
  house rule and fridge's Fredoka pattern.
- **`SequencerEngine`** ([ADR 0024](../../docs/adr/0024-boop-sequencer-engine-seam.md)).
  The contract lives in `src/engine/sequencerEngine.ts`
  and Tone.js must never leak through it — only `toneAudioDriver.ts` imports
  `tone`, with named imports so the bundle stays tree-shaken. Schedule-time
  beat events are the canonical seam
  (`{ tick, step, audioTime, hits: [{ instrumentId }] }`) and must do no DOM
  work; UI subscribes via `onDrawBeat`. Pattern edits are readable state, not
  an event stream, and audition-on-toggle is the engine's job. Test engine
  behaviour against `FakeAudioDriver`, never a real AudioContext. The engine
  **borrows** its driver: `App` owns the one `AudioDriver` for the life of the
  page, and `engine.dispose()` must never dispose it (ADR 0024, as amended) —
  React's dev double-mount builds two engines over that one driver.
- **Persistence** ([ADR 0025](../../docs/adr/0025-boop-save-format.md), extended
  for songs by [ADR 0032](../../docs/adr/0032-boop-save-format-songs.md)). One
  versioned save document under one `localStorage` key (`boop:save`), holding
  the autosaved working grid and the "My boops" list. A stored boop is a whole
  song: `patterns` is the clip list (≤5, optional `name`/`tint` per clip), plus
  optional `placements` (the 16 positions, comma-separated — each field the
  clips sounding there, so a position can hold several; a comma-less string is
  read in the pre-layering one-clip-per-position form) and `gridClip` — all additive, still
  `SAVE_FORMAT_VERSION` 1, strict all-or-nothing decode. Anything that persists
  or shares a boop goes through `persistence/saveFormat.ts` — don't invent a
  second encoding for share links. Decode is total: corrupt or future-versioned
  data reads as an empty grid, never an error. A browser with **no** working
  grid is seeded with a one-clip song built from a sample clip rather than
  opened empty (tickets 36/17) — that lives in `useWorkingSong`, beside the
  restore, and must never need a new field or a version bump.
- **Saved-state visibility** ([ADR 0031](../../docs/adr/0031-boop-saved-state-visibility.md)).
  Because nothing is ever lost, **never add a `beforeunload` guard** — it would
  warn about nothing, in wording a 6-year-old cannot read. The chrome answers
  the narrower, true question, "is this boop in My boops?", off the **loaded
  boop** (`savedState.ts`, and `CONTEXT.md`): words on the desktop bar, a dot on
  the phone's save icon, a standing ring on the row. "Edited" has one definition
  app-wide — any mutation of the song: a cell toggle, a speed change, a
  placement change, clip add/delete/rename, or a lane reorder (ADR 0031, as
  amended). Identity is the boop's *row*, so every mutation of "My boops"
  goes through `savedState.ts`'s transitions or the ring lands on the wrong boop.
- **Share links** ([ADR 0026](../../docs/adr/0026-boop-share-links.md)). The
  whole creation lives in the fragment (`#g=<base64url>`), decoded through the
  save format's own validator, cleared with `replaceState` once loaded. One
  Share button: system sheet on touch devices (`prefersShareSheet`), clipboard
  + "Copied!" otherwise — capability alone can't decide, desktop browsers ship
  `navigator.share` too. Never a modal or a "copy this link" field.
- **Song play is the song grid's header at every width**
  ([ADR 0034](../../docs/adr/0034-boop-song-play-is-the-song-header.md)). The
  laptop bar's play *column* is gone; the button leads the header row, as it
  always did on the phone. The 93px that column took is the lane grid's, and
  that is what makes the rest of the ADR's geometry work: `.lanes` is `flex: 1`
  (on `auto` it took its content's *minimum* width and the tablet band's
  squares compressed to their 20px floor at every width), the tablet band's
  squares, numerals and strip track are `flex: 0 1 <laptop size>` so they
  shrink but never grow past it, and the box reserves a `scrollbar-gutter` so a
  classic vertical scrollbar cannot start a sideways one.
- **The grid never shrinks**
  ([ADR 0027](../../docs/adr/0027-boop-small-phone-layout.md)). 6 x 16, always — no breakpoint may drop a row or
  a step. Below 1024px (`useIsPhone`) the instrument rail is pinned and the 16
  step columns scroll inside a snap-to-the-bar-line window, with the loop map
  carrying the playhead when it is off screen. Playback must never scroll that
  window for the child. Paint vs scroll inside it: the browser owns horizontal
  pans (`touch-action: pan-x`), a tap toggles, and a drag paints only once it
  crosses a cell boundary — see `PhoneGrid.tsx`'s header.
- **The song bar is the home surface; the grid opens as a card**
  ([ADR 0035](../../docs/adr/0035-boop-song-bar-is-the-home-surface.md),
  superseding [ADR 0030](../../docs/adr/0030-boop-fixed-frame-one-scroller.md)
  in part). At every width the song bar is the scrolling region's whole
  content — the arrangement is what a child lands on, because the song is the
  less discoverable half of the app. The grid opens in `ClipEditorCard`,
  bottom-anchored below 1024 and centred at and above it, by two routes: a tap
  on any clip chip, and the dock's one labelled launcher row. The card is
  `min(calc(var(--column-width) + 36px), 100%)` at ≥1024 on a 14px overlay
  gutter — it *contains* the fixed-geometry column, so its own padding adds to
  `--column-width` or the last steps clip. Clip play is the well's footer at
  every width, because the card is a modal and the launcher is behind its
  backdrop. **A known cost:** on the phone Clear grid is in the "⋯" menu and
  the grid is behind the card, so a child no longer watches the grid clear.
- **The stage is a fixed frame at every height, and it has no exceptions**
  ([ADR 0030](../../docs/adr/0030-boop-fixed-frame-one-scroller.md), as
  narrowed by [ADR 0035](../../docs/adr/0035-boop-song-bar-is-the-home-surface.md)).
  `.stage` is a `height: 100dvh` flex column: chrome `flex: none`, the
  scrolling region `flex: 1; min-height: 0; overflow-y: auto`, the dock
  `flex: none` and inset to `--column-width` (not full-bleed). Neither the
  chrome nor the dock may scroll away, and **the page never scrolls** — at any
  height, at any width. The region may; that is allowed and is what a five-clip
  song bar on a short phone uses.
  **The three props ADR 0030 needed are all retired** (screenspace ticket 04),
  each verified by measurement, so do not put any of them back:
  - *The ≥1024 dock cap* (`max-height: max(32dvh, 100px)`) guarded a dock that
    held the growing song bar. The dock holds a fixed-height launcher now —
    measured at 132px at 1280×600 and 1280×900, one clip or five, against a cap
    that allowed 192.
  - *The 505px page-scroll exception*, with its `max-height: 504px` twins on
    the phone well and the lane strip. Page overflow is now zero at 380, 420,
    460, 492, 504, 505 and 520, one clip or five.
  - *The phone grid's three-row floor*. It became `min-height: 0`, not nothing:
    deleting it restores the content-based `min-height: auto` and the well
    overflows the card. The floor's own reason is gone (390×640 gives the rows
    320px now, not 40), and what it did instead was push clip play — which
    lives *inside* that well — below the fold: measured wholly off screen at
    390×380 and at 667×375. `Grid.module.scss` records the same conflict for
    the laptop well; **neither renderer has a floor, and neither may be given
    one.**
  New main-screen content goes in the scrolling region by default. Adding to
  the dock costs vertical space on the screen that has least of it.
  **The nested-scroller exception stands** (ADR 0030, as amended by ticket 23):
  the grid well and the phone song bar each hold one, because each carries a
  play button the region would otherwise scroll away. The well's is inside the
  card; the phone song bar's lane strip is the only nested scroller left on the
  frame. Neither box may ever be `flex: 1` — they may shrink, they must never
  stretch the grid on a tall window. The phone song bar does not shrink at all
  below its cap: what holds it is the *absence* of `min-height: 0` on it, which
  leaves it the content-based automatic minimum. Do not add one, and note
  `flex-shrink: 0` was tried there and measured to change nothing. The laptop
  lane grid scrolling vertically is not a third nested scroller: it is ticket
  25's existing `overflow-x` box gaining a second axis. Anything genuinely new
  still needs another ADR.
- **Kits are pure data.** Adding or swapping instruments means editing
  `public/kits/<kit>/kit.json` and dropping in files — never touching the
  engine. Nothing outside the manifest may enumerate instrument ids.
- **Adding a database?** Follow
  [docs/how-to/adding-an-app.md §2](../../docs/how-to/adding-an-app.md#2-add-a-database-database-backed-apps-only) —
  this is only expected for the share-link snapshot store, not the toy itself.
