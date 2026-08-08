# 34 — WAV export moves into "My boops" as a per-boop Export

**Reported:** V1 feedback (Ed, 2026-08-07) — "Save as WAV" should be an Export
button inside the dialog rather than a link under Share.

**Today** (ticket 25): the desktop top bar carries a demoted "Save the sound as a
file" link that renders **the working grid as it stands right now** to a WAV and
hands it to the share sheet or a download. The phone chrome has no export at all.

**Decisions (grilled 2026-08-07):**

1. **One export path only.** The top-bar link is **removed**. Export means "export
   this saved boop"; to export, save first. That gives saving a purpose, and it
   gives the phone an export for the first time (via the dialog). A pinned
   "this boop (unsaved)" row and keeping both paths were both rejected.
2. **Filename: slugged, lowercase** — `boop-3.wav`. A child-typed name can contain
   anything (emoji, slashes, spaces), so slugging is required regardless; empty
   after slugging falls back to `boop.wav`.

**What to build:**
- A third icon button on each dialog row, beside rename and delete: 34 × 34,
  radius 9px, a 17px download glyph at `rgba(20,38,42,.4)` — handoff §4's icon
  treatment. Ticket 30's width increase makes room.
- It renders that row's stored pattern + tempo through the existing pipeline
  (`renderGrooveWav` → `exportGrooveWav`, both renamed by ticket 35) and delivers
  it exactly as today: share sheet where `canShare({files})`, download otherwise.
- Per-row rendering/disabled state while it works — the current `exporting` ref
  guard moves onto the row so a double-tap can't start two renders.
- Delete the top-bar link and its `onExportWav` prop threading through
  `HomePage` → `TopBar`.

**Design:** handoff §5's "demoted secondary underneath Share" paragraph is
retired; §4's row gains a third icon button. Handoff amendment.

**Ships with:** 30 and 32 in one PR — 34 is the reason 30 needs the extra width,
so reviewing them apart hides the justification (grilled).

**Blocked by:** 30 — dialog width; 35 — rename (filename and copy land once)

**Status:** ready-for-agent

- [ ] Export button on every saved row; renders that row's pattern and tempo
- [ ] Filename `boop-<slug>.wav`, falling back to `boop.wav`
- [ ] Share-sheet / download behaviour unchanged from ticket 25
- [ ] Top-bar "Save the sound as a file" link and its prop chain removed
- [ ] Double-tap cannot start two renders
- [ ] The export iwft moves to the dialog path and still drives the real
      render/encode pipeline in Chromium
