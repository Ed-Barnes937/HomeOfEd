# 02 — Sim domain model

**Type:** grilling
**Status:** open
**Blocked by:** —

## Question

Define the simulation's domain model — the heart of orbi. From the spec
(`.scratch/orbi/spec.md`): dials (size, distance from sun, water, atmosphere +
looks) produce telemetry (surface °C, pressure, water state), telemetry matches
**recipes** (ice / volcano / storm / classic green), a matched recipe grows
that life type. The multiple-recipes idea is the co-designer's anti-boredom
mechanism and must be preserved.

Resolve:

1. How do dials map to telemetry — a real-ish physics toy (greenhouse effect,
   insolation) or a tuned lookup? How much real science survives?
2. Recipe matching: thresholds, the "one nudge from two recipes → player
   chooses" case, and what happens when conditions drift out of a recipe
   (lenient die-back, never extinction).
3. Tick model: fixed-timestep, seeded/deterministic (house pattern,
   `apps/silt/src/sim/`), time rates (×1 to ×1000), sim only runs while open.
4. The ubiquitous language: Planet, Dials, Telemetry, Recipe, Life, Chapter,
   Toolkit — pin terms into a CONTEXT.md draft for the eventual `apps/orbi`.

Run with `/grilling` + `/domain-modeling`. Chapters/events/toolkit detail is
ticket 03; exact balance numbers are ticket 04's prototype.

## Answer
