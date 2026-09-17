# 09 - Legal gate ADR for the family service

**Status:** resolved
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

## Answer

Drafted as [`docs/adr/0057-family-service-legal-gate.md`](../../../docs/adr/0057-family-service-legal-gate.md)
(0057 verified free on origin/main and every remote branch at write time),
MADR-lite, **Status: proposed** until Ed accepts. It records:

- Parent-owned accounts, child *profiles* only (username + display name; no
  child email/password/DOB) - decision 11's posture verbatim.
- Invite-code-closed registration (`REGISTRATION_INVITE_CODE`, sprout's exact
  mechanism: required in prod, crash on missing, never persisted).
- The hard boundary: counsel sign-off + real ToS/Privacy + safeguarding review
  before any non-household account, recorded as a follow-up ADR; no partial
  opening.
- Content sensitivity tiers: boops/scenes/doodles low; recorded child voice
  audio (`.scratch/boop-recorded-sounds`) is a step up that re-opens the gate
  even inside the pilot - deliberate call, never a default.
- Two named pilot-only shortcuts the first-slice spec delegates to this gate
  (shared-device profile tokens, hand-reset passwords with no email
  machinery), both flagged as must-revisit before the gate opens.
- Scope: the family service's own gate; sprout's ADR-0019 stays scoped to
  sprout - prior art, not a parent.

For Ed's review before merge. No new fog surfaced; ticket 10 already carries
the voice-audio cross-reference this ADR feeds.

## Comments
