# 17 — Flag-visibility test gaps (topic badges + dashboard entry point)

**What to build:** Close the two test gaps from map ticket 09 so the 6.5.9
parent-visible-flag-log claim is fully pinned: a parent sees flag topics as badges
(never raw JSON), and the dashboard's "View flags" link demonstrably reaches the flag
log.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] The parent-flags whole-frontend test asserts the topic badges rendered from the
      seeded topics (the seed already inserts them); the page object gains a matching
      topic-badge helper.
- [x] A whole-frontend test clicks the dashboard's "View flags" link and lands on the
      flag log.
- [x] The guardrail roadmap's 6.5.9 entry drops the "parent-visible flag log" clause
      (confirmed by map ticket 09).
- [x] Verify loop green. No production code changes expected — test-and-docs only by
      design.

## Comments

- Done. `SproutAppPom.verifyFlagTopics` asserts one badge per seeded topic; the first
  flags test checks `['space', 'animals', 'numbers']`. A new test mounts the dashboard,
  clicks "View flags" and asserts the three seeded flags render. `clickLink` is now
  exact-match — the substring locator collided with the per-child "Review flags" link
  (strict-mode violation); the two existing callers (Terms/Privacy) still pass.
- The 6.5.9 row's "still to confirm" clause is replaced with a confirmed
  parent-visibility bullet citing ticket 09, and the row flips ⚠️ → ✅: its other
  outstanding item (the ADR-0017 disclosure build) already landed in ticket 15, so
  nothing remained to confirm. No production code changed.
