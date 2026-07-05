# wotd

Word of the Day — `wotd.homeofed.com`. Pick a difficulty level (beginner,
intermediate, advanced, expert) and see today's word for that level: the word,
its definition, an example sentence, and three synonyms. One word per level per
day, LLM-generated on the first request of the day.

Database-backed (its own `wotd` database in the shared `hoe-pg` cluster).
Migrated from a Supabase playground app onto the hub stack — see
[docs/plans/0004-wotd-migration-plan.md](../../docs/plans/0004-wotd-migration-plan.md)
and [apps/wotd/CLAUDE.md](CLAUDE.md) for the design (lazy generation + the
injected generator seam).

## Develop

```bash
pnpm dev --filter=wotd      # port 3003; PGlite + FakeWordGenerator, no docker, no live LLM
pnpm test --filter=wotd     # Vitest (*.test.ts) + Playwright CT (*.iwft.tsx)
pnpm lint --filter=wotd
pnpm typecheck --filter=wotd
pnpm generate --filter=wotd # drizzle-kit migration after a schema.ts change (commit the folder)
```

Data flows `page → TanStack Query → tRPC client → router → GetTodayWordsHandler →
WotdStore / WordGenerator`. The same handler runs in dev, `.iwft`, and prod; only
the injected Store (PGlite vs Postgres) and generator (fake vs Anthropic) differ.

## Docker stack (real image + real Postgres)

```bash
docker compose up wotd            # builds the Fly image, runs migrations, serves on :8083
curl -fsS localhost:8083/health   # {"ok":true} — deep Store round-trip
```

Live word generation needs `ANTHROPIC_API_KEY`; without it, `/health` and seeded
reads still work but `/wotd`'s first-of-day generation errors.

## Deploy

Human-gated (root `CLAUDE.md`, [how-to §4](../../docs/how-to/adding-an-app.md#4-deploy-human-gated)):

```bash
scripts/go-live.sh wotd --db                          # create hoe-wotd, attach Postgres, cert, CNAME
fly secrets set ANTHROPIC_API_KEY=... --app hoe-wotd  # extra step vs. the script
```

Then merge to `main` → the `deploy-wotd` workflow deploys (running migrations via
the fly.toml `release_command`) and post-deploy `/health` gates the rollout.

## Environment

- `DATABASE_URL` — Postgres connection string (Fly-injected in prod; see `.env.example`).
- `ANTHROPIC_API_KEY` — word generation (Fly secret; a missing key fails generation only, not boot).
- `PORT` — server port (default 8080).
