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

**Status:** ready-for-agent

- [ ] Whole creation encoded in the URL fragment; versioned encoding derived
      from the save format so new instruments/kits/chaining extend it
- [ ] Opening a link loads the groove ready to play
- [ ] Mangled or future-versioned links degrade to an empty grid, never an
      error
- [ ] Web Share API sheet on mobile; clipboard + "Copied!" label flip on
      desktop
- [ ] Codec round-trip, versioning, and defensive decode unit-tested
      (prime target); a whole-frontend test covers share → open link →
      groove plays
- [ ] Verified early on mobile Safari
