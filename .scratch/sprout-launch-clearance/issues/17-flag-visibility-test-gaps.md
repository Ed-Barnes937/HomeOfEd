# 17 — Flag-visibility test gaps (topic badges + dashboard entry point)

**What to build:** Close the two test gaps from map ticket 09 so the 6.5.9
parent-visible-flag-log claim is fully pinned: a parent sees flag topics as badges
(never raw JSON), and the dashboard's "View flags" link demonstrably reaches the flag
log.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The parent-flags whole-frontend test asserts the topic badges rendered from the
      seeded topics (the seed already inserts them); the page object gains a matching
      topic-badge helper.
- [ ] A whole-frontend test clicks the dashboard's "View flags" link and lands on the
      flag log.
- [ ] The guardrail roadmap's 6.5.9 entry drops the "parent-visible flag log" clause
      (confirmed by map ticket 09).
- [ ] Verify loop green. No production code changes expected — test-and-docs only by
      design.

## Comments
