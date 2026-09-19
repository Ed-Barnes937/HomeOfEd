# 08 - First-slice spec: boop saves behind a family account

**Status:** resolved
**Type:** research
**Map:** ../map.md
Blocked by: 05

## Question

Write the implementation spec for the first slice, per the decisions recorded
in [ticket 05](05-decision-sitting.md). Spec only - building it is a separate
epic with its own map. The decided shape the spec must honour:

- **Family service (Option C):** one new scale-to-zero Fly app (working name
  "family"; the spec may propose the final name) with two routers - identity
  (parent email+password accounts via Better Auth stock tables + child
  profiles: username, display name, `parentId`, no child email) and SaveStore
  (opaque versioned blobs keyed `(appId, accountId, slotKey)` with sizes/
  quotas, nothing app-shaped server-side). One logical DB in `hoe-pg`.
- **Tokens carry `{ id, role, parentId }`**, verified offline via the
  generalised sprout `childToken.ts` pattern - consuming apps need no DB and
  no round-trip (ADR 0008 preserved). Ships as the `AuthProvider` in a new
  `packages/accounts`, alongside the save-client contract types.
- **Browser-direct wiring (decision 9):** the SPA talks to the family
  service's own tRPC with a `.homeofed.com` session; saves never pass through
  the owning app's handlers. Answered for Ed in the sitting: app backends
  never load saves into their own DBs - boop stays stateless.
- **Hub owns the account UI (decision 5):** login + family management at
  `homeofed.com/account`; boop keeps only a small "synced as X" affordance.
- **Import is copy, never move (decision 12):** first login offers "keep
  these on your account"; localStorage is never cleared and remains the
  offline/degraded copy. Conflict default LWW-per-slot; boop's import merge
  hook unions `creations`.
- **Household gate (decision 11):** invite-code-closed registration from day
  one; see ticket 09 for the ADR.
- Slice contents: parent account + one child profile, hub login UI,
  `packages/accounts`, the family service, boop's `boop:save` slot with the
  copy-import flow. Nothing for silt/espy/karesansui (silt is the deliberate
  second slice), no sprout changes, no ledger.

The spec should also name: the architecture ADR to be written with the first
implementation PR (fresh family service + central SaveStore + browser-direct,
citing ticket 05), the port-registry row and how-to checklist touchpoints for
the new app, and the **Lever A checkpoint** - after this slice ships, revisit
hub `min_machines_running` 1 -> 0 (decision 8 deferred it until the cold
start can be felt).

## Answer

Spec written 2026-09-15 at
[`.scratch/family-first-slice/spec.md`](../../family-first-slice/spec.md)
(Draft - for Ed's review), homed in the directory that will hold the build
epic. It honours all 13 ticket-05 decisions and covers everything this ticket
asked to be named:

- **Architecture ADR**: `docs/adr/NNNN-family-service.md`, written with the
  first implementation PR - it is the future ADR that ADR 0008 explicitly
  deferred (spec §10).
- **Port registry + touchpoints**: dev 3010 / CT 3110 / compose 8090 (the
  next-free row), plus the full how-to checklist including a `FAMILY_GO_LIVE`
  CI gate (sprout precedent) and the human-gated infra steps (spec §9).
- **Lever A checkpoint**: after the slice ships and the cold start is felt,
  revisit hub `min_machines_running` 1 -> 0 (~$3.24/mo); recorded as a
  build-epic note (spec §11).

Verified against the repo, not just tickets: boop has exactly one frozen
localStorage key (`boop:save`, `apps/boop/src/persistence/storage.ts:21`) so
the slice's sync surface is one slot; hub's `/account` is a 3-line route
addition (`apps/hub/src/router.tsx`); sprout's `childToken.ts` +
`providers.ts` generalise as specced; `packages/accounts` and `apps/family`
don't yet exist.

**Five proposals the spec makes beyond ticket 05, flagged for Ed's review
(spec §12):** the name `family` is final; Ed25519 signatures instead of a
shared HMAC secret (public key ships in `packages/accounts`, no secret
distribution to consuming apps; HMAC fallback documented); no child
credentials in v1 (parent-session profile picker - feeds ticket 09's gate
ADR); `slotKey` = localStorage key verbatim with an `appId` allowlist and v1
quotas 256 KiB/slot, 2 MiB/account; no email machinery in v1 (no
verification, no self-serve password reset).

## Comments
