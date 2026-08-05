# 21 — URL-hash share links

**What to build:** One Share action that turns the current creation (pattern,
tempo, kit id) into a URL with everything encoded in the hash fragment — no
server. Opening a shared link opens boop with the groove loaded and ready to
play. Mobile gets the system share sheet; desktop copies to the clipboard and
the button label flips to "Copied!". No modal, no "copy this text" field.

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
