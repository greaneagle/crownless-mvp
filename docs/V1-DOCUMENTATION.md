# Crownless v1.0 — Full Documentation

_Build 1.0.0 "The Border March" (MVP), released 2026-11-17. This is the reference for what v1 is and how it works, for players, testers and developers. Every number below comes from the code or the `data/` files at 1.0.0. If a number changes, the code wins; update this page with it._

**Contents**
1. [What Crownless is](#1-what-crownless-is)
2. [Player guide and rules](#2-player-guide-and-rules)
3. [Technical guide](#3-technical-guide)
4. [Working on the project](#4-working-on-the-project)
5. [What comes in v2, and where the details are](#5-what-comes-in-v2-and-where-the-details-are)
6. [Document index](#6-document-index)

---

## 1. What Crownless is

Crownless is a single-player, top-down 2D warband RPG for the browser. You are a nobody on a disputed frontier, the Border March. You hire soldiers, fight in real-time battles in person, trade, take contracts, and decide who holds Greywall Fort.

- **Platforms:** phones in landscape (touch) and desktops (keyboard and mouse). Full screen on Android Chrome; Add to Home Screen on any phone.
- **Tech:** plain HTML5 Canvas and classic JavaScript. No bundler, no runtime dependencies, no server, no network use and no accounts. Hosted on GitHub Pages from `main`, which is a **test build**, not a public release.
- **Scope of v1:** everything in the MVP design (`Crownless_MVP_GDD_v1.md`), checked through Gates A–E (`docs/GATE-*-VALIDATION.md`).
- **Language:** English only.

---

## 2. Player guide and rules

### 2.1 Starting out
You create a character with:
- a **name** (up to 20 characters)
- a **presentation** (man, woman or unspecified) and a **cloak colour** (crimson, forest, violet or ash)
- a **background**, which adds +1 to one attribute and +1 to one skill:

| Background | Attribute | Skill | Flavour |
|---|---|---|---|
| Farmhand | Strength | One-Handed | Strong and handy with a blade |
| Scout | Agility | Pathfinding | Knows every shortcut |
| Peddler | Charisma | Trade | Can talk a price down |

Everyone starts poor:
- 60 crowns
- a worn sword, clothing and an oak shield
- three days of food
- no soldiers, standing in Stonebridge

### 2.2 The hero
**Attributes:** Strength, Agility, Intelligence and Charisma. All start at 5 and go up to 20.

**Skills:** eight skills, each from 0 to 10.

| Skill | Effect in v1 |
|---|---|
| One-Handed | +3% melee damage per point |
| Pathfinding | +3% map travel speed per point |
| Trade | Buy 1% cheaper and sell 1% dearer per point |
| Leadership | +2 party slots per point |
| Tactics | +3% auto-resolve power per point |
| Shield, Archery, Riding | Listed but not yet used (later updates) |

**Derived numbers:**
- **HP** = 60 + 5 × Strength.
- **Damage** = weapon damage (6 unarmed) × (1 + 0.03 × One-Handed).
- **Armour** = the sum of the armour on your equipped items.
- **Blocking** needs a shield in the off hand.

**Levelling:**
- XP to the next level = round(100 × level^1.35), up to level 10.
- Intelligence adds +2% XP for every point above 5.
- Each level gives 1 skill point; every second level also gives 1 attribute point.
- Battle XP for the hero:
  - a win gives 25 plus 8 per kill
  - a loss gives 5 plus 4 per kill
- Contracts and quests also give XP.

**Equipment:**
- Eight slots: weapon, off hand, head, body, hands, feet, horse and ring.
- 32 items in `data/items.js`: 5 weapons, 3 shields, 3 helmets, 4 body pieces, 2 gloves, 2 boots, 3 horses, 1 ring, plus food and quest items.
- You get gear from loot (better bands drop better gear) and town armouries. Each settlement's `gear` list says what it sells.

### 2.3 The Border March
**Ten settlements:**

| Settlement | Type | Holder | Services |
|---|---|---|---|
| Stonebridge | Town (walkable) | Valedorn | Recruit, trade, rest, contracts |
| Eastwatch | Town | Aurelian | Recruit, trade, rest, contracts |
| Greywall Fort | Fort | Valedorn (can change) | Recruit, rest |
| Ashgate Fort | Fort | Aurelian (can change) | Recruit, rest |
| Oakford, Highmere | Villages | Valedorn | Trade, rest |
| Brackenfield | Village | Valedorn | Trade, recruit |
| Dunmarsh, Redfield | Villages | Aurelian | Trade, rest |
| Saltmere | Village | Aurelian | Trade, recruit |

**Travel:**
- Tap or click a place or a party to travel there.
- Speed = 4 map units per hour × terrain × cargo load × your skill bonuses. Terrain: road 1.2, grass 1.0, forest 0.75.
- Time runs at 4 game hours per real second while you travel.
- **Wait** (Space) lets time pass.

**Arriving in a walkable town** (Stonebridge) opens its menu first. **Walk the streets** is optional; in town you talk to:
- the innkeeper: food, rest, contracts and saving
- the merchant: the market
- the sergeant: hiring
- the elder

Time doesn't pass in town.

**Factions:**
- **Valedorn Crown**: knightly border lords in the west. Recruits Levies and Hunters.
- **Aurelian Remnant**: heirs of imperial law in the east. Recruits Recruits and Skirmishers.
- **Road Reavers**: bandits. Not a diplomatic faction.
- The two towns also hire out **Mercenaries**.

### 2.4 Your company
**Party size:**
- cap = min(20, 8 + 2 × Leadership + ⌊renown ÷ 40⌋ + 2 if Friendly with either kingdom)
- Wounded soldiers count toward the cap. So does Mara.

**Troops** (from `data/troops.js`):

| Troop | Faction | Role | Tier | HP | Dmg | Armour | Wage/wk | Hire | Upgrades to (cost) |
|---|---|---|---|---|---|---|---|---|---|
| Levy | Valedorn | Infantry | T1 | 45 | 7 | 1 | 3 | 15 | Footman (25) or Hunter (25) |
| Footman | Valedorn | Infantry | T2 | 60 | 10 | 3 | 6 | 25 | Guard (60) or Rider (90) |
| Guard | Valedorn | Infantry | T3 | 80 | 14 | 6 | 12 | 60 | — |
| Hunter | Valedorn | Archer | T2 | 60 | 10 | 2 | 6 | 25 | Longbowman (60) |
| Longbowman | Valedorn | Archer | T3 | 80 | 14 | 5 | 12 | 60 | — |
| Rider | Valedorn | Cavalry | T3 | 90 | 14 | 6 | 12 | 60 | — |
| Recruit | Aurelian | Infantry | T1 | 45 | 7 | 1 | 3 | 15 | Spearman (25) or Skirmisher (25) |
| Spearman | Aurelian | Infantry | T2 | 60 | 11 | 3 | 6 | 25 | Legionary (60) or Horse Scout (90) |
| Legionary | Aurelian | Infantry | T3 | 80 | 14 | 6 | 12 | 60 | — |
| Skirmisher | Aurelian | Archer | T2 | 60 | 10 | 2 | 6 | 25 | Marksman (60) |
| Marksman | Aurelian | Archer | T3 | 80 | 14 | 5 | 12 | 60 | — |
| Horse Scout | Aurelian | Cavalry | T3 | 90 | 14 | 6 | 12 | 60 | — |
| Mercenary | Neutral | Infantry | T2 | 60 | 10 | 3 | 6 | 25 | — (no path in v1; see F-1). From 1.5.0: Sellsword (60) |
| Sellsword (from 1.5.0) | Neutral | Infantry | T3 | 80 | 15 | 5 | 14 | trained only | — |
| Looter, Reaver | Neutral | Infantry | T1, T2 | 45, 60 | 7, 10 | 1, 3 | — | enemies only | — |

**Soldier XP:**
- A win gives 20 plus 5 per kill; a loss gives 8.
- An upgrade needs 40 XP (T1) or 100 XP (T2), plus the gold cost. The soldier must not be wounded.
- Archers shoot up to 225 px with 60% accuracy.

**Casualties:**
- 35% of fallen soldiers die. The rest are wounded for 2 days.
- Travel or rest to pass the time.

**Upkeep:**
- **Food:** one ration feeds 5 people for a day (base price 8 crowns).
- **Wages:** every soldier's wage is due every 7 days. Wounded soldiers still get paid.
- **Morale:**
  - starts at 70; fed troops recover 5 a day back toward 70
  - starving: −15 a day
  - unpaid wages: −20
  - a victory: +5; a defeat: −10
- **Desertion:** below 25 morale, there is a daily chance of a desertion that grows to 60% at morale 0.

### 2.5 Battles
- **Your hero:**
  - real-time movement in four directions
  - swings with a windup (0.16 s), a strike window (0.12 s) and a recovery (0.24 s), hitting everything in a 90° arc in front of you
  - a press up to 100 ms early is buffered
  - a frontal shield block covering 120°; it can't cancel a swing already started
- **Enemy windups** are drawn in red so you know when to block.
- **Damage after armour** = max(1, round(raw × 100 ÷ (100 + 4 × armour))).
- **Orders:**
  - pick a group with **1** infantry, **2** archers or **3** cavalry
  - then give **F** Follow, **H** Hold or **C** Charge
- **Cavalry** hits 1.2× harder at full gallop, rides through enemies and wheels round.
- **Battle size:**
  - a setting of 20, 30 or 40 units at once
  - reserves step in 3 at a time as others fall
  - your company deploys at most 12 infantry, 8 archers and 6 cavalry at the start (the rest wait in reserve)
- **Spacing:** soldiers stand shoulder to shoulder (12 px footprints that push apart). Charging riders pass through.
- **Maps:** an open field, a forest clearing (trees block movement and arrows) and the Greywall courtyard (walls). The map depends on where the fight happens. From 1.8.0 (V2-05) battles in the open and in forests use large generated fields three screens across (Open Country, Forest Wilds) with a following camera; the courtyard stays one screen; Settings → Battlefield: Small brings back the one-screen maps.
- **Time:** a battle and its aftermath take 6 game hours (0.25 days). From 1.6.0 (V2-04): a fixed 4 game hours, fought or auto-resolved, however long the fight lasts.
- **Defeat:**
  - you are captured, not killed: you keep 80% of your crowns and lose one item
  - you are released near a settlement half a day later

### 2.6 Encounters and the living map
Patrols of both kingdoms, caravans and Road Reaver bands move on the map:
- Patrols hunt bandits.
- Caravans move prices where they arrive.
- Reavers rob caravans and chase you if you look at most half as strong as them.

Off-screen fights happen between parties.

When a hostile party catches you, or you attack a camp, you choose:

| Choice | What happens |
|---|---|
| **Attack** | Fight the battle yourself |
| **Auto-resolve** | Power = Σ(count × tier power × health) × (1 + 0.03 × Tactics), with tier power T1 1, T2 1.7, T3 2.5. Your win chance = your power ÷ total, held between 10% and 90%; the odds are shown. The winner always takes some losses |
| **Negotiate** | Pay the Reavers' toll (base + per troop), or **intimidate** them if you are at least 2.5× stronger. Either way they leave you alone for a day |
| **Retreat** | Chance = 0.5 + 0.1 × (your speed − their speed), held between 15% and 85% |

### 2.7 Trade
- **Six goods** (base price, weight):

  | Good | Base price | Weight |
  |---|---|---|
  | Grain | 10 | 1 |
  | Salt | 18 | 1 |
  | Wool | 14 | 1 |
  | Iron | 28 | 2 |
  | Cloth | 32 | 1 |
  | Tools | 40 | 3 |

- **Prices:**
  - buy = round(base × scarcity × (1 − 0.01 × Trade))
  - sell = round(base × scarcity × 0.75 × (1 + 0.01 × Trade))
  - scarcity runs from 0.8 to 1.4
- **Price movement:**
  - Every unit you buy pushes the local price up, and every unit you sell pushes it down.
  - Markets drift back to their own baseline over time.
  - An arriving caravan moves scarcity by 0.08 at its destination; a robbed caravan makes its goods dearer there.
- **Cargo:**
  - capacity = 20 + 10 per soldier + 30 with a horse
  - a full load slows travel to 70%
- **Selling gear:** spare gear from the pack can be sold too.

### 2.8 Contracts
Stonebridge and Eastwatch each post one offer of each kind:

| Contract | What you do | Time | Pay |
|---|---|---|---|
| Bandit Hunt | Break a marked band of 3–14 Reavers (70–120% of your strength), then return to the giver | 4 days | 40 + 6 per troop crowns, 5 renown, 40 + 5 per troop XP |
| Caravan Escort | Stay within 6 map units of a wagon (it only rolls while you're close) and beat the ambush on the way | 4 days | 30 + 3 per league crowns, 4 renown; paid on arrival |
| Delivery | Carry 3–5 goods (refundable deposit at their value) or a sealed letter (40% of offers) | 5 days | 20 + 2 per league crowns, 2 renown; paid on arrival |

A failed contract costs 2 renown. Finished contracts raise your reputation with the town's kingdom.

### 2.9 Reputation and territory
- **Reputation:**
  - one hidden score per kingdom, from −100 to 100
  - shown as **Hostile** (below −25), **Neutral** or **Friendly** (above +24)
- **What moves it:**
  - helping a kingdom: +10
  - attacking its patrols or caravans: −15
  - major story decisions: ±25
- **Effects:**
  - Friendly with either kingdom gives +2 party slots.
  - Hostile kingdoms refuse recruits and contracts, and their patrols hunt you.
- **Territory:** Greywall Fort and Ashgate Fort can change hands, through the story or the frontier.

### 2.10 News
- **Bulletins:** every 2 days a line of regional news arrives, shown on the map and kept in the Journal. It covers caravan losses and arrivals, patrol victories and defeats, frontier clashes (at most every 4 days), forts changing hands and your own deeds.
- **Market talk:** the Trade screen shows what last moved that town's prices.
- **Never changes play:** news is chosen without the world's random numbers, so it never changes the simulation.

### 2.11 The story
Four quests, all data in `data/quests.js` and `data/dialogue.js`:
1. **A Stranger's Wage** (Elder Maren, Stonebridge): fetch the grain wagon from Oakford, break the Reavers, or raise three recruits with Sergeant Brun. This is the playable tutorial.
2. **The Broken Seal** (Caravan Master Oswin, Eastwatch): recover a sealed packet by fighting, intimidating or paying Wenna the Fence. Then choose who sees the rival charters.
3. **Two Banners:** break the other side's column, sell plans, or refuse both and save a caravan. Mara rides ahead; reach the clash within 3 days or lose her for good.
4. **The Greywall Verdict:** declare for the Crown, the Remnant or the road, win in Greywall's courtyard, and set the terms. There are three endings:
   - Valedorn holds Greywall
   - the Aurelians take it
   - the **Road Peace** (refuse both and keep Oswin's packet)

The sandbox carries on after the story ends.

**Mara**, a former imperial scout, waits in Stonebridge after Q2:
- **Joining:** she joins free if you are honest with her, or for 100 crowns.
- **In the company:** she takes a party slot, fights on her own, wears the weapon and body armour you give her, and adds +1 Pathfinding while fit.
- **Wounds:** she is never killed in an ordinary battle; going down wounds her for 2 days.

### 2.12 Controls

| Action | Desktop | Touch |
|---|---|---|
| Travel | Click a place or party; Space waits or stops | Tap a place or party; Wait button |
| Walk (town) / move (battle) | WASD or arrows | Left joystick |
| Talk (town) | Space, E or Enter | TALK |
| Attack | Space or left click | ATTACK |
| Block | Shift or right click (hold) | Hold BLOCK |
| Orders | 1/2/3 to pick a group, then F/H/C | ORDERS |
| Look around (large battlefields, from 1.9.0) | Click the small map | Tap the small map |
| Tactical overview (from 1.9.0) | Hold Tab, or M to toggle | MAP |
| Pause | Esc | Pause |
| Diagnostics | F3 | Logs (dev mode) |

### 2.13 Comfort, settings and saving
- **Settings** (⚙ on the map, in town and in battle, and on the title screen):
  - music and effects volume
  - battle size (20/30/40)
  - battlefield: large or small (from 1.8.0)
  - health bars
  - reduced effects
  - tips on/off and show again
  - full screen (on by default on phones)

  Settings belong to the device, not the save.
- **Tips:** short cards the first time each screen comes up, once per device. **How to Play** covers every system.
- **Sound:** all synthesized in the browser: sound effects and three music loops (menu, world, battle).
- **Saving:**
  - Autosave after battles, in settlements, and when the page is hidden or closed. The previous save is kept as a backup.
  - With two tabs open, the older tab stops saving.
  - **Save & export** writes a file or text that another browser or device can import.
  - The game reminds you to export a copy now and then. Browsers, notably iOS Safari after about 7 days unused, can clear site storage.

### 2.14 Known limits of v1
- Mercenaries have no upgrade path (finding F-1; from 1.5.0 they train into Sellswords, V2-03b).
- Soldiers have no names (from 1.4.0 they do: V2-03).
- A raised shield protects only its holder.
- Shield, Archery and Riding skills have no effect yet.
- No hairstyles (waiting for art).
- English only; no text size setting; pinch-zoom is off.

---

## 3. Technical guide

### 3.1 Architecture
- **Page and load order:** `index.html` loads every script as a classic deferred `<script>`, **data first, then logic**. Order matters, because each module uses the ones loaded before it; `js/main.js` loads last and starts the loop.
- **Namespace:** every module attaches to `window.Crownless`, called `CL` in code. Content files fill `window.CROWNLESS_CONTENT`.
- **State:**
  - `CL.campaign` is the persistent campaign, the thing that is saved.
  - `CL.game` is the live, transient state: the battle, the current journey, the town walk.
- **Pure logic, DOM at the edges:** the logic modules touch the page only through `CL.ui` hooks, so the tests can run them in Node. Only `ui`, `render`, `input`, `audio`, `fullscreen` and `main` assume a browser.
- **Determinism:**
  - The world simulation and auto-resolve use the campaign's seeded RNG (`rngSeed`), so a fixed seed replays the same campaign.
  - News and cosmetic choices never draw from it.
  - From 1.3.0 (V2-02) the campaign rolls that used to be unseeded have their own seeded streams: casualties, loot (and the capture loss) and desertion. Moment-to-moment rolls inside a fought battle stay unseeded.

### 3.2 Modules (`js/`, in load order)

| Module | Responsibility |
|---|---|
| `core` | Namespace, constants, math helpers, the diagnostics log (last 800 events) |
| `content` | ContentDB: typed lookups into `data/` and load-time reference validation (one source per ID) |
| `state` | `CL.game`, the live battle and game object |
| `storage` | From 1.2.0: the storage layer every save key goes through (localStorage today; swappable) |
| `clock` | From 1.6.0: the campaign clock: the one way time moves, with fixed hours for battle, capture and rest |
| `events` | From 1.3.0: domain events with unique IDs (BattleResolved, SoldierWounded, …) and listeners |
| `soldiers` | From 1.4.0: named soldiers: culture names, service records kept from events, notes, filters, rename |
| `troops` | From 1.5.0: the troop tree as discovered (seen or owned), learned from events and hiring offers |
| `save` | Save service: schema v2 at 1.0 (v3 from 1.2.0), backup on every write, fallback to the backup, migration from 0.3.x; from 1.2.0 also structure checks, migration steps and the travel autosave |
| `assets` | Sprite loading (`assets/u####.png` units, `w####.png` world) and frame tables |
| `camera` | From 1.7.0: the battle camera (follows the hero in arenas larger than a screen; one-screen maps stay at 0,0) |
| `arena` | From 1.7.0: generated battlefields (the camera test's forest; from 1.8.0 the large Forest Wilds and Open Country, built from `generate` specs in `data/battle_maps.js`), and the Battlefield setting's swap to one-screen maps |
| `tactics` | From 1.9.0: detection (only enemies your company has seen are shown), the minimap (tap to look) and the tactical overview (battle held; send a group to a spot) |
| `units` | Units built from troop data: facing, swing phases, movement, obstacle steering, spacing (from 1.7.0: per-map bounds, an obstacle grid on big maps) |
| `combat` | Battle simulation: waves and reserves, swings, blocks, arrows, AI, cavalry, win and loss |
| `party` | Recruiting, the day clock (`advanceDays`), recovery, resting, battle results applied exactly once, XP and upgrades, party cap |
| `upkeep` | Rations, weekly wages, morale, desertion |
| `trade` | Markets, prices, scarcity drift, cargo and its weight, selling gear |
| `autoresolve` | Seeded RNG and auto-resolve power, odds and casualties |
| `parties` | World parties (patrols, caravans, Reavers), their movement and off-screen fights, encounter choices |
| `contracts` | The contract lifecycle for hunt, escort and delivery |
| `realm` | Reputation and fort ownership |
| `story` | The quest and dialogue interpreter (see 3.5) |
| `companion` | Mara: joining, gear, wounds, skill bonus, being away |
| `news` | World events into news bulletins and market talk |
| `encounter` | From 1.3.0: the one commit path for every encounter result (battle and capture, auto-resolve, retreat, toll), applied exactly once |
| `portable` | Save export and import: file format, checksum, strict validation, restore |
| `world` | The strategic map: travel, terrain, time passing, settlements and sites, capture release |
| `town` | Walkable Stonebridge (menu first, streets optional) |
| `character` | Hero creation, attributes, skills, levelling, equipment, derived stats |
| `ui` | DOM overlays, menus, roster, Journal, the diagnostics panel |
| `render` | Canvas drawing for battle, map and town, and the HUD |
| `input` | Keyboard, mouse, on-screen buttons, joystick |
| `debug` | The Debug panel's testing shortcuts (all logged) |
| `settings` | Device settings, kept outside the save |
| `audio` | Web Audio synthesizer: sound effects and music, rate-limited |
| `tips` | First-time tips |
| `fullscreen` | Full screen on tap, landscape lock, home-screen detection |
| `main` | Boot and the main loop |

### 3.3 Content (`data/`)
Everything that is content lives in data files and is checked by `CL.content` at load, so a broken reference fails at boot, not mid-game.

| File | Holds |
|---|---|
| `factions.js` | The two kingdoms and the Reavers: recruits, garrisons, colours |
| `settlements.js` | The ten settlements: type, owner, services, map position, market baseline, armoury |
| `troops.js` | Every troop's stats, wages, costs and upgrade paths (and the hero's body) |
| `items.js` | Equipment, food and quest items |
| `markets.js` | The six trade goods and food rations: base price, weight |
| `quests.js`, `dialogue.js` | The story: quests with stages and dialogue trees |
| `battle_maps.js` | Grass field, forest clearing, Greywall courtyard: obstacles and spawn zones. From 1.8.0 also Forest Wilds and Open Country, generated from a `generate` spec, each naming its one-screen `small` map |
| `encounters.js` | Scripted encounters (the looter band, the captain's trial) |
| `world_map.js` | The Border March: terrain, roads, base speed, terrain factors |
| `character.js` | Skills, backgrounds, the starting kit |
| `world_parties.js` | Party templates: bandits, patrols and caravans of both kingdoms |
| `contracts.js` | The three contract templates and their reward formulas |
| `town_hubs.js` | The Stonebridge street layout and townsfolk |
| `companions.js` | Mara |
| `help.js` | How to Play topics and first-time tips |
| `news.js` | News line templates |
| `names.js` | From 1.4.0: name cultures for soldiers (given names, trades, epithets, forms); factions point at one |

### 3.4 Saves
- **Where:** localStorage key `crownless_save`, with `crownless_save_backup` and `crownless_save_pre_import`.
- **Separate from the save:** device settings, tips seen, export reminders and dev mode each have their own key.
- **Schema v2 is frozen at v1.0.** Every field, the export file format and its checksum are documented in **[`docs/SAVE-FORMAT.md`](SAVE-FORMAT.md)**.
- **Loading checks:** every load runs through `CL.save.sanitize`, so bad or missing fields fall back to safe defaults.
- **Imports are strict:** an unknown ID, a newer version or a checksum mismatch rejects the file without touching the current game.
- **Fixtures:** five real v1.0 saves in `tests/fixtures/saves-v1.0/` (a new game, day 30, a mid-story escort, the Road Peace with Mara, the Crown ending). `tests/save-fixtures.test.js` keeps them loading in every later build.
  - They are built by `scripts/make-save-fixtures.js`.
  - Don't regenerate them casually; they stand for real players' saves.
- **Since v1 (1.5.0, V2-03b):** schema v6 adds what the company knows of each troop (the troop tree).
- **Since v1 (1.4.0, V2-03):** schema v5: every soldier is a named person with an origin, a joining day, a service record and notes; older saves' soldiers are named on load.
- **Since v1 (1.3.0, V2-02):** schema v4 adds the named random streams and the result and event counters; every encounter result commits once through `CL.encounter.resolve`.
- **Since v1 (1.2.0, V2-01):** saves are schema v3 (v2 plus `worldId` and `contentVersion`). Loading first checks that a save is complete for its schema version (a partial save is rejected rather than filled with defaults), then migrates it step by step, keeping a v2 save as it was in `crownless_save_v2`. The backup only ever holds a complete save, a write counts only once it reads back, imports and restores report success only once stored, and the game also autosaves once per game day on the map. Saves from the 0.3, 0.14 and 0.28 builds are fixtures too. Details: `docs/SAVE-FORMAT.md`.

### 3.5 The story interpreter
Quests are data. `js/story.js` interprets three small vocabularies; its header comment is the full reference.

- **Conditions (`if`):**
  - flags: `{ flag }` with `is`, `gte` or `lte`, plus `not`, `all` and `any`
  - quest status and stage
  - gold, renown, level, soldiers
  - reputation and standing
  - skill, attribute and background
  - items held, fort owner, current location
  - companion with you or fit, free party room
- **Effects (`do`):**
  - flags: set, clear, add
  - gold, renown, XP, food, reputation
  - give and take items, recruit
  - quest start, stage, complete, fail
  - fort owner, messages and journal notes
  - companion join, part, send and recall
  - ending

  Any effect can carry its own `if`.
- **Events (`on`):** game code calls `emit(name, payload)`, and stages react to `battle`, `enter`, `recruit`, `trade`, `contract`, `talk` and `parley`.
- **Stages** can have `begin` effects, a `deadline` with `expire` effects, and a `band`:
  - The band is a party spawned on the map for that stage.
  - It is re-spawned if lost while the stage is active, so nothing soft-locks.
  - It is removed when no longer needed.

### 3.6 Time
- `CL.party.advanceDays(days)` is the one way campaign time passes. It drives upkeep, recovery, market drift, the world parties' ticks, contract deadlines, story deadlines and news.
- Travel advances time continuously at 4 game hours per real second.
- A battle adds a flat 0.25 days. From 1.6.0 (V2-04) all fixed amounts come from `js/clock.js`, the one clock authority, with the hours in `data/world_map.js` (`time`: battle 4, capture 12, rest 24). Nothing else passes time: not the battle's own seconds, pausing, menus, towns or a retreat.

### 3.7 Developer mode
- **Showing the tools:**
  - The **Logs** and **Debug** buttons show on a local dev server.
  - On the published site, add `?dev` to the address to show them on that device, and `?dev=0` to hide them again.
  - F3 opens diagnostics either way.
- **Camera test (from 1.7.0, PROTO-A):** Camera test 30 / 40 in the Debug panel: everyone on the field at once in a 2880×1620 forest, the camera following the hero, red markers at the screen edge for enemies out of view. The result screen adds the arena, time to first contact, first fall and battle length.
- **Debug panel:** XP, crowns, renown, items, troops, food and morale, time, teleport, world parties, contracts, prices, god mode, win or lose a battle, wipe the save, and a **stress test** that reports fps, simulation and drawing time. Every action is logged as `Debug: …`.
- **Diagnostics:** export as JSON or TXT.

---

## 4. Working on the project

### 4.1 Commands (Node 22+, dev only; the game needs nothing)

| Command | What it does |
|---|---|
| `npm run serve` | Serves the game at http://localhost:8123 (opening `index.html` from disk also works) |
| `npm test` | 332 tests at 1.0.0 with `node:test`: logic modules and data in a Node `vm` sandbox with the UI stubbed out (`tests/helpers/load.js`) |
| `npm run lint` | Biome; from 1.1.0 it also runs `npm run typecheck` |
| `npm run typecheck` | From 1.1.0 (V2-00): TypeScript's `tsc --noEmit` over the modules marked `// @ts-check`, using the shared types in `types/crownless.d.ts`. Dev only; no build step and no output |
| `npm run simulate` | Headless campaign bot: 30 days, 8 seeds |
| `npm run simulate:story` | Randomized story bot from a fresh start to an ending, 200 seeds; reports endings and soft-locks (the tests run 60) |
| `npm run bench` | Battle simulation time per frame at 20/30/40/60 units on each map (drawing is measured on a device with the stress test) |
| `npm run assets` | Rebuilds `assets/manifest.json`; a test fails if it is stale |
| `npm run icons` | Regenerates the home-screen icons |

### 4.2 What the tests cover
- **Gameplay systems:** combat, cavalry and spacing; party and progression; upkeep, trade and contracts (escort and delivery); world and parties; realm, news and town; Mara.
- **The story:** each quest (Q1–Q4) and the interpreter.
- **Saves:** save, portable, save safety and the v1.0 fixtures.
- **Gate acceptance:** `gate-d` (60 randomized whole-story runs, every ending reached, no soft-locks) and `gate-e` (definition of done, money and battle-result exploit probes).
- **Consistency:** `content` (every reference resolves), `assets` (the manifest matches) and `version` (package, page title, HUD and footer agree).

### 4.3 Workflow
- **Branching:** everything is on `main`. Each task ends green (tests and lint) and playable. Pushing deploys the test build through `.github/workflows/deploy.yml`, which runs the tests and lint first.
- **Version bumps:** one build number everywhere: `package.json`, `CL.BUILD`, the page title, the HUD and the footer. `tests/version.test.js` guards it.
- **Release notes:** progress goes into `docs/ROADMAP.md` and, at releases, `docs/RELEASE-NOTES.md`.

### 4.4 Adding content (recipes)
- **A troop:** add it to `data/troops.js`. Set `upgradeTo`/`altUpgradeTo` on the troop below it and list it in a faction's `recruits` or a garrison. The tier sets its auto-resolve power.
- **An item:** add it to `data/items.js` with a `slot` and `stats`, then list it in a settlement's `gear` or let it drop as loot.
- **A settlement:** add it to `data/settlements.js` with `mapX`/`mapY`, services, a market baseline and gear.
- **A quest:** add stages to `data/quests.js` and conversations to `data/dialogue.js`, using the vocabulary in 3.5. Add a test like `tests/q1.test.js`, and run `npm run simulate:story` to prove nothing soft-locks.
- **A tip or help topic:** add it to `data/help.js`.
- **A name culture (from 1.4.0):** add it to `data/names.js` (given names, optional trades and epithets, weighted forms using `{given}`, `{trade}`, `{epithet}` and `{origin}`), then point a faction, settlement or troop at it with `culture`. `npm test` checks it.
- **A sprite:** add the PNG to `assets/`, then run `npm run assets` and record its source in `docs/ASSETS.md`.

`npm test` catches broken references (`tests/content.test.js`). A change to anything saved needs a save-format thought; see `docs/SAVE-FORMAT.md`.

---

## 5. What comes in v2, and where the details are

**v2.0 "The Living Warband"** is the next release. It is a **testing release**; the long-term goal is to sell the game. Its full plan, with every task, acceptance criteria, risks and the owner's decisions, is **[`docs/V2-PLAN.md`](V2-PLAN.md)**. The design behind it is in the two v2 design documents in the repository root.

**v2.0 at a glance (in order):**

| ID | What | Plan section |
|---|---|---|
| ART-01 | Art style guide and asset list for an artist | V2-PLAN §5 |
| V2-00 | Type checking with JSDoc and `tsc --noEmit`, no build step | §5 |
| V2-01 | Save schema v3 and a migration framework (the v1.0 fixtures must load) | §5 |
| V2-02 | One battle-result path and a small event dispatcher | §5 |
| V2-03 | **Named soldiers** with origins and service records (names from a moddable culture generator) | §5 |
| V2-03b | A troop tree discovered as you play; fixes the Mercenary upgrade gap (F-1) | §5, §4b |
| V2-04 | One canonical campaign clock (the flat 6-hour battle charge goes) | §5 |
| PROTO-A | Camera test run on the phone before the big refactor | §5 |
| V2-05 | World-space battle camera and larger arenas | §5 |
| V2-06 | Minimap and tactical overview | §5 |
| V2-07 | Battle preparation presets and Simulate | §5 |
| V2-08 | Group AI, cohesion, morale and rout | §5 |
| V2-09 | Nearby reinforcements joining battles | §5 |
| V2-10 | Company chronicle and roll of honour | §5 |
| V2-11 | Accounts (purse, company chest, budgets) and a hireable quartermaster | §5 |
| V2-12 | A merchant follower using the same market rules as you | §5 |
| V2-Q | A few small quests using the new systems (no new main story) | §5 |
| V2-T1, V2-T2 | Tuning passes: economy, then battles | §5 |
| V2-13 | v2.0 acceptance | §5 |
| R-01 – R-03 | Release track: commercial readiness, a packaging trial, a demo and storefront plan | §5 |

**Later phases:** these are outlined in V2-PLAN §6–8.
- **Phase 7, v2.1–2.2:**
  - more followers
  - officers and detached patrols
  - pursuit and detection
  - world events
  - a tournament
  - a first business
- **Phase 8, v2.3+:**
  - holdings and claims, fealty and allegiance
  - castellans
  - simple sieges
  - named nobles
- **Phase 9:**
  - kingdoms, treaties and rebellion
  - houses and marriage
  - modding

**Where each kind of detail lives:**
- **Task-by-task plan, acceptance and order:** `docs/V2-PLAN.md` §5. The per-task contract is under it.
- **Owner decisions and their effects:** `docs/V2-PLAN.md` §10.
- **Playtest findings F-1 to F-3:** `docs/V2-PLAN.md` §4b.
- **Risks:** `docs/V2-PLAN.md` §9.
- **Design rationale, scenarios (SC-xx) and prototypes:** `Crownless_v2_0_Feature_and_Systems_Design_Part_1.md` and `_Part_2.md`. V2-PLAN cites them by § number.
- **What the v3 save migration must handle:** `docs/SAVE-FORMAT.md`, last section.
- **Status of every phase and step:** `docs/ROADMAP.md`.
- **Backlog, not planned for v2:** text size and zoom, other languages, more accessibility (V2-PLAN §5, "Later backlog").

---

## 6. Document index

| Document | Read it for |
|---|---|
| [`README.md`](../README.md) | Quick overview, project layout, how to run and deploy |
| **`docs/V1-DOCUMENTATION.md`** (this page) | The full v1 reference |
| [`docs/RELEASE-NOTES.md`](RELEASE-NOTES.md) | What shipped in v1.0.0 and its known limits |
| [`docs/SAVE-FORMAT.md`](SAVE-FORMAT.md) | Save schema v2 (frozen), the export file, storage keys |
| [`docs/ROADMAP.md`](ROADMAP.md) | Status of every phase and step, past and planned |
| [`docs/V2-PLAN.md`](V2-PLAN.md) | The v2 plan: tasks, acceptance, risks, decisions |
| [`docs/BASELINE.md`](BASELINE.md) | Recorded behaviour used as a regression reference |
| [`docs/ASSETS.md`](ASSETS.md) | Where every sprite and sound comes from, and the rights |
| `docs/GATE-A-VALIDATION.md` … `GATE-E-VALIDATION.md` | The MVP acceptance gates and playtest checklists |
| [`Crownless_MVP_GDD_v1.md`](../Crownless_MVP_GDD_v1.md) | The original MVP design (v1's spec) |
| `Crownless_v2_0_Feature_and_Systems_Design_Part_1.md`, `_Part_2.md` | The v2 design documents |
