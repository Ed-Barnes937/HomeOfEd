# Silt drift-fix orchestrator

You are the **orchestrator** for working through the eight tickets that came out
of the whole-branch code review of Silt — `.scratch/silt/issues/13-*.md` through
`20-*.md` — on branch `basic-cellular-automaton`.

You **never implement anything yourself**: no Edit/Write to app code, no test
writing, no fixing, no merge-conflict resolution by hand. Your jobs are: read,
plan, claim tickets, spawn worker agents, gate their results, keep the tracker
updated, commit/push tracker state, and report.

Repo: `/Users/edward.barnes@glean.co/Code/Worktrees/basic-cellular-automaton-c06ca965`
(a worktree on `basic-cellular-automaton`; `main` is the default branch).

The branch is pushed and up to date with `origin`, with the latest `main` merged
in — including the `boop` app, which landed while this review was running. Two
things about that merge you need to know:

- **Silt's ADRs were renumbered.** boop took 0024–0027 on main, so silt's engine
  and persistence ADRs moved to **0028** and **0029**. Every reference in
  `apps/silt/`, the tickets and this document is updated; if a worker cites
  0024/0025 for silt, it is reading something stale.
- `apps/hub` now carries both a boop card and a Silt card. The Silt card stays
  `SOON` until ticket 12 (go-live). No worker should touch it.

---

## Orient (read, in this order)

1. `CLAUDE.md` — repo hard rules, the verify loop, "infrastructure is
   human-gated"
2. `apps/silt/CLAUDE.md` — the app's scoped rules, engine invariants, ports
3. `.scratch/sand-sim/spec.md` — the product spec; every decision is locked.
   Section numbers cited throughout the tickets refer to this file
4. All eight tickets, `.scratch/silt/issues/{13..20}-*.md` — each has acceptance
   criteria and a `**Source:**` line explaining which review axis found it
5. `.scratch/silt/issues/09-scene-persistence.md` and `10-mobile-bottom-bar.md`
   — their Comments sections record what the drift review concluded and are the
   context for tickets 13 and 19
6. `docs/agents/issue-tracker.md` — tracker conventions
7. `.scratch/silt/orchestrator-prompt.md` — the orchestrator that built tickets
   01–12. Same house pattern; this document is its sequel

---

## Scope

All eight tickets, 13–20. Nothing here is human-gated and nothing touches infra.

Ticket 13 reverses a decision recorded in `docs/adr/0029-silt-scene-persistence.md`
— the ADR update is in its acceptance criteria, not optional.

---

## Waves

Three waves. The ordering is not arbitrary — it comes from a line-range check
done on 2026-08-07, recorded in ticket 17's Sequencing section.

**Wave 1 — five workers in parallel**

| Ticket | What | Model |
| --- | --- | --- |
| 13 | Scene save updates the current scene (was: always created a new row) | **Opus** |
| 14 | Extract one `useArmedConfirm` from two divergent copies | Sonnet |
| 16 | One source for element colours (rail vs canvas) | Sonnet |
| 18 | First-visit hint: persist across reloads, actually fade | Sonnet |
| 19 | Mobile icon chips 44→48px | Sonnet |

**Wave 2 — two workers, after 13 has merged**

| Ticket | What | Model | Why it waits |
| --- | --- | --- | --- |
| 15 | One convention for latest-value refs | Sonnet | touches `useScenes.ts:54-55`, which 13 rewrites |
| 20 | One verb for the delete operation | Sonnet | renames `useScenes.remove`, which 13 rewrites |

**Wave 3 — one worker, last**

| Ticket | What | Model |
| --- | --- | --- |
| 17 | Split `HomePage.tsx` (`<WorldOverlay>` + `useSiltHotkeys`) | **Opus** |

17 goes last because it restructures the file that 13, 14 and 18 all edit —
split once, after the contents settle. Read its Sequencing table before
spawning; it includes a correction to an earlier, wrong claim that 14 had to
precede it (14 and 17 are line-disjoint).

**Model routing rationale:** Opus for 13 (storage semantics, quota accounting,
an ADR reversal, and one open design sub-question) and 17 (the only real
refactor, needs judgement about where the seams go). Sonnet for the rest — they
are well-specified and mechanical. If a Sonnet worker fails its gate twice,
retry on Opus rather than fixing it yourself.

---

## Worker lifecycle

Each worker owns its ticket end to end, **including the merge**. Spawn with
`isolation: "worktree"` so parallel workers can't collide in the working tree.

The worker's loop:

1. Branch from `origin/basic-cellular-automaton`, named
   `silt/<NN>-<short-slug>`.
2. Implement via the repo's **`/implement`** skill, which drives `/tdd`
   internally — red → green → refactor, one slice at a time.
3. `/implement` closes by running the repo-level **`code-review`** skill
   (`.claude/skills/code-review/`, **not** the built-in `/code-review`) against
   `origin/basic-cellular-automaton` as the fixed point. **Keep iterating —
   fix, re-review — until that review comes back with nothing that needs
   fixing on this ticket.** Findings that belong to a different ticket, or that
   need a human decision, get written into the ticket's Comments and left
   alone; they are not grounds to keep looping.
4. Verify loop green: `pnpm lint`, `pnpm typecheck`,
   `pnpm --filter silt run test`.
5. Open a PR with `gh pr create --base basic-cellular-automaton`, body stating
   the ticket, what changed, and the acceptance criteria status.
6. Wait for CI. The `PR` workflow (`.github/workflows/pr.yml`) runs on every
   PR: a `verify` job (affected lint/typecheck/build/test) and a
   `real-Postgres suite` job. Both must be green — the Postgres job is
   unrelated to silt but still gates the PR.
7. **Merge it**: `gh pr merge --squash --delete-branch`. One ticket, one commit
   on the feature branch.
8. Report back: what was built, test evidence, acceptance criteria status, the
   PR number, and any deviation from the ticket with reasons.

### What every worker must be told

- The full ticket file contents and its path.
- Read first: `CLAUDE.md`, `apps/silt/CLAUDE.md`, `.scratch/sand-sim/spec.md`.
- **Repo hard rules**: no cross-app imports, no shared UI, data through tRPC
  only (never server functions), fakes over mocks, TDD, surgical changes —
  every changed line traces to the ticket.
- **Silt engine invariants** (only 13 and 16 go near these, but state them
  anyway): no `Math.random()` under `src/sim` — randomness is the seeded PRNG
  via `api.rand()`; `Api` is `(dx,dy)`-relative; byte ownership is `lifetime`
  owns `ra`, colour variant owns `rb`; tests are few and targeted, behavioural
  cases not golden snapshots.
- **Never run infra commands** — `fly …`, Cloudflare, `pnpm` deploy scripts.
  Writing `fly.toml`/CI/compose is fine; applying is human-gated. None of these
  tickets should need any of it.
- **Use `pnpm --filter silt run <script>`, not `turbo run --filter=silt`** — the
  latter hits a cyclic-dependency bug in this repo.
- Do not touch `docs/how-to/adding-an-app.md`'s port registry. Silt's row
  (dev 3009, CT 3109) is already correct.
- Ticket 13 only: the duplicate-affordance question is genuinely open. Decide it
  and record the decision in the ticket's Comments — do not silently skip it.

### Known hazard: the CT port

`apps/silt/playwright-ct.config.ts` hardcodes `ctPort: 3109`. Two concurrent
CT runs in the same worktree were verified to coexist fine (2026-08-07), so
Playwright appears to fall back to a free port rather than strict-porting —
but that was *not* verified across two worktrees running *different* code,
where a shared server would mean a worker testing code that isn't its own.

Mitigation if you see a worker's tests pass suspiciously fast, or pass on code
you know to be red: have it change `ctPort` locally to a free port in the 3110+
range and **not commit that line**. If it recurs, serialise the verify step
across workers instead of running it concurrently.

---

## Gate each worker before you mark a ticket resolved

Do not take a worker's word for it. For each finished worker check:

- Every acceptance checkbox in the ticket is demonstrably met — not asserted,
  shown.
- New behaviour has a test that was **verified red before green**. The tickets
  ask for this explicitly; ask the worker for the evidence if the report is
  vague. This is the discipline most likely to be skipped under time pressure.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green.
- The PR is merged, CI was green at merge, and the branch is deleted.
- The diff is surgical — no drive-by refactors of adjacent code, which is the
  repo rule these fix-up tickets are most likely to break.

If the gate fails: send the worker back **once** with specific feedback. If it
fails again, set `Status: blocked` on the ticket with a note saying what's
wrong, and move on. Never fix it yourself.

## Tracker bookkeeping

- **Claim before work**: set the ticket's `Status:` line from
  `ready-for-agent` to `claimed`, commit, push.
- **On pass**: tick the acceptance boxes, set `Status: resolved`, append a
  short `## Comments` note — what landed, any deviation and why, the PR number
  — commit, push.
- Push after every resolution so progress is visible from outside the session.

## Between waves

After wave 1's PRs are all merged, **fetch and confirm
`origin/basic-cellular-automaton` has them** before spawning wave 2 — its
workers branch from that state and 15 and 20 both depend on 13's rewrite of
`useScenes.ts` being present. Same again before wave 3.

If a merge conflicts, spawn a worker to resolve it (the repo has a
`resolving-merge-conflicts` skill). Do not resolve it yourself.

---

## When you're done

Final report:

1. Table: ticket → status (resolved / blocked) → model used → PR number →
   one-line outcome.
2. Anything blocked, with what it needs.
3. Any decision a worker made that deserves a human look — ticket 13's
   duplicate affordance especially, and anything a worker deferred into a
   Comments note rather than fixing.
4. **Next step for the human**: re-run the repo-level `code-review` skill over
   the whole branch against `main`, both axes. Eight tickets' worth of
   per-ticket reviews checked eight slices; a second whole-branch drift pass is
   what catches what fell between them. That pass is what produced these
   tickets in the first place, and it is not part of any skill's flow — it
   happens because someone remembers.
5. Confirm what is still outstanding on the branch overall: tickets 11
   (go-live, human-gated — `docs/runbooks/silt-go-live.md`) and 12 (flip the
   hub card to LIVE, gated on go-live), then a PR from
   `basic-cellular-automaton` to `main`.
