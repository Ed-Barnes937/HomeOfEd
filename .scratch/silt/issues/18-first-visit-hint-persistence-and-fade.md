# 18 — The "first visit" hint is neither first-visit-only nor fading

**What's wrong:** Spec §9: *"first visit shows one fading line (drag to pour
sand), no modal/tour"*. Design brief §04: *"fades on the first stroke and never
returns"*. Neither half holds.

`apps/silt/src/pages/HomePage.tsx:26`, `:323-327`,
`apps/silt/src/pages/HomePage.module.scss:434-446`.

- **Not first-visit.** `hasPainted` is component state with nothing persisted, so
  a returning user who reloads without painting sees the hint again — every
  visit. "Never returns" is only true within one page load.
- **Not fading.** The hint is removed by unmounting the node, so it disappears
  instantly. There is no transition on the way out.

**What to build:**

- Persist a "has painted here before" flag (a `silt:seen` localStorage key is
  enough — it does not belong in a scene envelope, which §8 defines as pure
  simulation data).
- Fade the element out rather than unmounting it — keep it mounted for the
  transition, or use a CSS animation on removal.

**Status:** claimed

- [ ] The hint does not reappear after a reload once the user has painted
- [ ] The hint fades rather than vanishing
- [ ] `chrome.iwft.tsx` "the first-visit hint fades on the first stroke and never
      returns" is extended to cover the reload case (it currently only proves the
      within-session half, which is why this slipped through)
- [ ] Storage failure cannot break the page — private-browsing modes throw on
      `localStorage` access; follow the `openStorage()` pattern in
      `features/scenes/useScenes.ts:25`
- [ ] Full suite green

**Source:** whole-branch drift review (2026-08-06), Spec axis. Silent deviation —
not recorded in any ticket. The existing iwft test's *name* claims the behaviour
the spec asked for, which is part of why nobody caught it.

## Comments

Implemented in PR #53 (`silt/18-first-visit-hint`, squash-merged).

- Persisted a `silt:seen` localStorage key (standalone — not part of any scene
  envelope) via a new `openHintStorage()` accessor in `HomePage.tsx`, mirroring
  the `openStorage()` guard in `features/scenes/useScenes.ts:25` so a
  private-browsing throw on `localStorage` access can't take the page down.
  `hintVisible` now initialises from `!hasSeenHint()`, so a returning visitor
  never mounts the hint at all.
- The hint no longer unmounts on the spot: it gets a `firstVisitHintFading`
  modifier class (`opacity: 0`, `transition: opacity 400ms ease` in
  `HomePage.module.scss`) on the first stroke or scene load, and only unmounts
  on `onTransitionEnd`.
- Extended `chrome.iwft.tsx`'s "the first-visit hint fades on the first stroke
  and never returns" case with a `page.reload()` + re-`mountApp()` (mirroring
  `scenes.iwft.tsx`'s reload pattern) to prove the hint stays gone for a
  returning visitor, plus a fading-class assertion before it disappears.
  Verified this addition red (failing on the fading-class assertion, for the
  right reason — old code unmounted with no transition at all) before writing
  the fix.
- Went through one round of the `code-review` skill (Standards + Spec axes):
  both independently flagged that the original `hasSeenHint`/`markHintSeen`
  helpers duplicated the shape of `openStorage()` instead of following it;
  folded them into the single `openHintStorage()` accessor and re-reviewed
  clean.
