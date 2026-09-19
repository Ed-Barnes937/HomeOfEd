# tumble - a marble machine with opinions

**The toy.** A pegboard wall. Marbles drop from two hoppers at the top (blue
left, red right) and rattle down through parts you place: ramps that steer,
flippers that *remember* - each marble that passes flips them to send the next
one the other way - crossovers, catchers, and a bell. Press the lever and
watch the machine run. It is a kinetic sculpture toy: the pleasure is watching
marbles clatter through a thing you built.

**The play loop.** Machines misbehave in interesting ways. "Why did the third
marble go left?" leads to staring at flipper states, which is the game.
Challenge cards ("make it ring the bell every second marble") are optional
furniture, not the spine.

**The stealth payload.** The flipper is a bit. A column of flippers is a
binary counter. Routing marbles through remembered state is logic - AND, OR,
NOT emerge from part arrangements without ever being named. This is the
mechanical-computation insight of Turing Tumble: a child who predicts the
machine is doing state-machine reasoning.

**Stealth discipline.** Never show a truth table. The bell, the colours, and
the clatter are the reward system. If a kid discovers the counter pattern,
that discovery is theirs.

**Prior art.** Turing Tumble, Digi-Comp II, marble runs generally; Zoombinis
for the discover-the-rule spirit ([the genre's high-water mark](https://en.wikipedia.org/wiki/Zoombinis)).

**Shape.** Stateless, single screen. Discrete simulation (marbles move
cell-to-cell through part graphs - no continuous physics needed, which keeps
the engine pure TS and trivially testable). Canvas or DOM renderer; sound
matters (borrow boop's audio learnings). Machines saved in localStorage,
shareable URL-hash encoded like boop clips (ADR 0026).

**Open questions.** Continuous "toy physics" veneer over the discrete core
(juice vs simplicity); how big the pegboard is on a phone.
