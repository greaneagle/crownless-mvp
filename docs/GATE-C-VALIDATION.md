# Gate C — Campaign Loop: Progress & Validation

_Spec: GDD §3 (map, travel), §8 (encounters, settlements), §14 Gate C._

**Gate C pass criteria (GDD §14):** a player can complete a contract, buy food, recruit, fight, level and reload with all state intact.

Gate C was delivered in slices, recorded below. **Verdict: Gate C passes**: the GDD criterion is met by an automated end-to-end test, a 30-day simulation over 8 seeds, and a playthrough with real clicks in the browser. A real-phone pass is still owner-pending (see the end).

---

## Acceptance — 0.14.0 (2026-11-16)

### The GDD Gate C criterion

| Criterion | Automated (`tests/acceptance.test.js`) | Browser, real clicks |
|---|---|---|
| Complete a contract | the bot completes ≥1 on a fresh GDD start (60 crowns, no soldiers) | accepted a Bandit Hunt (5 Looters, 2 Reavers), fought it, collected 82 crowns at Stonebridge |
| Buy food | ✓ | Buy 3 days' food, 24 crowns |
| Recruit | ✓ | hired 2 Levies |
| Fight | ✓ (wins counted) | Attack, then a real-time battle won 7–0 with no losses |
| Level | reaches level 2 or more | "Paid 82 crowns — level up!", then spent a point on Leadership (party cap 8 → 10) |
| Reload with all state intact | every gameplay field is identical after reloading from storage **and** after importing an exported file on another "device" | after a **real page reload** and Continue, all 16 compared fields were identical |

The scope items are all in place: the region, travel, encounters, trading, food and wages, progression, both kingdoms' moving patrols, and save/load.

### The loop holds up over time: headless campaign simulation
`npm run simulate` (`scripts/simulate-campaign.js`) plays brand-new games on the real game logic with a simple bot (`tests/helpers/campaign-bot.js`). The bot buys food, hires within a budget, upgrades, spends points, takes contracts it can win, auto-resolves good fights, pays tolls or retreats from bad ones, and rests its wounded. Results for 30 days × 8 seeds:

| | min | typical | max |
|---|---|---|---|
| Hero level | 4 | 6 | 9 |
| Contracts completed | 3 | 11 | 24 |
| Soldiers at day 30 | 2 | 10 | 17 |
| Stalls (no progress) | 0 | 0 | 0 |
| Desertions | 0 | 0 | 0 |
| Times out of food | 0 | 0 | 1 |

**The simulation found a real balance problem, now fixed.** Before the fix, **7 of 8 new campaigns stalled**: still level 1 after 30 days, broke, with no contracts done.
- **Cause:** auto-resolve valued the hero like one T3 soldier (power 2.5), while in a real battle a fresh hero alone beats the 7-looter camp. So auto-resolve showed every early fight as hopeless.
- **Fix:** the hero's auto-resolve power now comes from their **real stats**: HP × damage relative to a T1 soldier, ×1.5 with a shield. A new Farmhand counts as about 7.5, and the value grows with levels and gear. It stays below the hero's real-battle worth, so fighting it out yourself still pays off.
- **Result:** a lone new hero has about a 50% auto-resolve chance against the Looter Camp and under 35% against the Reaver Hideout. Both are covered by a test.

A regression test also runs 3 seeds for 15 days and fails if any campaign stalls or never levels up.

### GDD §15 edge cases — where each is covered

| Edge case | Covered by |
|---|---|
| Hero captured with zero surviving troops | `parties.test` (lone hero loses an auto-resolve: captured and released) |
| All food consumed during travel | `upkeep.test` "food runs out partway through travel" |
| No gold for wages | `upkeep.test` "short pay costs morale" |
| Player joins a hostile encounter | `parties.test` (ambush interrupts travel; attack/retreat/toll) |
| Quest courier's party removed off-screen | `contracts.test` (target destroyed off-screen → contract void, no penalty) |
| A fort changes owner before Q4 | Gate D (fort ownership arrives with reputation and quests) |
| Companion wounded at story trigger | Gate D (companion) |
| User loses browser storage | `portable.test` round trip into a fresh browser; Save & export warning; browser wipe-and-import run (0.13.0) |
| Import invalid or future-version save | `portable.test` (malformed, checksum, newer version, unknown IDs; current save untouched) |
| Battle ends during reinforcement spawn | `combat.test` "waves come from the encounter" (the end is checked after a wave spawns; a wave can't spawn after victory) |
| Low-end phone with 30+ units | owner phone check (Gate E battle scaling) |
| User rotates device | Gate A (portrait prompt and pause), browser-verified |
| App pauses mid-battle | Gate A (`visibilitychange` auto-pause), browser-verified |
| Tap commands overlap the Attack button | Gate A (Orders panel moved above the controls), browser-verified |

### Balance observations for playtesting (not blockers)
- A bot that grinds can reach level 9 and 24 contracts in 30 days. Offers come back as soon as one is accepted, so a cooldown may be worth adding once human pacing is known.
- The bot loses about 40% of its fights because it auto-resolves at 55% odds. Humans who fight battles themselves should do much better.
- Renown climbs fast enough to max the party cap (20) by about day 20–30 in good runs.

### Deferred to Gate D (by design)
Faction reputation, plus attacking patrols and caravans; the other 8 settlements' full services and the Stonebridge walkable hub; the forest and courtyard battle maps; cavalry; quests Q1–Q4 and the companion Mara; escort and delivery contracts; regional news.

### Owner phone pass (to close Gate C fully)
- [ ] Play the browser acceptance loop above on a phone: hire, buy food, contract, fight, collect, level, then close and reopen the browser.
- [ ] Export the save on the phone and import it on desktop, and the other way round.
- [ ] Note anything that felt grindy or punishing in the first 30 minutes.

| Roadmap step | Status |
|---|---|
| 1. World map, click/tap travel, time advancing | ✅ 0.6.0 |
| 2. Settlement menu (Recruit / Trade / Rest / Contracts / Leave) | ✅ Recruit, Rest, Leave (0.6.0), Market (0.9.0), Contracts (0.12.0) |
| 3. Character creation + inventory/equipment | ✅ 0.7.0. Hairstyles wait for art. |
| 4. Food & weekly wages, morale/desertion | ✅ 0.8.0 |
| 5. Trading (6 goods, scarcity) | ✅ 0.9.0, with caravans moving prices since 0.10.0 |
| 6. World parties + encounter options (Attack / Negotiate / Retreat / Auto-resolve) | ✅ 0.10.0. Patrols and caravans can be talked to but not attacked until reputation (Gate D). |
| 7. Capture on defeat | 🟡 0.6.0: released near a settlement after half a day. Loss of crowns and an item came in Gate B. |
| 8. Player XP/levels/skills; troop upgrades; party-cap formula | ✅ 0.11.0. Cavalry upgrades unlock with mounted AI (Gate D). |
| 9. Bandit-hunt contract | ✅ 0.12.0 |
| 10. Save export/import | ✅ 0.13.0 |
| 11. Gate C acceptance | ✅ 0.14.0 — see Acceptance below |

---

## Slice 8 — 0.13.0: Save export and import (2026-11-16)

### What's in (GDD §13)
- **Save & export screen**, from any settlement ("Save & export") or the title screen ("Import or export a save"):
  - **The GDD's storage warning**, explained in plain words: browsers can clear storage (private browsing, clearing site data, low space), so export now and then and to move devices.
  - **Status:** your name, the game clock and when it was last saved. If the browser refused a save, it says so in red.
  - **Save now:** a manual save from a safe menu (GDD).
  - **Export save file:** downloads `crownless-<name>-day<N>-<date>.json`.
  - **Copy save text:** when the clipboard is blocked, the text appears in a box to copy by hand.
  - **Import from file**, and **Paste save text instead** (for phones where files are awkward).
  - **Restore save from before the last import:** one click, then the slot is cleared.
- **The file:** `{ format: 'crownless-save', version: 2, game: <build>, exportedAt, checksum, campaign }`. The checksum is FNV-1a over the campaign JSON, which catches damaged or hand-edited files (it's an integrity check, not security).
- **Strict import, never destructive.** Each of these is rejected with a plain reason and "Your current game was not changed":
  - empty, non-JSON, over-2 MB or wrong-shape files
  - a **checksum mismatch**
  - **a newer save version** ("made by a newer version of Crownless (x.y.z). Update the game first.")
  - **any unknown ID**, listed: troops, items, gear in the wrong slot, settlements, sites, backgrounds, skills, trade goods, markets, party types, contracts and contract givers. The GDD says unknown IDs must be rejected; normal loading quietly drops them instead.
  - A raw save object, without the envelope, is also accepted, and an **old 0.3 save** converts on import.
- **Backup:** a successful import first keeps the current save in its own slot (`crownless_save_pre_import`), alongside the existing rolling backup.
- **After an import:** the game goes straight into the imported campaign, and leftover state from the previous one (travel, open encounter, waiting, god mode) is cleared.
- **Save failures:** `CL.save.write()` returns whether it worked. The first failure shows "Could not save in this browser — use Save & export to keep your progress", and the screen keeps showing the error.

### Verification
- **Automated:** `npm test` → 153/153. The new `tests/portable.test.js` (11 tests) covers:
  - **Round trip:** a campaign with soldiers, gear, cargo, an active contract and world parties, exported and imported into a *different* browser, comes back byte-identical after load validation.
  - **The envelope's fields.**
  - **Every rejection path**, with the current save confirmed unchanged and no pre-import copy made.
  - **Raw and 0.3 imports.**
  - **Pre-import backup** and restore (one time only).
  - **Leftover state** cleared on import.
  - **Safe file names.**
  - **The quota-error warning.**
- **Browser:**
  - Made a game (Edda, 381 crowns, 3 Levies, Day 3). A **real click** on Save & export showed the warning and status.
  - A **real click** on Copy save text: the pane blocks the clipboard, so the fallback put the 4.5 KB save text in the paste box.
  - **Wiped all storage and reloaded**, like a new device; the title offered New game and "Import or export a save".
  - Pasting a **tampered** copy (gold edited) was rejected with the checksum message.
  - Pasting the genuine copy restored Edda in Stonebridge, Day 3, 381 crowns and 3 soldiers, and saved it.
  - The screen also works at 812×375. Fixed leftover text staying in the paste box after an import.
  - I deliberately didn't click **Export save file**, because it downloads a file to the machine. Its content is the same tested `serialize()` output.

### For the owner to try on a phone
- [ ] Export on desktop, then import the file on Android Chrome and on iPhone Safari (Files app).
- [ ] Copy save text on a phone, paste it on another device, and import.

## Slice 7 — 0.12.0: Contracts — the bandit hunt (2026-11-16)

### Lifecycle (GDD §4 repeatable work)
- **Offers:** settlements with the contracts service (Stonebridge, Eastwatch) post **one offer at a time**, refreshed every 3 days. Templates live in `data/contracts.js`.
- **Bandit Hunt:**
  - The target band is built from Looters and Reavers to **0.7–1.2× the player's strength** when offered (3–14 troops). It camps 10–17 leagues from the town.
  - **Reward:** 40 + 6 crowns per bandit, +5 renown, and 40 + 5 hero XP per bandit, shown on the offer. **Time limit:** 4 days.
- **Accept → active:** a **marked band** spawns at the camp. It roams within 4 leagues of the camp so you can find it, and doesn't take one of the 3 regular bandit slots.
  - **On the map** it shows a pulsing gold ring and the label "Contract target"; the HUD shows "contract N.Nd left". Click it to hunt it down.
  - It behaves like any band: you can Attack, Auto-resolve, Negotiate or Retreat.
- **Done:** beating it, in a real battle or by auto-resolve, completes the contract and shows "Return to Stonebridge to collect your pay". Defeating a *different* band doesn't count.
- **Collect:** only at the town that hired you; its button reads "Contracts — collect pay!". Pays gold, renown and XP, which can level you up, and `contractsDone` goes up.
- **Fail:** missing the deadline or abandoning costs −2 renown. The band stays in the world as an ordinary band.
- **Void (GDD edge case "quest courier's party removed offscreen"):** if a patrol destroys your target first, the contract is cancelled with **no penalty**.
- **One contract at a time.** The lifecycle is generic (template → offer → start → on target defeated or lost → collect), ready for the escort and delivery templates in Gate D.
- **Saves:** the contract, offers, `nextContractId` and `contractsDone` are validated on load. A saved hunt whose band is missing is voided.
- **Debug:** a **Contracts** section with "Defeat contract target" and "New offers".

### Verification
- **Automated:** `npm test` → 142/142. The new `tests/contracts.test.js` (11 tests) covers:
  - offer locations and refresh, band sizing and reward formula, accept, the slot not counting
  - the marked band staying near camp, completing by battle and by auto-resolve, collecting only at the giver
  - deadline failure, abandoning, the off-screen void edge case, and save validation
- **Browser (desktop), with real clicks** on Contracts, Accept contract, the gold-ringed target and Collect payment:
  - **Caught and fixed a UI bug the unit tests can't see:** after removing an unused parameter, two multi-line calls still passed the old first argument. The board rendered "[object Object]" and a letter-per-line description.
  - The full loop then worked:
    - The offer was sized for a lone hero (2 Looters and 1 Reaver for 58 crowns).
    - After accepting, the HUD showed "contract 4.0d left" and the map showed the gold-ringed target.
    - Clicking it started an intercept. A lost auto-resolve meant capture, with the contract still active.
    - A different band then ambushed us, and correctly didn't complete the contract.
    - Beating the real target showed "Return to Stonebridge…" and the button changed to "Contracts — collect pay!". Collecting paid 58 crowns, +5 renown and XP.
  - The contract cleared, a new offer appeared, and the save recorded it. No errors were logged.

## Slice 6 — 0.11.0: Levels, troop upgrades, party cap (2026-11-16)

### Rules (GDD §5, §7)
- **Hero XP:**
  - Victory: 25 + 8 per enemy defeated. Defeat: 5 + 4 per enemy defeated. Fought or auto-resolved battles both count.
  - **Intelligence** adds 2% per point above 5 (GDD: "INT modestly influences XP").
- **Levels:**
  - Next level needs `round(100 × L^1.35)` XP (100, 255, 441, 650, …), with a **cap of level 10**.
  - Each level gives **+1 skill point**; every 2nd level gives **+1 attribute point**.
  - Points are spent with **+** buttons on the Party screen: skills cap at 10, attributes at 20. Strength raises HP straight away.
- **Troop XP:**
  - Every soldier who fought earns 20 for a win or 8 for a loss, halved if wounded, plus 5 per enemy they felled in a real battle (kills are now credited per unit).
  - Soldiers who weren't deployed earn nothing.
- **Upgrades:**
  - The GDD trees: Levy → Footman → Guard or Levy → Hunter → Longbowman (Valedorn); Recruit → Spearman → Legionary or Recruit → Skirmisher → Marksman (Aurelian). `data/troops.js` gained the Levy → Hunter and Recruit → Skirmisher branches.
  - **Cost:** gold from data (25 for T1→T2, 60 for T2→T3, as in the GDD) plus XP (40 at T1, 100 at T2, our starting values). Wounded soldiers can't upgrade.
  - **The Footman → Rider and Spearman → Horse Scout branches are locked**, marked "Cavalry training comes later", until mounted AI arrives (Gate D 4.5).
- **Party cap:**
  - `min(20, 8 + 2×Leadership + floor(Renown/40))`, replacing the flat 15. The GDD's +2 faction bonus arrives with reputation.
  - Wounded soldiers take slots. The Party screen shows the breakdown, and older saves over the new cap keep their soldiers but can't hire more.
- **Battle result:** shows hero and troop XP, "Level up!", and how many soldiers are ready to upgrade.
- **Party screen:**
  - Level and XP, unspent points, attribute and skill **+** buttons, and the party-size breakdown.
  - A new **Troops** section lists each troop type with count, wounded, best XP against the requirement, and how many are ready, plus one upgrade button per branch with its price.
- **Debug:** a new **Progress** section with Hero +100 / +1000 XP, Troops +50 XP and Renown +40.

### Verification
- **Automated:** `npm test` → 131/131. The new `tests/progression.test.js` (11 tests) covers:
  - the XP curve, level-ups and points (including several levels at once), the Intelligence bonus and level cap
  - point spending with caps and STR → HP
  - the party-cap formula and recruiting being blocked at the cap
  - upgrade trees and the cavalry lock, upgrade rules (XP, gold, wounded, running out of gold)
  - battle XP for the hero and soldiers (wins, losses, wounded, non-participants), with real-battle kills credited per soldier
  - auto-resolve XP, and save validation
- **Browser (desktop):**
  - +1000 XP took a Farmhand to level 4 with 3 skill and 2 attribute points.
  - **Real clicks** on the Leadership "+" raised the party cap from 8 to 10, and on the Strength "+" raised Strength to 7 and HP to 95.
  - A **real click** on "→ Footman · 25 each" upgraded 4 Levies for 100 crowns; the Guard branch then waited for 100 XP and Rider showed as locked.
  - Upgraded 2 Recruits to Skirmishers, which caught and fixed a "Levys" plural bug.
  - The Looter Camp victory screen showed "+49 XP · troops +120 XP". No errors were logged.

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
