# Gate C — Campaign Loop: Progress & Validation

_Spec: GDD §3 (map, travel), §8 (encounters, settlements), §14 Gate C._

**Gate C pass criteria (GDD §14):** a player can complete a contract, buy food, recruit, fight, level and reload with all state intact.

Gate C is delivered in slices. This file records each one.

| Roadmap step | Status |
|---|---|
| 1. World map, click/tap travel, time advancing | ✅ 0.6.0 |
| 2. Settlement menu (Recruit / Trade / Rest / Contracts / Leave) | 🟡 Recruit, Rest and Leave (0.6.0), and Market (0.9.0) work. Contracts (step 9) is still to come. |
| 3. Character creation + inventory/equipment | ✅ 0.7.0. Hairstyles wait for art. |
| 4. Food & weekly wages, morale/desertion | ✅ 0.8.0 |
| 5. Trading (6 goods, scarcity) | ✅ 0.9.0, with caravans moving prices since 0.10.0 |
| 6. World parties + encounter options (Attack / Negotiate / Retreat / Auto-resolve) | ✅ 0.10.0. Patrols and caravans can be talked to but not attacked until reputation (Gate D). |
| 7. Capture on defeat | 🟡 0.6.0: released near a settlement after half a day. Loss of crowns and an item came in Gate B. |
| 8. Player XP/levels/skills; troop upgrades; party-cap formula | ⬜ |
| 9. Bandit-hunt contract | ⬜ |
| 10. Save export/import | ⬜ |
| 11. Gate C acceptance | ⬜ |

---

## Slice 5 — 0.10.0: A living map and encounter choices (2026-11-16)

### World parties (GDD §8)
- **Who's out there** (`data/world_parties.js`):
  - **2 patrols per kingdom** (Valedorn footmen, hunters and levies; Aurelian spearmen, skirmishers and recruits).
  - **1 caravan per kingdom** on a route through its towns and villages.
  - **Up to 3 Road Reaver bands** (3–6 Looters plus 0–3 Reavers) operating from the Looter Camp and Reaver Hideout.
  - Each kind respawns on a timer once destroyed.
- **What they do:**
  - **Patrols** move between their kingdom's settlements and hunt bands they spot.
  - **Caravans** travel their route. Each arrival lowers the price of the good they carry at that stop by 0.08 (GDD ±0.05–0.1).
  - **Bands** roam near their lair, flee from stronger patrols, rob caravans, and **hunt the player** when they're out on the map and at most twice the bands' strength. Then a "!" appears and a message: "Road Reavers have spotted you!"
  - A **robbed caravan** makes its good scarcer (+0.08) at the stop it was heading for.
- **Off-screen fights** (patrol vs band, band vs caravan) use **auto-resolve**: the loser is destroyed and the winner always takes losses.
- **Time:** parties move whenever campaign time passes: travelling, resting, battles, captivity, and the new **Wait** button on the map (Space toggles it when you're not travelling). A band catching you stops travel or waiting and opens the encounter.
- **On the map:**
  - Each kind has its own icon: shield for patrols, wagon for caravans, jagged red pennant for bands. Each carries a faction letter and a troop count.
  - A party standing on a town or lair sits beside it with a count badge, so names stay readable.
  - Click or tap a party to go and meet it; your travel follows it as it moves.
- **Seeded randomness:** the world and auto-resolve use `campaign.rngSeed` (mulberry32), which is saved, so a save reproduces its world.

### Encounter choices (GDD §7–8), for bands and the two lair sites
- **Attack:** a real battle against exactly that band, in waves of up to 8. A win destroys the band; a loss weakens it by the soldiers you killed.
- **Auto-resolve:**
  - Power = Σ troops × tier power (T1 1, T2 1.7, T3 2.5; the hero counts 2.5; wounded excluded) × (1 + 0.03 × Tactics).
  - Win chance = clamp(P/(P+E), 0.1, 0.9).
  - **A winner always loses at least one soldier** if it has any, so there are no guaranteed casualty-free wins. A beaten player is captured, as in a real battle.
  - The buttons show your odds, and the result shows strength vs strength.
- **Negotiate:**
  - Pay a toll of 20 + 4 per bandit, and they leave you alone for a day.
  - Or, if you're 2.5× stronger, **Intimidate** them away for free.
- **Retreat:** `clamp(0.5 + 0.1 × (your speed − their speed), 0.15, 0.85)`, using the current terrain, your load, Pathfinding and horse. Success means a 6-hour head start; failure forces the battle.
- **Patrols and caravans** have a short talk scene and Leave. Attacking them waits for faction reputation (Gate D).

### Tuning from simulation
A 30-day headless world simulation found two problems, both fixed:
- **Bands went extinct.** The sim ran in steps after the clock had already jumped to the end of the period, so every respawn timer used the end time. The sim now keeps its own step-by-step clock.
- **Patrols wiped out bands at their lairs.** Bands now flee stronger patrols, and patrols are heavier (speed 3.6 vs the bands' 3.8, sight 7 vs 9), so a band that spots them first can get away.

Result over 3 seeds × 30 days: 2–3 bands alive at any time, about one off-screen battle a day, 150–200 caravan deliveries, and **a lone hero on the road ambushed 1–6 times per 72 hours**. The sim runs 30 days in about 250 ms.

### Verification
- **Automated:** `npm test` → 120/120. The new `tests/parties.test.js` (18 tests) covers:
  - the world's makeup and seed reproducibility, the power formula, Tactics and clamps
  - winners always taking losses, caravan price effects both ways
  - when bands chase the player, and when they leave them alone (too strong, in town, cooldown)
  - an ambush interrupting travel
  - the toll and intimidation, the retreat formula and a failed retreat forcing a battle with exactly that band
  - waves of 8
  - auto-resolve wins (band destroyed, casualties, exactly once) and losses (captured, band survives weakened)
  - auto-resolve at lair sites, a real-battle win removing the band
  - save validation and older saves getting a populated world, and waiting
  - Test worlds use a fixed seed and are empty unless a test asks for parties.
- **Browser (desktop):**
  - A new world showed all 9 parties, with badges beside landmarks.
  - Waiting in real time passed 5 hours, then a band ambushed us. The encounter screen offered Attack, Auto-resolve (45%), Pay 32 crowns and Retreat (52%).
  - Auto-resolve with a **real click**: lost the roll and was captured, with the result drawn over the map.
  - A **real click** on a patrol started an intercept, and a Looter band ambushed us on the way.
  - **Retreat** with a real click failed (52%), which forced a battle against exactly 3 Looters and 2 Reavers. After the win the band was gone from the map.
  - No errors were logged.

## Slice 4 — 0.9.0: Trading (2026-11-16)

### Rules (GDD §9)
- **Goods:** six trade goods (grain, salt, wool, iron, cloth, tools), with base prices and weight from `data/markets.js`. The emoji icons are placeholders until the art pass.
- **Markets:**
  - The 8 settlements with the trade service (both towns and all six villages; forts have none) each get a baseline **scarcity** per good in `data/settlements.js`, between 0.8 (plentiful) and 1.4 (scarce).
  - The baselines follow each place's character: farm villages have cheap grain and wool, Highmere's hills cheap iron, Saltmere cheap salt, and the Eastwatch river port cheap cloth and tools.
- **Prices:**
  - Buy = `round(Base × Scarcity × (1 − 0.01 × Trade))`.
  - Sell = `round(Base × Scarcity × 0.75 × (1 + 0.01 × Trade))`.
  - **Deviation:** the GDD bases the sell price on the discounted buy price, which would make Trade *lower* sale prices. Here Trade helps both ways.
  - The market labels each price **cheap, fair or dear**.
- **No same-town exploit:**
  - Each unit bought raises that town's scarcity by 0.003, and each unit sold lowers it, clamped to 0.8–1.4.
  - A **rounding guard** keeps a unit's sell price at least 1 crown below what buying it one step earlier cost. So a buy-then-sell round trip in one town loses money, whatever the good, town, quantity or Trade level. This was proven by a brute-force test, which caught a break-even case before the guard existed.
- **Restock:** markets close 10% of the gap to their baseline each day. Caravan arrivals and bandit losses moving prices come with step 6.
- **Cargo:**
  - Carrying capacity is 20, plus 10 per soldier, plus 30 with a horse.
  - The GDD's **PartyLoadFactor** slows travel linearly, down to 70% speed at full load.
  - The map HUD shows cargo, and the market header shows the slowdown.
- **Selling gear:** pack items sell for half their value, adjusted by Trade. **Quest items can't be sold** (GDD §9), and equipped gear has to be removed first.
- **Atomic and save-safe:** each purchase or sale is checked in full (gold, carrying capacity, stock) before anything changes, then saved.
- **Saves:** `markets` and `cargo` are sanitized (values clamped, unknown towns and goods dropped). Older saves get the baseline markets.
- **Debug:** a **Trade** section with "+5 of each good" and "Reset prices".

### Tuning done during this slice
The first per-unit price impact (0.01) made trading pointless: the best routes earned 12–14 crowns, and anything over about 15 units lost money. A route simulator showed this, so the impact was lowered to 0.003. Now the best 30-unit run (salt from Saltmere to Oakford or Brackenfield) earns about 51 crowns, roughly one Looter Camp fight. Trading is worthwhile without beating combat.

### Verification
- **Automated:** `npm test` → 102/102. The new `tests/trade.test.js` (10 tests) covers:
  - the goods list and which places have markets
  - the price formula with Trade
  - **no round-trip exploit**: 8 towns × 6 goods × 3 quantities × 3 Trade levels
  - a profitable cross-town route
  - price movement, clamping and daily restock, and restock driven by the clock
  - all-or-nothing transactions
  - capacity and the load factor's effect on map speed
  - gear sales and quest-item protection
  - save validation
- **Browser:**
  - **Desktop:** at the Eastwatch market, buying 15 cloth moved its price from 27 to 32 (the old tuning). Cargo showed 15/20 and "travel 23% slower", and the worn sword sold for 6.
  - **At 812×375:** bought 20 salt in Saltmere for 298, which loaded the party to 20/20 (30% slower). The trip to Oakford took 17.1 h, and selling there earned 342, **+44 profit**.
  - The market cards stay readable, and the modal scrolls on a phone. No errors were logged.

## Slice 3 — 0.8.0: Food, wages, morale (2026-11-16)

### Rules (GDD §9, plus starting values where the GDD gives none)
- **Food:**
  - The party eats `ceil(party size / 5)` rations a day, counting the hero, wounded soldiers included. Food is eaten continuously as time passes: travelling, resting, battles (¼ day) and captivity (½ day).
  - Food items, from the starting kit or loot, go straight into the ration stock. "Three Days of Food" is 3 rations.
  - Settlements that trade sell **3 days'** or **a week's** worth for the current party. A ration costs `round(8 × (1 − 0.01 × Trade))` crowns, per the GDD price formula, with scarcity fixed at 1 until trading (step 5).
- **Wages:**
  - Paid every 7 days (first payday day 8): the sum of each soldier's weekly `wage` from `data/troops.js`, wounded soldiers included (GDD §7).
  - If you're short, you pay what you have and lose **20 morale**.
- **Morale:**
  - Runs 0–100 and starts at 70.
  - **Losses:** −15 per day starving, −20 for unpaid wages, −10 for a lost battle.
  - **Gains:** +5 per fed day back up to 70, and +5 for a win. Morale above 70 from victories is kept.
  - **Desertion:** below 25, each midnight has a chance (up to 60% at 0 morale) that one random soldier deserts.
  - In this slice morale only drives desertion; it has no effect in battle yet.
- **Warnings (GDD §11):**
  - Messages for low food (under a day left), running out of food, wages paid or short, and desertion.
  - The map HUD shows food in days and morale; the panel border turns red when food is under a day or morale is under 25.
  - Settlement and Party screens show food, morale and wages, with warnings in red when short.
- **Saves:**
  - New fields: `food`, `morale`, `nextWagesDay`, `starving`.
  - Older saves get 3 rations, 70 morale and a payday 7 days on; food items in their pack become rations.
- **Debug panel:** a new **Supplies** section with +10 food, No food, Morale ±20, and Pay wages now.

### Verification
- **Automated:** `npm test` → 92/92. The new `tests/upkeep.test.js` (12 tests) covers:
  - ration maths, eating over time, prices with the Trade discount
  - starving and its one-time warning, and the low-food warning
  - morale recovery and its cap
  - payday timing, wounded soldiers' wages, short pay
  - the desertion threshold and rolls, battle morale
  - older-save upgrade, and the debug supplies
  - The GDD edge cases "all food consumed during travel" and "no gold for wages" are covered explicitly.
- **Browser (desktop):**
  - New game: Stonebridge showed "Food: 3.0 days (1/day) · Morale 70 · No wages owed", with buttons to buy 3 days' food (24) and a week's (56).
  - Hiring 2 Levies and a Hunter left 5 crowns. The wages line turned red ("12 crowns due day 8") and the food buttons were disabled.
  - Debug "No food", then travelling to Eastwatch, gave the "run out of food" message, morale falling, and the HUD showing "food 0.0d" with the red border.
  - Fixed a "3 days's food" typo along the way. No errors were logged.

### Balance notes for playtesting
- 60 starting crowns go quickly: three hires leave you unable to buy food or cover the first wages. The Looter Camp is meant to be the way out of that, so check that the early loop feels tight rather than punishing.
- If desertion feels harsh, tune `MORALE` in `js/upkeep.js`.

## Slice 2 — 0.7.0: Character, equipment, debug tools (2026-11-16)

### What's in
- **New game / Continue:**
  - The title offers **Continue** when a save exists.
  - **New game** over an existing save needs a second press ("Erase save and start over?"), following GDD §11's rule to confirm irreversible choices.
- **Character creator (GDD §5):**
  - Name: up to 20 characters, with control characters and `<>` stripped. It's only ever displayed as text.
  - Gender presentation: stored now for future sprite art.
  - **4 cloak colours**: Crimson, Forest, Violet and Ash. The hero sprite is recoloured live. Only the cloak's red band (hue ≥330° or ≤12°) is shifted; skin, hair and tunic are untouched. I checked this from the front, side and back. Royal blue was dropped because it vanished against the blue tunic.
  - **3 backgrounds** from the new `data/character.js`: Farmhand (+1 STR, +1 One-Handed), Scout (+1 AGI, +1 Pathfinding) and Peddler (+1 CHA, +1 Trade).
  - A live preview shows the hero.
  - **Hairstyles are deferred**: they need sprite art (Gate E art pass).
- **Starting state (GDD §5):**
  - 60 crowns, a worn sword, clothing, three days of food, and **no soldiers**.
  - **Deviation:** an **oak shield** is in the kit too. Blocking requires a shield (GDD §6), and sword-and-shield is the GDD's first core promise.
  - A new **Looter Camp** near Stonebridge (3, then 4 Looters; clears for 2 days) gives a lone hero a fair first fight.
- **Stats in effect now:**
  - **HP** = 60 + 5×STR.
  - **Damage** = weapon damage × (1 + 0.03 × One-Handed): Worn Sword 17, the new Arming Sword 21 (rare loot), unarmed 6.
  - **Armor** is the sum of equipped gear.
  - **No shield means no block.** The Block button is disabled in battle.
  - **Travel** speed gets +3% per Pathfinding point (the Ring of Roads adds a point), and a horse adds its travel bonus.
  - Trade, Leadership, Tactics, Shield, Archery and Riding are stored but have no effect until their steps arrive.
- **Character & gear sheet:**
  - Opened from **Party** on the map or **Character & gear** in a settlement.
  - Shows attributes, derived stats and the 8 skills, plus 8 equipment slots (weapon, shield, helmet, chest, gloves, boots, horse, ring) and the pack.
  - Equip and Remove swap items between pack and slot **atomically**, so an item is always in exactly one place, and each change is saved.
- **Older saves:** if a save predates characters, the player is asked to create one and keeps their gold, soldiers and pack. Missing equipment becomes the starting kit, already equipped.
- **Debug tools** (the **Debug** button next to Logs, also reachable over menus):
  - **Crowns:** ±100 or +1000.
  - **Soldiers:** add 1 or 5 of any troop (past the cap), heal all wounded, dismiss everyone.
  - **Items:** add any item to the pack.
  - **Hero:** ±1 to any attribute or skill (clamped), and a god-mode toggle.
  - **World:** +1 day, reset sites, teleport to any settlement.
  - **Battle:** win now or lose now, through the normal exactly-once result path.
  - **Save:** wipe, which needs a second press.
  - Every action is logged as `Debug: …` (it shows in exported reports) and saved.
- **AI fix:** units whose target falls now pick a new one at once, instead of swinging at the body for up to 0.4 s.

### Verification
- **Automated:** `npm test` → 80/80. New suites:
  - `tests/character.test.js` (10 tests): backgrounds, name cleaning, derived stats, atomic equip, travel factor, battle hero and the no-shield block, the new-game flow, older-save upgrade, save validation, kit validation.
  - `tests/debug.test.js` (7 tests): one per tool group.
  - The test helper gives fresh campaigns an explicit fixture (130 crowns, Farmhand, 3 Levies and 2 Hunters). `{ party: false }` tests the real GDD new game.
- **Browser (desktop):**
  - Played the full new game through real clicks: New game, a Scout with a violet cloak, then Begin. Stonebridge showed 60 crowns and no soldiers, and the sheet showed the correct stats.
  - Opened the Debug panel with a real click and used +1000, Add item (Arming Sword), STR +1 and Add 5. Every one applied and was logged.
  - Equipped the Arming Sword from the sheet, and damage went to 21.
  - Travelled to the Looter Camp and won the fight.
- **Balance sample:** 100 battles with a scripted player.

  | Matchup | Wins | Hero HP left on a win |
  |---|---|---|
  | Lone hero vs Looter Camp | 20/20 | about 47/90 |
  | 4 Levies vs Looter Camp | 20/20 | — |
  | Lone hero vs Reaver Hideout | 10/20 | — |
  | 3 Levies + 2 Hunters vs Reaver Hideout | 15/20 | — |
  | 6 Levies + 3 Hunters vs Reaver Hideout | 19/20 | — |

  No battle stalled.
- **Observation for the GDD's open question 2** ("is facing by movement comfortable?"): standing still, the hero can't turn without moving. My first bot got stuck facing the wrong way next to a diagonal enemy, which a person would fix with a nudge of the stick. If phone testing shows players having the same trouble, let small joystick pushes turn the hero without moving.

## Slice 1 — 0.6.0: The Border March map (2026-11-16)

Closes Gate B's deferred "return to map".

### What's in
- **New flow:** Title → **world map** ↔ **settlement** menus. A map **site** leads to an **encounter**, then the battle, the result, and back to the map. The camp screen is gone.
- **`data/world_map.js`**:
  - The Border March: two roads (west–east trade road, north–south fort road) and a river splitting Valedorn (west) from Aurelian (east).
  - Two forest areas and some hills.
  - One **Reaver Hideout** site linked to the `captains_trial` encounter.
  - It's validated at boot along with the rest of the content.
- **Travel (`js/world.js`):**
  - Click or tap a settlement, the hideout or open ground to travel there.
  - Speed = 4 map-units/hour × terrain (road 1.2, grass 1.0, forest 0.75), per GDD §3. The party-load factor stays 1.0 until there's cargo to carry.
  - Distance is measured in screen proportions, so a journey takes as long as it looks. Stonebridge → Eastwatch is about 3 h on the road; crossing the map is about a day.
  - Time passes while travelling (4 game hours per real second), and wounded soldiers heal along the way. Space halts the party.
- **Settlements:**
  - All 10 are on the map, with an icon shape for each type (town, fort, village) and a **faction-colour banner with a letter emblem** (GDD §11: not colour alone).
  - Each menu only shows services that work today.
  - Recruits depend on the settlement's owner: Valedorn offers Levy and Hunter, Aurelian offers Recruit and Skirmisher (`recruits` in `data/factions.js`).
  - Rest is only possible in settlements that offer it. Entering a settlement autosaves (GDD §13).
- **Hideout:**
  - Arriving opens an encounter screen with **Attack** or **Leave**.
  - Victory clears the hideout for **3 days**. It shows as "(cleared)", and visiting it then just shows a message.
  - The party returns to the map where the battle was fought.
- **Capture:** half a day in captivity, then release at the nearest kingdom-owned settlement (GDD §6). This is applied inside the exactly-once battle-result transaction.
- **Save:**
  - `campaign.world` stores position, current settlement and site timers. It's sanitized on load (bad coordinates clamped, unknown places dropped).
  - Older saves start inside Stonebridge.
- **Phone readability:** map labels are 14 px and settlements have a 28 px tap radius, about 38 CSS px across on an 812×375 screen. Battle-only controls (joystick, Attack/Block, Orders, Pause) are hidden outside battle.
- **Content fix:** the faction descriptions said north/south; they now say west/east, matching the GDD.

### Verification
- **Automated:** `npm test` → 62/62. The new `tests/world.test.js` covers:
  - **Terrain:** terrain types and speeds, and forest being slower than grass.
  - **Travel:** Stonebridge → Eastwatch time matches the estimate, the clock advances, arrival opens the menu and autosaves, wounded heal while travelling, and click hit-testing.
  - **Settlements:** faction recruits, and no rest on the open map.
  - **Hideout:** encounter → battle → cleared for 3 days → returns.
  - **Capture:** the time skip and release point.
  - **Save:** sanitizing the world state, and the clock label.
- **Browser:**
  - **Desktop:**
    - Title → Stonebridge menu → Leave → **a real mouse click** on Eastwatch. The party walked the road and arrived at Day 1, 03:00.
    - The Aurelian recruits were offered there, and I hired one.
    - Travelled to the hideout, attacked and won a full battle. Continue returned the party to the hideout, now shown as "(cleared)", and the HUD showed the time and wounded.
  - **Phone-sized (812×375):**
    - After a reload, the save restored the position, site timer and loot.
    - **A real tap** just off Stonebridge's icon travelled there and opened its menu.
    - No errors were logged.

### Known limits of this slice
- The river doesn't block travel and has no fords or bridges yet. Roads only make travel faster.
- The hideout is the only fight on the map. Moving bandits, patrols and caravans (step 6) will replace it as the main source of battles.
- Nothing costs anything over time yet (food and wages are step 4), so waiting and resting are free.
- The battle is always fought on the grass arena. The other two battle maps come in Gate D.
