# strut - spaghetti bridges and the cart that trusts them

**The toy.** A gap between two cliffs, a box of spaghetti struts and
marshmallow joints, and a little cart that sets off the moment you press Go.
Build a bridge, watch it hold - or watch it sag, twang, and dump the cart into
the river with a satisfying splosh. Wobble is rendered lovingly: this is a
physics comedy first.

**The play loop.** Collapse is the content. Every failure is funny and every
failure is legible - you can *see* which joint gave way. The retry impulse is
immediate, and each retry is a hypothesis.

**The stealth payload.** Structural engineering: triangles do not shear,
squares do; load spreads through members; tension and compression feel
different (spaghetti snaps, marshmallow stretches). Nobody says the word
truss. The kid who beats the wide-gap level has independently reinvented one.

**Stealth discipline.** No scores, no material budget in v1 - budgets turn it
into optimisation homework. The pressure to use fewer struts can arrive later
as an opt-in "fancy mode".

**Prior art.** Poly Bridge (the [stealth-learning canon example](https://screenwiseapp.com/guides/educational-games-that-don-t-feel-like-school)),
World of Goo, Bridge Builder, the classroom spaghetti-tower challenge - which
is exactly the hands-on construction play home educators already reach for.

**Shape.** Stateless, single screen. A soft-body/spring-mass solver as a pure
engine package-in-the-app (Verlet integration is enough and is well within the
silt/boids performance envelope); canvas renderer on top. A handful of
hand-authored gap layouts, saved bridges in localStorage.

**Open questions.** Whether levels (widening gaps) or a pure sandbox canyon
comes first; how much material variety (rope? plank?) v1 needs - probably none.
