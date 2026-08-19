# orbi — technical genesis map

Label: `wayfinder:map`

## Destination

An implementation-ready ticket set for orbi v1 (full spec, Flight Console
design) under `.scratch/orbi/issues/`: every technical decision resolved, each
implementation ticket self-contained with verify criteria and executable by a
single Sonnet/Opus agent session (Fable subagents reserved for the hardest
tickets). Build happens after this map, as small PRs to `main`.

## Notes

- **Sources of truth**: features — [spec.md](spec.md); look & feel —
  [design-handoff/README.md](design-handoff/README.md).
- **Standing choices (2026-08-19, Ed, post-design-handoff)**:
  - Visual direction: **1d "Flight Console"** — chosen by the co-designer.
  - Mission Control robot's name: **Blip** (replaces UNIT-7/"Toaster", BOLT,
    Aster, Bleep, Twink).
  - **Stateless** per ADR 0008 — planets saved client-side; no DB, no auth.
- **Charting decisions (2026-08-19, Ed)**:
  - Real 3D committed (library choice pending ticket 01).
  - Trunk-based development on `main` — no epic branch; small PRs.
  - Deploy deferred: go-live (Fly app, DNS, cert — human-gated runbook) is the
    second-to-last implementation ticket; removing "coming soon" from the hub
    card is the last. The coming-soon hub card is implementation ticket #1.
  - v1 = the full spec (it is a v1 spec; v2 ideas exist separately).
  - Desktop-first; responsive/tablet is an aspiration, not a gate.
- **Skills**: grilling tickets → `/grilling` + `/domain-modeling`; prototype
  tickets → `/prototype`; research tickets → `/research` subagents;
  implementation (post-map) → `/tdd`.
- **House patterns to lean on**: silt's DOM-free engine / renderer-seam /
  test-seam split (`apps/silt`); boop's versioned save document (ADR 0025) and
  `AudioDriver` seam; stateless iwft wiring per `apps/silt/src/testing/`.
- **Port registry row reserved for orbi**: dev 3010 / CT 3110 / docker 8090
  (claim it in the registry in the first implementation PR).

## Decisions so far

<!-- one line per closed ticket: gist + link -->

## Not yet specified

- Recipe threshold numbers and balance curves — waits on the sim model
  (ticket 02) and the pacing prototype (ticket 04).
- Which surface-view "more life" decorations ship (blob families, fireflies,
  census ticker…) — the design README marks these how-might-we; waits on
  rendering architecture (06) and asset pipeline (09).
- Blip's dialogue: fact lines, hint-ladder content, deadpan voice writing —
  waits on the sim model (what facts exist to state).
- Asset creation workflow decision (and a possible HITL 2D-mock → 3D-model
  prototype) — graduates once ticket 09's research is in.
- Mobile/touch adaptations (touch-action, DPR cap, layout collapse) — revisit
  after rendering architecture (06).
- Performance budget and testing on real devices.

## Out of scope

- V2 ideas (tracked separately by Ed) — the destination is the v1 spec.
- Database / cross-device sync / auth — ruled stateless (Notes above); a DB
  is additive later.
- Offline/real-time progression, full creature simulation, achievements or
  scores — excluded by the spec's guardrails.
- Native wrapping (Capacitor etc.) — not part of this effort.
