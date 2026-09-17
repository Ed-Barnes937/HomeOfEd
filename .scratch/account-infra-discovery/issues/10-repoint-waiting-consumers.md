# 10 - Re-point the waiting consumers at the decided direction

**Status:** resolved
**Type:** task
**Map:** ../map.md
Blocked by: 05

## Question

Three parked consumers were waiting on this map's direction. Append a comment
to each pointing at [ticket 05](05-decision-sitting.md)'s decisions and the
first-slice spec ticket (08), stating what the direction means for them:

- `.scratch/boop-clips/issues/02` (clip durability/reach): clips become a
  SaveStore slot (or asset) under the boop first slice; durability lands with
  the slice.
- `.scratch/boop-recorded-sounds/issues/01` (needs a BlobStore home): the
  family service's SaveStore is that home; note the voice-audio sensitivity
  flag from ticket 09's gate ADR.
- silt per-scene progression's "revisit under global accounts" note: silt is
  the deliberate *second* slice (blob/quota stress test); nothing to do until
  the boop slice proves the shape.

Comments only - no status changes on those tickets beyond what their own
owners decide.

## Answer

All three consumers re-pointed (2026-09-15), comments only, no status changes:

- [`boop-clips` 02 - clip persistence direction](../../boop-clips/issues/02-clip-persistence-direction.md):
  told that boop stays stateless, clips ride inside the `boop:save` blob to
  the family SaveStore, boop *is* the first slice (so the ordering question is
  answered), and localStorage/decode-is-total survive by construction.
- [`boop-recorded-sounds` 01 - record your own sound](../../boop-recorded-sounds/issues/01-record-your-own-sound-idea.md):
  told the SaveStore is the BlobStore home it was missing (after the boop
  slice, quota conventions pending Ed), and carried the voice-audio
  sensitivity flag from [ADR 0057](../../../docs/adr/0057-family-service-legal-gate.md):
  off-device child voice never lands by default and re-opens the gate even in
  the household pilot.
- [silt discovery-tree 28 - per-scene progression](../../silt-discovery-tree/issues/28-per-scene-progression.md):
  told the "revisit under global accounts" future is decided, silt is the
  deliberate second slice (blob/quota stress test), nothing to do until boop
  proves the shape; scene-owned progression composes cleanly.

This was the map's last open ticket.

## Comments
