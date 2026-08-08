# 31 — Saved/edited indicator

**Reported:** V1 feedback (Ed, 2026-08-07) — it isn't obvious whether a boop has
been saved, automatically or otherwise.

**The framing that makes this tractable.** boop has two kinds of saving (ADR
0025 / `CONTEXT.md`):

- The **working grid** — always autosaved after a 2s lull, flushed on `pagehide`.
  Never lost; just unnamed.
- A **saved boop** — a named copy in the list.

So "unsaved" cannot mean "you will lose this". It means "this is not in your
list, or it has diverged from the one you loaded".

**Decisions (grilled 2026-08-07):**

1. **What it reports.** One indicator with two states: **`Boop 3 • edited`** when
   a loaded saved boop has diverged, **`Not saved yet`** when no saved boop is
   loaded. This requires tracking which saved boop is currently loaded — which
   also delivers the "currently loaded" row treatment the handoff specifies in §4
   (`background: rgba(11,124,145,.1)`, `inset 0 0 0 1.5px rgba(11,124,145,.5)`)
   and V1 never built. Build both here.
2. **What counts as an edit: a tempo change does.** Tempo is part of a saved
   boop, so a boop whose tempo you moved genuinely differs from the one on disk.
   **The existing starter-ring rule is dropped into line with this** — today
   `HomePage`'s `activePreset` deliberately survives a tempo change; that
   exemption goes, so there is one definition of "changed" in the app. Remove the
   comment block in `HomePage.tsx` that justifies the old rule.
3. **Starters get no identity.** Loading a starter reads `Not saved yet`, same as
   a blank grid — the indicator's job is "is this in My boops", and a starter
   never is. Which starter is loaded remains a concern of the New boop dialog's
   card ring (ticket 36) only.
4. **Phone placement: a dot badge on the existing save icon** in the 52px strip —
   filled when edited, hollow when saved. There is no horizontal room for text
   (back arrow, wordmark, spacer, save icon, `⋯`), and the save icon is the one
   spot in the phone chrome that already means "saving".
5. **No tab-close guard.** `beforeunload` would warn about nothing losable (the
   working grid is already flushed on `pagehide`) and the browser's own confirm
   text is unreadable to a 6-year-old.

**Where the desktop indicator sits:** in the top bar, after the wordmark, before
the `flex:1` spacer. Chivo 600, small, `rgba(242,239,230,.5)` — quiet chrome, not
a status bar.

**Design:** new surface — no new colours (reuse `--cyan-solid` for the loaded row
per §4 and existing ink alphas for the text). Handoff amendment for the top-bar
region and the phone strip's save icon.

**Blocked by:** 32 — the save form (it defines the moment this clears); 35 — rename

**Status:** ready-for-agent

- [ ] Loaded-boop identity tracked; set on load, cleared by Clear grid and by
      loading a starter, adopted by a fresh save
- [ ] Indicator reads `<name> • edited` / `Not saved yet` on desktop; dot badge
      on the phone save icon
- [ ] Any cell toggle **or tempo change** marks edited; the old starter-ring
      tempo exemption is removed, not left alongside
- [ ] "Currently loaded" row treatment in the dialog, per handoff §4
- [ ] No `beforeunload` handler anywhere; a test proves a plain autosaved grid
      raises no browser prompt
- [ ] Whole-frontend test: save → indicator clears → toggle a cell → `• edited`
      → change tempo only → still `• edited` → reload the saved boop → clears
