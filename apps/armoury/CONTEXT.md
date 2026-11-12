# armoury

A street with two shops where a child makes their own wand or sword. A generator
turns a handful of choices into a carved 3D wand or a forged 3D sword; the shop
around it makes the choosing feel like shopping for one.

## Language

**Wand**:
One of the two things a child can make, from the wand shop: carved wood with a
**core**, a handle and a shaft, in a box on a counter. Everything under "Wand"
below (Bark, Bumps, Zone, Extras, Core, Spell, Wave) is the wand's alone.
_Avoid_: Design.

**Item kind**:
Wand or sword: which of the two a thing is. Each has its own params, save document,
shelf section and shop. Stored and shared as `{ params, name? }` whichever kind it
is; a link names the kind. In code an **item** is either, and `engine/` and `items/`
are item-agnostic.
_Avoid_: Type, category, item (in UI copy).

**Params**:
An item's choices, keyed by its schema (`wand/wandSchema.ts`, `sword/swordSchema.ts`).
Always normalised: clamped, snapped to step, with choices allowed by the others.

**Shop**:
A place that makes one item kind: the wand shop (`/wands`) and the smithy
(`/swords`). Each has its own scene, controls, words, colours and picture, on one
shared shell. Entering a shop makes it the **last shop**.
_Avoid_: Page, mode.

**Street**:
The first page a visitor sees (`/street`): one painting of eight shops along a
lane with its lights off, the two built ones lighting up when pointed at and
opening as links, the rest shut for the night; and the way back to the hub. On a phone it slides sideways and opens on
the last shop; on a touch screen a tap picks a shop and an Enter button goes in. A returning visitor skips it and opens in the
shop they were last in; a visitor with an old save sees it once.
_Avoid_: Home, landing page, menu.

**Sword**:
The other thing a child can make, from the smithy: a blade, a guard, a grip and a
pommel, forged from steel, fittings and leather. A set of **params** like the wand,
in one of eight **kinds of sword**.
_Avoid_: Blade (that is only the steel part), weapon.

**Kind of sword**:
Dagger, Short sword, Knight's sword, Longsword, Greatsword, Sabre, Katana or Rapier.
Picked above the groups; it decides the size bands, the edges and which hilt parts
and options exist. **Try another** keeps it ([ADR 0098](../../docs/adr/0098-armoury-sword-generator.md)).
A **Kind** on its own means this.
_Avoid_: Family (the code's name for it), class, type.

**Smithy**:
The sword shop: a village forge at the end of the day, with the sword lying across
an anvil, warm forge light from the left and cool window light from the right
([ADR 0101](../../docs/adr/0101-armoury-smithy-scene-tag-and-picture.md)).
_Avoid_: Forge (that is the fire in it), workshop.

**Anvil**:
Where the sword lies in the smithy, drawn from above on its stump. It never
changes size; a sword longer than it hangs over the ends, and its outline is the
shadow.
_Avoid_: Counter (the wand shop's).

**Kind of wand**:
Turned (straight, as if from a lathe) or Branch (grown: bent, lumpy and knotted).
Picked above the groups; **Try another** keeps it
([ADR 0084](../../docs/adr/0084-armoury-branch-wands.md)).

**Spine**:
The bent line a Branch follows. Everything is built straight, then carried onto
the spine; both ends stay on the straight wand's axis.

**Bark**:
None, patches or full, on a Branch only: rough, furrowed and darker than the wood,
standing a little proud of it. Worn bare where a hand grips a grown handle; never
on metal, paint, bone, gem seats or an engraving. Takes little stain
([ADR 0091](../../docs/adr/0091-armoury-branch-wood-and-bark.md)).

**Group**:
A section of params a child sees together. A wand's: the wood, the shape, the
branch (on a Branch only), the handle, the shaft, the extras, the core. A sword's:
the kind, the metal, the blade, the edge and tip, the guard, the grip, the pommel,
the finishing touches. The unit a **lock** works on.

**Bumps**:
Evenly spaced swellings along the shaft, knobbly or bamboo. Part of the shaft's
outline, not carving.
_Avoid_: Nodes (the code's name for them), in UI copy.

**Raised spiral**:
A shaft spiral that stands proud as a ridge instead of being cut in as a groove.

**Envelope**:
How far carving, ridges, lumps, knots and bark may move the surface from the wand's
outline, either way: a quarter of the local radius ([ADR 0090](../../docs/adr/0090-armoury-raised-features.md)).

**Zone**:
A stretch of the wand in metal, paint or bone instead of wood: the handle, the
shaft, the ring, the end cap or a band. A metal raised spiral is a zone in angle
as well as length ([ADR 0082](../../docs/adr/0082-armoury-material-zones.md)).

**Extras**:
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
A stone that glows faintly and flares with the **spell**, in the core's colour or
one chosen colour for all of them: set gems in seats on the surface (round, square or
marquise cut), a crystal tip (one of five shapes), or an orb at the end
([ADR 0083](../../docs/adr/0083-armoury-glowing-gems.md),
[ADR 0087](../../docs/adr/0087-armoury-crystal-colours-and-shapes.md)).
_Avoid_: Jewel, light.

**Core**:
What's inside the wand. Decides the colour of its **spell**, the glow at its tip
and the light it throws on the shop.

**Spell**:
The burst of light cast from the tip at the end of a **wave**.
_Avoid_: Cast effect, animation.

**Flourish**:
An item's show-off move in the **close look**, when it arrives or a child taps it.
A wand's is a **wave**; a sword's is the same figure of 8, slower, followed by a
**glint** and the **runes** waking.
_Avoid_: Cast (the code's old name), animation, effect.

**Wave**:
The wand's flourish: the tip draws a figure of 8 in light, and the **spell** leaves
it as the 8 closes.
_Avoid_: Swish, gesture.

**Glint**:
The sword's flourish ends in a thin line of light that runs up one edge, once, as
the 8 closes. Brief and subtle: the brightest thing the sword ever shows.
_Avoid_: Shine (the UI's word for the whole flourish), flash, sparkle.

**Close look**:
The item lifted out of its scene into the middle of the darkened shop, where a
child turns it, makes it flourish, and puts it back.
_Avoid_: Modal, inspector, zoom view.

**The counter**:
The wand shop's main screen: the wand in its box, its **tag**, and the controls.
The smithy's is the anvil.

**Tag**:
The paper label tied to the wand's box: shop number, name and tag line. The
smithy's, on its sword, is the **ticket**.

**Ticket**:
The smithy's tag: brown card on twine tied to the sword's grip, with the same shop
number ("No."), name and tag line.
_Avoid_: Label, mark number.

**Shop number**:
A four-digit number hashed from the params. The same wand always has the same
number, on every screen and in every link.

**Tag line**:
"Thirteen inches, oak, emberstone core. Sturdy." Derived, never stored.

**Lore**:
A sentence about the wood and one about the core. Original, never franchise
vocabulary.

**Your shelf**:
The wands and swords a child has kept, a section for each kind, each item in its own
labelled box, oldest first.
_Avoid_: Collection, saved wands, my wands.

**Player**:
The family profile a page opened for. The counter and the shelf are kept per
player, under `armoury:save@<accountId>`, and the bare `armoury:save` signed
out; the code always names the bare key and `@hoe/accounts`' `profileStorage`
adds the suffix. A device's shelf from before profiles is copied into each
player on first open, and never written again
([ADR 0094](../../docs/adr/0094-per-profile-local-saves.md)). Switching player
happens at hub, through the chip in the header.
_Avoid_: User, account (in UI copy), owner.

**Shared view**:
`/shared#w=...`, where a share link lands, open to anyone. The wand can be
shaped like any other, but it is kept in memory only: no shelf, no autosave.
"Keep this wand" goes to the root, behind the gate, carrying the wand as it is
now ([ADR 0093](../../docs/adr/0093-estate-gate.md) decision 6).
_Avoid_: Preview, guest mode, read-only view (it is editable).

**Try another**:
Replace the item on the counter or anvil with a random one, keeping any locked
groups and its kind.
**Put the last one back** undoes it until something else changes.
_Avoid_: Surprise me, randomise (in UI copy).

**Stage**:
The three.js view of an item: the box stage (reached through `StageHandle`)
and the close-look stage (through `CloseUpHandle`). Each kind has its own pair.

### The sword's parts

**Blade**:
The steel, from the guard to the **tip**. Its length, width and shape are 0-1
sliders inside the **kind of sword**'s band.

**Fuller**:
A groove or ridge down the middle of the blade (one, two or three grooves, or a
ridge with a groove). The code's `middle`. Runes can sit in it.
_Avoid_: Blood groove, channel.

**Tip**:
The point of the blade: round, long, curved, angled, spear or clipped, as the kind
allows.

**Guard**:
What stands between blade and hand: a bar, wings, an S, a hand bow, a disc, a dome
or a cup, by kind. It has its own size, ends and, on a disc, shape.
_Avoid_: Crossguard, hilt (the guard, grip and pommel together).

**Grip**:
Where the hand holds: a wrap (leather, cord, wire, wood, ridged bone or the
Katana's diamond braid), a colour and a shape.
_Avoid_: Handle (the wand's).

**Pommel**:
The weight at the end of the grip: a wheel, ball, pear, nut, cap and others by kind.
A gem can be set in it.
_Avoid_: Knob.

**Steel finish**:
How the blade's metal looks: Satin, Mirror, Black, Silver or Blue, with a pattern
(plain, Ripples or, on a Katana, a temper line). Wear scratches the blade and polishes
the grip. Not to be mixed up with the **metal** of the guard and pommel, which is
the fittings'.
_Avoid_: Material, colour.

**Runes**:
Marks that glow faintly on the blade, in the groove, near the guard or down the
middle, in a **core**-style colour. They are the wand's invented glyphs, drawn as a
mask, not carved. They wake in the close look as the **flourish** ends.
_Avoid_: Letters, writing, glyphs (the code's word).
