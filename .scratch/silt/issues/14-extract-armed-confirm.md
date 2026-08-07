# 14 — Two arm-then-confirm state machines, built twice and drifting

**What's wrong:** The reset confirm (spec §3) and the scene-delete confirm
(spec §9) are the same mechanism implemented twice, in two tickets, and they
have already diverged.

- `apps/silt/src/pages/HomePage.tsx:72-87` — `armReset`, `RESET_ARM_MS = 3000`,
  its own timer ref and unmount-clear effect.
- `apps/silt/src/features/scenes/ScenesPopover.tsx:43-53` — `armDelete`, its own
  `3000`, its own timer ref and effect.

The divergence: `armDelete` clears a pending timer before re-arming, `armReset`
does not. Same intent, two behaviours under repeated clicks.

**What to build:** One `useArmedConfirm(ms)` hook returning
`{ armed, arm, disarm }`, used by both call sites, with the 3s constant living
in one place. Behaviour of both confirms should be identical afterwards.

**Status:** resolved

- [x] Both confirms go through one hook; the `3000` appears once
- [x] Repeated clicks behave the same at both sites (the `clearTimeout`
      divergence is gone)
- [x] Existing coverage still passes: `chrome.iwft.tsx` "reset needs a second
      click", `scenes.iwft.tsx` "deleted behind a second click"
- [x] lint / typecheck / `pnpm --filter silt run test` green

**Note on the 3s auto-disarm itself:** it is scope beyond §3's bare
*"second-click confirm"*, was recorded in ticket 07's Comments and explicitly
flagged for human veto. The drift review judged it justified and consistent
across both confirms, so this ticket keeps the behaviour and only removes the
duplication. If the human vetoes the auto-disarm, it comes out of one place
instead of two.

**Source:** whole-branch drift review (2026-08-06), Standards axis, Duplicated
Code — the class of finding a per-ticket review cannot see, since tickets 07 and
09 each only had their own half in front of them.

## Comments

**Resolved (orchestrator, 2026-08-07) — PR #54, squash-merged, CI green.**

`useArmedConfirm(ms)` now lives at `apps/silt/src/hooks/useArmedConfirm.ts`,
returning `{ armed, arm, disarm }` and exporting `ARM_MS = 3000` as the sole
default. `HomePage.tsx` (reset) and `ScenesPopover.tsx` (scene delete) both call
it; `RESET_ARM_MS` and `DELETE_ARM_MS` are gone, so the constant appears once.
`arm()` always clears a pending timer before setting a new one, which is the
divergence the ticket was filed for.

Red-before-green was verified: the hook was first written with the old bug
ported in, and `useArmedConfirm.iwft.tsx` failed with
`Expected: "b" Received: "none"` — a leaked first timer disarming early after a
re-arm. Adding the `clearTimeout` turned it green with no change to the test.

Diff is 5 files / +121 −39, all traceable to this ticket. The 3s auto-disarm
behaviour is unchanged, as the ticket scoped — it remains pending a separate
human veto, and now comes out of one place if vetoed.

One in-flight correction from the code-review pass: the test-only probe was
first placed in `src/hooks/` beside the real hook and was moved to
`src/testing/`, which `apps/silt/CLAUDE.md` names as the home for harness code.

Minor, not blocking: the new test file is `src/useArmedConfirm.iwft.tsx`, named
after the unit rather than after what it tests, which is the convention ticket
20 is tidying for `silt.iwft.tsx`. Left alone here to keep this diff surgical.
