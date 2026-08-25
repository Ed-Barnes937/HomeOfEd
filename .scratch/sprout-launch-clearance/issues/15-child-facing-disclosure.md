# 15 — Child-facing honest disclosure surfaces

**What to build:** A child starting a new chat sees a statement card saying Sprout is a
computer, can be wrong, and that their grown-up can see the chats; on every chat screen
(new and continue) a persistent muted line above the input repeats the disclosure — both
worded for the child's preset reading level. (ADR-0017 items 1–3; spec "Child-facing
disclosure", including the exact per-preset copy table. Do not reword the copy.)

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The shared child-config loader also returns the preset name (column exists on the
      preset row), falling back to `early-learner` when no preset row exists — unit test
      pins the fallback, keeping the ADR-0016 safe-by-default property for the
      disclosure register.
- [ ] The new-conversation empty state is replaced by the statement card (🤖, "I'm
      Sprout!", the per-preset card lines from the spec's copy table).
- [ ] A persistent one-line disclosure (the per-preset "chrome voice" line) sits above
      the chat input on both the new-chat and continue-chat screens.
- [ ] Wording is selected by the child's preset from the child-scoped `children.myConfig`
      read — never authored client-side.
- [ ] Whole-frontend tests prove preset-appropriate wording state-through-UI (seeded
      preset → visible copy), for at least the strictest and least-strict presets.
- [ ] The guardrail roadmap's 6.5.9 disclosure half cites ADR-0017 as built.
- [ ] Verify loop green.

## Comments
