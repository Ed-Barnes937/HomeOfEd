# 0002 — Documentation structure & delivery process

- **Status:** Accepted
- **Date:** 2026-06-29
- **Related:** [0001-foundation.md](0001-foundation.md)

## Context

ADR 0001 set the architecture. This ADR records how we document the repo and how
foundation work is delivered — specifically because the work is intended for
Claude agent teams, and because deployed infrastructure should stay under human
control while it's being learned/set up.

## Decisions

### Documentation surfaces

| Surface | Role |
|---|---|
| Root `README.md` | Overview + **standard procedures** (getting started, run/test/deploy, add-an-app) + documentation map. The human front door. |
| Root `CLAUDE.md` | High-signal **working rules** for agents/contributors: navigation, hard rules, TDD/verify loop, "before you finish" checklist, add-an-app checklist. Links out rather than duplicating prose. |
| `packages/*/README.md` | **Every package** ships one: purpose, public API/exports, usage, testing. |
| `apps/*/CLAUDE.md` | **Every app** ships a scoped one for app specifics. |
| `docs/adr/NNNN-*.md` | All decisions, MADR-lite, numbered. |
| `docs/plans/*.md` | Implementation plans (vertical slices). |

No separate progress/status doc — git history + ADRs are the record.

### Agentic-coding documentation principles

- `CLAUDE.md` stays concise and high-signal (it's loaded into every agent
  context); detail goes to README/ADRs and is linked, not duplicated.
- Per-package README and per-app `CLAUDE.md` give agents local context so they
  don't need the whole repo in scope.
- A current README and any new ADR are part of a task's definition of done.

### Delivery model — vertical slices for agent teams

Foundation work is broken into vertical slices (see
[the implementation plan](../plans/0001-foundation-implementation-plan.md)) with,
per slice: explicit file/dir ownership (so parallel agents don't collide), a
public contract, and test-based acceptance criteria. A thin tracer-bullet slice
de-risks the architecture first; hardening slices then run in parallel against
its contracts.

### Human-in-the-loop for deployed infrastructure

Agents may author Dockerfiles, `fly.toml`, compose files, and CI workflows, but
**must not apply changes to deployed infrastructure**: creating Fly apps,
provisioning Managed Postgres, setting secrets, deploying, or changing Cloudflare
DNS/certificates. These are done by a human following runbooks, both to keep
control of production and so the operator learns the setup. The agent-delivered
end state is **all local-only code ready**; the human gates are the release.

## Consequences

- Clear, navigable docs that suit both humans and agents; low duplication.
- Parallel agent work is possible without collisions once contracts exist.
- Production setup is deliberate and understood, at the cost of the foundation
  not being live until the human completes the Phase 4 runbooks.
