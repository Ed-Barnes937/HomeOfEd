# 0004 — Migrating word-of-the-day (WOTD) onto the hub stack

Source: `~/Code/Playground/word-of-the-day` (Vite React SPA + Supabase).
Target: `apps/wotd` at `wotd.homeofed.com`, following
[docs/how-to/adding-an-app.md](../how-to/adding-an-app.md) verbatim.

## What the app is

Pick one of four difficulty levels (beginner / intermediate / advanced /
expert), see today's word for that level: the word, its definition, an example
sentence, and three synonyms. Words are LLM-generated once per day, one per
level.

## Decisions (agreed 2026-07-05)

| Topic | Decision |
|---|---|
| Architecture | Standard checklist: own Fly app `hoe-wotd`, own `wotd` database in the shared `hoe-pg` cluster. |
| Database | **Database-backed** — words are shared across users, must survive redeploys, and are queried server-side (§0 of the how-to says yes on all three). |
| Auth | **Dropped for v1.** Supabase Google SSO was cosmetic (welcome message + profile name). The profile route, auth store, and Avatar go away; `ctx.auth` stays the null seam. Auth returns when the central identity service exists (ADR 0008). |
| Generation trigger | **Lazy, on first request.** The `todayWords` handler generates and inserts if today's rows don't exist. No scheduler infra. |
| LLM | **Anthropic `claude-haiku-4-5`** with tool-based structured output, replacing OpenAI gpt-4o-mini. Needs an `ANTHROPIC_API_KEY` app secret (human-gated). |
| Styling | **Full restyle to the stack's idiom: SCSS modules** (as in `templates/starter`). Tailwind, cva, `tailwind-merge`, clsx, and `@radix-ui/react-slot` are **not** ported. `lucide-react` is also dropped — the four level-card icons become inline SVG components. React 18 → 19 (starter's version). |
| Day boundary | **UTC.** "Today" is the UTC date from `ctx.now()`. UK visitors see words flip at midnight/1am local — accepted for deterministic tests. |
| Data migration | None — the Supabase data is disposable (0 users). |

## What carries over vs. what's rebuilt

**Carries over:**

- Routes `/` (level picker) and `/wotd?level=` (word card) — TanStack Router,
  zod search validation.
- Component *behaviour and content*: `LevelCard` (incl. the "Typically KS1–KS4"
  age hints), `WOTDCard`/`WOTDDefinition`/`WOTDSentence`, `Typography`,
  `Button`, `SiteHeader` (minus auth/Avatar).
- The generator prompt: difficulty personas + the word/definition/sentence/
  synonyms schema (from `supabase/functions/generateWOTDs/index.ts`).

**Rebuilt on the stack:**

- Supabase client + `@supabase-cache-helpers` → tRPC client + TanStack Query
  (data through tRPC only — hard rule 4).
- Tailwind/cva/radix/lucide styling → SCSS modules + inline SVGs (visual
  parity is best-effort, not pixel-perfect).
- Supabase `words` table + `todaywords` view → Drizzle schema + a Store query.
  The view's definition isn't in the source repo; assumed semantics = "rows
  created today". Replaced by an explicit `for_date` column (below).
- Supabase edge function → a domain handler behind DI.
- zustand auth store → deleted.

## Contracts (pinned before lanes fork)

These are written **as committed code** in a serial task straight after
scaffold, so the compiler — not prose — holds the seam between the backend and
frontend lanes. Both lanes import them; neither changes them without stopping.

### Wire contract (tRPC)

One procedure. The client sees camelCase and nothing it doesn't need — no ids,
no dates cross the wire.

```ts
type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

type WordOfTheDay = {
  difficulty: Difficulty
  word: string
  definition: string
  exampleSentence: string   // snake_case in DB, camelCase on the wire
  synonyms: string[]        // DB column stays `alternatives`; renamed at the store boundary
}

// procedure: todayWords — query, no input
// output: WordOfTheDay[] — exactly 4, one per difficulty; order unspecified,
// client keys by difficulty
```

### Store contract

```ts
interface WotdStore {
  getWordsForDate(date: string): Promise<WordRow[]>   // date = 'YYYY-MM-DD'
  insertWords(rows: NewWordRow[]): Promise<void>      // on conflict (for_date, difficulty) do nothing
  ping(): Promise<void>
}
```

Dates are `YYYY-MM-DD` strings end to end (Drizzle `date` column in string
mode) — no `Date` objects at the store boundary, so PGlite and Postgres can't
drift on timezone handling.

### Generator contract

```ts
type GeneratedWord = {
  difficulty: Difficulty
  word: string
  definition: string
  exampleSentence: string
  synonyms: string[]        // exactly 3
}

interface WordGenerator {
  generateDailyWords(): Promise<GeneratedWord[]>
}
```

Semantics, not just the signature: `generateDailyWords` **validates it got
exactly one word per difficulty and throws otherwise**. Malformed LLM output is
the generator's problem; the handler never sees a partial set.

### Handler semantics (`GetTodayWordsHandler`)

- `today` = UTC `YYYY-MM-DD` from `ctx.now()`.
- `getWordsForDate(today)` covers all 4 difficulties → map to wire type,
  return.
- Anything missing → `generateDailyWords()` → `insertWords` (conflict-ignore
  fills gaps and resolves races) → re-select → if *still* incomplete, throw
  (internal error). Generator failure propagates; the next request retries.

### iwft seed shape

`mountApp({ seed })` takes `seed: { words: NewWordRow[] }` — raw store insert
rows, applied via `applyPendingSeed` (hub's pattern).

### Fixed names and numbers

| Pin | Value |
|---|---|
| App / package name | `wotd` |
| Fly app | `hoe-wotd` |
| Subdomain | `wotd.homeofed.com` |
| Dev port / CT port / compose host port | `3003` / `3104` / `8083` |
| tRPC procedure | `todayWords` |
| Routes | `/` and `/wotd?level=<Difficulty>` (invalid level → `beginner`) |
| Env var | `ANTHROPIC_API_KEY` |
| Model | `claude-haiku-4-5` |

### File map (mirror the starter's greeting layout — rename, don't invent)

| Starter file | wotd file |
|---|---|
| `src/server/handlers/greetingHandler.ts` | `src/server/handlers/todayWordsHandler.ts` |
| `src/server/greeting.test.ts` | `src/server/todayWords.test.ts` |
| `src/features/greeting/greetingQuery.ts` | `src/features/wotd/todayWordsQuery.ts` |
| `src/pages/HomePage.tsx` + `.module.scss` | `src/pages/HomePage.tsx` (level picker) + `src/pages/WotdPage.tsx`, each with its `.module.scss` |
| `src/greeting.iwft.tsx` | `src/wotd.iwft.tsx` |
| — (new) | `src/server/schema.ts`, `store.ts`, `migrate.ts`, `migrations.ts`, `migrations/` (how-to §2) |
| — (new) | `src/server/wordGenerator.ts` (interface + types), `anthropicWordGenerator.ts`, `src/testing/fakeWordGenerator.ts` |
| — (new) | `src/components/` for `LevelCard`, `WOTDCard`, `Typography`, etc. — internals are the frontend lane's own business as long as POM-tested behaviour holds |

### Schema (`src/server/schema.ts`)

```
difficulty_level enum: beginner | intermediate | advanced | expert
words:
  id            uuid pk default random
  word          text not null
  definition    text not null
  example_sentence text not null
  alternatives  text[] not null        -- synonyms
  difficulty    difficulty_level not null
  for_date      date not null          -- replaces the todaywords view
  created_at    timestamptz default now
  unique (for_date, difficulty)        -- idempotent daily generation
```

`for_date` beats a created_at-based view: the "today" query is an equality, and
the unique constraint makes concurrent lazy generation safe.

## Wiring

- `simulator.ts`: PGlite store + `FakeWordGenerator`.
- `main.ts`: real Postgres store + `AnthropicWordGenerator`
  (`ANTHROPIC_API_KEY` from env), deep `/health` via `store.ping()`.
- `IwftApp.tsx`: in-browser PGlite + seed; `FakeWordGenerator`.

Dev/CI never hit the Anthropic API — fakes over mocks (hard rule 5).

## Steps

Each step ends green (lint / typecheck / test per the §3 verify loop).
Steps 1–3 are serial; 4–5 and 6 are two parallel lanes; 7–8 serial.

1. **Scaffold** — `cp -r templates/starter apps/wotd`; rename touchpoints
   (how-to §1). Verify the starter's greeting demo passes → green baseline.
2. **DB layer** (how-to §2a–2m) — schema above, generate migration, migration
   loaders, `DrizzleWotdStore` + `store.test.ts` over PGlite (including the
   on-conflict idempotency case), vitest timeouts, `.env.example`,
   `fly.toml` release_command, Dockerfile `@hoe/db` edits, compose two-service
   pattern.
3. **Pin contracts in code** — the types/interfaces above, the `todayWords`
   procedure stubbed in the router, `FakeWordGenerator`, and the simulator/
   IwftApp wired to fake + PGlite so the frontend lane has a working backend
   from day one. Compiles + greeting tests still green.
4. **[Backend lane] Domain (TDD)** — failing unit tests for
   `GetTodayWordsHandler` with fake store + `FakeWordGenerator`: returns
   existing words without generating; generates + persists when today is
   empty; tolerates a lost insert race; throws when the re-select is still
   incomplete. Then the handler behind the pinned procedure.
5. **[Backend lane] Anthropic impl** — thin `AnthropicWordGenerator`
   (ported personas prompt, tool schema); unit-test the
   response→`GeneratedWord[]` parsing/validation — including the
   throw-on-partial-set rule — against a canned tool-use payload, not the
   live API.
6. **[Frontend lane] UI port + restyle** — `.iwft` first: home shows four
   level cards (with KS age hints); clicking one lands on `/wotd?level=…`
   showing the seeded word/definition/sentence/synonyms; unknown level falls
   back to beginner. Then port routes and components against the pinned wire
   type: SCSS modules replacing Tailwind/cva, inline SVGs replacing lucide,
   React 19 idioms, tRPC hook replacing the supabase fetch. Delete
   profile/auth/Avatar. Greeting demo removed once wotd tests cover the app.
7. **Delivery wiring** — `deploy-wotd` CI job (copy `deploy-hub`: affected
   check, fly.toml path, smoke URL `wotd.homeofed.com`); `apps/wotd/CLAUDE.md`
   scoped doc recording the lazy-generation and generator-seam decisions;
   README.
8. **Full verify** — §3 loop + docker-stack smoke
   (`docker compose up wotd`, deep `/health`, tRPC round-trip). Note: port 8082
   can be squatted by an unrelated container on this machine; wotd uses 8083.

## Human-gated go-live (hand-off)

Agent stops before any of this (root CLAUDE.md):

```bash
scripts/go-live.sh wotd --db          # fly apps create hoe-wotd, postgres attach, cert, CNAME
fly secrets set ANTHROPIC_API_KEY=... --app hoe-wotd   # extra step vs. the script
```

Then merge to `main` → deploy workflow → post-deploy smoke. Afterwards:
decommission the Supabase project and the old deployment (data disposable),
and add wotd to the hub launcher grid.

## Out of scope for v1

- Age-based difficulty selection (an age input mapping to a level) — never
  existed in the source code; possible follow-up once migrated.
- Auth / profile.
- Pixel-perfect visual parity with the Tailwind original.

## Assumptions

- `todaywords` view ≈ "words created today" — inferred from the frontend
  (fetches the view, filters by level client-side); its SQL isn't in the repo.
- The old repo's Dockerfile serves a hello-world `index.ts` and is not the real
  deployment; nothing from it is reused.
- On a day with no visitors, no words are generated — acceptable, nothing reads
  them.
