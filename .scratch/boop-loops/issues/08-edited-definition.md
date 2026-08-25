# The "edited" definition grows

Type: grilling
Status: resolved

## Question

ADR 0031 gives "edited" exactly one app-wide definition — a cell toggle or a
tempo change. A boop now also mutates via placements, clip add/delete/rename,
and speed. Which of these count as edited (dropping the saved indicator and
the starter ring)?

## Answer

Decided by ed-barnes937 during charting (2026-08-12): **all of them count.**
Placement changes, clip add, clip delete, clip rename, and speed changes are
all "edited" — the single definition grows to "any mutation of the song".
ADR 0031's amendment lands with the spec.
