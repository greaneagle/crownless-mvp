# Crownless 1.6.0 — The Border March

A single-player, top-down party-battle prototype in plain HTML5 Canvas and classic JavaScript. There's no bundler, no runtime dependencies and no server. It's published to GitHub Pages straight from `main`.

- **Design spec:** [`Crownless_MVP_GDD_v1.md`](Crownless_MVP_GDD_v1.md). The engine is HTML5 Canvas, not the Godot the spec recommends.
- **Full v1 documentation** (rules and numbers, architecture, how to add content, what v2 brings and where its details are): [`docs/V1-DOCUMENTATION.md`](docs/V1-DOCUMENTATION.md)
- **Current behavior (regression reference):** [`docs/BASELINE.md`](docs/BASELINE.md)
- **Status and plan:** [`docs/ROADMAP.md`](docs/ROADMAP.md); the v2 plan is [`docs/V2-PLAN.md`](docs/V2-PLAN.md), from the owner's v2.0 design documents

## What is playable

- Create your hero: a name, a cloak colour, and a background (Farmhand, Scout or Peddler). You start with 60 crowns, a worn sword, clothing, an oak shield and some food, and no soldiers.
- Equip loot from the **Party** screen. Strength sets your HP, your weapon and One-Handed skill set your damage, armor reduces hits, a shield is needed to block, and Pathfinding or a horse speeds up travel.
- Travel the Border March, a strategic map with 10 settlements. Click or tap to travel; roads are faster and forests slower, and time passes as you go.
- Enter settlements to hire troops and rest. Valedorn towns train Levies and Hunters, Aurelian towns train Recruits and Skirmishers, and the two towns also hire out Mercenaries. Party size starts at 8 soldiers (wounded included) and grows with Leadership and renown, and every troop's stats come from `data/troops.js`.
- **A living map:** kingdom patrols hunt bandits, caravans haul goods (which moves prices), and Road Reaver bands rob caravans and hunt travellers who look weak. Use **Wait** (or Space) to let time pass.
- **Progression:** battles earn XP. Your hero levels up to 10 and gets skill points every level and an attribute point every second level. Soldiers who fight earn XP and can be upgraded along the Valedorn and Aurelian troop trees for gold. Party size grows with Leadership and renown.
- **Reputation:** the Valedorn Crown and the Aurelian Remnant each see you as Friendly, Neutral or Hostile. Contracts and beating Reavers on their land raise it; attacking their patrols or caravans lowers it. Friendly gives +2 party slots. Hostile kingdoms refuse recruits and contracts, and their patrols hunt you. Greywall and Ashgate forts can change hands.
- **Contracts:** Stonebridge and Eastwatch post three kinds of work. **Bandit hunts:** find the gold-marked band and break it, then return for pay. **Caravan escorts:** ride beside a wagon to another settlement (it only rolls while you stay close) and beat the Reaver ambush on the road. **Deliveries:** carry goods (with a refundable deposit) or a sealed letter. Escorts and deliveries pay on arrival, and every finished contract wins favour with the town's kingdom.
- **Regional news:** every two days a line of news reaches you (shown on the map and kept in the Journal): Reavers robbing caravans, patrols beaten or victorious, Valedorn and Aurelian patrols skirmishing on the border, forts changing hands, and your own deeds. Markets talk about what moved their prices: a robbed caravan makes its goods cost more where it was going; caravans, escorts and deliveries that arrive make them cheaper.
- **Encounters:** when bandits catch you, or you attack their camps, choose **Attack** (fight it yourself), **Auto-resolve** (the odds are shown), **Negotiate** (pay their toll, or intimidate them if you're much stronger) or **Retreat** (faster parties get away more often).
- Real-time four-direction hero movement. Sword swings have a visible windup, a strike window and a recovery, and hit everything in a 90° arc in front of you.
- A frontal shield block that covers 120°. It can't cancel a swing you've already started, and enemy windups are drawn in red so you know when to block.
- Allied infantry, archers and cavalry fight alongside you. Archers fire arrows; riders charge, hit 1.2× harder at full gallop, ride through and wheel round.
- Pick a group with **1** (infantry), **2** (archers) or **3** (cavalry), then give an order: **F** Follow, **H** Hold or **C** Charge.
- **Q1 — A Stranger's Wage:** ask Elder Maren in Stonebridge for work. Fetch the grain wagon from Oakford (and survive the ambush), break the Reavers, or help Sergeant Brun raise three recruits. Every route ends with the charter fragment and the first hint of who should hold Greywall.
- **Q2 — The Broken Seal:** Caravan Master Oswin in Eastwatch lost a sealed packet to Reavers on the river road. Fight them, cow them with a big enough company, or pay Wenna the Fence in Highmere for their secret. Then decide who sees the two rival Greywall charters: Captain Aldric of the Crown, Magistrate Vell of the Aurelians, or nobody.
- **Mara:** after Q2, a former imperial scout waits by the inn in Stonebridge. Be honest with her and she rides with you for free, otherwise for 100 crowns. She fights beside you, wears the weapon and armour you give her, and finds faster roads (+1 Pathfinding).
- **Q3 — Two Banners:** after Q2, Captain Aldric and Magistrate Vell both want your sword. Break the other side's column, sell one side's plans to the other, or refuse both and save a caravan from Reavers. Mara rides ahead to scout — reach the clash within 3 days or lose her for good.
- **Q4 — The Greywall Verdict:** both banners march on Greywall. Declare for the Crown, the Remnant or the road, win the deciding battle in Greywall's courtyard, then set the terms at the parley. Three endings: the Crown holds Greywall, the Remnant takes it, or — if you refused both crowns and kept Oswin's packet — the Road Peace. The sandbox carries on afterwards.
- **Story system:** quests and conversations are data (`data/quests.js`, `data/dialogue.js`) run by an interpreter with conditions, effects and event triggers. Talk to Elder Maren for a conversation that changes with your background, renown, reputation and who holds Greywall. The **Journal** lists your quests and objectives.
- **Walk Stonebridge:** stroll the streets and talk to the innkeeper (food, rest, contracts, saving), the merchant (market), the sergeant (hire troops) and the elder. Tap a person to walk over and talk; the classic menu is a tap away.
- **Three battlefields:** you fight on an open field, in a forest clearing (trees block movement and arrows) or at a walled fort courtyard, depending on where the fight happens. Forts show their garrison.
- The battle is two waves of Road Reavers (Looters and Reavers, defined in `data/encounters.js`) and ends in victory or capture. Armor reduces damage, and archers sometimes miss.
- Win gold, renown and loot, which goes into your pack. If you're captured you lose 20% of your crowns and one item, then you're released near a settlement half a day later.
- **Named soldiers (1.4.0):** every soldier has a name from their homeland's culture, where and when they joined, and a service record (battles, victories, kills, assists, wounds, captures, wages actually paid) with short service notes. The Party screen lists them by name with a filter; each has a card where you can rename or upgrade them. Names come from `data/names.js`, which a mod can extend.
- **Troop tree (1.5.0):** a third Party tab shows every troop line as you discover it: troops you have met by name, troops you have hired or trained in full. Troops at the end of a line are at max tier; Mercenaries now train into Sellswords. **Upgrade all ready** upgrades everyone who has earned it after showing the total cost.
- **Time (1.6.0):** a battle takes a fixed 4 game hours of overworld time, fought or auto-resolved; capture 12 hours; a rest a day. The fight's own seconds, pausing and menus pass no time.
- Casualties: 35% of fallen soldiers are killed and the rest are wounded for 2 campaign days. Travelling or resting passes the time.
- **Gear:** about 30 items, including swords, axes and maces, three shields, helmets, armour from gambeson to mail, gloves, greaves and three horses. Find them as loot (better bands drop better gear) or buy them in town armouries.
- **Trade:** buy goods where they're cheap and sell them where they're dear. There are six goods, every market prices them differently, prices move as you trade and settle back over time, and a heavy cargo slows you down. You can also sell spare gear from your pack.
- **Upkeep:** your party eats a ration a day for every 5 people, so buy food in towns and villages. Wages are due every 7 days. Running out of food or missing wages lowers morale, and below 25 soldiers start to desert.
- **Save & export** (in any settlement or on the title screen): export your game as a file, or copy it as text, and import it in another browser or device. Damaged, edited, newer-version or unknown-content saves are refused without touching your game, and the save from before an import can be restored.
- **Full screen on phones:** with Settings → Full screen on (the default on phones), the game hides the browser's address bar on your first tap and locks to landscape (Android Chrome and desktop browsers). iPhone browsers can't do that for web pages, so add Crownless to your home screen instead (Share → Add to Home Screen; on Android, ⋮ → Add to Home screen). Launched from the home screen it runs with no browser bars at all, with its own icon.
- **Tips and How to Play:** the first time each screen or situation comes up (the map, Stonebridge, an encounter, the first battle, the market, low food, points to spend…), a short tip explains it once on this device; the first battle waits on its controls card. **How to play** (title screen, Settings, or a tip's More help) covers every system and lists the touch and keyboard controls. Tips can be switched off or shown again in Settings. The Elder's first quest remains the hands-on tutorial.
- **Sound and settings:** synthesized sound effects and three music loops (menu, world, battle), generated in the browser with no sound files. The ⚙ button (on the map, in town and in battle, which pauses) and the title screen open **Settings**: music and effects volume, battle size (20 / 30 / 40 units at once), health bars over soldiers, and reduced effects. Settings stay on the device and are not part of a save.
- **Developer tools** (the Logs and Debug buttons) show on a local dev server. On the published site they are hidden; open the page with `?dev` added to the address (for example `…/crownless-mvp/?dev`) to show them on that device, and `?dev=0` to hide them again. F3 opens the diagnostics panel either way.
- The **Debug** button gives testing shortcuts: hero and troop XP, renown, contracts, crowns, trade goods and prices, spawning or clearing world parties, food and morale, soldiers, items, stats, god mode, time, teleport, win or lose a battle, and wiping the save. Every use is logged.
- The game auto-saves in the browser (after battles, in settlements, and when the page is hidden or closed) and keeps a backup of the previous save; if the latest save is ever unreadable, the one before it loads and you are told. With the game open in two tabs, the older tab stops saving so it can't overwrite newer progress. Save & export shows when you last exported a copy, and the game reminds you now and then (browsers, notably iOS Safari, can clear site storage). Saves from 0.3 and 0.4 are converted automatically. A diagnostics panel (F3) shows logs and can export them as JSON or TXT.
- Landscape phone controls: joystick, Attack, Block and an Orders menu above them. The game pauses when you switch away and asks you to rotate in portrait.
- Gate details and playtest checklists: [`docs/GATE-A-VALIDATION.md`](docs/GATE-A-VALIDATION.md), [`docs/GATE-B-VALIDATION.md`](docs/GATE-B-VALIDATION.md), [`docs/GATE-C-VALIDATION.md`](docs/GATE-C-VALIDATION.md), [`docs/GATE-D-VALIDATION.md`](docs/GATE-D-VALIDATION.md)

| Action | Desktop | Touch |
|---|---|---|
| Travel (map) | Click a place or party; Space halts or waits | Tap a place or party; Wait button |
| Move (battle) | WASD / arrows | Left joystick |
| Attack | Space / left click | Attack |
| Block | Shift / right click | Hold Block |
| Orders | 1 or 2 group, F/H/C order | Orders |
| Pause | Esc | Pause |
| Diagnostics | F3 | Logs |

## Project layout

```
index.html        page shell; loads data/ then js/ as classic deferred scripts
style.css         layout, HUD and touch controls
js/               game runtime, attached to window.Crownless
  core.js         constants, math helpers, diagnostics log
  content.js      ContentDB: lookups into data/ + boot-time validation
  state.js        live game state (CL.game)
  storage.js      storage layer: every save key goes through it (localStorage today)
  events.js       domain events with unique IDs (BattleResolved, SoldierWounded, …) and listeners
  clock.js        the campaign clock: the one way time moves; fixed hours per battle, capture and rest
  soldiers.js     named soldiers: culture names, service records kept from events, notes, filters, rename
  troops.js       the troop tree as discovered (seen or owned), from events and hiring offers
  save.js         save schema v6: structure checks, migrations (0.3, v2 to v5), last-known-good backup, autosave
  assets.js       sprite preloading and frame tables
  units.js        units built from troop data, swing phases, facing, movement
  combat.js       waves, attacks, AI, arrows, win/loss
  party.js        recruiting, day clock, wounded recovery, battle results and loot
  upkeep.js       food rations, weekly wages, morale, desertion
  trade.js        markets, prices, cargo, selling gear
  world.js        strategic map: travel, terrain, settlements, sites, capture release
  encounter.js    the one commit path for every encounter result (battle, auto-resolve, retreat, toll), exactly once
  town.js         walkable Stonebridge (menu first, Walk the streets): walking, townsfolk, talking
  autoresolve.js  seeded RNG and GDD auto-resolve (power, odds, casualties)
  parties.js      patrols, caravans, bandit bands; encounter choices
  contracts.js    contract lifecycle (offer, accept, complete, collect, fail)
  portable.js     save export/import: file format, checksum, strict validation
  character.js    hero creation, attributes/skills, equipment, derived stats
  debug.js        Debug panel testing tools
  settings.js     device settings (volumes, battle size, effects), kept outside the save
  audio.js        Web Audio synthesizer: sound effects and music loops
  tips.js         first-time tips (content in data/help.js)
  fullscreen.js   full screen on tap (Settings), home-screen app detection
  ui.js           overlays, roster, pause, diagnostics panel
  render.js       canvas drawing (battle and world map) and HUD
  input.js        keyboard, mouse, touch buttons, joystick
  main.js         boot and main loop (loads last)
data/             content definitions (window.CROWNLESS_CONTENT): troops, encounters, world map, items, backgrounds, name cultures…
assets/           sprite PNGs (u#### units, w#### world tiles)
tests/            node:test suite (no dependencies)
types/            shared types for the type checker only (the page never loads them)
tsconfig.json     type-checker settings: checks the js/ files marked // @ts-check, emits nothing
```

Script order in `index.html` matters, because each module uses the ones loaded before it.

## Develop

You need Node 22 or later, and only for the dev tools. The game itself needs nothing.

```bash
npm run serve
```

Then open http://localhost:8123. Opening `index.html` directly from disk also works.

```bash
npm test
```

```bash
npm run lint
```

`lint` runs Biome and then the type checker (`npm run typecheck`, which is TypeScript's `tsc --noEmit` fetched by `npx`). There is no build step: the type checker reads the JSDoc in modules that start with `// @ts-check` (`core`, `save`, `party`, `units`, `combat`, `story`, `world` so far) against the shared types in `types/crownless.d.ts`, and writes nothing. The game still runs the plain `.js` files.

```bash
npm run simulate
```

`simulate` plays brand-new campaigns headlessly with a simple bot (30 days, 8 seeds by default) and prints how each went, as a quick check that the campaign loop doesn't stall.

```bash
npm run simulate:story
```

`simulate:story` plays whole stories from a fresh start to an ending with a randomized bot (200 seeds by default). It reports the endings and branches reached, and prints the last steps of any run that soft-locks. `tests/gate-d.test.js` runs the same check on 60 seeds.

```bash
npm run bench
```

`npm run assets` rebuilds `assets/manifest.json` (every image, its source, and whether the game uses it) after adding or removing art; a test fails if it is out of date.

`bench` times the battle simulation per frame at 20, 30, 40 and 60 units on each battle map. Drawing isn't included; measure that on a device with the Debug panel's stress test, which reports fps, simulation and drawing time without touching the campaign.

The tests load the logic modules (`core` → `party`) and the `data/` files into a Node `vm` sandbox with the UI stubbed out, so no browser is needed. The rendering and input code is checked by playing the game.

## Deploy

On every push to `main`, [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs the tests and lint, then publishes the repository root to GitHub Pages. Pull requests run the checks only. In the repository settings, under **Pages**, set the source to **GitHub Actions**. If the browser shows an old copy after a deploy, hard-refresh with Ctrl+Shift+R.

## Known limits

v1.0.0 is the complete MVP: Gates A–E passed (see `docs/RELEASE-NOTES.md`). v2 is under way on `main` (builds 1.1.0 onward; `docs/V2-PLAN.md`). Hairstyles wait for sprite art. The music is three short synthesized loops, a placeholder the GDD allows until final polish. Ally commands are simple, not a formation system. The sprites were made with AI by the project owner using Sprite Studio (their own tool); some animations are not yet hand-aligned. See [`docs/ASSETS.md`](docs/ASSETS.md) for where every asset comes from. Browser saves can be cleared by the browser.
