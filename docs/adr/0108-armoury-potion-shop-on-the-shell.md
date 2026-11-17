# 0108 - armoury potion shop on the shell: the third kind, its route, and a close look that waits

- **Status:** Accepted
- **Date:** 2026-11-13
- **Related:** [ADR 0096](0096-armoury-item-kinds-saves-and-links.md) (item kinds,
  saves and links), [ADR 0097](0097-armoury-street-and-last-shop.md) (the street
  and the last shop), [ADR 0093](0093-estate-gate.md) (decision 6, the shared
  view), [ADR 0094](0094-per-profile-local-saves.md) (per-player saves),
  [ADR 0104](0104-armoury-potion-item.md) (the potion item),
  [ADR 0106](0106-armoury-potion-names-effects-and-blends.md) (its names and effects),
  [ADR 0113](0113-armoury-three-ingredients-that-mix.md) (three ingredients and the
  `mixed` flag the tap sets), [ADR 0110](0110-armoury-potion-shop-scene-card-and-picture.md)
  (the scene on this shell), [ADR 0111](0111-armoury-potion-close-look.md) (the
  show the reveal is timed to), [ADR 0112](0112-armoury-ingredient-pictures.md)
  (the pictures on the picker's jars and its phone layout).

## Context

The potion is armoury's third kind. ADR 0096 set out what a new kind costs: an
`ItemDef`, a storage key, a link field, a path and a door, with no change to the
save or link formats. Everything that ships bytes to a visitor (the key, the
field, the path, the last-shop value) is a one-way door once released, so the
names are fixed here and in the epic's spec, and change only with the owner.

The potion shop is built in many tickets: the pour picker, the real stage, the
painted scene and the close look all come later. The shell has to work end to
end first, on fake stages, without opening the shop to visitors.

## Decision

- **The third kind, per ADR 0096.** `ITEM_KINDS` is `['wand', 'sword', 'potion']`:
  new kinds go last, the order a link is read in, so a link naming two kinds still
  opens the older one. The potion's save document is `armoury:save:potion`
  (`POTION_SAVE_KEY`), the same shape as the others, in `PROFILE_KEYS` so it is a
  player's. Its link field is `potion`, built at `/shared` like the others. Its
  path is `/potions` and its last-shop value is `potion`. `SAVE_FORMAT_VERSION`
  and `SHARE_FORMAT_VERSION` do not change.
- **Older builds fail safe.** A stale tab or an older build reads a potion link
  as no item (its `ITEM_KINDS` has no `potion` field to look for) and opens a
  normal visit; it reads `armoury:shop = potion` as no last shop and sends the
  root to the street; it never opens `armoury:save:potion`, so it cannot rewrite
  a potion shelf. Every wand and sword save and link opens as before.
- **One commit widens every union.** `ItemKind`, `ShopPath`, `ShopView.path` and
  `ShopView.shop` gain the potion together, with every `Record<ItemKind, ...>`
  (the registry, `SHOP_PATHS`, the shared view's `SHOPS`, the benches, the
  shelf's way back) filled in the same commit, so none is ever partial.
- **`apothecary` is the shop's name in code**: the `ShopView` folder
  (`src/apothecary/`), its `data-shop` and its token block. The visitor sees
  "the potion shop"; `potion` stays the kind.
- **`ShopView.closeUp.flourishOnArrival`.** The close look calls the item's
  flourish on arrival only when it is true. The wand and the sword keep `true`,
  so their behaviour is unchanged. The potion sets `false`: its flourish is the
  uncorking, a three-second show with a pop, and a child who lifts a bottle to
  look at it should choose when to open it. A tap on the bottle or "Uncork it"
  asks for it.
- **The shelf is a loop over its shelves.** `SHELVES` lists each kind's view,
  heading and noun; the header's count and the intro are worked out over the
  shelves that hold something, so a fourth kind is one more row. A wand-only or
  sword-only shelf reads exactly as before, including the wand-only intro. A
  potion's box draws its bottle flat: the glass, the stopper and its pours in
  their ingredient colours.
- **The door stays shut.** `DOOR_LABELS['/potions']` is set, but the street's
  potion shop gets no `to` until the shop is finished (ticket 17), so nothing on
  the street or in another shop links to `/potions`. The route exists and is
  reached by address, by a potion link's Keep, or by a returning last shop, which
  is how the tests drive it.
- **Stand-ins until their tickets land:** the scene is a plain room and a flat
  table edge with the stage's foot on `BASE_LINE`; the picture is a dark room and
  table under the shared frame; the shelf's bottle is drawn from the bottle rows
  directly, until the bottle generator's outline replaces it; the token block is
  the scene mock's palette, whose text pairs were measured at AA.

## The pour picker

Three ingredients that mix, and "Empty the bottle" as the only removal (decision E17).

- **One widget owns the Pours group.** `potionWidget` returns `PourPicker` for
  `pour1` and `null` for `pour2`, `pour3` and `mixed`, so the group draws once
  through the existing per-param widget hook and the mixed flag has no control of
  its own. The glass gets a `SwatchPicker` tinted from `potionSwatchFor`.
- **A pour is a `set` on the lowest empty slot.** A jar calls
  `onChange(nextPourKey(params), id)`. The same ingredient may go in as often as
  the child likes. The jars sit in the colour wheel's order, so the grid reads as
  a rainbow.
- **Two ways the jars are shut.** A full bottle that is not mixed shows "The
  bottle is full. Tap it to mix it, or empty it to start again."; a mixed one
  shows "This potion is mixed. Empty the bottle to make a new one." Either way
  every jar is `aria-disabled` (still focusable) and points at the visible message
  with `aria-describedby`; a tap pours nothing and announces the message again.
- **There is no take-out.** Taking one ingredient out of three would leave a
  half-made potion that the mix has to be re-judged for, and a mixed potion with a
  hole in it has no meaning. "Empty the bottle" sets every filled slot to `none`
  from the top down, which also unmixes, and is the one way back to a clean start.
  The button shows while anything is in the bottle.
- **The list has three equal rows**, top first, each the swatch and the name, an
  empty slot reading "Empty", with no buttons. Its heading reads "Mixed in the
  bottle" once mixed. "In the bottle" is a plain list (the schema calls the bottom
  pour `pour1`, so numbering the top "1" would contradict it).
- **Accessibility.** Every jar is a button named "Pour in {Label}"; a polite live
  region says "{Label} poured in. One of three.", "Two of three.", "Three of
  three. Tap the bottle to mix it.", and "The bottle is empty."; each announcement
  is a fresh node so a repeat is heard. Every swatch has a light ring because the
  dark ones are low in contrast against the dark tile.
- **The picture is one seam.** `IngredientPicture` is the only place a jar's
  picture is drawn; a plain colour swatch stands in for it until ticket 16.
- **On a phone** the jars, rows and tab-row lock are laid out as in
  [ADR 0112](0112-armoury-ingredient-pictures.md) "The phone layout"; the shut
  message sits below the jars on a phone and above them on a desk, and the tab
  scrolls inside the sheet like any other.
- **Focus stays in the picker.** After "Empty the bottle" focus goes to the first
  jar. Focus scrolls the sheet into view only when no pointer made the click
  (`detail` 0, which is Enter, Space or a screen reader's click); a tap or a mouse
  click focuses without scrolling, so the sheet stays where the child was.

## The tap that mixes

The tap that lifts the bottle is the tap that mixes it (E14, E15): the potion sets
`flourishOnArrival`, so the close look flourishes as soon as the bottle lands, and
every later tap flourishes again. Mixing is not a second button.

The reveal is a timer in the shell, not a callback from the stage. `ShopView.closeUp.reveal`
carries the seconds (`MIX_REVEAL_SECONDS`, and a short one for reduced motion, both in
`mixBeats.ts`) and a `change(params)` that returns the param to set or null. `CloseUp` starts
the timer on each flourish and restarts it on the next; when it fires, `change` is asked
against the current params and its answer is dispatched as an ordinary `set`. Asking at the
moment it fires is what makes a replay on a mixed potion, or a bottle with fewer than three
in it, set nothing. The stage interface stays the wand's and the sword's, and the stage's
own swirl (ticket 23) is only a picture that runs for the same time.

Closing the close look before the timer fires (Put it back, Escape, a tap away) makes the
change at once, so a potion is never left half-mixed by a quick exit. Unmounting only clears
the timer.

`CloseUp` carries a visually hidden polite live region that announces "{name}. {lore}" when the
derived name changes while it is open, using the name as shown (a rename wins). Only a reveal
changes the name there, so only a reveal speaks; the wand and the sword never do.

E17 removes "Put the last one back" from the potion shop, since Empty the bottle is its only
way back. The button is the shell's shared undo for Try another, so `ShopView.offersPutBack`
(default true) hides it for the potion alone. The workbench still records `previous`; the wand
shop and the smithy keep the button.

## Considered and rejected

- **Opening the door now.** A visitor would find a shop with no real bottle and
  plain pills for pours. The shell is reviewed on fakes; the door opens last.
- **A flourish on arrival for the potion**, as the other two do. The uncorking
  is loud and long; on every lift it would stop being a choice.
- **Keeping the shelf's two-kind arithmetic and adding a third branch.** Each new
  kind would multiply the cases; the loop keeps the old outputs and scales.

## Consequences

- Every place that takes a kind, a shop path or a shop view now covers the
  potion, and the type checker fails any `Record<ItemKind, ...>` left without it.
- A potion link sent now still opens in every later build; the names above can
  never be renamed without breaking links and shelves already out there.
- Ticket 08 adds the pour picker (a section here), ticket 13 the scene, card
  picture, token values and the potion box's look, ticket 17 the door.
