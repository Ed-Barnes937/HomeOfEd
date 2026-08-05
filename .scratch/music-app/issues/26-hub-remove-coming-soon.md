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

**Status:** ready-for-agent

- [ ] "Coming soon" label removed
- [ ] Card links to `boop.homeofed.com`
- [ ] Verified against the live app before merge
- [ ] Hub tests green
