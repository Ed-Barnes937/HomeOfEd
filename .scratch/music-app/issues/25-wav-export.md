# 25 — WAV export (spike mobile Safari first)

**What to build:** A secondary "get the audio" action tucked behind/below
Share: an offline render of the pattern looped ~4× to a WAV file, offered via
the share sheet on mobile and download on desktop. No import.

**Spec caveat:** this is the highest-risk feature and the first candidate to
cut from V1. Start with the mobile-Safari verification; if it can't be made
to work acceptably there, close this ticket as "cut from V1" (the spec
explicitly allows it) rather than shipping a desktop-only export.

**Blocked by:** 18 — Launch kit content; 21 — URL-hash share links (the Share
affordance it nests under).

**Status:** resolved

- [ ] Spike first: offline render + share-sheet delivery proven on real
      mobile Safari before building the full feature
- [x] Offline render of ~4 loops at current tempo to WAV
- [x] Demoted placement below/behind the primary Share action
- [x] Share sheet on mobile, download on desktop (built + feature-
      detected; real-device verification outstanding)
- [ ] If the spike fails: ticket closed as cut-from-V1 with findings
      recorded, nothing half-shipped

## Comments

2026-08-06 (agent, Sonnet; orchestrator note): **built, NOT resolved** —
landed in `7f5d3f8` on `music-app`. The ticket's "spike mobile Safari
first" step cannot be run from an agent environment, so per orchestrator
instruction the full feature was built behind the demoted placement and
the ship-or-cut decision is deferred to the human device test.

What shipped: pure byte-tested 16-bit PCM WAV encoder; pure render/mix
math mirroring the engine's gain staging (hard-clamp noted as NOT
equivalent to the live Limiter); injectable decode seam; export action on
the shareAction target idiom (canShare({files}) -> share sheet, else
object-URL download); "Save the sound as a file" link below Share per the
design. 27 new unit tests; export iwft drives the REAL pipeline in
Chromium (real fetch/decode/encode/download, filename `groove.wav`).
Verify loop green at gate: lint/typecheck clean, vitest 172/172, CT 34/34.

**Outstanding HUMAN step (mobile Safari, real device):**
1. Open boop in iOS Safari, build a short pattern.
2. Tap "Save the sound as a file" under Share.
   - Success: iOS share sheet opens with a playable .wav attached (or a
     clean download fallback where canShare({files}) is false).
   - Failure: nothing happens / silent JS error / freeze during render /
     file doesn't play the pattern.
3. On failure: invoke the ticket's cut-from-V1 clause — hide the
   affordance, record findings here. Cutting still unblocks ticket 26.

2026-08-06 (orchestrator): **owner decision — device test waived.** Ed
chose not to run the mobile-Safari verification; the feature ships as
built (feature-detected share sheet with graceful download fallback).
Ticket resolved on that basis. If iOS export turns out broken in the
wild, the cut-from-V1 clause above is the playbook.
