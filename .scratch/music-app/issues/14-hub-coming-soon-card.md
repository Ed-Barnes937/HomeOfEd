# 14 — Hub card: boop "Coming soon"

**What to build:** boop appears on the homeofed.com home page (`apps/hub`) as
a card with a "Coming soon" label and a small preview animation, matching how
the hub presents its other apps. The card is not a link to the app yet (or
links nowhere harmful) — it announces boop before it exists.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] boop card on the hub home page, styled consistently with the existing
      app cards (hub owns its own UI — no shared components)
- [x] Clear "Coming soon" label
- [x] A small looping preview animation in the boop spirit (musical,
      playful, no strobing/flashing)
- [x] Card does not navigate to a broken destination
- [x] Hub tests green

## Comments

Resolved 2026-08-05 (agent, Sonnet). Landed in `047150d` on `music-app`.
boop added to the hub gallery as a no-href card (renders a `<span>`, so no
broken navigation) with a "Coming soon" label via a new optional `soonLabel`
field, and a `drawBoop` canvas preview — four cells in boop's instrument
colours pulsing in sequence with smooth scale/alpha curves (no strobing).
POM gained `verifyBoopIsComingSoon`; canvas count expectation bumped 6→7.
Gate re-verified by orchestrator: `pnpm --filter hub run lint`/`typecheck`
clean, vitest 8/8, playwright 2/2. No deviations from the ticket.
