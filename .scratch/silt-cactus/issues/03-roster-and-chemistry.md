# 03 — Roster, chemistry, and the chart

**Status:** done
**Type:** task
**Blocked by:** 01, 02
**Spec:** [../spec.md](../spec.md) §2, §3, §6

Wire the five cactus species into `elements.ts`, add the reaction rows, and
carry the discovery machinery: graph hook edges, `chartAs` foldings, regen.

## Scope

1. **Species** — ids 26–30 as the spec's table and colour list give them:
   `duned` (carries `createSandBank`), `nub` (carries `createSprout` with
   cactus opts), `apex` (carries `createTip` with
   `{ climbP: 0.08, flowerP: 0.3 }`, `flower: blossom`, `cap: cactus`,
   height 10–16 prepaid by nub's opts), `cactus`, `blossom` (carries the
   existing `createShed`, and the spec's lifetime with
   `becomes: 'seed'`, `emits: petal 1–2`). Tags, hardness, archetypes,
   lifetimes exactly per spec §2. Append to `v1Elements`; never renumber.
2. **Reactions** per spec §3 — mind the precedence traps, they are the
   file's whole character:
   - `seed + sand → (null, duned)` p 0.03 at the tail (nothing above claims
     the pair — verify, don't assume).
   - Four `fire + <part> → steam` rows at 0.4 ABOVE `fire + [flammable]`.
   - Four `acid + <part> → sulphur` rows at 0.3 ABOVE the `[solid]`/`[powder]`
     tag rows, beside the existing eight.
   - No `duned` acid row (tag rows erase it, no residue — the `buried`
     treatment). No water rows.
   - Extend `fire.test.ts` / `acid.test.ts` precedence pins to cover the new
     named rows, as they pin the existing ones.
3. **Comments**: this file's comments are its documentation culture — every
   number and every ordering choice gets the same style of why-comment the
   neighbouring elements have. Match it; reference spec/ADR 0054 where the
   existing entries reference theirs.
4. **Graph + chart** (`src/docs/interactionGraph.ts`):
   - `CHARTED_AS`: `duned → seed`; `nub`, `apex`, `blossom` → `cactus`.
   - Hook edges, mirrored by hand as the existing four are: sand germination
     (`duned` → `nub`, bed refunded as sand), the cactus raise, the cactus
     bloom (two products — flower and cap; check how the generator wants a
     two-outcome hook edge expressed, and if it genuinely cannot, STOP and
     raise it).
   - Verify the witness keys actually distinguish `nub`/`apex` from
     sprout/tip (they are cursor-read so they should — test it, in
     `witness.test.ts`'s idiom).
   - Run `pnpm --filter silt run graph` and commit the regenerated
     `docs/interaction-graph.md` alongside (the drift test gates it).
5. **Registry/round-trip suites**: `registry.test.ts`, `sceneRoundTrip`,
   `panelModel.test.ts` (the key's words are checked against every roster
   name, substrings included — a new name may trip it) and any other suite the
   roster's shape feeds. Run the full vitest suite and fix what the new roster
   legitimately breaks; if a failure looks like a real design conflict rather
   than a stale expectation, STOP and raise it.

## Rules

- TDD where there is behaviour (lifecycle of the new species, precedence
  pins); expectation updates where suites merely enumerate the roster.
- Run `pnpm --filter silt exec vitest run` and
  `pnpm --filter silt run typecheck` (do NOT run the playwright suite).
- Do not commit; leave changes in the working tree.

## Ambiguity rule

If you hit a genuine design ambiguity this ticket and the spec do not settle,
STOP, put the question under a `## Questions` heading in your final report,
and do not guess.
