# Gate D — Full Regional Content: Progress & Validation

_Spec: GDD §3–§10 and §14 Gate D._

**Gate D pass criteria (GDD §14):** expand to 10 settlements, 15 troop types, 3 battle maps, 4 story quests, 3 repeatable contracts, a companion, reputation and ending flags. **Pass:** each ending is reachable, no quest soft-locks, and the sandbox continues.

| Roadmap step | Status |
|---|---|
| 4.1 All ten settlements with their services | ✅ All 10 enterable since 0.6.0 (recruit, trade, rest, contracts where listed); **fort garrisons** shown since 0.15.0 |
| 4.2 Stonebridge walkable town hub | ✅ 0.16.0 |
| 4.3 Three battle maps as distinct environments | ✅ 0.15.0 |
| 4.4 Complete the item catalogue (~30) | ✅ 0.17.0 |
| 4.5 AI cavalry; all 15 troop roles | ⬜ |
| 4.6 Faction reputation and fort ownership | ⬜ |
| 4.7 Quest and dialogue interpreter | ⬜ |
| 4.8–4.12 Q1–Q4 and the companion Mara | ⬜ |
| 4.13 Escort and delivery contracts | ⬜ |
| 4.14 Trade-world interactions and regional news | ⬜ |
| 4.15 Gate D acceptance | ⬜ |

---

## Slice 3 — 0.17.0: Item catalogue, tiered loot, armouries (2026-11-16)

### What's in (GDD §9: "Approximately 30 item definitions including weapons, helmets, armor, shields, boots, gloves, horses, goods and food"; "Loot uses small weighted tables tied to encounter tier"; income from "loot and sale of gear")
- **The catalogue:** 28 items plus the 6 trade goods, 34 in all. Every gear slot has a tiered ladder:

  | Slot | Ladder |
  |---|---|
  | Weapons | Worn Sword 17 → Hand Axe 19 → Arming Sword 21 → War Mace 22 → Knight's Sword 25 |
  | Shields (all can block) | Oak → Kite (+1 armour) → Iron-Rimmed Heater (+2) |
  | Helmets | Leather Cap 1 → Iron Helm 2 → Bascinet 3 |
  | Body | Clothing 1 → Padded Gambeson 2 → Leather Jerkin 3 → Mail Hauberk 5 |
  | Gloves | Work Gloves → Mail Mittens 1 |
  | Boots | Boots 1 → Iron Greaves 2 |
  | Horses | Nag +10% → Rouncey +20% → Courser +35% travel (all also add carrying capacity) |

  There's also the Ring of Roads, two foods (Three Days of Food, Smoked Meat = 6 rations), and the 3 protected quest items. Each item has a `tier` (1–3).
- **Changed stats:** the Iron Helm went from armour 1 to 2 and the Leather Jerkin from 2 to 3, to make room for the ladders.
- **Tiered loot:** `loot_tables` low, mid and high in `data/items.js`, each richer than the last (checked by average value). Encounters name their table: the Looter Camp uses low, the Reaver Hideout mid. **Bandit bands pick by size**: up to 6 → low, up to 10 → mid, larger → high.
- **Armouries** in every market:
  - **Stonebridge** and **Eastwatch** stock the full range. Only the river port sells the Knight's Sword, the Heater and the Courser.
  - Villages stock 3–4 basics; forts have none.
  - Price: `round(value × 1.3 × (1 − 0.01 × Trade))`, always above the resale value, so buying and reselling can't make money. Checked for every stocked item at Trade 0 and 10.
  - Each listing shows what you're wearing in that slot. Buying is all-or-nothing, and bought food goes straight into the ration stock.
- **Content validation:** every loot-table item must exist and not be a quest item; armouries can only stock real, sellable items; bands need loot-size tiers.

### Balance check (`npm run simulate`, 30 days × 8 seeds)
The campaign bot now also buys better gear when it has money to spare after a safety reserve. Results: 4–8 pieces bought and 4–6 hero armour by day 30, ending gold 30–133 (gear is now a real money sink), levels 4–7, 5–14 contracts, still about 10–16 lost fights, and **0 stalls, 0 desertions**. Better gear helps without making the game trivial.

### Bug found by the acceptance test
The reload check in `tests/acceptance.test.js` found **empty "zombie" parties**. A winner of an off-screen fight that lost its last troops to attrition stayed on the map with 0 troops, and was dropped on reload, so the reload didn't match. The gear changes shifted the random sequence enough to expose it. Now a winner with nobody left is removed too, and there's a regression test.

### Verification
- **Automated:** `npm test` → 184/184. The new `tests/items.test.js` (7 tests) covers:
  - catalogue size and slot coverage, and the tier ladders (value and power never go down)
  - loot tables getting richer per tier with no quest items, and band size choosing the tier
  - which places have armouries and what they stock
  - buy prices above resale with all-or-nothing buying, and bought food becoming rations
  - full heavy armour (13) cutting a Looter's hit from 7 to 5
- **Browser:** Stonebridge merchant, then See my wares. The Armoury listed 18 items with what's worn in each slot. A **real click** bought a Padded Gambeson for 33, with the hint "equip it from Character & gear". Equipping it raised armour to 2, and Back returned to the streets. No errors were logged.

## Slice 2 — 0.16.0: Walkable Stonebridge (2026-11-16)

### What's in (GDD §8: "One small top-down town scene containing market stall, tavern, recruiter and exit. NPCs stand in place or pace on short loops; interaction opens dialogue menus.")
- **`data/town_hubs.js`:** Stonebridge's streets and plaza with a well:
  - **The Grey Ford Inn**, the **Market** stall, the **Muster Hall**, the **Elder's House**, a cottage and trees.
  - The buildings use the battle-map obstacle format, so collision and drawing are shared with battles.
  - Each person has an action, a few lines, and a short title shown under their feet.
- **People:**

  | Person | Behaviour | Talking opens |
  |---|---|---|
  | **Hilde the Innkeeper** | stands still | buy food, rest a day, the notice board (contracts, "collect pay!" when due), Save & export |
  | **Ottmar the Merchant** | paces by his stall | the market |
  | **Sergeant Brun** | paces | hire the local troops, review troops |
  | **Elder Maren** | stands still | her lines from `data/dialogue.js`; the hook for Q1 later |
  | **Gate Guard** | stands still | leave town |

  Each conversation shows the next of that person's lines.
- **Controls:**
  - WASD or the joystick, the same as in battle. **TALK** (the Attack button, relabelled), or **Space / E / Enter**, talks to whoever is in reach. A prompt shows over them: "Hilde the Innkeeper — TALK: Inn".
  - **Tap** a spot to walk there, or **tap a person** to walk up and talk; the walk follows them if they're pacing. Any manual movement cancels it.
  - Walk out through the west gate, or talk to the guard, to return to the map.
  - Block and Orders are hidden in town; Party and **Town menu** are shown. Town menu opens the classic list, which offers **"Walk the streets"** to come back.
- **Flow:** arriving at Stonebridge, Continue from the title, starting a new game, importing a save and Debug teleport all go "to the place": Stonebridge's streets, or the menu elsewhere. The market, notice board, Save & export and the Party screen all return to wherever you came from. Time doesn't pass in town.
- **Content validation:** hubs must belong to an explorable settlement, people need known actions, sprites and something to say, and spawn, people and pacing ends must be clear of buildings.

### Verification
- **Automated:** `npm test` → 176/176. The new `tests/town.test.js` (9 tests) covers:
  - Stonebridge being walkable while Eastwatch stays a menu, and buildings blocking movement
  - the pacing loop, the talk range and lines rotating
  - tap-to-talk with a pacing person, and tap-to-walk cancelled by manual input
  - the gate exit and the guard, sub-menus returning to the streets, and content clear of buildings
  - The campaign bot also handles town mode, and the 30-day simulation still shows no stalls.
- **Browser:**
  - A new game starts in the streets, with the TALK button.
  - Walked with held keys; the prompt appears in reach.
  - **Real tap** on the Innkeeper: walked over and opened her options. The **real click** on the notice board, then Back, returned to the streets.
  - **Real tap** on the pacing Recruiter. This first failed because the walk aimed at where he'd been; it now follows him. Hired a Levy (45 crowns, 1/8), then walked out through the gate to the map.
  - At 812×375: joystick and TALK showing, Block and Orders hidden.
  - **Fixed along the way:** name tags over people's heads covered building signs, so they're now under their feet, with a boxed prompt for whoever's in reach.

### For the owner's playtest
- [ ] Is walking the town pleasant, or do you reach for the Town menu?
- [ ] Are tapping and the TALK button reliable on a phone?

## Slice 1 — 0.15.0: Three battle maps and fort garrisons (2026-11-16)

### What's in (GDD §8)
- **The three scenes** in `data/battle_maps.js` share one tile palette, collision system and spawn-anchor format:
  - **Grass Field:** the familiar arena, now with three rocks for light cover.
  - **Forest Clearing:** nine trees and four bushes that make lanes and cover, on darker ground with flowers.
  - **Greywall Courtyard:** a walled yard with a gate gap, flagstones and two crates. The enemy holds the yard and you come in from the dirt approach.
- **Which map you fight on:**
  - In woodland, the Forest Clearing.
  - Within 6 leagues of Greywall or Ashgate, the Courtyard.
  - Otherwise, the Grass Field.
  - This applies to bands, contract targets and ambushes. The Reaver Hideout ("dug in among the stones") now uses the Forest Clearing; the Looter Camp stays on the Grass Field.
- **Collision (`js/units.js`):**
  - Units have a 12 px footprint. Circles (trees, rocks, bushes) and rectangles (walls, crates) push units out, so the hero slides along edges.
  - Push-out repeats for corners where walls meet.
  - Padded rectangles use rounded corners, matching collision. A test caught the old square-padding version flagging "phantom" overlaps.
- **AI steering:** soldiers feel 34 px ahead and turn by increasing angles toward the free side, keeping that side so they don't dither. The player steers the hero.
- **Cover:** trees, walls and crates **stop arrows** (GDD §6 "collision against terrain"), with a small hit puff. Rocks, bushes and fences are low cover and don't.
- **Spawns:** the hero stands at the map's anchor and allies form up around it, pushed clear of obstacles. Enemies are placed in the map's spawn box, never inside an obstacle.
- **Depth:** units and obstacles are drawn in one depth order, so soldiers pass behind trees and walls.
- **Fort garrisons:** Greywall (10 Footmen, 4 Guards, 6 Hunters, 2 Longbowmen) and Ashgate (Aurelian equivalents) show their garrison in the fort menu. Sieges come later; this is the GDD's "fort garrison info".
- **Content validation:** every map needs ground and spawns, and valid obstacle shapes; forts need valid garrisons. A content test checks every map sprite exists.

### Verification
- **Automated:** `npm test` → 167/167. The new `tests/battlemaps.test.js` (11 tests) covers:
  - map choice by terrain and near forts
  - push-out from circles and rectangles, including a centre inside a wall
  - the hero sliding past a tree, and an AI soldier steering around a tree to a goal behind it
  - which obstacles stop arrows, and a flying arrow stopped by a tree
  - on each map, nobody spawning inside an obstacle (10 seeded spawns each)
  - **no trapped units:** 6 full seeded battles per map (hero, 4 Footmen, 7 + 4 enemies) all resolve, with no living unit inside an obstacle at any check
  - fort garrisons
- **Browser:**
  - Screenshots of all three maps mid-battle: forest depth with enemies behind trees; the courtyard walls, gate, flagstones and crates; the grass field with rocks.
  - A band met at forest terrain (20, 30) was fought on the Forest Clearing.
  - Travelling to Greywall showed "Garrison: 22 (10 Footmen, 4 Guards, 6 Hunters, 2 Longbowmen)", after fixing the plurals.
  - No errors were logged.

### For the owner's playtest
- [ ] Do the trees and walls make fights more interesting, or just more fiddly on a phone?
- [ ] Does sliding along walls feel natural with the joystick?
