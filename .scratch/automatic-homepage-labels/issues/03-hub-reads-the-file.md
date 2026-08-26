# 03 — The homepage reads the generated dates

**Status:** done
**Type:** task
**Blocked by:** 01
**Spec:** [../spec.md](../spec.md)

**What to build:** replace the hand-written `deployedAt` / `updatedAt` literals
in `apps/hub/src/pages/HomePage.tsx` with values derived from
`apps/hub/src/generated/deployments.json`.

- `AppLink` gains `pkg?: string` — the workspace package name, the join key
  between the card and the file. Card `name` is a display string
  (`fridge magnets`, `Silt`) and cannot be the key.
- A new `appDates.ts` maps a `pkg` to `{ deployedAt, updatedAt }`:
  `firstDeployedAt` → `deployedAt`, `lastDeployedAt` → `updatedAt`. An app with
  no entry (a `SOON` card, or one added before its first deploy) gets
  `undefined` for both, which both helpers already treat as "no pill".
- `isNew.ts` and `isUpdated.ts` do not change. They already take an optional
  string and an injected `now`, and the file's values are full ISO instants,
  which `Date` parses fine.
- Delete the `deployedAt` / `updatedAt` literals and their comments from the
  `APPS` array. Leave `soonLabel` alone.

**Easy to get wrong:** the "New wins over Updated" precedence at
`HomePage.tsx:109`. Every app's first entry has `firstDeployedAt` equal to
`lastDeployedAt`, so on launch day both windows are open — the existing nested
ternary is what keeps "New" showing, and it must survive the refactor intact.

**Test coverage:** `home.iwft.tsx` has no assertions on either pill today. Add
them — a card whose seeded dates are inside the window shows the right pill, a
stale one shows neither. Inject `now` rather than depending on wall-clock time,
or the test rots in two weeks.

- [ ] Unit tests first for `appDates.ts`: known app, unknown app, `SOON` card
- [ ] iwft covers New shown, Updated shown, neither shown, and New winning when
      both windows are open
- [ ] No `deployedAt` / `updatedAt` string literals left in `HomePage.tsx`
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter hub run test` green

## What changed from the ticket

**The precedence rule was extracted, not left in the JSX.** `pillFor.ts` takes
`(AppDates, now)` and returns `'new' | 'updated' | null`. The ticket said to
keep the nested ternary intact and cover precedence through the browser, but
the iwft's clock has to be chosen relative to the recorded dates (see below),
and there is no instant that *provably* has both windows open once CI starts
moving `lastDeployedAt`. As a pure function the rule is pinned exhaustively in
`pillFor.test.ts` instead, and `HomePage.tsx` is two flat lines. `isNew` and
`isUpdated` are unchanged and now only called from `pillFor`.

**The JSON import needs `with { type: 'json' }`.** The .iwft tests execute in
Node, which refuses a bare JSON import, while Vite is happy either way. Without
the attribute Playwright fails at collection with "needs an import attribute" —
worth knowing before someone tidies it away.

**The iwft clock is derived from the data.** CI rewrites `deployments.json` on
every deploy, so a hard-coded instant would have gone red on the next release.
The three tests set `page.clock.setFixedTime` to silt's own recorded dates plus
an offset. They are not vacuous: at the real current time silt shows Updated,
so both the New test and the no-pill test would fail if the clock were not
taking effect.

## Verification

`pnpm --filter hub run lint`, `typecheck`, `test` and `build` all green — 19
unit tests and 6 iwft tests, up from 16 and 3.

One pre-existing prettier warning on `src/pages/isNew.test.ts`, untouched by
this work and left alone.
