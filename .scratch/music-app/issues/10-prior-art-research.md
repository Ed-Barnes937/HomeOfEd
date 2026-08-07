# Prior-art survey: kid-facing sequencers

Type: research
Status: resolved
Blocked by: —

## Question

Survey existing kid-facing music sequencers and groove toys — at minimum
Chrome Music Lab (Song Maker + Rhythm), Incredibox, GarageBand Live Loops,
Toca Band, and anything else notable in the 6+ browser/tablet space. For each:
how they handle the core grid interaction on touch, play/transport
affordances, tempo controls, kid-legible saving/sharing, onboarding (tours,
demo content), sound palette tone, and what they charge for. Output: patterns
worth borrowing, traps to avoid, and how boop differentiates. This feeds the
spec (ticket 07) and especially the design brief (ticket 08).

## Answer

Twelve products surveyed against primary sources (production bundles read
directly where available). Full findings on branch `research/prior-art` at
`.scratch/music-app/research/prior-art.md`. Highlights:

**Borrow:** latched drag-paint tracked per pointer id (both CML experiments);
audible edits while stopped; "empty" presented as the first preset rather than
the landing state (Groove Pizza); seed exactly one lane and leave the rest
blank (CML Rhythm); constraints baked into the data so bad output is
unreachable (ToneMatrix's pentatonic-only note array — the design law for the
future melody lane); the instrument artwork *is* the note glyph (Rhythm);
URL-hash pattern encoding with graceful decode failure (ToneMatrix); autosave
+ anonymous local history (Groove Pizza); self-describing ARIA label on the
grid (Song Maker); global spacebar play toggle.

**Avoid:** "Restart" buttons that reset the song (Song Maker); losing work on
tab close (Song Maker has zero localStorage); save flows that demand typing
(Incredibox's public form = literacy gate); file-system-shaped sharing
(GarageBand); desktop-gated export (Groove Pizza hides audio download on
mobile); keyboard-only destructive actions (ToneMatrix clear-all); killing
page scroll/zoom wholesale; shrinking the grid as the phone answer (Song
Maker silently drops to 8×8); public community layers on kid content;
strobing feedback.

**Differentiation:** boop is a true step sequencer where the field is mostly
loop-launchers; 6×16 is deliberately wider than every kid comparator; durable
no-account persistence (autosave + named list) exists nowhere in the survey;
a stateless URL-hash share story is proven and unclaimed; the beat-event seam
has no comparator.

**Challenges to map decisions (flagged to the human):** (1) zero surveyed
products ship a coach-marks tour — the field onboards with content (seed
patterns/presets); the starter beat may be doing all the work. (2) A
continuous tempo slider is the minority position for this age band — discrete
speeds or a log mapping with no numerals is the field's answer. (3) On
tablets the kid-legible artifact is a link, not a file — WAV export needs
real mobile-Safari verification, and URL-hash sharing may be the cheaper,
more legible primitive. Supported without qualification: no swing, autosave +
named list, sample kits as data, beats grouped in 4s, artwork-as-note-mark.

**Corrections:** Song Maker and Groove Pizza are not open source; Incredibox
tops out at v9; Toca Band survives only inside the Toca Boca Jr subscription;
Sampulator and web Seaquence are dead.
