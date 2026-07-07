# Adversarial eval harness (Phase 6.5.3)

The objective oracle for guardrail safety work. A fixed, version-controlled set
of known bypasses (the **trick set**) is run against the pipeline's
**deterministic** guardrails on every change, and a **bypass rate** is reported.
A regression fails the build.

This is built first on purpose: every later safety PR (6.5.1, 6.5.5, 6.5.7, …)
is judged against it, so "working" has a shared, objective definition instead of
one fallible LLM judging another.

## What it covers

The deterministic, CI-runnable layers — the output blocklist, the
sensitive-topic detector, and the conversation-depth tracker. A case is
**caught** if _any_ of those layers flags it (defence-in-depth).

The LLM judge / validation model is **out of scope**: it needs an API key and is
non-deterministic, so it cannot gate CI. Techniques that primarily target the
judge (apology, story framing) are still included — they are scored against the
deterministic surface, which documents what that surface does and does not catch
on its own.

## Files

- `trick-set.ts` — the cases (data). Each is a disguised piece of disallowed or
  sensitive content. Add cases here.
- `harness.ts` — the runner: executes the deterministic guardrails per case and
  computes the bypass rate.
- `eval.test.ts` — the CI gate (vitest).

## The ratchet

Each case carries `expected: "caught" | "bypass"` — its current, committed
behaviour. The gate asserts every case's actual outcome equals its `expected`:

- A case marked **caught** that starts bypassing → **regression, build fails.**
- A case marked **bypass** that becomes caught → **build fails until you flip
  `expected` to `caught`**, locking in the win.

So the baseline only ever moves in the safe direction, and adding a newly
discovered (documented) bypass doesn't trip a coarse threshold.

## Running it

```sh
pnpm test:eval                          # from the repo root (what CI runs)
pnpm --filter sprout-pipeline test:eval
```

The bypass rate and per-technique breakdown print to the log.

## Extending it

Add a `TrickCase` to `TRICK_CASES` in `trick-set.ts`: a stable unique `id`, the
`technique`, a `description`, the `input`, and `expected`. Run `pnpm test:eval`
to see the real outcome, then set `expected` to match. Multi-turn (crescendo)
cases add a `history` array, evaluated by the depth tracker.
