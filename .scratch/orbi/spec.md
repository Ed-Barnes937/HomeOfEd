# orbi — planet tamagotchi

Status: idea complete (wayfinder session, 2026-08-18, Ed + daughter)

## One-liner

Build a crazy planet, then look after it. Life emerges to suit whatever world
you made; you steer, rescue, and watch its story unfold — from bare rock to
city lights and blob rockets.

## Who it's for

An 11-year-old (the co-designer) and kids like her. Learning is smuggled in:
every mechanic is a real science idea in disguise (habitability, atmosphere and
temperature, extremophiles, comets delivering water).

## Core loop

1. **Build** a planet from a blank canvas of dials — size, distance from sun,
   water, atmosphere thickness, plus looks (colours, spots/patterns, moons,
   rings). A **randomise** button rolls a surprise planet to tweak.
2. **Fast-forward** time (planet only changes while you watch — no
   real-time/offline progression). A full story from bare rock to blobs takes
   roughly **5–10 minutes** of fast-forwarding.
3. **Life emerges** if the planet matches a **recipe** (see below). It climbs
   the **ladder of chapters**.
4. **Things go wrong** occasionally (freezing oceans, mega-storms, asteroid)
   and you fix them — or don't! Lenient and forgiving: life can die back but
   rarely dies out; there is never a game-over. Sad planets, not dead ones.
5. **Save, load, revisit.** Save-game style planet list with search.

## The ladder (chapters)

1. Bare rock
2. Seas form
3. First life — colour spreads across seas and land
4. Blobs! — simple moving creatures (in from day one, deliberately simple)
5. Clever blobs — **city lights twinkle on the night side**, and eventually a
   **little rocket takes off**

## Recipes — many ways to win

Life cannot emerge from *any* conditions; there are **several recipes**, each
growing a different-looking life. Conditions always matter, but there is never
one right answer:

- **Ice life** — frozen water + at least a thin atmosphere
- **Volcano life** — lots of heat + minerals to eat
- **Storm life** — a thick, wild atmosphere
- **Classic green life** — liquid water + gentle temperatures

A planet matching no recipe (bare airless rock) stays bare — that's the
toolkit's job. Sometimes a planet sits one nudge from two recipes and the
player chooses which life it gets. Different planets therefore progress
differently — this was the co-designer's explicit fix for "every planet
needing the same things would get boring quick".

## The rescue toolkit

Multiple ways to solve the same problem, each a real science idea:

- **Nudge the planet** closer to / further from its sun
- **Thicken or thin the atmosphere**
- **Send an ice comet** to deliver water
- **Plant a seed** to kickstart life somewhere

## Mission Control

A **little robot-satellite character** orbiting the planet delivers messages in
a **side panel** that stays out of the way when zoomed in.

- Always states **facts** ("No life yet — the surface is -80° and nothing is
  liquid").
- Hints are an **ask-for-more ladder**: press once for a nudge ("I wonder if
  warming things up would help…"), press again for the answer. No toggle
  needed; figure-it-out players never press.
- Character's name: **not yet decided** — pick after seeing design directions.

## Views

- **Zoomed out**: one beautiful 3D-feeling planet slowly spinning against dark
  starry space; drag to turn. Calm, slow, floaty.
- **Zoomed in**: closer surface view where you watch life develop —
  **Spore-like** energy at this level.
- The **night side glows** — city lights appear there in the final chapter.

## Extras (agreed, small)

- **Postcard**: export a picture of your planet ("Greetings from Splodge!") to
  show friends.
- **Calm spacey background music**, switchable off. No chimes — "chimes would
  get annoying quickly".
- Sandbox — **no badges, scores, or achievements**. The planet is the reward.

## Look & feel (for the design brief)

- Dark, starry, fairly simple space background.
- Realistic-but-a-bit-cartoony: the planet looks rounded and touchable,
  colours richer than real life — a beautiful model of a planet, not a photo.
- Controls could feel like a spaceship control desk — but **interface design
  is deliberately open**: Claude Design should **explore multiple visual
  directions**, not lock one in.
- Nothing flashes or shouts. Calm when zoomed out; livelier, Spore-like when
  zoomed in.

## Name

**orbi** — chosen by the co-designer. Round, friendly, orbit-y; fits the
HomeOfEd family (boop, espy, boids, karesansui).

## Scope guardrails

- Solo-buildable browser app: TypeScript + npm libraries, HomeOfEd stack.
- Life-as-colour spreading + simple moving blobs; **no** full creature
  simulation.
- Planet only simulates while the app is open; no offline/real-time progression.
- Technical planning is **out of scope** for this document — it happens later,
  using this spec as input.

## Glossary

- **Planet**: a saved world with its dials, current chapter, and life.
- **Dials**: the build-time controls (size, sun distance, water, atmosphere,
  looks).
- **Chapter**: a stage on the ladder (bare rock → … → clever blobs).
- **Recipe**: a set of conditions that lets a particular life type emerge.
- **Toolkit**: the rescue actions (nudge, atmosphere, comet, seed).
- **Mission Control**: the robot-satellite character and its side panel.
- **Planet shelf**: the searchable save-game list of planets.
- **Postcard**: an exported picture of a planet.
