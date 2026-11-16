# Gate D — Full Regional Content: Progress & Validation

_Spec: GDD §3–§10 and §14 Gate D._

**Gate D pass criteria (GDD §14):** expand to 10 settlements, 15 troop types, 3 battle maps, 4 story quests, 3 repeatable contracts, a companion, reputation and ending flags. **Pass:** each ending is reachable, no quest soft-locks, and the sandbox continues.

| Roadmap step | Status |
|---|---|
| 4.1 All ten settlements with their services | ✅ All 10 enterable since 0.6.0 (recruit, trade, rest, contracts where listed); **fort garrisons** shown since 0.15.0 |
| 4.2 Stonebridge walkable town hub | ✅ 0.16.0 |
| 4.3 Three battle maps as distinct environments | ✅ 0.15.0 |
| 4.4 Complete the item catalogue (~30) | ✅ 0.17.0 |
| 4.5 AI cavalry; all 15 troop roles | ✅ 0.18.0 |
| 4.6 Faction reputation and fort ownership | ✅ 0.19.0 |
| 4.7 Quest and dialogue interpreter | ✅ 0.20.0 |
| 4.8–4.12 Q1–Q4 and the companion Mara | 🟡 Q1 ✅ 0.21.0 · Q2 ✅ 0.22.0 |
| 4.13 Escort and delivery contracts | ⬜ |
| 4.14 Trade-world interactions and regional news | ⬜ |
| 4.15 Gate D acceptance | ⬜ |

---

## Slice 8 — 0.22.0: Q2 "The Broken Seal" (2026-11-17)

### What's in (GDD §4 Q2: "Locate a courier's lost packet after a caravan ambush. Resolve the encounter by fighting, paying a bandit informant or negotiating if sufficiently strong. The recovered packet exposes contradictory claims about Greywall. Choose whether to show it to Valedorn, Aurelian, or keep it. The choice modifies reputation and available dialogue, not all future access.")
- **New people:**
  - **Caravan Master Oswin** and **Magistrate Vell** (Aurelian) appear as *Talk to …* on Eastwatch's menu.
  - **Captain Aldric** (Valedorn) walks the Stonebridge square.
  - **Wenna the Fence** appears on Highmere's menu while the packet is missing.
- **Start:** Oswin offers the job in Eastwatch, and Q1 isn't required. If you carry the Q1 charter fragment, he recognises the same imperial seal.
- **The thieves:** a 4 Looter + 2 Reaver camp on the river road between Eastwatch and Highmere, marked in gold. It is a *camp*: it holds its ground and only fights if you go to it, so the road to Highmere stays open even for a lone hero.
- **Three ways to the packet:**
  - **Fight** the camp.
  - **Pay** Wenna 60 crowns for its hiding place.
  - **Intimidate** the camp with a company at least 2.5× its strength, using the existing negotiation rule.
  - Paying the camp's toll only buys passage.
- **Reading it:** two sealed copies of the Greywall charter, naming different heirs.
- **Three choices:**
  - **Show Aldric:** Valedorn +25, Aurelian −10 (the GDD's ±25 story decision).
  - **Show Vell:** Aurelian +25, Valedorn −10.
  - **Keep it:** tell Oswin. No reputation change, and it sets `has_evidence` for the Q4 compromise ending. The packet is protected from sale and capture.
  - Every choice pays 80 crowns, +15 renown and +80 XP, and closes the quest.
- **Dialogue remembers:** Oswin, Aldric and Vell each have lines for every choice. No choice locks any later content.
- **Interpreter additions:**
  - A `parley` event, so quests can react to intimidating or paying a band.
  - `camp` quest bands. Quest bands now always attack unless they're camps, and the camp marker survives saves.
- **Fix:** the debug teleport no longer leaves the Stonebridge streets drawn behind another settlement's menu.

### Checks
- `tests/q2.test.js` (10 tests) covers:
  - Oswin noticing the fragment, and Q2 needing no Q1
  - the camp not chasing, and keeping its marker through a save
  - each way to the packet; a toll that only buys passage; a fence you can't afford
  - all three choices with exact reputation and pay
  - dialogue that remembers the choice
  - agents that only take the packet while you carry it
- 233 tests pass; lint clean.
- Browser, with real clicks:
  - In Eastwatch, Oswin and Vell were on the menu; took the job from Oswin.
  - Saw the gold "Quest: Reavers 6" camp on the map, then travelled past it to Highmere with no encounter.
  - Paid Wenna through her conversation, and the camp packed up.
  - In Stonebridge, tapped Captain Aldric and showed him the packet: "Quest complete · +80 crowns · +15 renown", Valedorn 25 (Friendly), Aurelian −10.
  - The preview save was then reset so the quest can be played fresh.

---

## Slice 7 — 0.21.0: Q1 "A Stranger's Wage" (2026-11-16)

### What's in (GDD §4 Q1: "The player chooses between escorting a grain wagon, clearing nearby bandits or helping a recruiter. Introduces movement, settlement menu, first battle, money and recruitment. All choices lead to learning of the disputed charter; no branch locks later story.")
- **Start:** ask Elder Maren *Is there work for me?*. Her offer has a line suited to your background, and you take one of three jobs or say *Let me think on it*. The quest then waits in the journal, and *About that work…* brings the offer back.
- **Route 1, the grain wagon:**
  - Travel to Oakford, and the wagon joins you.
  - On the road home a three-Looter ambush, marked in gold on the map, springs whatever your strength, with its own encounter line.
  - Win and the drivers praise your fight. Slip past (by retreating, paying or intimidating) and the wagon still gets home, with a different line from the Elder.
- **Route 2, the Reavers:** win against any Road Reaver band or clear the Looter Camp.
- **Route 3, the recruiter:**
  - Sergeant Brun now has a conversation. He pays a 15-crown advance once.
  - Hire three soldiers, anywhere, so a Hostile Stonebridge can't block it. The journal counts them.
  - Then win any fight with them.
- **Report:** the Elder's words change with your route. You receive **50 crowns, +15 renown** (the GDD's story-resolution figure), **+60 XP**, **+10 Valedorn reputation** (helping a faction) and the protected **Charter Fragment**. She explains the disputed charter and sends you to the caravan master in Eastwatch, which is where Q2 will pick up.
- **New interpreter support:**
  - Stage `band`: a quest band is spawned when the stage begins, comes back if it's lost (for example from an old save), and is removed when the stage ends.
    - It is left alone by patrols and off-screen fights, keeps its tag through saves, and battles against it carry that tag.
  - `add` counters and numeric flag checks.
  - `{flag:x}` in text.
- **Optional:** Q1 is never forced. The sandbox runs without it, and there's no time limit.

### Checks
- `tests/q1.test.js` (7 tests) plays every route through the real game: travel, encounters, battles, recruiting and dialogue. That includes the wagon fight and the slip-past variant, losing to the ambush, the band being lost and coming back, patrols leaving it alone, the quest tag surviving a save, both ways to finish the Reaver route, the recruiter route with Brun's one-time advance, and "think on it". 223 tests pass; lint clean.
- Browser, with real clicks, on the wagon route:
  - Asked the Elder for work and took the wagon; the HUD showed the quest.
  - Clicked Oakford and travelled there; the ambush appeared on the road.
  - Clicked Stonebridge; the Reavers stopped the party, and I won the fight with the debug win.
  - Returned and tapped the Elder: the report line about the ambush, then "Quest complete · +50 crowns · +15 renown", the fragment, and Valedorn at 10.
  - The preview save was then reset so the quest can be played fresh.

---

## Slice 6 — 0.20.0: Quest and dialogue interpreter (2026-11-16)

### What's in (GDD §4: "use conditional lines, shared scenes and 3–5 quest flags"; §13: "Event-driven updates notify quest flags when battles, trades and conversations resolve"; screen 10, the Quest Journal)
- **`js/story.js`**, the QuestTracker: it reads quests and conversations from data and runs them. All story content lives in `data/quests.js` and `data/dialogue.js`; the code holds no story text. It has three small vocabularies, documented at the top of the file:
  - **Conditions:** flags, quest state and stage, crowns, renown, level, fit soldiers, reputation and standing, skills, attributes, background, items held, fort owner and current location. They combine with `all`, `any` and `not`.
  - **Effects:**
    - set or clear flags
    - crowns, renown, XP, food and reputation
    - give or take items, add soldiers (up to the party cap)
    - start a quest, set its stage, complete or fail it
    - change a fort's owner
    - show a message or add a journal note
  - **Events:** `battle`, `enter`, `recruit`, `trade`, `contract` and `talk`, sent by the game as things happen. Each quest stage lists triggers (`on: [{ event, match, if, do }]`), and the first matching trigger of the current stage fires.
- **Dialogue trees:**
  - The opening line can depend on conditions.
  - A node's lines are shown together when their conditions hold, or one per visit with `cycle`.
  - Options can be hidden behind a condition and carry effects.
  - Text can use `{name}`, `{gold}`, `{renown}` and `{settlement}`.
  - `services: false` hides the speaker's shop or recruit menu during a story moment.
  - A dialogue with a `place` appears as **Talk to …** on that settlement's menu. This is how quests can continue at towns other than Stonebridge, as the GDD requires.
- **Elder Maren** is the first real conversation:
  - A greeting with one line for each background.
  - The town's troubles, then a question about Greywall whose answer changes with the fort's current owner.
  - Lines that appear at 20+ renown and with Valedorn Friendly or Hostile.
  - Three story flags: `met_elder`, `asked_troubles` and `heard_charter`.
  - The other five dialogues are converted to the tree format, ready for Q1–Q4.
- **Quests:** Q1–Q4 are now in the stage-and-journal format. Their triggers will be written with each quest (4.8–4.12), and finishing a quest pays its rewards once.
- **Quest Journal:** opened with the **Journal** button on the map, in town and on every settlement menu. It lists active quests with their current objective and notes, then finished ones. The map's top-left panel shows the newest active quest.
- **Saves:** story state (`flags`, `quests`, `visits`) is saved and validated. Unknown quests are dropped and unknown stages fall back to the first stage. Only simple flag values are kept, and older saves start blank.
- **Content checks at boot:** every node link, condition, effect, quest, stage, event, item, faction and settlement named in story data is checked, with errors in the Logs panel. Shipped content is clean.
- **Debug panel:** Story section with Start, Next stage, Complete and Reset story for any quest.

### Checks
- `tests/story.test.js` (11 tests) covers:
  - every condition and effect
  - quest start, stages and paying rewards once
  - triggers firing only on the right event, place and condition, including a real battle at the Looter Camp
  - the game sending recruit, trade and contract events
  - Elder Maren's branches and flags, rotating lines, and hidden options that can't be chosen
  - **Talk to …** at a settlement, the journal and the map panel
  - save round-trip and junk rejection, and the content checks catching broken data
- 216 tests pass; lint clean.
- Browser, with real clicks: tapped Elder Maren in Stonebridge. The greeting used the hero's name and Farmhand line, and *What troubles Stonebridge?* → *Tell me about Greywall* showed the right line for Greywall's owner and set the three flags. The Journal button showed an empty journal with a hint. After starting Q1 from the Debug panel, the Journal showed the quest and current objective over the town scene, and the map panel showed "▸ A Stranger's Wage". The test quest was then cleared from the preview save.
- **Fixed during the check:** the town scene now stays visible behind the Journal.

---

## Slice 5 — 0.19.0: Faction reputation and fort ownership (2026-11-16)

### What's in (GDD §10: "Three visible states per faction: Friendly / Neutral / Hostile. Store hidden score [-100, 100]"; §12: "Two forts have owner IDs. One story quest can change Greywall's owner.")
- **Reputation:** each kingdom (Valedorn and Aurelian) has a hidden score from −100 to 100. Below −25 it's **Hostile**, above +24 **Friendly**, otherwise Neutral. The Road Reavers are always hostile and have no score. The game announces when your standing changes. All of this lives in the new `js/realm.js`.
- **What changes it:**
  - Collecting a contract: +10 with the giver's kingdom.
  - Beating Road Reavers (a band or a camp): +2 with whoever holds the nearest settlement.
  - Attacking a kingdom's patrol or caravan that wasn't after you: −15.
  - Story decisions (±25) arrive with the quests.
- **What it does:**
  - **Friendly** with either kingdom: +2 party slots (the GDD's `faction_bonus`). The Character screen shows both standings and the bonus.
  - **Hostile:**
    - That kingdom's settlements won't let you recruit and post no contracts. Their board says why and how to make amends. The market and rest stay open, so you can't get stuck.
    - Their patrols ride you down, with their own lines and no toll to pay.
    - After a capture you're released at a settlement that will have you, if there is one.
  - **Attacking a patrol or caravan:** a neutral one now offers *Attack them* and *Attack (auto-resolve)*, each showing the reputation cost. A patrol win pays +6 renown (GDD) and mid-tier loot; a caravan pays crowns.
- **Fort ownership:** Greywall and Ashgate store their owner in the save. When a fort changes hands:
  - Its map banner and recruits follow the new owner.
  - Its garrison becomes the new owner's standard garrison (`garrison` in `data/factions.js`).
  - Patrols switch their waypoints, and a kingdom that loses its home fort musters its patrols where it still holds ground.
  - The Q4 ending will call `CL.realm.setOwner`. Until then the Debug panel can flip either fort.
- **Saves:** reputation and owners are saved and validated. Unknown factions, non-kingdom owners and bad numbers are rejected, and saves from before this build start Neutral with the original owners.
- **Debug panel:** Valedorn/Aurelian ±10 and Flip Greywall/Ashgate.

### Checks
- `tests/realm.test.js` (11 tests): thresholds and clamping, the standing-change message, the party-cap bonus, the contract and bandit rewards, the patrol-attack penalty and hostile pursuit, refusal at hostile settlements, Greywall changing hands, save round-trip and junk rejection, and the release point after capture. 205 tests pass; lint clean.
- 30-day simulation on 4 seeds: campaigns progress normally (6–22 contracts, nobody stuck).
- Browser, with real clicks: the Debug panel flipped Greywall and set Valedorn to Hostile. Stonebridge then said "hostile to you", hid recruiting and explained the empty board. Both settings survived a page reload. Greywall showed the red Aurelian banner on the map. A Valedorn patrol confronted the hero with its hostile line. A neutral Aurelian patrol offered to be attacked; attacking cost 15 reputation and started a battle with a +6 renown reward.

---

## Slice 4 — 0.18.0: AI cavalry, all 15 troop roles (2026-11-16)

### What's in (GDD §7: cavalry "charge momentum and pass-through behavior"; mounted charge damage ×1.2)
- **Cavalry AI:** riders ramp up speed over 0.8 s. At momentum ≥ 0.6 a strike gets the GDD **1.2× charge bonus**. After striking they **ride through** the target (about 22 px past it), then wheel round for another run.
- **Orders:** group **3 Cavalry** (key 3 or the button). Charge is the default. Hold keeps them in place until enemies come within 160 px; Follow keeps them near the hero and lets them ride down anyone within 180 px. Without living cavalry the button is greyed out and orders say "No cavalry in this battle".
- **Deployment:** up to 6 riders form on the left wing behind the hero, clear of trees and walls.
- **Art:** Riders and Horse Scouts use mounted sprites, drawn larger than foot soldiers.
- **All 15 troops in play:** Footman → Rider and Spearman → Horse Scout upgrades are open, and **Mercenaries** can be hired in towns. A test checks that every troop type in `data/troops.js` can be recruited, reached by upgrade or met as an enemy.
- **Fix:** a pyrrhic loss that wiped out a contract's marked band left the contract stuck as active. It now completes the contract.

### Checks
- `tests/cavalry.test.js`: deployment, charge bonus, pass-through, Hold/Follow, no-cavalry orders, upgrades, Mercenary hire, all-15 reachability, and 12 cavalry battles across the three maps (all end, nobody stuck in scenery). 194 tests pass; lint clean.

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
