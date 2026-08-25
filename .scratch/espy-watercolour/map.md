# espy — watercolour improvements

Making espy's ink field read as real watercolour on real paper.

Background study (read this first):
[`docs/reference/watercolour-technique/README.md`](../../docs/reference/watercolour-technique/README.md)
— a source-level study of sudoaquarelle.com, covering both its pigment model
and its procedural paper.

## Notes

The study's §8 mapping is the key context. espy's field is
*threshold-a-diffused-dye-buffer*; a high-fidelity renderer is
*simulate-pigment-settling*. Our rim pooling and granulation are painted on at
fixed magnitude rather than emerging from the model — which is the same failure
`engine/layout.ts` documents as the reason for `MIN_BLOBS = 3`.

That splits the work cleanly in two, and the two tickets follow the split:

- **01 — paper.** Ports cheaply. Nothing about our architecture is in the way.
- **02 — deposition model.** Does not port. Needs alignment and prototypes
  before anyone writes shipping code.

## Decisions so far

- Implement from the Curtis et al. 1997 paper and from the study, **never** by
  porting sudoaquarelle source — no licence is served with it. See the study's
  provenance section.
- The paper effect ships with static constants. No `?tune` panel, no user-facing
  controls. (Ed, 2026-08-16.)

## Fog

- Whether the deposition model can reach a settled state inside espy's ~1500ms
  bloom-then-bake window. Their design runs continuously and interactively; ours
  freezes. This is the central unknown in ticket 02.
- Whether an emergent model lets `MIN_BLOBS = 3` be removed.
