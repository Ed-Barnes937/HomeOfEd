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
explicit this stays in-app). The grid, transport and working-grid autosave now
consume it; "My boops" and share links are later tickets.

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
  export/           WAV export: offline render → PCM mix → WAV encode, plus the
                    share-sheet/download action and the slugged filename. Pure
                    but for `sampleDecoder.ts`, the AudioContext seam.
  share/            URL-hash share links (ADR 0026) — pure, no server
    shareLink.ts      encode/decode a creation to `#g=<base64url>`; total decode
    shareAction.ts    share sheet vs clipboard, behind an injected ShareTarget
  features/grid/    the grid well. Two renderers, one behaviour:
                    Grid.tsx      laptop/tablet — the full 6x16 laid out flat
                    PhoneGrid.tsx <1024px — pinned rail + snap-scrolling step
                                  window + the "WHOLE LOOP" map (ticket 27)
                    phoneWindow.ts / loopMap.ts  pure geometry + tick derivation
                    useDragPaint.ts  latched drag-paint, shared by both
  features/boops/   BoopsPanel.tsx — the "My boops" dialog: the always-on save
                    form (ticket 32), the list, per-row load/rename/delete/export
  features/clips/   the clip chrome (boop-loops ticket 15, laptop ≥1280 only):
                    ClipHeader.tsx (tint dot, inline rename, copy, delete),
                    ClipControl.tsx (Play this clip + clip-scoped Clear grid,
                    rendered inside the grid well), clipTints.ts (the fixed
                    5-tint list)
  features/songbar/ SongBar.tsx — the pinned song bar (laptop ≥1280): Speed
                    (the old tempo slider), the song play button (wired to the
                    songConductor, ticket 16), and the lane grid — chips
                    (tap-to-select, drag-to-reorder via useChipDrag.ts,
                    ticket 18), placement squares (drag-paint + the grid's
                    keyboard model), "+ New clip"
  features/picker/  the "+ New clip" picker (ticket 17, replacing the retired
                    starters): NewClipPicker.tsx (the paper-card dialog —
                    Blank first, then the sample clips), sampleClips.ts (the
                    eight-clip roster + the first-visit seed, pure data), and
                    PatternThumbnail.tsx (the dot-matrix preview, shared with
                    "My boops")
  features/topbar/  TopBar.tsx (desktop, incl. the laptop's plain New boop
                    reset) and PhoneBar.tsx (the 52px strip + "⋯" menu);
                    `useIsPhone.ts` and `useIsLaptop.ts` (both at src/) pick
                    the layout: ≥1280 is clip-lanes, <1024 is the phone, and
                    the tablet band between keeps the old transport until
                    ticket 20
  pages/            HomePage — the whole app as a fixed frame (ADR 0030):
                    pinned chrome, the scrolling grid region, pinned transport
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
  behaviour against `FakeAudioDriver`, never a real AudioContext.
- **Persistence** ([ADR 0025](../../docs/adr/0025-boop-save-format.md), extended
  for songs by [ADR 0032](../../docs/adr/0032-boop-save-format-songs.md)). One
  versioned save document under one `localStorage` key (`boop:save`), holding
  the autosaved working grid and the "My boops" list. A stored boop is a whole
  song: `patterns` is the clip list (≤5, optional `name`/`tint` per clip), plus
  optional `placements` (16-char string) and `gridClip` — all additive, still
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
- **The grid never shrinks**
  ([ADR 0027](../../docs/adr/0027-boop-small-phone-layout.md)). 6 x 16, always — no breakpoint may drop a row or
  a step. Below 1024px (`useIsPhone`) the instrument rail is pinned and the 16
  step columns scroll inside a snap-to-the-bar-line window, with the loop map
  carrying the playhead when it is off screen. Playback must never scroll that
  window for the child. Paint vs scroll inside it: the browser owns horizontal
  pans (`touch-action: pan-x`), a tap toggles, and a drag paints only once it
  crosses a cell boundary — see `PhoneGrid.tsx`'s header.
- **The stage is a fixed frame, and the grid region is the only scroller**
  ([ADR 0030](../../docs/adr/0030-boop-fixed-frame-one-scroller.md)). `.stage`
  is a `height: 100dvh` flex column: chrome `flex: none`, the grid region
  `flex: 1; min-height: 0; overflow-y: auto`, transport `flex: none` and inset
  to `--column-width` (not full-bleed). Neither bar may scroll away, and the
  loop map stays under the grid *inside* the scrolling region — never in the
  bar, or it becomes a second transport. New main-screen content goes in the
  scrolling region by default.
- **Kits are pure data.** Adding or swapping instruments means editing
  `public/kits/<kit>/kit.json` and dropping in files — never touching the
  engine. Nothing outside the manifest may enumerate instrument ids.
- **Adding a database?** Follow
  [docs/how-to/adding-an-app.md §2](../../docs/how-to/adding-an-app.md#2-add-a-database-database-backed-apps-only) —
  this is only expected for the share-link snapshot store, not the toy itself.
