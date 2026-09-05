# 27 - life.test.ts starves under load: the repo's one flaky file

**Status:** ready-for-agent
**Type:** task
**Source:** observed repeatedly 2026-09-04/05 while parallel agents ran suites
(Ed opted to track it, per the repo's engineering-excellence bar on flakiness).
**Spec:** test infrastructure - `apps/silt/src/sim/life.test.ts`.

The facts, measured: the file is 51 tests documented at ~21s (72-87s on a
busy-but-sane machine). Under heavy parallel load it inflated to 800-1651s
and failed 1-3 cases per run - different tests each time (the meadow hold,
the ash wash, the torch-and-rain case) - while passing 51/51 alone every
time. The failures are starvation, not wrongness: long seeded sim runs with
(presumably) wall-clock-adjacent expectations, sharing worker slots with 39
other vitest files plus whatever else the machine is doing.

## Mandate

Measure before changing: find what actually fails under contention - a real
timeout, a tick-budget assumption, or vitest worker scheduling - by running
the file under artificial load and reading the failure, not guessing.

## Directions (implementer picks after measuring)

1. If the long cases assume wall-clock: remove the assumption (tick-driven
   loops with no time budget), so slowness is only slowness.
2. Vitest-level isolation: mark the file as its own pool/sequence (vitest
   `poolMatchGlobs` / `sequence` config or a `slow` project) so it is not
   time-sliced against 39 other files.
3. Split the file: the handful of long seeded runs (meadow, torch-and-rain)
   into a `life.slow.test.ts` that runs sequentially.

Do NOT weaken assertions or raise timeouts as the fix - the bar is a suite
that is green on a loaded machine because nothing in it depends on the
machine being quiet.

## Tests

- The acceptance test is the suite itself: full `pnpm --filter silt run test`
  green while the machine is under synthetic load (document the load recipe
  used in this ticket's Outcome).
