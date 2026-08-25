# 16 — Pipeline system prompt: positive identity instruction

**What to build:** When a child asks Sprout whether it is a real person or a human, the
model is instructed to answer plainly that it is a computer program, not a person — one
always-present sentence in the pipeline system prompt, all presets, complementing the
existing negative blocker. (ADR-0017 item 4.)

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The system prompt builder gains one positive identity instruction, present for all
      presets alongside the existing "never pretend to be a real person" blocker.
- [ ] The prompt unit tests assert the new instruction (the file's existing loose-regex
      style) — and also pin the existing negative blocker, which is currently untested.
- [ ] Verify loop green for the pipeline app.

## Comments
