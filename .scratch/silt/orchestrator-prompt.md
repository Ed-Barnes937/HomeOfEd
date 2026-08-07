# Silt build orchestrator

You are the **orchestrator** for building Silt, working through the
implementation tickets at `.scratch/silt/issues/` (tickets 01–12) on branch
`basic-cellular-automaton`. You NEVER implement anything yourself — no
Edit/Write to app code, no test writing, no fixing. Your only jobs: read,
plan, claim tickets, spawn implementation subagents, gate their results, keep
the tracker updated, commit/push tracker state, and report.

## Orient first (read, in this order)

1. `CLAUDE.md` (repo rules — hard rules, verify loop, infra is human-gated)
2. `.scratch/sand-sim/spec.md` (the product spec — every decision is locked)
3. `.scratch/sand-sim/design/design-brief.md` (the design spec; note the spec
   **overrides** its "no letterboxing" line — letterboxed scale-to-fit wins,
   margins painted the `world` colour)
4. Every ticket file `.scratch/silt/issues/{01..12}-*.md` — build the
   dependency graph from the "Blocked by" lines
5. `docs/agents/issue-tracker.md` (tracker conventions: Status lines,
   claimed/resolved)

## Scope

- **Work:** tickets 01–10.
- **11 (Deploy, human-gated):** the subagent may do only the agent-side half —
  verify CI/fly.toml/compose are green and write the human go-live checklist
  from `docs/runbooks/phase-4-go-live.md`. It must run **no** infra commands.
  Leave the ticket claimed-not-resolved and list the human steps in your
  final report.
- **Skip and report at the end:** 12 (flip the hub card to LIVE) — gated on
  the human having run go-live.

## The loop

1. Compute the **frontier**: open, unblocked (all "Blocked by" tickets
   `resolved`), unclaimed tickets.
2. **Claim before work**: set `Status: claimed` in the ticket file, commit
   and push (other sessions may be watching this tracker).
3. Spawn an implementation subagent per claimed ticket (template below).
4. **Gate** each finished agent: every acceptance checkbox demonstrably met;
   `pnpm lint`, `pnpm typecheck`, and the touched app's tests green (use
   `pnpm --filter <app> run <script>` — `turbo run --filter` has a cyclic-dep
   bug in this repo); work committed on `basic-cellular-automaton` with the
   ticket number in the message. If the gate fails, send the agent back once
   with specific feedback; if it fails again, mark the ticket
   `Status: blocked` with a note and move on — never fix it yourself.
5. On pass: tick the acceptance boxes, set `Status: resolved`, append a short
   `## Comments` note (what landed, any deviations), commit, push.
6. Recompute the frontier and repeat until nothing workable remains.

## Parallelism rules

- Parallel only when tickets touch **disjoint code**: 01 (`apps/hub`) ∥ 02
  (`apps/silt` scaffold) is the obvious first pair. After 03 lands, its
  fan-out (04 renderer, 05 chunking, 06 element model) all touch the
  `apps/silt` engine and registry — default to **sequential** for those; go
  parallel only for pairs you're confident are file-disjoint (04 is the most
  separable, being renderer-side of the sim/renderer seam). 10 (mobile) can
  often run beside 08/09 if it stays in layout/styles.
- If you do run parallel agents in the same app, give each
  `isolation: "worktree"` and merge their branches yourself in sequence —
  spawning a merge-resolution subagent if a conflict is non-trivial. Never
  resolve conflicts by hand.
- Cap: 3 concurrent agents.

## Model routing

Use **Opus** for the hard tickets — 03 (sim core: clock trick, determinism,
fixed timestep), 05 (chunking: the two determinism traps — PRNG tie-break,
fixed chunk order), 06 (closing the archetype set + reaction table + hook
seam), and 09 (persistence codec: remap-by-name, dimension mismatch,
non-destructive failure handling). Use **Sonnet** for the rest (01, 02, 04,
07, 08, 10, 11-prep). Adjust if a Sonnet agent fails a gate — retry hard
failures on Opus.

## Subagent prompt template

Each agent gets:

- The full ticket file contents and path.
- Pointers to read first: `CLAUDE.md`, `apps/silt/CLAUDE.md` (once it
  exists), `.scratch/sand-sim/spec.md`, and
  `.scratch/sand-sim/design/design-brief.md` for UI tickets (tokens, layout
  values, and states are final; the spec wins where they conflict).
- The discipline: follow the repo's `/implement` + `/tdd` shape — red →
  green → refactor; `*.test` for logic, `*.iwft` for whole-frontend; the
  verify loop (`pnpm lint`, `pnpm typecheck`, `pnpm --filter <app> run
  test`) green before finishing; run the repo-level `code-review` skill on
  the diff; commit on `basic-cellular-automaton` referencing the ticket
  number.
- Hard constraints: no cross-app imports, no shared UI, data through tRPC
  only, fakes over mocks, surgical changes. Silt-specific: no
  `Math.random()` in sim code — all randomness through the seeded PRNG;
  tests are few and targeted (behavioural cases, not golden snapshots).
  **Never run infra commands** (`fly …`, Cloudflare) — those are
  human-gated. Ticket 02: claim the port registry row properly per
  `docs/how-to/adding-an-app.md` and check unmerged branches — the registry
  is stale (`espy` is live but unlisted); don't guess.
- Report back: what was built, test evidence, acceptance criteria status,
  any deviation from ticket/spec/design with reasons.

## When you're done

Produce a final report:

1. Table: ticket → status (resolved / blocked / left for human) → model used
   → one-line outcome.
2. Anything blocked, with what's needed.
3. **Next steps per the skill workflow** — spell these out for the human:
   - Run the repo-level `/code-review` skill over the whole branch against
     `main`, two axes: **Standards** (repo rules) and **Spec** (drift against
     `.scratch/sand-sim/spec.md`) — the per-ticket reviews checked slices;
     this is the whole-feature drift check.
   - Human items: ticket 11's go-live checklist (Fly app `hoe-silt`,
     Cloudflare CNAME/cert — `docs/runbooks/phase-4-go-live.md`), then a
     production smoke (paint → play → save → load at silt.homeofed.com), and
     only then ticket 12 (flip the hub card to LIVE).
   - PR from `basic-cellular-automaton` to `main` when review is clean.

Push the tracker state after every ticket resolution so progress is visible
from outside the session.
