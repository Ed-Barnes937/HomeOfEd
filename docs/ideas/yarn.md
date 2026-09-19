# yarn - roll the dice, tell the tale

**The toy.** A velvet table and a handful of chunky picture dice - a castle,
a moody cat, a thunderstorm, a key. Shake the device (or smash the big
button), watch them tumble and settle, and tell the story that connects them.
That is it. The dice physics should be delicious; the pictures should be odd
enough to force invention. A "one more die" button raises the stakes
mid-story. Finished stories can be kept: a title, the dice faces pinned in
order, and (optionally) a recording of the telling.

**The play loop.** It is a two-player toy by nature - teller and audience,
kid and parent, swapping. The tumble is the drum roll; "how do I get from the
lighthouse to the angry bee?" is the game. The shelf of kept stories becomes
a family artefact.

**The stealth payload.** Oracy - the skill UK primary education is currently
loudest about and software serves worst. Improvised narration builds
narrative structure (beginning/middle/end arrive by necessity), vocabulary in
production rather than recognition, and confident speaking. The optional
recording quietly makes it a fluency practice tool a parent can hear progress
in.

**Stealth discipline.** No prompts, no rubric, no "story must have a
problem!" scaffolding. The dice are the entire provocation. Recording is
opt-in and playful (a wax-cylinder aesthetic beats a red REC dot).

**Prior art.** Rory's Story Cubes (the direct ancestor, as an object);
campfire storytelling; the Literacy Trust's chat/play/read framing of early
literacy at home.

**Shape.** Stateless. Dice as lightweight 3D or faked-3D canvas tumble
(boids-grade rendering budget); face sets as static art packs (a dozen dice,
swappable themes). Story shelf in localStorage; audio recordings via
MediaRecorder, kept local. A later bridge - "sprout, tell me what happens
next" - is the one natural cross-app hook, and would go through sprout's
existing safety pipeline, not around it.

**Open questions.** Whether audio recording is v1 (privacy is easy while
local-only, but it needs a clear parent story); how many dice sets at launch;
shake-to-roll on desktop (spacebar, obviously, but make it feel good).
