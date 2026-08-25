# 01 — Theme foundation: tokens, fonts, and the light/dark toggle

**What to build:** A visitor on either screen sees the paper & ink look begin: the app loads
Newsreader and Nunito, paints from the design's token set, and gains a two-segment sun/moon theme
toggle in the top bar. Toggling switches the whole app between light and dark, the choice survives
a reload, and a first-time visitor gets their system preference.

**Blocked by:** None — can start immediately.

**Status:** resolved

Spec: `.scratch/wotd-redesign/spec.md` · Design: `reference/wotd-polish/` (README token tables +
`WOTD - Dark Mode.html`, the primary reference).

- [x] Both design palettes (light and dark) and the OKLCH level colours (solid, border, fill, hover steps) exist as CSS custom properties driven by a `data-theme` attribute on the document root
- [x] Newsreader + Nunito load via a Google Fonts link in the HTML shell (repo convention)
- [x] The theme toggle matches the design: two-segment pill, 26px circular segments, stroked sun/moon icons, active segment filled per the handoff's colour spec
- [x] Toggling flips the theme instantly on every screen; the choice persists in localStorage across reloads
- [x] With no stored choice, the theme initialises from `prefers-color-scheme`
- [x] `.iwft` coverage: toggle switches the theme and the choice persists across reload
