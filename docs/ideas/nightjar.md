# nightjar - draw on tonight's sky

**The toy.** Tonight's actual sky over your house, rendered as a calm
full-viewport star field (espy's warm-paper sensibility, but ink on midnight).
Connect stars into your own constellations, name them ("The Enormous Sausage
Dog"), and keep them in a sky journal. Your constellations come back whenever
their stars are up - and drift with the seasons, because the real sky does.

**The play loop.** Naming things you made is durable fun. Returning in
November to find The Sausage Dog has moved - or set - is the hook that keeps
the toy alive across months, not minutes.

**The stealth payload.** The celestial sphere, seasonal drift, why the sky
rotates, star brightness and colour, and - quietly - the real map: bright
stars keep their true names as pins (Vega, Betelgeuse), and a "someone else
drew here" whisper reveals the classical constellation sharing your stars.
Orion gets learned because he is squatting on your doodle.

**Stealth discipline.** No planetarium chrome, no RA/Dec, no quiz. Real
astronomy surfaces only as annotations on the child's own drawings.

**Prior art.** Stellarium (the data, none of the vibe), paper star wheels,
the dot-to-dot instinct every kid already has.

**Shape.** Stateless. Star catalogue (Hipparcos bright stars, a few thousand)
ships as static data; sky position is pure maths from date + a fixed London
lat/long (a location picker is later). Pure-TS ephemeris engine under a canvas
renderer - fully unit-testable against known sky positions. Journal in
localStorage. Reduced-motion rules from the a11y pass apply to twinkle.

**Open questions.** Day/night handling (always night? real twilight?);
whether planets are v1 (they move week-to-week, a lovely mystery) or later.
