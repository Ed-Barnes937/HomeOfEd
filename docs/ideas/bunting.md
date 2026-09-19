# bunting - a flag for everything

**The toy.** A flag workshop: divisions (halves, quarters, saltires, pales),
a respectful palette, emblem stamps, and a flagpole outside the window where
your finished flag snaps in the breeze (cloth simulation worth doing well -
the flap is the toy). Make a flag for your bedroom, your dog, the shed, your
imaginary nation from wayfarer. Flags collect on a string of bunting across
the top of the screen.

**The play loop.** Kids are reliably obsessed with flags - they are the most
child-legible design artefact there is: bold, geometric, meaningful,
finishable in five minutes. The bunting string is the collection mechanic.

**The stealth payload.** Two smuggled loads. Design principles: the workshop
tools embody real vexillology (simple enough for a child to draw, meaningful
elements, two or three colours, no lettering) so good design is the path of
least resistance. Geography: a "flags of the world" drawer exists purely as
*material to steal from* - raiding Bhutan's dragon for your own flag is how
you learn Bhutan has a dragon. Halves, quarters, and thirds do fraction work
on the side.

**Stealth discipline.** The rules are tools, not rubrics - nothing scores
your flag. Real-world flags are never quizzed, only browsed and burgled.

**Prior art.** The NAVA "Good Flag, Bad Flag" booklet (the ruleset, verbatim,
as UI); the r/vexillology kids-flag genre; fridge's stamp-and-arrange feel.

**Shape.** Stateless. SVG-native rather than canvas (flags are vector art;
crisp export and printing for free - print your flag, tape it to a stick).
Pure-TS flag model (divisions + emblems + palette as data) with the cloth-sim
renderer on top. Bunting in localStorage; share via URL-hash like boop
(ADR 0026). Real-flag data is static and small.

**Open questions.** Emblem drawer size at v1 (curated dozens beat a clip-art
dump); whether freehand emblems (espy-style) ever belong or break the
simplicity rule that makes the toy teach.
