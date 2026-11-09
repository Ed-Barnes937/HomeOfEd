# armoury

A wand shop where a child makes their own wand. The generator turns a handful of
choices into a carved 3D wand; the shop around it makes the choosing feel like
shopping for one.

## Language

**Wand**:
The thing a child makes: a set of **params** plus, optionally, a name they gave
it. Stored and shared as `{ params, name? }`.
_Avoid_: Design, item (except inside `engine/`, which is item-agnostic).

**Params**:
The wand's choices, keyed by the schema in `wand/wandSchema.ts`. Always
normalised: clamped, snapped to step, with choices allowed by the others.

**Kind of wand**:
Turned (straight, as if from a lathe) or Branch (grown: bent, lumpy and knotted).
Picked above the groups; **Try another** keeps it
([ADR 0084](../../docs/adr/0084-armoury-branch-wands.md)).

**Spine**:
The bent line a Branch follows. Everything is built straight, then carried onto
the spine; both ends stay on the straight wand's axis.

**Group**:
A section of params a child sees together: the wood, the shape, the branch (on a
Branch only), the handle, the shaft, the trimmings, the core. The unit a **lock**
works on.

**Bumps**:
Evenly spaced swellings along the shaft, knobbly or bamboo. Part of the shaft's
outline, not carving.
_Avoid_: Nodes (the code's name for them), in UI copy.

**Raised spiral**:
A shaft spiral that stands proud as a ridge instead of being cut in as a groove.

**Envelope**:
How far carving, ridges, lumps and knots may move the surface from the wand's
outline, either way: a quarter of the local radius ([ADR 0081](../../docs/adr/0081-armoury-raised-features.md)).

**Zone**:
A stretch of the wand in metal, paint or bone instead of wood: the handle, the
shaft, the ring, the end cap or a band. A metal raised spiral is a zone in angle
as well as length ([ADR 0082](../../docs/adr/0082-armoury-material-zones.md)).

**Trimmings**:
The group where a child picks the wand's zones, its one metal and one paint, its gems
and its **engraving**.
_Avoid_: Decor (the code's key for it), in UI copy beyond the phone tab.

**Engraving**:
A repeating tile (scales, vine, knotwork, runes or dots) cut into a band of the wood:
on the handle, up the shaft or all over, clear of metal and gem seats, in place of any
cut carving there. A **stencil** in code
([ADR 0085](../../docs/adr/0085-armoury-carved-pattern-stencils.md)).
_Avoid_: Pattern (the handle's carving), texture.

**Gem**:
A stone in the core's colour that glows faintly and flares with the **spell**:
set gems in seats on the surface, a crystal tip, or an orb at the end
([ADR 0083](../../docs/adr/0083-armoury-glowing-gems.md)).
_Avoid_: Jewel, light.

**Core**:
What's inside the wand. Decides the colour of its **spell**, the glow at its tip
and the light it throws on the shop.

**Spell**:
The burst of light cast from the tip at the end of a **wave**.
_Avoid_: Cast effect, animation.

**Wave**:
The wand's flourish in the **close look** when it arrives or a child taps it:
the tip draws a figure of 8 in light, and the **spell** leaves it as the 8 closes.
_Avoid_: Swish, gesture.

**Close look**:
The wand lifted out of its box into the middle of the darkened shop, where a
child turns it, waves it, and puts it back.
_Avoid_: Modal, inspector, zoom view.

**The counter**:
The main screen: the wand in its box, its **tag**, and the controls.

**Tag**:
The paper label tied to the box: shop number, name and tag line.

**Shop number**:
A four-digit number hashed from the params. The same wand always has the same
number, on every screen and in every link.

**Tag line**:
"Thirteen inches, oak, emberstone core. Sturdy." Derived, never stored.

**Lore**:
A sentence about the wood and one about the core. Original, never franchise
vocabulary.

**Your shelf**:
The wands a child has kept, each in its own labelled box, oldest first.
_Avoid_: Collection, saved wands, my wands.

**Try another**:
Replace the wand on the counter with a random one, keeping any locked groups.
**Put the last one back** undoes it until something else changes.
_Avoid_: Surprise me, randomise (in UI copy).

**Stage**:
The three.js view of the wand: the box stage (reached through `StageHandle`)
and the close-look stage (through `CloseUpHandle`).
