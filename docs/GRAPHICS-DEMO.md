# Graphics demo: a code-drawn art direction (experiment)

_Built 2026-11-25 on 4.9.0 (commit e5bae98). **Adopted by the owner the same day** (D-P10k): this approach becomes the game's art, and Phase 10 converts to it in P10-G1 to P10-G6 (`docs/NEXT-TASKS.md`). The demo itself changes nothing in normal play; it is retired in P10-G6._

## How to open it

1. Show the developer tools (`?dev=1` on the address, or a local server), then press **Debug**.
2. The first button is **Graphics Demo — New Art Direction**. It opens on the world map.
3. The bar at the top:
   - **Map**, **City**, **Battle**, **Gallery** go straight to a scene.
   - **Day / Dusk / Night** changes the time of day.
   - **Old art** (in battle) draws the *same live battle* with the game's current renderer. Press it again to go back.
   - **Res** sets the canvas resolution: full, 2× or 1×.
   - **Stats** shows the frame rate and the update and drawing time.
   - **Reset** starts the demo over. **Exit demo** returns to the game exactly as it was.
   - **☰** hides the bar.

**The connected route.** You start on the map near Brackenfield. Tap Stonebridge on the river and walk there, then press **Enter the city**. Walk around and tap people to talk. The south gate leads out with **Leave for the map**. On the map, the two hostile bands (red rings) chase you. When one catches you, **Fight** starts the battle. After it, **Back to the map**: the band is gone.

**Controls.** These are the normal ones:
- **Map:** tap or click to travel (a route is found round water and mountains). WASD, the arrows or the stick steer. The wheel, a pinch or +/− zoom from 0.5× to 1.6×.
- **City:** walk with WASD, the arrows, the stick or a tap. E, Space or a tap on someone talks to them. Esc closes the dialogue.
- **Battle:** the game's own controls, unchanged: WASD or the stick, Space or ATTACK, Shift or BLOCK, F/H/C orders, 1/2/3 divisions, R rally, the ORDERS panel, the wheel or a pinch to zoom, and Esc to pause.

## The visual language

- **One kit, one set of rules** (`js/gfx/kit.js`):
  - one palette (`PAL`, starting from the brief's greens, tan, cream, terracotta and slate);
  - one warm dark-brown outline at one width, on silhouettes only;
  - light from the upper left: a base colour, one shade on the lower right, at most one highlight. There are no gradients, except soft night lights;
  - a modest shadow leaning lower right;
  - a slightly raised three-quarter view from the south, with fronts facing the viewer.
- **Characters** (`js/gfx/figures.js`): one renderer for everyone, built from parts. The parts are a shadow, legs and boots, a tunic or armour (gambeson, mail, leather, fur, rags), a realm tabard with its device, arms and hands, a big head with a simple face, hair (six styles), a beard, nine helmets, five hats, a cloak, a shield (kite, round, heater or plain wood), a weapon (sword, axe, great axe, spear, lance, bow, hammer, staff, club) and a quiver.
  - A *look* is plain data. A troop's look comes from its id; a townsperson's from their role and a seed.
  - Skin, hair and beards vary by seed, so nobody changes between frames.
  - The figures are about 3 heads tall. They face 4 ways, using the game's own `u.face`. Horses are always drawn in profile, because seen end-on they read as a tall man.
- **Buildings:** one `building()` function. Its spec gives the material (plaster, stone, timber, whitewash, an optional stone ground floor), the roof (terracotta, slate, thatch, shingle, turf), the roof form (gable, gable end to the street, hipped, long hall), timber framing, a chimney, the door, windows, a hanging sign (tavern, smith, barracks, guild) and an awning. Towers, town walls and props (well, stall, forge, anvil, rack, barrels, crates, fences, stone walls, wagons, banners) work the same way.
- **Two cultures from the same parts:**
  - **Valedorn**: blue tabards with a chevron, kite shields, nasal and barrel helms, plaster, stone, terracotta and slate.
  - **Hrothmark**: grey-green wool, fur collars, quartered round shields, spangenhelms, axes, braids and beards, timber long halls with shingle and turf roofs.
  - The road bands have hoods, rags and mismatched kit.
- **Animation, from the real state only:**
  - walking is legs, a small bob and the arms;
  - a sword or axe rises in the swing's windup, sweeps through in its active part (with a short pale trail) and returns in recovery;
  - a spear levels at the facing and thrusts along its line;
  - a raised shield comes across the body (`u.guard`);
  - a bow is drawn while the archer reloads and is released on the shot;
  - a struck soldier flashes pale and recoils slightly;
  - the fallen lie still and fade as the game fades them;
  - a white pennant marks those running, an amber dot the shaken;
  - riders' horses have a leg cycle.

  None of it touches a hitbox or a timing: the drawing only reads the units.
- **Restrained feedback:** a small burst for a hit, a pale arc for a block, a puff for an arrow in the ground, the rally ring, dust behind fast movers. Under Reduced effects there's no dust, no trail and only the rally ring. Arrows have heads and fletching. Health bars show only on the hurt. Rings under the feet are blue for yours, red for theirs and gold for the hero.

## The three scenes

| Scene | What is there |
|---|---|
| **World map** (`js/gfx/map.js`) | A march of its own, 2400×1500. Grass with soft variation, a mountain range with snowcaps, hills, six woods on darker forest floors, a lake, a river with a stone bridge and a ford with stepping stones, the coast with a harbour, a pier and boats, and fields round the villages. Settlements: Stonebridge (walled city with a keep), Greywall (castle on a rise), three Valedorn villages, Ulfstead (a Hrothmark steading). Parties on the roads: a Valedorn patrol, a lord (white horse, gold-edged banner), a merchant caravan (covered wagon), a Hrothmark patrol, and two hostile bands that chase (Hrothmark raiders, Road Reavers). Each party has its own figures, banner and stance ring. Names show at the right zoom, and a party's name only when near or under the pointer. Day, dusk and night light the windows. |
| **City** (`js/gfx/city.js`) | A new Stonebridge, 1920×1220 (the real one in `data/town_hubs.js` is untouched). A south gate with towers and guards, the main street, a cobbled square with a well and three stalls, the guildhall with its bell tower and banners, the Gilded Ford tavern (sign, awning, barrels, bench), the smithy (wide door, forge glow, anvil, smoke), the barracks (rack, training dummy), a merchant's stone-and-timber house, eight houses, a stable, gardens, chickens, trees, lamps. Ten people with work and words: merchant, smith (hammering), innkeeper, recruiter, reeve, guards, a traveller, a widow. Walkers on loops and a child running round the well. Chimneys smoke. Collision uses the game's own `CL.units.resolveObstacles`. Building names show only when close: the look should say what it is first. |
| **Battle** (`js/gfx/battle.js`) | The game's real combat (`CL.combat.startBattle` as a practice battle, `CL.combat.update`), 35 on the field. Yours: the hero, 3 levies, 4 footmen, 2 guards, 3 hired spearmen, 3 hunters, a longbowman and 2 riders. Against you: 16 Hrothmark raiders (clansmen, shieldmaidens, axemen, huscarls, fell archers, hill riders) or 15 Road Reavers. The meadow has a forest edge, copses, bushes, rocks, two low stone walls, a fence, an abandoned wagon with crates, and a brook that is the game's ford rule (wading is slower). |
| **Gallery** (`js/gfx/gallery.js`) | Every part on one screen: soldiers at true battle size and 2.4× bigger, turning and cycling idle, walk, attack, guard and hit; townsfolk; buildings by material; nature, props, shields and map pieces. |

## Isolation: the campaign can't change

- **The campaign:** `CL.campaign` is swapped for a deep copy on entry, and the real object is put back on exit.
- **The game state:** `CL.game` keeps its identity (`js/input.js` holds it), but its contents are set aside and replaced by a sandbox copy. On exit it is emptied and refilled exactly.
- **The save:** while the demo is open, `CL.save.write` refuses (one guard line in `js/save.js`). So no autosave, page hide, battle end or screen change can write. The demo writes no storage and no settings itself.
- **The main loop:** it hands frames to the demo (`js/main.js`), so the real world, clock, parties and autosave are frozen while it runs.
- **Shared values:** the battle size is set to 40 for the demo battle and put back on exit.
- **Clean-up:** listeners are added on entry and removed on exit. The canvas, panel and stylesheet are removed with them.
- **Lazy loading:** the demo's files load only when the button is pressed (`js/debug.js`). Normal play doesn't load them at all.
- **Refresh:** nothing of the demo survives a reload, and the game boots on the untouched save.

**Verified by tests on desktop and phone** (`tests/browser/gfx-demo.spec.js`):
- after travelling, entering the city, walking, talking, fighting, the old-art toggle, a victory, the gallery, Reset and Exit, every stored key is byte-identical and so is the campaign;
- the same after a defeat against a band met on the map;
- page hide, `pagehide`, an explicit write and an autosave in the demo all return false, and storage is unchanged;
- a reload in the middle boots on the real save;
- three entries and exits leave no canvas, panel, stylesheet or listener behind, the scripts load once, and the battle size is restored.

The browser pane's own save (an existing one on this machine) was fingerprinted before and after the manual testing here.

## Files

- **New** (all under `js/gfx/`): `kit.js`, `figures.js`, `gallery.js`, `map.js`, `city.js`, `battle.js`, `demo.js` (runtime, isolation, input, panel), `demo.css`.
- **New tests:** `tests/gfx-demo.test.js` (5) and `tests/browser/gfx-demo.spec.js` (5 cases × 2 devices).
- **Changed, debug-only hooks:**
  - `index.html`: the Debug button;
  - `js/debug.js`: the button's action and the loader;
  - `js/main.js`: the loop hands frames to the demo while it is open;
  - `js/save.js`: the write guard;
  - `tests/assets.test.js`: reads `js/` recursively, so the demo's files are checked for external resources too.

## Comparison with the current graphics

Matching screenshots (34 PNGs, about 11 MB, not committed) are in `docs/graphics-demo/`, at the same sizes (1280×720, and 812×375 at 3×). The old ones are `*-old-town`, `*-old-map` and `*-old-battle`. In battle, **Old art** gives the closest comparison: the same soldiers, the same moment, the old renderer.

| | Current | Demo |
|---|---|---|
| **Sharpness** | A 960×540 canvas scaled up pixelated | Drawn at the screen's real pixels: crisp on a 3× phone |
| **Town** | Flat boxes with name signs. One tile tree. Big sprites (the hero is taller than the inn's door) | Ten kinds of building with roof forms, framing, signs, smoke and lit windows. The function shows before the label does |
| **Troops** | Role sprites: every Hrothmark or Aurelian troop shares the Valedorn role art. One sprite set per facing and frame | Each troop by its kit, each side by its colours and shapes. Weapons and the attack's real phases are visible. Women soldiers come free (the parts have a `female` look) |
| **Map** | Canvas shapes and markers, already code-drawn | Miniature towns, a castle, villages of two cultures, banner-carrying parties, a wagon, a lord on a horse |
| **Detail and cost** | Raster sprites carry more texture and detail per figure, and draw cheaply: about 0.7 ms a frame for this battle at full speed, 3 ms at 4× CPU throttle | About twice the drawing time: 1.4–1.6 ms at full speed, 7 ms throttled. Rasterising a full-resolution 3× canvas costs more than that (below) |

**Where the current art is better.** Its sprites have more individual detail and texture up close, and its drawing is cheaper. Big melees are a pile in both: the engine packs fighting soldiers close. In the demo the blue kite shields against the round shields and the foot rings carry it, but single soldiers in the middle are hard to pick out.

## Performance (headless desktop Chromium; **not measured on a real phone**)

| Scene | Full speed draw / update (ms) | 4× CPU throttle: draw (ms), fps at full resolution, fps at the 1× canvas |
|---|---|---|
| Map at 1× | 1.3 / 0.08 | 6.3 · 18–26 fps · 30–56 fps |
| Map at 0.5× (the whole region) | 2.7 / 0.05 | 12.9 · 13–18 fps · 23–33 fps |
| City | 2.0 / 0.05 | 8.8 · 19–26 fps · 28–46 fps |
| Battle, 35 units | 1.6 / 0.46 | 7.1 · 19–25 fps · 27–42 fps |
| Same battle, old art | 0.7 / 0.41 | 3.3 · 44–45 fps · 48–51 fps |

- At full speed, every scene runs at 60 fps on desktop and on the phone profile.
- Under throttling, the frame rate falls well below the JavaScript time because of rasterisation. The phone profile's canvas is 1988×1118, against the game's 960×540.
- At **Res 1×** the throttled phone profile gets back most of the frame rate: map 56, city 46, battle 42 fps.
- Opening the demo takes 60–70 ms (about 400 ms throttled). Most of it is building the map's travel grid once.
- The repeated map trees and peaks are cached as small images per zoom, and settlement bodies as one image each.

What would help next if this is adopted: cache the static ground of the city and battlefield per view, draw fewer tufts when zoomed out, and use 2× rather than the full 3× on phones. All three are simple. None needs a framework.

## Candid assessment

**What worked:**
- the towns, more than anything: roof forms, framing, signs and small life make a place you recognise without labels;
- the troop kits: spear, bow, shield, horse and helmet read at phone size;
- a culture comes from about six parts and a colour;
- animation taken straight from the swing's phases is honest and readable;
- the map reads as one miniature world;
- one person (or agent) can add a troop, a house or a prop in minutes by writing a look or a spec.

**What didn't, or looks unfinished:**
- big melees blur;
- the map's settlements are tiny at 0.5× zoom;
- the fields are plain rectangles;
- side walls of the city are simple strips;
- fallen soldiers are the standing figure rotated;
- faces are dots;
- there is no fog of sight;
- the stream and the map's coast have no real shoreline detail;
- the toolbar is busy on a phone (☰ hides it);
- the demo hero's map banner device is a plain disc.

**Easy improvements, without much more complexity:**
- an eight-way facing for the drawing only;
- a smaller dedicated melee pose;
- shoreline foam;
- fields in strips;
- one fallen pose per weapon;
- portraits from the same parts at a larger scale. P10-09's portraits could use them.

**Does it remove the external art pipeline?** For battles, towns and the map, yes. Everything here is code, with no image files, no generation tools and no hand processing. What it doesn't give is the richness of painted or pixel sprites close up. Whether that matters is the owner's call.

## Is it practical for the whole game?

It appears practical. The renderer already takes a troop id and a side. The building function takes a spec, which `data/town_hubs.js` could hold. The battle drawing reads only unit state that every battle already has.

**If approved, a production plan would need to:**
1. Move the kit into the main renderer behind a setting, and keep the sprites as a fallback until each set is done.
2. Give every troop in `data/troops.js` a look (about 45 rows).
3. Draw the real map's settlements and parties with the map pieces.
4. Give each walkable town its building specs.
5. Decide the phone resolution policy (2× by default?).
6. Measure on a real phone.
7. Re-plan P10-G1 and P10-G2 around this instead of Sprite Studio.

None of that has been started.

## Tests run

- **Fast suite:** 920 of 921 passed. The failure was `tests/assets.test.js` reading the new `js/gfx` folder as a file; fixed (it now scans `js/` recursively), and the file passes.
- **New tests:** `tests/gfx-demo.test.js` passes (5). `tests/browser/gfx-demo.spec.js` passes (10, desktop and phone).
- **Lint:** clean except the 2 old warnings. **Typecheck:** clean.
- **Full browser suite (non-visual):** 263 passed, 9 skipped, 2 failed under load: `layout` (the world map) and `world-map` (the cut-short wait, the known flake recorded in P10-09). Both pass on their own, twice each, on both devices.
- **Not run:**
  - the slow suite and the long runs (this touches none of their systems);
  - the `@visual` screenshot baselines (they are compared only on CI's Linux).
- **No real-device testing.** Phone figures are from Chromium's phone emulation with CPU throttling, which is not a phone.
