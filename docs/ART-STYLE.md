# Crownless art style: drawn in code

_From P10-G1 (4.10.0), decision D-P10k._ Everything the game shows is drawn in code by the art kit in `js/art/`. There are no image files to make, generate, crop or recolour. To see every part, open **Debug → Art gallery**: each realm's troops at battle size and enlarged, turning and cycling poses, plus the hero, the companions, townsfolk, buildings by culture, nature and props.

This guide is for whoever adds to the art next, human or agent.

## The rules

| Rule | What it means |
|---|---|
| **One palette** | `PAL` in `js/art/kit.js`: warm greens, olive, cream, sandstone, warm browns, terracotta, slate, muted blue, restrained crimson. Use a palette colour or a tone of one (`tone(hex, k)`: lighter if `k` is above 0, darker if below). Strong colour is for realms, the hero, selection and important feedback. |
| **One outline** | `STYLE.outline` (warm dark brown) at `STYLE.line`, round silhouettes only, never on inner detail. `fillLine(ctx, colour)` fills and outlines the current path. |
| **One light** | From the upper left. A base colour, one shade on the lower right (or the right side), and at most one small highlight on the upper left. No gradients or textures, except the soft glow of lights at night (`glow`). |
| **One shadow** | A soft ellipse that leans a little to the lower right (`shadow(ctx, x, y, rx, ry, height)`). |
| **One view** | A slightly raised three-quarter view from the south: fronts face the viewer, and roofs and tree crowns show a little of their tops. People face four ways (`down`, `up`, `left`, `right`: the game's own `u.face`). Horses are always drawn in profile. |
| **Simple on purpose** | A few clear shapes per thing, readable at phone size. When something can't be read at 1× on an 812×375 screen, make its shape clearer rather than adding detail. |
| **Stable** | Variation comes from a seed (`rng(seed)`, `hash(seed, i)`), never from `Math.random` while drawing, so nothing flickers. |
| **Honest** | The drawing only reads the game: facing, swing phases, guard, cooldowns, flash, fallen, morale. It never changes a hitbox, a timing, a reach or a speed. A shield is drawn only on a troop that can block; a spear or pike means a long reach; a bow or crossbow follows the troop's shot. |

## Conventions for drawing functions

- **Arguments:** `ctx` first, then the anchor (x, y): where the thing meets the ground (feet, or the base centre of a building's front wall). Drawing goes upward, to negative y, from there, so sorting by y paints a scene in depth order.
- **Size:** `s` is a size factor. 1 is the battle and town scale; a person is about 38 px tall. The map uses about 0.45 for houses and 0.6–0.75 for figures.
- **Units:** coordinates are the game's 960×540 logical pixels. The renderer scales them to the screen's real pixels (the **Sharpness** setting: Sharp, Balanced or Fast), so never size anything in device pixels.
- **Caching repeated drawings:** a forest of trees, the map's peaks and settlements are drawn once at the current scale and stamped (`cached(key, k, w, h, ox, oy, paint)`). Animated things (people, banners, smoke) are drawn live.

## People: looks and poses (`js/art/figures.js`)

One renderer, `figure(ctx, x, y, look, pose)`, draws everyone.

**A look** is plain data:
- **Troops** have one in `data/troops.js` (the `LOOKS` table, one row a troop; packs may give their own).
- **Companions** have one in `data/companions.js`.
- **Townsfolk** get one by role, from `townLook(role, seed)`.
- **The hero** gets one from the creator's choices, from `heroFor(character, canBlock)`.

The vocabulary is `CL.content.LOOK` (`js/content.js`), and the content checks refuse anything else:

| Part | Values |
|---|---|
| `armour` | gambeson, mail, leather, fur, rags (none: a plain tunic) |
| `helmet` | nasal, kettle, great, cap, hood, spangen, crest, plumed, furhat, sallet |
| `hat` | brim, cap, kerchief, coif (townsfolk, and some militia) |
| `shield` | kite, round, heater, wood, pavise (only on a troop with `shield: true`) |
| `weapon` | sword, axe, greataxe, spear, pike, lance, bow, crossbow, hammer, staff, club |
| `hairStyle` | short, long, braid, bun, bald, tied |
| colours (`#rrggbb`) | tunic, legs, boots, hoodColor, capColor, hatColor, band, cloak, cloakTrim, plume, apron, hair, skin |
| flags (`true`/`false`) | tabard (in the side's colours, with its device), quiver, fur (a collar), pauldrons, beard, female (companions and townsfolk; a troop's comes from its `gender`) |
| others | `bowSize` (0.8–1.4), `mount { coat, mane, pony }` (cavalry only) |

**Faces, skin, hair and beards** vary by the soldier's seed (the unit's or soldier's id), within the culture's range.

**The realm's colours** come from the side a soldier fights for (`realm(id)`: the realm's `color` in `data/factions.js`, with its culture's device), not from the troop. A hired spearman wears the company's colours.

**A pose** is what happens this frame:
- `face`;
- `walk` and `move` (the stride);
- `atk { phase: windup | active | recovery, k }` (the swing: a blade rises, sweeps and returns; a spear levels and thrusts);
- `guard` (the shield across the body);
- `draw` and `shot` (a bow drawn while reloading and loosed; a crossbow's string drawn back over its slower load);
- `hit` (a pale flash and a small recoil);
- `mounted`, `work` (a hammering beat), `talk`.

## Cultures (`CULTURES` in `js/art/kit.js`)

Each culture (a realm's `culture` in `data/factions.js`) has three things:
- **a device** for banners, tabards and shields: chevron, bar, quarter, lozenge, coin, wave, cross;
- **its usual shield**;
- **its town materials:** walls, roofs and roof forms, most common first.

| Culture | Device | Shield | Towns |
|---|---|---|---|
| valedorn | chevron | kite | plaster, stone, whitewash; terracotta, slate, thatch |
| aurelian | bar | heater | whitewash, stone; terracotta, hipped roofs |
| hrothmark | quarter | round | timber halls; shingle and turf; long halls |
| vessaro | lozenge | heater | whitewash and plaster; terracotta, hipped roofs |
| border (free cities, bands) | coin | round | mixed: plaster and timber, thatch and shingle |
| ostrand | wave | kite | grey stone; slate and turf |
| saltreach | cross | heater | whitewash; terracotta and slate |

The bands are not realms: they have their own looks in `SIDES` (`reavers`, `merchant`).

## Buildings (`building(ctx, spec, t, night)`)

A spec says, at s = 1:
- `x, y`: the front wall's foot;
- `w`, `h`, `d`: width, wall height, and how much roof shows;
- `wall`: plaster, stone, timber or whitewash, with `base: true` for a stone ground floor;
- `roof`: terracotta, slate, thatch, shingle or turf;
- `form`: gable (the ridge along the street), end (the gable end to the street), hip, or long (a hall);
- `beams` (timber framing), `chimney` (−1..1 along the ridge), `door` (center, left, right or wide), `windows` (a count);
- `sign`: `{ kind: tavern | smith | barracks | guild, at: left | right }`;
- `awning` (a colour).

At night (`night` above 0.3) the windows light. Walls, towers and props work the same way: `cityWall`, `tower`, `well`, `stall`, `forge`, `anvil`, `rack`, `barrel`, `crate`, `fence`, `stoneWall`, `wagon`, `banner`, `shieldShape`, `tree`, `bush`, `rock`, `tuft`.

## How to add…

**A troop.**
1. Give it a `look` row in `data/troops.js` (or in its pack) from the vocabulary above.
2. Make the look agree with the troop: a shield only with `shield: true`; a spear, pike or lance for a reach of 70 or more; a bow, or a crossbow for a shot of 300 or faster; a `mount` for cavalry.
3. `npm test` runs the content checks. Look at it in the Art gallery, at 1× on a phone-sized window.

**A culture.**
1. Add a row to `CULTURES` with a device, a shield and town materials.
2. A new device is a few lines in `device()`.
3. Give the realm its `culture` in `data/factions.js`. Its colour is already its `color`.

**A part** (a helmet, a weapon, a shield shape).
1. Draw it in `js/art/figures.js` (`helmet()`, `weapon()`, `shieldShape()`), anchored like the others, in the palette, with the one outline.
2. Add its name to `CL.content.LOOK`.
3. Show it in the gallery. Check it in all four facings and every pose.

**A building or prop.** Prefer a spec of `building()` or an existing prop with new values. When a new prop is needed, write it beside the others in `js/art/kit.js`: anchored at its foot, a shadow, the outline, base, shade and highlight. Then add it to the gallery's props page.

## Battles (`js/art/battle.js`)

The renderer hands a battle to `CL.gfx.battle.draw(ctx, game, view, k)`. It draws:
- the ground (grass, the map's patches, rises, water, a courtyard's flagstones, decor);
- the obstacles by their `look`, sorted with the units by their feet;
- each unit from `lookOf(u)`: the hero, a companion, a lord, a tournament fighter, or a troop on its side;
- the fallen, arrows, and the game's effects.

A standing or walking soldier is a **baked frame**: drawn once per look, facing, step and scale (`cached`), then stamped. One striking, blocking, struck or shooting is drawn live, except in a big battle (over `CL.render.BUSY.from` at once), where those poses are baked too, three steps to a phase. The real phase still chooses the step.

A new obstacle look is a branch in `obstacle()` and a name in the maps' comment (`data/battle_maps.js`). A new pose has to bake, so keep it a function of the pose's few fields.

## Towns (`js/art/town.js`)

`CL.gfx.town.draw(ctx, town, opts)` draws a town's streets.
- **Buildings:** each is drawn inside its footprint in `data/town_hubs.js` (the box is also its collision) from `specOf`: its kind (tavern, barracks, house), the town's `colors`, and its realm's culture, with the obstacle's own `spec` over that. A landmark gets `tower: 'left' | 'right'` or a `long` hall. The ground and each building are baked once per town, scale and light.
- **People:** drawn from their `role` (`ROLE_LOOK` to the kit's role looks), a woman when `gender: 'female'`, a companion in their own look.
- **Life:** smoke from chimneys, banners, a child at the well, gulls over water, hens in the northern and salt towns. The light follows the campaign's hour (`nightOf`).
- **To add a town:** lay out its footprints in the data as before. To give a building more character, add a `spec`.

## The world map (`js/art/worldmap.js`)

`terrain(ctx, map, extent, k)` draws the land into the renderer's cached layer (one per zoom step): grass, fields, the sea, areas, forests, hills, waters and crossings, roads. The renderer still decides what shows, where and when, and draws the labels and badges; the module draws:
- `settlement` (a miniature by type and culture, the sovereign's banner, an occupier's pennant, a siege camp);
- `site`;
- `party` (its template's own troops, its banner, a stance ring, its facing);
- `ghost` and `company`.

Icons keep about their old size on screen, so taps and labels stay put. Every miniature is baked once per kind, culture, side, facing, step and scale.

## Portraits, figures, arms and icons (`js/art/ui.js`)

**Portraits.** `portrait(ctx, x, y, w, look, { helm })` draws a bust in a 100-unit square: shoulders in the look's clothes, the neck, the face and the hair or headgear.
- **A face** is `faceOf(seed)`: a shape (round, long, broad), brows, a nose and a mouth by kind. `beardKind` is 0 for none, 1 stubble, 2 short, 3 full. `crown` marks a ruler.
- **The looks:**
  - `soldierLook(s, side)` reads the soldier's `portrait` id (P10-09) over their troop's look;
  - `heroLook(character)` is the hero;
  - `lordLook(c, pid)` is a lord or ruler;
  - `speakerLook(npc)` is a townsperson by role, a companion, or a lord.

**Figures.** `figure(ctx, w, h, look)` fits a standing or mounted figure into a box. `troopUrl(id)` is a troop's small figure.

**Arms.** `houseArms(c, house)` gives a realm-like colours object: the realm's colour, a charge from `DEVICES` and a tincture, by the house's place among its realm's houses. The same object works with `shieldShape`, `banner` (add `edge` for a gold edge) and `device`.

**Icons.** `ICONS` holds 24×24 paths in gold with the one outline. `installIcons()` writes the `.ico-<name>` rules at boot. A good with an entry in `ICONS` shows its drawing; a pack's good without one shows its emoji.

**Images on the screens.** `canvas(w, h, paint)` and `url(key, w, h, paint)` draw at the screen's resolution. Image URLs are cached by key.

## What it costs

Drawing in code costs more than stamping sprites. Measure before and after a change:
- the Debug panel's **Battle benchmark** and **Map stress test**;
- the demo's **Stats** (per frame, the update and drawing time).

The numbers from the demo and P10-G1 are in `docs/GRAPHICS-DEMO.md` and `docs/NEXT-TASKS.md` (P10-G1's Done paragraph). On a phone the canvas resolution is the biggest lever (Sharpness). In big battles, simplify figures and stamp the still ones (P10-G2).
