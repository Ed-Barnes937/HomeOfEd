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

**Status:** claimed

- [ ] Both confirms go through one hook; the `3000` appears once
- [ ] Repeated clicks behave the same at both sites (the `clearTimeout`
      divergence is gone)
- [ ] Existing coverage still passes: `chrome.iwft.tsx` "reset needs a second
      click", `scenes.iwft.tsx` "deleted behind a second click"
- [ ] lint / typecheck / `pnpm --filter silt run test` green

**Note on the 3s auto-disarm itself:** it is scope beyond §3's bare
*"second-click confirm"*, was recorded in ticket 07's Comments and explicitly
flagged for human veto. The drift review judged it justified and consistent
across both confirms, so this ticket keeps the behaviour and only removes the
duplication. If the human vetoes the auto-disarm, it comes out of one place
instead of two.

**Source:** whole-branch drift review (2026-08-06), Standards axis, Duplicated
Code — the class of finding a per-ticket review cannot see, since tickets 07 and
09 each only had their own half in front of them.
