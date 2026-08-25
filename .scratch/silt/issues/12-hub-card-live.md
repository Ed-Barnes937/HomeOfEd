# 12 — Hub: flip Silt card to LIVE

**What to build:** The hub's Silt card (from ticket 01) becomes a real
doorway: the `SOON` label is replaced by the `LIVE` status, the card links to
`https://silt.homeofed.com`, and the deployment date is recorded so the hub's
"New" pill shows for the launch window. The coming-soon animation stays — it
is the card's preview.

**Blocked by:** 01 — Hub: Silt "coming soon" card; 11 — Deploy Silt
(human-gated)

**Status:** resolved

> Skipped by the build orchestrator by design: this ticket can only be done
> after the human has run go-live, since `deployedAt` must be the real launch
> date and the card must not claim LIVE before the site serves.

- [x] Silt card shows `LIVE` and links to `https://silt.homeofed.com`
- [x] `deployedAt` set to the actual go-live date; "New" pill renders
- [x] Hub tests, lint, typecheck green

## Comments

Done once the human confirmed silt was live (2026-08-07), so `deployedAt` is
the real launch date — same day as boop.

One line of `APPS` in `apps/hub/src/pages/HomePage.tsx`: `status: 'SOON'` →
`'LIVE'` plus `href` and `deployedAt`. No component or style changes were
needed — the card already renders the LIVE dot, the link wrapper and the "New"
pill off that data (`isNew.ts` drives the pill for 14 days).

Test side, TDD: `HomePagePom.verifySiltIsComingSoon` became `verifySiltLink`,
asserting the href and that `SOON` now appears exactly once (HEIG only). Went
red for the right reason before the change. **The "New" pill is deliberately
not asserted in `.iwft`** — it is true for 14 days and then false, so an
assertion on it would rot on the calendar. `isNew.test.ts` already pins the
rule with an injected `now`; this follows the precedent set by `verifyBoopLink`.

Verified: hub 8 vitest + 2 CT green, repo-wide `pnpm lint` and `pnpm typecheck`
17/17 each.

**Sequencing note:** ticket 01's "coming soon" card was committed on the
`basic-cellular-automaton` epic branch (`c667ae7`), never to `main`, so the SOON
state never reached a real visitor — the card goes from absent to LIVE in one
merge. Same thing happened on the boop epic. If a future epic wants a real
teaser, that ticket has to ship to `main` on its own branch.
