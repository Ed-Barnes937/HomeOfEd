# 0051 - silt: mud is the densest thing that moves

- **Status:** Accepted
- **Date:** 2026-09-05
- **Related:** `.scratch/silt-discovery-tree/issues/23-mud-density.md` (Ed's
  local-testing ruling, binding); `.scratch/silt-materials/spec.md` §2, whose
  density ladder this ADR **supersedes**. The number lives in
  `apps/silt/src/sim/elements.ts`; the cases are in `apps/silt/src/sim/soil.test.ts`.

## Context

Mud shipped at density 50, and the placement was deliberate: below sulphur (55)
and sand (60) so a grain still fell through it. The materials spec wrote the
consequence down as a feature:

> sand remains the ceiling and sinks through everything (v1's existing note).
>
> - `.scratch/silt-materials/spec.md` §2, *Density ladder*

Played, it reads wrong. A bed of mud that a sandfall pours straight through is a
puddle of dust, not ground - and mud is the one material in the roster whose
whole job is to be the ground a plant grows out of. Ed's words from local
testing: "Mud should be one of the most dense liquids - currently sand and
sulphur fall through it which feels odd."

## Decision

**Mud goes to 65**, which puts it above sand (60) and so above every powder in
the roster. It is now both the densest liquid and the densest thing in the
world that moves at all; only the static elements, which have no density, sit
above it. The ladder is now:

```
smoke -5 · steam -10 · fire -20 │ EMPTY │ petal 10 · oil 20 · water 30 ·
acid 35 / ash 35 · seed 40 · lava 45 · sulphur 55 · sand 60 · mud 65
```

**The archetype stays `liquid`**, with its ooze numbers untouched (dispersion 1,
move 0.1). What mud floats and what mud flows like are separate questions: one
cell of spread at one tick in ten is the slowest thing in the roster and is what
makes mud creep rather than pour. The `[liquid]` tag chip stays with it; if the
word reads oddly on the chip now, that is a presentation call, not a physics one.

## Consequences

**Intended.** A grain of sand or sulphur lands on a mud bed and stays there.
Water (30), lava (45) and acid (35) all still float on mud, so a pool sits on
top of the soil it soaks into rather than under it.

**The seed path is untouched, and that was the thing worth checking.** Burial is
the `seed + mud` reaction row, never a sinking, so it could not have been moved
by a density at all - and the seed at 40 was lighter than mud at 50 and is
lighter than it at 65, so the ordering the seed actually depends on ("rests *on*
the bed") is the same ordering as before. The raise moved mud away from the
seed, not past it. Two things named "density" nearby are not this one: the
flower's lifetime comment in `elements.ts` and `seedBank.ts`'s "density
dependent" both mean *population* density, and the bank's hook reads only the
species ids above and below a cell - it never asks the registry for a number.
`buried` is `static` and has no density at all.

**Density is not an edge.** Nothing in the interaction graph moves, so
`apps/silt/docs/interaction-graph.md` is unregenerated and its drift test is
green - verified, not assumed.

**A stale parenthetical is left standing on purpose.**
[ADR 0042](0042-silt-wood-smolders-as-ember.md) says ash rests on a bed "below
mud (50)". The claim still holds at 65 and the record of what was decided then
stays as it was written; this ADR is where the number moved.
