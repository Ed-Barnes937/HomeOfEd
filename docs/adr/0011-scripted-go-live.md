# 0011 — Scripted go-live, human-triggered

- **Status:** Accepted
- **Date:** 2026-07-03
- **Related:** [ADR 0001 §9/§14](0001-foundation.md), [ADR 0008](0008-apps-without-a-database.md),
  [runbook G4.9](../runbooks/phase-4-go-live.md#g49--scripted-go-live-scriptsgo-livesh),
  [how-to §4](../how-to/adding-an-app.md)

## Context

Taking a new app live is ~6 manual steps across two dashboards and two CLIs
(runbook G4.1–G4.8). Doing it by hand for boids surfaced two failure modes:
an app-scoped deploy token that couldn't deploy the second app, and the
Cloudflare-proxy / Fly-cert chicken-and-egg (a proxied CNAME breaks
Let's Encrypt validation). Every step has an API, so full automation is
possible — the question is how much standing credential power to create.

## Decision

One idempotent script, **`scripts/go-live.sh <app> [--db] [--dry-run]`**, that
performs the whole sequence: fly app create → optional `hoe-pg` attach →
first deploy → grey-cloud CNAME → cert add + poll to Issued → flip CNAME to
proxied → health/index verification.

- **Human-triggered, human credentials.** The script is run by a person under
  their own `fly auth login` session and a `CLOUDFLARE_API_TOKEN` scoped to
  Zone.DNS:Edit. The root `CLAUDE.md` rule stands: agents write the script,
  never run it.
- **Grey → Issued → orange** solves the cert chicken-and-egg
  deterministically: DNS-only while Let's Encrypt validates against Fly
  directly, proxied only after issuance.
- **Idempotent** — every step checks before creating, so a partial failure
  re-runs from the top and resumes.
- **`--dry-run`** prints every mutating command without executing; this is
  also the agent-testable path (no live test can exist for infra scripts, so
  the TDD rule is satisfied by syntax check + dry-run inspection, not a
  test suite).

## Rejected alternatives

- **CI GitOps** (merge a new `apps/*` → CI provisions everything): needs
  long-lived org-wide Fly + Cloudflare create/destroy tokens in GitHub
  secrets — a real blast-radius increase to save minutes a few times a year.
- **Terraform**: still deferred-not-dismissed (ADR 0001). Revisit if the app
  count grows or drift detection starts mattering; the script's step list is
  the module spec when that day comes.

## Consequences

- Go-live is one command + one dashboard-free wait (~5 min), and is
  self-documenting via `--dry-run`.
- New failure surface: the script depends on flyctl/Cloudflare API output
  shapes (`fly apps list --json`, `certs check` text). A CLI upgrade can break
  it; the runbook's manual steps (G4.1–G4.6) remain the fallback and the
  source of truth for what the script must do.
- The Cloudflare token is created ad-hoc by the human per run (or kept in
  their own keychain) — never committed, never a repo secret.
