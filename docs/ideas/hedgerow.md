# hedgerow - plant it and see who comes

**The toy.** A strip of English garden, side-on, silt-calm. You plant things -
teasel, buddleia, hawthorn, a bramble tangle, a little pond - and then you
wait. Visitors arrive on their own schedule: goldfinches mob the teasel heads,
a hedgehog snuffles through after dusk, frogs find the pond by spring. Click a
visitor to hear it (real birdsong) and add it to a field-notes book the app
keeps for you - silt's field-notes pattern, pointed at wildlife.

**The play loop.** Anticipation and collection. The garden runs on real time
(check in tomorrow; dusk brings different visitors), so it behaves like orbi's
gentle check-in rhythm rather than a session game. The collector's itch -
"what brings the bullfinch?" - drives replanting.

**The stealth payload.** UK species identification by sight and song, food
webs and habitat as *mechanics* (no pond, no frogs; no berries, no winter
thrushes), seasonality, and the quiet ecological lesson that what you plant
decides who can live there. This is the RSPB garden-birds knowledge set,
acquired by gardening.

**Stealth discipline.** Species facts appear only in the field-notes book,
only after a visit, and read like a child's own notes, not an encyclopedia.

**Prior art.** Wingspan's fact-smuggling, Neko Atsume's come-and-go visitors,
Animal Crossing's museum, real bird-feeder cams.

**Shape.** Stateless to start: garden + notebook in localStorage, visitor
schedule derived from real date/time. Pure-TS ecology engine (planting state +
date in, visitor events out) - deterministic and testable. Real audio clips
(xeno-canto is CC-licensed) need licence-per-clip checking. A later shared
"whose garden" layer would be the DB trigger, not v1.

**Open questions.** How honest the seasonality is (a swift in December should
be impossible - is a kid OK waiting until May?); art pipeline for ~30 species.
