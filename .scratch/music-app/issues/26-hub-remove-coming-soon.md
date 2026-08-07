# 26 — Hub card: remove "Coming soon"

**What to build:** Once boop V1 is live at `boop.homeofed.com`, the hub card
drops its "Coming soon" label and becomes a real link to the app, consistent
with the hub's other live app cards.

**Blocked by:** 17 — Playhead + hit motion; 20 — My grooves; 21 — Share
links; 22 — Starter grooves; 23 — Keyboard + accessibility; 24 — Hint sheet;
25 — WAV export (which may resolve as "cut from V1" — that still unblocks
this); 27 — Small-phone layout; 28 — Final instrument artwork (or an
explicit decision to launch on attributed placeholders). Also gated on the
human-run go-live (Fly app + Cloudflare, per the runbook) — don't remove the
label before the app is actually reachable.

**Status:** resolved

- [x] "Coming soon" label removed
- [x] Card links to `boop.homeofed.com`
- [x] Verified against the live app before merge
- [x] Hub tests green

## Comments

Resolved 2026-08-07 (agent, on `music-app`). Go-live confirmed first:
`https://boop.homeofed.com/` returns 200 and `/health` -> {"ok":true}. TDD:
POM `verifyBoopIsComingSoon` flipped to `verifyBoopLink` (href asserted +
"Coming soon" absent), red confirmed, then the card flipped to
`status: 'LIVE', href, deployedAt: 2026-08-07` (drives the "New" pill, same
shape as espy/karesansui). `soonLabel` field kept — still the fallback for
HEIG's SOON card. Verify loop green: lint, typecheck, hub vitest 8/8 +
playwright 2/2.
