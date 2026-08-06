# apps/boop — scoped rules

A kid-friendly (6+) music toy at `boop.homeofed.com`: a 6-instrument x 16-step
step-sequencer, one always-looping pattern, music-first (no reactive visual
layer in V1). Full product spec: [`.scratch/music-app/spec.md`](../../.scratch/music-app/spec.md).
Visual reference: [`docs/reference/boop-design/README.md`](../../docs/reference/boop-design/README.md)
(high-fidelity handoff — read it before touching anything visual; colours,
type, spacing, radii, shadows and grid geometry are final and exact).
Domain vocabulary: [`CONTEXT.md`](CONTEXT.md).

**Stateless** ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)) —
copy base is `templates/starter`. The working grid, tempo, and saved grooves
("My grooves") persist to `localStorage`. Sharing a groove is primarily
URL-hash encoded (no server); a server-backed short-link fallback is a later
ticket, modelled on `apps/fridge`'s `board.share`/`board.get` handlers
(`apps/fridge/src/server/handlers/shareBoardHandler.ts`).

The `SequencerEngine` and the launch kit manifest have landed (ticket 12) —
Tone.js behind a TypeScript interface, no `packages/*` extraction (the spec is
explicit this stays in-app). The grid, transport and working-grid autosave now
consume it; "My grooves" and share links are later tickets.

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
    autosave.ts       debounced (2 s lull) writer of the working grid
    useWorkingGrid.ts hook: restore on mount, autosave on edit, flush on pagehide
  pages/            HomePage — placeholder route (ticket 11); the grid page replaces it
  features/greeting/  placeholder query — replace once the sequencer's real routes land
  styles/tokens.scss  design tokens from the handoff (stage/well/ink/instrument
                      hues, radii, shadows) + self-hosted Chivo / Chivo Mono
  testing/          IwftApp harness (in-browser backend) + iwft fixture + page objects
  greeting.iwft.tsx placeholder whole-frontend test via the in-browser backend
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
- **Persistence** ([ADR 0025](../../docs/adr/0025-boop-save-format.md)). One
  versioned save document under one `localStorage` key (`boop:save`), holding
  the autosaved working grid and the "My grooves" list. Anything that persists
  or shares a groove goes through `persistence/saveFormat.ts` — don't invent a
  second encoding for share links. Decode is total: corrupt or future-versioned
  data reads as an empty grid, never an error.
- **Kits are pure data.** Adding or swapping instruments means editing
  `public/kits/<kit>/kit.json` and dropping in files — never touching the
  engine. Nothing outside the manifest may enumerate instrument ids.
- **Adding a database?** Follow
  [docs/how-to/adding-an-app.md §2](../../docs/how-to/adding-an-app.md#2-add-a-database-database-backed-apps-only) —
  this is only expected for the share-link snapshot store, not the toy itself.
