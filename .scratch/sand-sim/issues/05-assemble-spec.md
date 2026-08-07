# 05 — Assemble the spec

Type: task
Status: resolved
Assignee: ed-barnes937 (resolved 2026-08-05)
Blocked by: 01, 02, 03, 04, 06, 07, 08, 09

## Question

Assemble `.scratch/sand-sim/spec.md` from the map's decisions and the resolved
tickets: destination-quality spec covering the interaction model, v1 element
roster and reactions, spawners, architecture stance, determinism/testing
stance, scene persistence (localStorage), UI/UX (from the claude-design
output), grid dimensions, and the HomeOfEd wiring checklist (stateless app,
ports, subdomain, CI). Reaching this ticket's resolution *is* the destination.

## Answer

Spec assembled at [`.scratch/sand-sim/spec.md`](../spec.md) (2026-08-05) from
all eight resolved tickets and the charting-session decisions. Twelve sections:
product summary, HomeOfEd wiring checklist (stateless per ADR 0008; ports
deliberately left as "take next-free registry row at implementation time" —
the registry is stale, `espy` is live but unlisted), interaction model, v1
roster/reactions (Dirt/Sand/Water/Lava + Water+Lava→Obsidian as a table row),
engine architecture (4-byte cell + clock, archetype+hooks with the three
grafts, chunking with determinism guards), grid/rendering (300×200,
letterboxed, world-colour margins), spawners, scene persistence (versioned
JSON envelope), UI/UX (pixel toy / docked left rail, load-bearing points
inlined, brief linked for the rest), testing stance (few, targeted,
determinism-backed), post-v1 roadmap, out of scope.

The map's destination is reached — no open tickets remain.
