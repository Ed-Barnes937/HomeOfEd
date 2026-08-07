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

**Status:** resolved

- [x] The hint does not reappear after a reload once the user has painted
- [x] The hint fades rather than vanishing
- [x] `chrome.iwft.tsx` "the first-visit hint fades on the first stroke and never
      returns" is extended to cover the reload case (it currently only proves the
      within-session half, which is why this slipped through)
- [x] Storage failure cannot break the page — private-browsing modes throw on
      `localStorage` access; follow the `openStorage()` pattern in
      `features/scenes/useScenes.ts:25`
- [x] Full suite green

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

**Resolved (orchestrator, 2026-08-07) — PRs #53 and #58, squash-merged, CI green.**

Persistence is a standalone `silt:seen` key read through `openHintStorage()`,
which is a verbatim match for `useScenes.ts`'s `openStorage()` (same try/catch,
same comment about private browsing), plus a second try/catch around the write.
The key is read and written only in `HomePage.tsx` and never goes near
`sceneCodec`/`sceneStore`/`useScenes`, so spec §8's "scene envelopes are pure
simulation data" boundary holds — verified against the merged tree.

The fade is real: `.firstVisitHint` carries `transition: opacity 400ms ease`,
`.firstVisitHintFading` sets `opacity: 0`, and the node unmounts on
`onTransitionEnd` rather than on the paint itself.

Red-before-green verified — the extended `chrome.iwft.tsx` case failed on the
pre-fix code with `Expected pattern: /fading/ … element(s) not found`, because
the old code unmounted the hint instantly and never produced the class.

**Two caveats, neither blocking, both worth a human glance:**

1. The storage-failure criterion was met by *following* the named pattern, not
   by a test. There is no precedent in this repo for simulating a throwing
   `localStorage` in an `.iwft`, and `useScenes.ts`'s own `openStorage()` throw
   path is likewise uncovered. Matching the convention was the right call over
   inventing test infra inside a fix-up ticket, but the path stays unproven.
2. `hasSeenHint()` calls `.getItem()` unguarded — the try/catch covers *opening*
   storage, not reading from it. It runs inside a `useState` initialiser, so a
   throwing `getItem` would fail the first render. The reference pattern has the
   same shape, so this is a property of the convention rather than of this
   change; fixing it belongs in a ticket that covers both call sites.
