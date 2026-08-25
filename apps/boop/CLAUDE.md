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
  pages/            HomePage — the whole app as a fixed frame (ADR 0030):
                    pinned chrome, the scrolling region (the song bar, since
                    screenspace ticket 03), the pinned dock (the clip
                    launcher); the grid opens as a card over the top
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
- **The stage is a fixed frame, and the region between the bars is the only
  scroller** ([ADR 0030](../../docs/adr/0030-boop-fixed-frame-one-scroller.md)).
  **Screenspace ticket 03 changed what stands in the frame** — the song bar is
  the scrolling region's whole content, the dock holds the clip launcher, and
  the grid opens as a card over the top. The frame itself is unchanged, but
  every sentence below about *the grid* in the region now describes the grid
  *inside the card*. Screenspace ticket 04 writes the superseding ADR and
  retires whichever of the three compromises below no longer earn their keep. `.stage`
  is a `height: 100dvh` flex column: chrome `flex: none`, the grid region
  `flex: 1; min-height: 0; overflow-y: auto`, transport inset to
  `--column-width` (not full-bleed). The dock is `flex: none` on the phone but
  **capped at ≥1024** (`flex: 0 1 auto; max-height: 32dvh`, ticket 23): the
  song bar grows with the song, and uncapped it took 79% of a 1280×600 screen
  and starved the grid to 16px. Neither bar may scroll away, and the
  loop map stays under the grid *inside* the scrolling region — never in the
  bar, or it becomes a second transport. New main-screen content goes in the
  scrolling region by default.
  **One exception** (ADR 0030, as amended by ticket 23): the grid well and the
  phone song bar each hold a nested scroller, because each carries a play
  button that the region would otherwise scroll away — a pinned bar the child
  can always reach beats the single-scroller rule. The well is a flex column
  whose rows scroll in their own box with the footer pinned under them; the
  phone song bar is the same shape with its header pinned. Neither box may
  ever be `flex: 1` — they may shrink, they must never stretch the grid on a
  tall window. **The grid absorbs the squeeze first, down to a floor.** The
  well shrinks (`min-height: 0`) and the phone song bar does not — what holds
  the bar is the *absence* of `min-height: 0` on it, which leaves it the
  content-based `min-height: auto`; do not add one, and note `flex-shrink: 0`
  was tried there and measured to change nothing. The ticket's headline is
  "the grid scrolls, *not* the bar", and a shrink factor above zero would chop
  a lane row on the default phone screen while the grid still held 109px of
  slack. **But priority without a floor takes everything**: it left 40px of
  grid at 390×640 with five clips and none at all on a 460px-tall window, with
  the rail spilling over the bar. So `PhoneGrid`'s `.well` — the box flex
  shrinks, not the scroll box in it — carries a three-rows-plus-loop-map
  `min-height`, and the region scrolls to pay for it. The bar's `max-height`
  then keeps song play clear of the chrome at the bottom of that scroll, and
  is what makes its strip scroll rather than the header. The *page* still
  never scrolls — **except below 505px of viewport height at phone widths**,
  where the owner's call is that boop stops being a fixed frame and the whole
  page scrolls (ADR 0030, amended twice by ticket 23). Down there no fixed
  arrangement keeps both play buttons reachable, so a scrolling page is what
  reaches them; the grid well and the lane strip take max-heights to keep the
  page a sensible length, and the three-row floor still applies. 505 is the
  first height at which song play is *wholly* clear of the transport — do not
  lower it, and do not merge this with the laptop's dock cap.
  **`Grid`'s well has no floor and must not be given one**: the dock cap
  already stops the region being starved, so a floor there was mutation-tested
  and found redundant — and it cannot be won anyway, since the clip play button
  sits *inside* that well, so a floor pushes its own button below the fold. The
  laptop lane grid scrolling vertically is not a third nested scroller: it is
  ticket 25's existing `overflow-x` box gaining a second axis. Anything genuinely
  new still needs another ADR.
- **Kits are pure data.** Adding or swapping instruments means editing
  `public/kits/<kit>/kit.json` and dropping in files — never touching the
  engine. Nothing outside the manifest may enumerate instrument ids.
- **Adding a database?** Follow
  [docs/how-to/adding-an-app.md §2](../../docs/how-to/adding-an-app.md#2-add-a-database-database-backed-apps-only) —
  this is only expected for the share-link snapshot store, not the toy itself.
