# 24 — Remove the placement hint from the lane grid

**What to build:** Delete the dashed square that marks the next free position
on the active clip's lane. The driver's call: it serves no purpose, and it
reads as an outline rather than an invitation.

Scope is laptop and tablet only — `SongBar` renders it, `PhoneSongBar` never
had one, so the phone already behaves the way we want.

- `features/songbar/SongBar.tsx`: drop the `nextFree` computation (line 57) and
  its comment, and the `data-hint` attribute on the square (line 241).
- `features/songbar/SongBar.module.scss`: drop the `&[data-hint='true']` rule
  (line 357).
- **Clean up the orphan this creates.** The tablet block's
  `border: 2px solid transparent` (line 340) and its long comment exist *only*
  so the dashed swap changes no geometry — a border inflates a flexible
  square's flex base size. With the hint gone both are dead. Remove them and
  confirm the tablet squares keep their exact widths.

**Deviates from:** the clip-lanes design handoff §5, which specifies the hint
("2px dashed `<clipTint>80` over the empty fill"), and `apps/boop/CLAUDE.md`'s
rule that the handoff numbers are final. Record the deviation — a note in
`docs/reference/design_handoff_clip_lanes/README.md` is enough — so the next
person reads this as a decision, not as a regression to restore.

**Ships with:** ticket 25. Both are small edits to
`features/songbar/SongBar.module.scss`, so they share one branch and one PR.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] No dashed square appears on any lane at 1280px+ or in the tablet band, whichever clip is active
- [ ] Tablet lane squares keep their existing widths — the fit across 16 positions is unchanged
- [ ] `nextFree`, `data-hint`, the `[data-hint]` rule and the transparent tablet border are all gone; no dead references remain
- [ ] The deviation from handoff §5 is recorded
