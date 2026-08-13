# WAV export scope

Type: grilling
Status: resolved

## Question

With a boop now holding a song, does WAV export render the whole song, the
clip on the grid, or offer both? What does an empty song (no placements)
export?

## Answer

Decided by ed-barnes937 during charting (2026-08-12): **export renders the
whole song.** Clips are not individually exportable — we don't care about
saving clips. Behaviour when the song has no placements falls to the spec
(the obvious reading: nothing to export or fall back to the active clip —
spec decides the wording, not this ticket).
