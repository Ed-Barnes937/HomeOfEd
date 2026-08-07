# 11 — Deploy Silt (human-gated)

**What to build:** Silt live at `silt.homeofed.com`. Infrastructure mutation
is human-gated (root CLAUDE.md): the agent prepares and verifies everything
preparable, then hands the human a precise checklist from the go-live runbook
(`docs/runbooks/phase-4-go-live.md`).

Agent-side: confirm `fly.toml`, CI deploy job, and compose service are
correct and green; confirm the docker-stack build works; write the human
checklist (create `hoe-silt`, Cloudflare proxied CNAME `silt →
hoe-silt.fly.dev`, Full (strict) TLS, Fly cert; first deploy via CI).

Human-side: run the checklist.

Agent-side after: verify `https://silt.homeofed.com` serves the app and
`/health` is green; smoke the core loop in production.

**Blocked by:** 09 — Scene persistence; 10 — Mobile bottom bar and touch
painting

**Status:** resolved

- [x] Human checklist written and handed over; no infra commands run by the agent
- [ ] CI deploys silt on merge (smoke URL passing) — human, after this branch merges
- [x] `https://silt.homeofed.com` serves the app; `/health` ok — human
- [x] Production smoke: paint → play → save → load works in a real browser — human

## Comments

Agent-side half complete in commit `289aac5` (Sonnet agent). Deliberately left
**claimed, not resolved** — the remaining three boxes need the human to run
go-live.

Checklist written to **`docs/runbooks/silt-go-live.md`**, mirroring
`phase-4-go-live.md` G4.6–G4.11 adapted to silt. Orchestrator confirmed
`scripts/go-live.sh` exists, takes an app name and reads the Fly app from
`fly.toml`, so the documented `scripts/go-live.sh silt` (no `--db`) is real.

Config cross-check found **no defects** — nothing needed fixing, so the only
file touched is the new runbook. `fly.toml` (`hoe-silt`, `lhr`, no
`release_command`, shallow `/health`), the `deploy-silt` CI job (correct
`APP_URL`, affected-check on package name `silt`, correct fly.toml path), the
compose service (host port 8089, matching the registry) and the Dockerfile
(turbo-prune filtered to backend-kit + logger, no `@hoe/db`) all match the
espy/karesansui stateless shape.

Container verified locally, not merely read: `docker build` succeeded,
`docker run` served `/health` → `{"ok":true}` and the SPA index with its hashed
asset, then torn down. Repo-wide `pnpm lint` and `pnpm typecheck` green (16/16
each), silt tests 105 vitest + 23 CT, hub tests 8 vitest + 2 CT (ticket 01
still fine).

**Known unverifiable:** whether the `FLY_API_TOKEN` GitHub secret is org-scoped
or still `hoe-hub`-scoped — unreadable from repo config. If it's app-scoped the
`deploy-silt` job will fail auth; the runbook carries the remediation command.
This matches the standing note in memory about that token.

No infra commands were run.

---

**Human half done, 2026-08-07.** Ed ran go-live via a `/wizard`-generated
script wrapping `scripts/go-live.sh silt` (no `--db`): tooling preflight, Fly
auth, Cloudflare DNS token, `FLY_API_TOKEN` check, dry-run review, the real
run, `/health` on both `hoe-silt.fly.dev` and `silt.homeofed.com`, then the
paint → play → save → load smoke in a browser. All passed; silt is live.

The one remaining box is CI-driven deploy on merge, which cannot be checked
until this branch reaches `main` — that is the post-go-live follow-up the
runbook already scopes out of this ticket, not outstanding work here.
