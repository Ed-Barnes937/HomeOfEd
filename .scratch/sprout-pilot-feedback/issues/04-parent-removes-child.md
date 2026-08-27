# 04 — Parent can remove a child

**What to build:** There is no way for a parent to remove a child account. The
intended behaviour (per Ed): deleting the child removes the child account, their
chat history, and the parent↔child link. The schema already cascades from
`children` (presets, conversations→messages→flags, behavioural events all hang
off `childId` with `onDelete: cascade`), so the mechanical delete is one row —
the work is the decision about what SHOULD be erased, then the handler + UI.

**Blocked by:** Discussion below — do not build until the retention questions
are settled with Ed.

**Status:** needs-info

**Implications to talk through before building** (Ed explicitly asked for this):

- Deleting chat history also deletes **safety flags and behavioural events**
  (same cascade as ticket 03). If a flag ever needs to be part of a
  safeguarding record (see `docs/safeguarding/csam-grooming-escalation.md` and
  the launch-readiness incident-log item), erasing it on child removal may be
  the wrong default — an incident could be "cleaned up" by deleting the child.
  Options: full cascade as specced; retain flags detached from the child for a
  fixed window; retain only flags already part of an incident.
- UK GDPR pulls both ways: erasure on request vs. safeguarding-justified
  retention. The counsel-facing docs (ADRs 0011–0018 set) should record
  whichever line we pick.
- Account-level erasure already exists implicitly: deleting the parent user
  cascades through `children.parentId`. Whatever we decide here should match
  that path's semantics, or that path should change too.
- Soft-deleted conversations (ticket 03) must not resurrect or block removal.

Once decided:

- [ ] Parent-scoped `children.remove` handler (ownership check, then delete /
      retain per the decision above), with unit tests.
- [ ] Child settings page gains a remove action behind a strong confirm (type
      the child's name, or similar) — this is irreversible for real data.
- [ ] Any retained records are inaccessible from normal parent/child UI and
      documented in the privacy policy if retention is chosen.
- [ ] `.iwft`: removed child disappears from the children list and their
      session can no longer authenticate.

## Comments

**2026-08-27 (Ed, pilot feedback):** Requested with the explicit instruction
that the ticket flag the implications of deleting chat history for discussion.
