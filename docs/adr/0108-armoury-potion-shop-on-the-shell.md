# 0108 - armoury potion shop on the shell: the third kind, its route, and a close look that waits

- **Status:** Accepted
- **Date:** 2026-11-13
- **Related:** [ADR 0096](0096-armoury-item-kinds-saves-and-links.md) (item kinds,
  saves and links), [ADR 0097](0097-armoury-street-and-last-shop.md) (the street
  and the last shop), [ADR 0093](0093-estate-gate.md) (decision 6, the shared
  view), [ADR 0094](0094-per-profile-local-saves.md) (per-player saves),
  [ADR 0104](0104-armoury-potion-item.md) (the potion item),
  [ADR 0106](0106-armoury-potion-names-effects-and-blends.md) (its names and effects).

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

- **One widget owns the Pours group.** `potionWidget` returns `PourPicker` for
  `pour1` and `null` for `pour2` to `pour4`, so the group draws once through the
  existing per-param widget hook. The glass gets a `SwatchPicker` tinted from
  `potionSwatchFor`; every other control stays plain.
- **A pour is a `set` on the lowest empty slot.** A jar calls
  `onChange(nextPourKey(params), id)`; with a full bottle the jars are
  `aria-disabled` (still focusable) and a tap announces the full message and pours
  nothing.
- **Take-out compaction lives in the item's `follows`**, not in the widget or the
  reducer: the widget sets the slot to `none` and `followPours` drops the pours
  above it down.
- **Empty the bottle is batched sets**, one `none` per filled slot from the top
  down in a single handler; React batches them, so the stage sees one change.
- **Accessibility.** Every jar is a button named "Pour in {Label}"; "In the
  bottle" is a list, top pour first, with empty slots above it like the
  bottle itself, each pour with "Take out {Label}"; a polite live region says
  what changed. Every swatch has a light ring because the dark ones are low in
  contrast against the dark tile.
- **The picture is one seam.** `IngredientPicture` is the only place a jar's
  picture is drawn; a plain colour swatch stands in for it.
- **On a phone** the pours list is the same single top-first column as on the
  desk, each pour with the words "Take out" in a button at least 44 px tall. The
  jars tighten (48 px tall, a 22 px swatch) so all nine stay in view in the sheet's
  238 px body at 390 by 844, empty or full; only "In the bottle" and "Empty the
  bottle" sit below the fold, so the tab scrolls inside the sheet like any other.
- **Focus stays in the picker.** After "Take out" focus goes to the take-out
  button now in that row, else the nearest remaining one, else the first jar;
  after "Empty the bottle" it goes to the first jar. Only those controls move it.
  Focus scrolls the sheet into view only when the click came from the keyboard
  (`detail` 0); a tap or a mouse click focuses without scrolling, so the sheet
  stays where the child was. The list rows are one height, empty or filled, so
  the list does not grow as it fills.
  "In the bottle" is a plain list (the schema calls the bottom pour "First pour",
  so numbering the top "1" would contradict it), the dimmed jars point at the full
  message with `aria-describedby`, and each announcement is a fresh node so a
  repeat is heard.

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
