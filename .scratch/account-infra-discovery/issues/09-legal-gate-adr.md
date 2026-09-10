# 09 - Legal gate ADR for the family service

**Status:** ready-for-agent
**Type:** task
**Map:** ../map.md
Blocked by: 05

## Question

Draft the short legal-gate ADR decision 11 committed to, modelled on sprout
ADR-0019, for Ed's review before merge. Posture decided in
[ticket 05](05-decision-sitting.md):

- Parent-owned accounts with child *profiles* (username + display name only,
  no child email).
- Invite-code-closed registration; supervised household pilot from day one.
- Counsel sign-off, real ToS/Privacy, and safeguarding review are the gate to
  any **non-household** account ever existing - the ADR records that boundary
  so it lives in the repo, not in Ed's head.
- Content sensitivity tiers flagged: boops/scenes/doodles are low-sensitivity
  creations; recorded child *voice* audio (`.scratch/boop-recorded-sounds`)
  is a step up and remains a deliberate call, not a default.
- Scope note: this gate is the family service's own; sprout's ADR-0019 gate
  stays scoped to sprout (decision 1 kept them separate on purpose).

Deliverable: `docs/adr/NNNN-family-service-legal-gate.md` (next free number
at write time), MADR-lite, marked Proposed until Ed accepts.

## Comments
