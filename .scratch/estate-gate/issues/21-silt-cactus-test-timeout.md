# 21 - silt: `cactus.test.ts` times out on a loaded CI runner

**Status:** needs-triage
**Type:** task

Not caused by this epic; it surfaces whenever a change makes every app
turbo-affected, as any `packages/backend-kit` change does.

On PR #191 (run 42861266364, commit 9ff910c) `verify` failed on
`apps/silt/src/sim/cactus.test.ts` > "the desert loop" > "climbs a tall, slow
column and finishes it with one draw": 32.9s against a 30s timeout. The whole
file took 76s. Nothing in the PR touches silt, and the other 634 silt tests
passed, so this is a slow test with no headroom rather than a breakage.

Options: make the test cheaper (a shorter column proves the same rule), or
give it an explicit timeout with real headroom. Measure locally and on CI
before choosing; do not just raise the number.

## Comments

2026-11-10: ticket 12 saw the same on `apps/silt/src/sim/life.test.ts`: three
timeouts at load average 54, and one test still took 42s against its 30s
limit at load 24. Same cause, same fix.
