# 32 — Manual save becomes a form: name in view, then Save

**Reported:** V1 feedback (Ed, 2026-08-07) — "Save this groove" feels janky. It
saves immediately, then drops you into a text field to edit the name, and the
mental model says you must save again, which produces a second entry.

**What actually happens today** (`GroovesPanel.tsx`): the tap saves, then the
"Saved it" moment shows a prefilled focused field whose "Done" button *renames*
the row it just created. **No duplicate is written by that path.** The duplicate
comes from pressing "Save this boop" a second time after Done, because nothing
said the first press had worked.

This reverses design handoff §5 — "the save has *already* happened; the field is
a rename, not a gate" — and supersedes ticket 20's "no typing required" AC.

**Decisions (grilled 2026-08-07):**

1. **Always-on form, not a reveal.** The dialog reads: title, `[name field +
   Save this boop]`, list, footer note. The field is permanently present and
   **prefilled with the generated name** ("Boop 3"), so saving stays one tap with
   no keyboard — the thing the original design was protecting. A reveal flow
   (tap → field appears → confirm) was rejected: it makes the first tap do
   nothing, which is the same jank in reverse.
2. **The gate is only against emptiness.** Save is enabled from the start; it
   disables (visibly) if the user clears the field. An always-empty field that
   must be typed into was rejected — it puts a keyboard between a child and
   saving.
3. **After saving:** the dialog stays open, the new row appears with a brief
   highlight (~1.2s, handoff `boopPop` easing + the loaded-row cyan), and the
   field **re-prefills with the next generated name** ("Boop 4"). The name in the
   box is therefore always the name that will be written, which is what stops a
   second press duplicating the first.
4. **Enter saves. Autofocus on desktop only** — autofocusing on a phone opens the
   keyboard over the list you specifically wanted visible after saving, for a
   name the child wasn't going to change.
5. The "Saved it" heading and the "Already saved. Type a new name if you want
   one." helper both die with the old flow. Nothing replaces them — the field
   speaks for itself. Row rename (the pencil) is unchanged.

**Knock-ons:**
- `saveOnOpen` (the phone save icon, ticket 27) becomes "open the dialog with the
  form ready" and **must no longer save on mount** — which also retires the
  StrictMode double-save `useRef` guard and its comment.
- Handoff §5's "Save" paragraph is rewritten. Ticket 20's superseded AC is noted
  on that ticket.

**Ships with:** 30 and 34 in one PR (grilled).

**Blocked by:** 35 — rename

**Status:** resolved

- [x] Name field always visible, prefilled with the generated name
- [x] Save blocked and visibly disabled only while the field is empty
- [x] One press = exactly one new entry; the field re-prefills with the next name
- [x] Dialog stays open; the new row is briefly highlighted
- [x] Enter saves; autofocus desktop only
- [x] Phone save icon no longer saves on mount; the StrictMode guard is gone
- [x] Design handoff §5 amended; ticket 20's superseded AC noted there
- [x] Whole-frontend test: open → save → dialog still open, one new row → save
      again → two rows, not three; clear the field → Save disabled

## Comments

Resolved 2026-08-08 (agent, Opus). Shipped with 30 and 34. The panel now renders
title → save form → list → footer. The form is a real `<form>` (so Enter
submits), prefilled from `generateBoopName`, autofocused only when `useIsPhone()`
is false, and its Save button is `disabled` on an empty name. After a save the
dialog stays open, the new row gets `data-highlighted` for 1.2s (loaded-row cyan
+ `boopPop`), and the field re-prefills with the next generated name.

Name generation moved out of `useBoops.save` — it now takes the name the form
was showing, since the form is what a child sees and edits before the write.
`saveOnOpen`, its StrictMode `useRef` guard and the whole `'saving'` panel state
are gone: with an always-on form, "open the panel" *is* "ready to save", so the
phone save icon just opens it. ADR 0027 §4 carries a superseded note; handoff §5
Save is rewritten; ticket 20's superseded AC was already noted there.
