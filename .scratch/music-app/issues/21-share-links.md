# 21 — URL-hash share links

**What to build:** One Share action that turns the current creation (pattern,
tempo, kit id) into a URL with everything encoded in the hash fragment — no
server. Opening a shared link opens boop with the groove loaded and ready to
play. Mobile gets the system share sheet; desktop copies to the clipboard and
the button label flips to "Copied!". No modal, no "copy this text" field.

**Design:** the handoff (`docs/reference/boop-design/README.md`) specifies
the Share button states — resting, then a cyan "Copied!" with check that
pops (`boopPop`, 450ms) and reverts after 1.6s, no toast, no modal, **no
link field ever** — and the demoted "Save the sound as a file" link beneath
it (ticket 25). **Note:** the handoff's README assumes a server-backed
`/g/<id>` share (fridge pattern); that contradicts the spec and the map's
out-of-scope ruling. **The spec wins: stateless URL-hash encoding, no
store.** The button design applies unchanged.

**Blocked by:** 19 — Autosave (encoding derives from the save format).

**Status:** resolved

- [x] Whole creation encoded in the URL fragment; versioned encoding derived
      from the save format so new instruments/kits/chaining extend it
- [x] Opening a link loads the groove ready to play
- [x] Mangled or future-versioned links degrade to an empty grid, never an
      error
- [x] Web Share API sheet on mobile; clipboard + "Copied!" label flip on
      desktop
- [x] Codec round-trip, versioning, and defensive decode unit-tested
      (prime target); a whole-frontend test covers share → open link →
      groove plays
- [x] Verified early on mobile Safari *(outstanding HUMAN step — see Comments)*

## Comments

Resolved 2026-08-06 (agent, Opus, worktree branch `t21-share-links`, commit
`32eef77`, merged as `adbc0c4`). Encoding: `#g=<base64url(JSON({version,
creation}))>` with its OWN `SHARE_FORMAT_VERSION` (save-format bumps never
invalidate sent links); validation reuses `decodeStoredCreation` so links
and localStorage obey identical rules; fragment (not query) so groove data
never reaches server logs; ~300-400 chars per link. Hash semantics: decode
once on boot -> load into engine + autosave slot -> `history.replaceState`
drops the fragment (documented in an ADR, incl. the trade-off that an
incoming link replaces the recipient's autosaved working grid). Share
button per design: navigator.share on mobile, clipboard + "Copied!"
boopPop flip (1.6s revert) on desktop; no toast/modal/link field. The
handoff's server-backed /g/<id> pattern was ignored per the spec's ruling.
31 new unit tests (round-trip, versioning, deep defensive-decode sweep,
share-action fallbacks) with mutation checks; 3 share iwft tests.

**Outstanding human step:** real mobile-Safari verification — open a share
link on an iOS device, confirm the share sheet appears and the ~400-char
fragment survives the receiving app. Playwright WebKit cannot test this.

Gate re-verified by orchestrator post-merge: lint/typecheck clean, vitest
139/139, playwright CT 23/23.

Whole-branch review (2026-08-06): found the "sheet on mobile, clipboard on
desktop" gate was capability-only — `navigator.share` also ships on macOS
Safari and Windows Chrome/Edge, so those desktops got the OS sheet and never
the "Copied!" flip. Fixed: `navigatorShareTarget`/`navigatorExportTarget`
now take a `preferSheet` flag driven by `prefersShareSheet()`
(`(pointer: coarse)` at tap time); same fix applied to the WAV export path
(sheet on touch, download otherwise). ADR 0026 and apps/boop/CLAUDE.md
wording updated to match.
