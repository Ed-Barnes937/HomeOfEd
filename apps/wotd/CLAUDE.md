# apps/wotd — scoped rules

Word of the Day at `wotd.homeofed.com`. Pick a difficulty level
(beginner / intermediate / advanced / expert) and see today's word for that
level — the word, its definition, an example sentence, and three synonyms. Words
are LLM-generated once per day, one per level. Migrated from a Supabase
playground repo; decisions in
[docs/plans/0004-wotd-migration-plan.md](../../docs/plans/0004-wotd-migration-plan.md).

**Database-backed** ([how-to §0](../../docs/how-to/adding-an-app.md)): words are
shared across users, must survive redeploys, and are queried server-side. Its own
`wotd` database in the shared `hoe-pg` cluster.

## Two decisions worth knowing

**Lazy, on-first-request generation.** There is no scheduler. `todayWords`
(`GetTodayWordsHandler`) reads today's words (UTC date from `ctx.now()`); if any
of the four levels is missing it calls the generator, inserts with
`onConflictDoNothing` (so concurrent first-requests race safely — the
`unique(for_date, difficulty)` constraint dedupes), re-selects, and throws if the
set is *still* incomplete. On a day with no visitors, no words are generated —
nothing reads them, so that's fine. A generator failure propagates; the next
request retries.

**No repeats within 90 days.** Before generating, the handler loads distinct
words used in the last `HISTORY_WINDOW_DAYS` (90) via `store.getRecentWords` and
passes them to the generator as exclusions (the prod prompt lists them; see
`buildUserMessage`). It then checks the result for any repeat — of a recent word
or a duplicate within the batch, case-insensitively — and regenerates up to
`MAX_GENERATION_ATTEMPTS` (3) times. If it still repeats after that, the set is
accepted anyway rather than blocking the user. No schema change — this reads the
existing `word`/`for_date` columns.

**The generator is a seam, injected per transport.** `WordGenerator`
(`src/server/wordGenerator.ts`) is an interface. The router is a
`createAppRouter(generator)` factory: dev (`simulator.ts`) and `.iwft`
(`IwftApp.tsx`) inject `FakeWordGenerator`; prod (`main.ts`) injects
`AnthropicWordGenerator` (Anthropic `claude-haiku-4-5`, tool-use structured
output, `ANTHROPIC_API_KEY`). **Dev and CI never hit the Anthropic API** — fakes
over mocks (hard rule 5). The Store rides the tRPC context (`ctx.store`), the
generator rides the router factory; both differ only by what each transport
injects. The Anthropic client is built lazily inside `generateDailyWords`, so a
missing key never crashes boot — only `/wotd`'s generation fails.

Auth was dropped for v1 (the old Supabase SSO was cosmetic). `ctx.auth` stays the
null seam and returns when the central identity service exists (ADR 0008).

## Layout

```
src/
  server/
    schema.ts       words table + difficulty_level enum (for_date date, string mode)
    migrations/     drizzle-kit output (`pnpm generate`) — SQL + meta/, committed
    migrations.ts   Vite ?raw glob loader → statement list (browser/vitest)
    store.ts        WotdStore interface + DrizzleWotdStore (getWordsForDate/insertWords/ping)
    wordGenerator.ts  pinned contracts: Difficulty/DIFFICULTIES/WordOfTheDay/GeneratedWord/WordGenerator
    handlers/todayWordsHandler.ts  GetTodayWordsHandler (lazy generation, race-safe)
    anthropicWordGenerator.ts      prod generator (Anthropic tool-use) + parseGeneratedWords
    router.ts       createAppRouter(generator) factory; exports AppRouter
    simulator.ts    dev wiring: PGlite Store + FakeWordGenerator
    main.ts         prod entrypoint: Postgres Store + AnthropicWordGenerator + deep /health
    migrate.ts      release_command: run-once migrations
    todayWords.test.ts / anthropicWordGenerator.test.ts / store.test.ts  Vitest units
  pages/ components/ features/  UI — SCSS modules, inline SVGs, code-based TanStack routes
  testing/          IwftApp harness (PGlite + FakeWordGenerator, fixed now) + POMs + fixture
  wotd.iwft.tsx     whole-frontend tests via the in-browser backend (seeded reads)
drizzle.config.ts   drizzle-kit: schema → src/server/migrations
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3104 })
```

## Commands

- `pnpm dev --filter=wotd` — simulator mode on port **3003** (real router +
  Node-side PGlite + FakeWordGenerator; restart to pick up server changes).
- `pnpm test --filter=wotd` — Vitest (`*.test.ts`) then Playwright CT (`*.iwft.tsx`).
- `pnpm generate --filter=wotd` — drizzle-kit migration from schema changes;
  commit the whole output folder.
- Prod (container/release): `pnpm build` then `pnpm start` (needs `DATABASE_URL`
  and `ANTHROPIC_API_KEY`, see `.env.example`; default port 8080); `pnpm migrate`
  is the deploy-time release_command.

## Rules

- Server code changes go through TDD: unit test against the injected seams
  (Store fake and/or PGlite, `WordGenerator` fake) first; `.iwft` only for
  whole-page behaviour (keep it thin, seed via raw SQL for the fixed `2026-07-05`
  date the harness pins).
- Data goes through tRPC only — never server functions (hard rule 4).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts`/`migrate.ts` run under
  native Node.
- Ports: dev 3003, CT 3104, compose host 8083 — unique across apps.
