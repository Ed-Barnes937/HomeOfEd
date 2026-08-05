# 25 — WAV export (spike mobile Safari first)

**What to build:** A secondary "get the audio" action tucked behind/below
Share: an offline render of the pattern looped ~4× to a WAV file, offered via
the share sheet on mobile and download on desktop. No import.

**Spec caveat:** this is the highest-risk feature and the first candidate to
cut from V1. Start with the mobile-Safari verification; if it can't be made
to work acceptably there, close this ticket as "cut from V1" (the spec
explicitly allows it) rather than shipping a desktop-only export.

**Blocked by:** 18 — Launch kit content; 21 — URL-hash share links (the Share
affordance it nests under).

**Status:** ready-for-agent

- [ ] Spike first: offline render + share-sheet delivery proven on real
      mobile Safari before building the full feature
- [ ] Offline render of ~4 loops at current tempo to WAV
- [ ] Demoted placement below/behind the primary Share action
- [ ] Share sheet on mobile, download on desktop
- [ ] If the spike fails: ticket closed as cut-from-V1 with findings
      recorded, nothing half-shipped
