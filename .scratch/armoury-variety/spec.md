# armoury variety - more kinds of wand

**Status:** ready-for-agent
**Raised:** 2026-11-09 by Ed, as the follow-up to the wand shop (PR #167)

## Why

Every wand today is a radius field on a straight axis: one turned profile with
groove sets cut out of it, in one material (wood plus a stain gradient). That
covers plain turned wands and little else. Ed shared two reference sheets, the
film wands (Ginny to Bellatrix) and Silvia Ballardini's concept sheet (13
wands, numbered c1-c13 left to right). The aim is to see how far the generator
can go, not to hit every one.

Almost every reference decomposes into five capabilities. Each is a ticket:

| Ticket | Capability | Benchmarks it unlocks |
|---|---|---|
| 01 | Raised features: shaft nodes, raised spiral ridges | Dumbledore (nodes), c3, Ron, c10 (ridge) |
| 03 | Material zones: metal bands and caps, painted wood, bone | Neville, Narcissa, Horace, Voldemort, c2, c6, c7 |
| 04 | Gems that glow in the core's colour: set gems, crystal tip, orb pommel | c1, c2, c3, c5, c6, c7, c10, c11, c13 |
| 05 | Branch wands: bent spine, organic noise, knots | Bellatrix, Harry, Neville handle, Dumbledore, c1, c4, c9 |
| 06 | Pattern stencils: carved height-map tiles | Hermione, Ginny, Snape, Sirius, Krum, c13 (scales) |

Ticket 02 is a throwaway spike that de-risks 05.

The benchmarks are internal: build a look-alike to check a capability lands.
Nothing franchise-named ships (apps/armoury/CLAUDE.md, "No franchise vocabulary").

## Build order

Sequential PRs, one per ticket, each off the latest main. Every ticket edits
`wandSchema.ts`, `compile.ts`, `geometry.ts` and `presets.ts`, so parallel
branches would mostly buy merge conflicts.

1. **01** raised features, with **02** the branch spike running alongside (it
   is thrown away, so it can't conflict).
2. **03** material zones.
3. **04** gems (wants metal settings from 03).
4. **05** branch wands, shaped by what 02 learned.
5. **06** pattern stencils.

Each PR's gate is Ed's eye on a real GPU (see the armoury-epic memory: Playwright
with `--use-angle=metal`, never SwiftShader), not just green tests.

## Decisions so far

- **Forks, curls, hooks and claws are out** (Ed, 2026-11-09). Horace's fork,
  Fleur's curl, Voldemort's hook, c3's prongs, c8's spiked head, c9's nautilus
  and c11's claws don't fit a radius field and would each be a hand-modelled
  part. Don't re-raise. c11's orb on its own is in scope (ticket 04).
- **The spine is a bend applied after the straight wand is built.** Every other
  feature is still authored in straight (angle, z) space, and anything placed on
  the surface (gems) goes through the same bend function. That keeps 05
  independent of 01, 03, 04 and 06. Ticket 02 confirms or overturns this.
- **"Carving only removes wood" becomes an envelope invariant** once 01 lands:
  the surface stays within a bounded distance of the profile, both ways. The
  generator tests in `wand/generator.test.ts` change to match.
- **Old saves keep opening.** New params get defaults, and `normalise` fills
  them in (ADR 0074). Every ticket adds params this way; none changes the save
  format's shape.
- **Control count is a real risk.** There are already five groups. New
  surface decoration goes in one new "Decorations" group rather than spreading
  across the existing ones. A top-level "Kind of wand" picker (Turned, Branch,
  ...) is expected to arrive with 05, the first real second kind; 02 checks
  whether it's needed.

## Out of scope

- Hand-modelled parts (above).
- Fine engraving below the mesh's resolution, unless ticket 06 lands normal maps.
- The hub card (`.scratch/armoury/issues/01-hub-card-shows-every-tool.md` stays
  blocked: these are all still wands).
- Sound, new spells, new cores.
