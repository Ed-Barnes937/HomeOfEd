# 0006 — Split the launcher from the reference/starter app

- **Status:** Accepted
- **Date:** 2026-07-02
- **Revises:** [0001-foundation.md](0001-foundation.md) §10 ("Tracer bullet —
  `apps/hub`") and §11 ("Adding an app — copy, no generator").
- **Related:** [0007-apps-without-a-database.md](0007-apps-without-a-database.md).

## Context

ADR 0001 made `hub` do two jobs at once: the **launcher/landing page** at the
apex, and the **reference app new apps are copied from** (§10, §11). That was the
right call for a single tracer bullet — one app, minimum ceremony.

The two roles pull in opposite directions:

- **Launcher** wants to *accrete* — navigation, a growing list of app links,
  landing-page styling, and eventually the auth surface.
- **Reference/copy base** wants to *stay minimal* — the less it contains, the
  cleaner the copy.

As hub grows as a launcher, copying it means inheriting launcher-specific code
and deleting it in every new app. That is the "copying becomes a real chore"
trigger ADR 0001 §11 named. §11 rejected a standing `_template` to avoid a
template that drifts from reality — but hub-as-launcher will now itself drift
from "clean starter," so neither option is currently good.

## Decision

Separate the two roles.

- **`hub` becomes the launcher only.** It serves the apex `homeofed.com`, and it
  grows freely — nav, link list, launcher styling, the eventual auth surface.
  It is no longer the thing you copy.
- **Introduce `templates/starter`** — a deliberately minimal app that is the
  copy base for new apps.
  - **Outside `apps/*`** so CI's affected-deploy logic never ships it (it is not
    an app, it is a seed).
  - **Inside the pnpm/turbo workspace** so `lint` / `typecheck` / `test` run
    against it on every PR. This is the anti-rot mechanism: a template that must
    stay green cannot silently drift from reality — which was §11's whole
    objection to a `_template`.
  - **It is the no-DB baseline** (see [ADR 0007](0007-apps-without-a-database.md)).
    A database is an *additive* step in the "adding an app" checklist, not
    something you delete.
- **No code generator yet.** A Turborepo generator (`turbo gen`) remains the
  next escalation if the mechanical wiring (name, the two ports, `fly.toml`,
  the Cloudflare CNAME, the CI job) becomes the chore. Copying one small,
  always-green app is the cheaper first move; revisit the generator if copying
  the starter is itself repetitive.

## Consequences

- **Two clear roles.** New apps copy a minimal thing; hub can take on
  launcher/nav/auth-surface code without polluting the copy base.
- **Cost:** the workspace carries one non-deployed app that CI keeps green (a few
  seconds of CI). Accepted — that greenness is exactly what stops the template
  rotting.
- **Built:** `templates/starter` exists — hub minus its DB layer and launcher
  UI, wired into workspace `lint`/`typecheck`/`test`/`build` (it's a stateless
  app per [ADR 0007](0007-apps-without-a-database.md)). The root `CLAUDE.md`
  checklist, `README.md`, and hub's docs now point at it as the copy base.
- **Revisit** `turbo gen` when copying the starter becomes repetitive.
