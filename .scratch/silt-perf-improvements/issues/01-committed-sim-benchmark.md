# 01 — A committed sim benchmark

**Status:** done
**Type:** task
**Spec:** [../spec.md](../spec.md)

Every ticket after this one claims a speed-up. Nothing in the repo can check
that claim, so this lands the measuring stick first.

**What to build:** `apps/silt/bench/sim.bench.ts`, a plain Node script (no new
dependency) that builds a `Sim`, drives a set of named scenarios, and prints
ms/tick for each. It runs under `node --experimental-strip-types`, like
`src/server/main.ts` does — so it sticks to erasable TS syntax (ADR 0004).

Wire it up as `"bench": "node --experimental-strip-types bench/sim.bench.ts"`
in `apps/silt/package.json`. It is **not** part of `pnpm test` — it is a tool,
not a gate, and a timing assertion in CI would only flake.

Scenarios, each 200 warm-up ticks then 1500 measured (these are the four the
audit used, and their fast-Mac baselines):

| Scenario | Setup | Per tick | Baseline |
| --- | --- | --- | --- |
| `spawners + mixed world` | stone floor, water pool, wood block, dirt bank | emit sand/water/oil from five fixed cells | 1.04 ms |
| `reaction churn` | stone floor, a wide wood slab | drop fire/lava on it, and acid above | 1.81 ms |
| `plant growth` | stone floor, deep water, seeds bedded in mud every 9 cells | — | 1.52 ms |
| `settled world` | the mixed world, left alone | — | ~0.37 ms |

`settled world` is there to guard the sleep path: if a later change makes a
settled world stop sleeping, that row is where it shows up.

**Print `scannedLastTick` alongside each timing.** A scenario that got faster
because it stopped simulating is not a win, and the scanned count is the only
thing that tells the two apart.

**Watch out for:** a scenario that quietly settles during the warm-up measures
nothing but loop overhead. Two of the audit's first attempts did exactly that —
`all-water` and `all-sand` both fell to `scanned=0`. Check every scenario
reports a non-trivial scanned count at the end of its run, and say so in the PR.

- [ ] `pnpm --filter silt run bench` prints four rows with ms/tick and scanned counts
- [ ] No new dependency; erasable TS syntax only
- [ ] Every scenario still scanning at the end of its run
- [ ] Not wired into `pnpm test`
- [ ] `apps/silt/CLAUDE.md` Commands section mentions it
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green

## Answer

Landed as `apps/silt/bench/sim.bench.ts`, run with `pnpm --filter silt run bench`.
Not wired into `pnpm test`. Baselines on the dev Mac:

```
spawners + mixed world   0.749 ms/tick   scanned=6374
reaction churn           0.911 ms/tick   scanned=1968
plant growth             0.999 ms/tick   scanned=5786
settled world            0.067 ms/tick   scanned=275
```

Plant growth settled to `scanned=0` on the first attempt — the trap the ticket
warned about — because `MAX_PLANT_NEIGHBOURS = 1` makes growth terminal. Fixed
with a deeper reservoir rather than a per-tick feed.

**Known weakness:** `reaction churn` scans 1968 where the audit's own version
held 4553; the wood slab burns out partway, so it understates ticket 02. See
the map's Fog.
