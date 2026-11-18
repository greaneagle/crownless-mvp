# Crownless 2.0 — Acceptance (V2-13)

_Build 2.0.0, 2026-11-18. v2.0 "The Living Warband" is a testing release. This is the evidence that it does what the v2 design asked of it: the core scenarios (design Part 2 §27.1, SC-01–14 and SC-30–39), Prototype G, the simulations, and what is still waiting on a phone._

## How it was checked

- **Automated tests:** 528, all passing (`npm test`). `npm run lint` passes (Biome and the TypeScript check).
- **Simulations:**
  - `npm run simulate`: campaigns played by a bot, 8 × 30 days.
  - `npm run simulate:story`: 200 stories to an ending.
  - `npm run economy`: money by source, 12 × 60 days.
  - `npm run bench`: frame cost.
  - `scripts/prototype-g.js`: Prototype G.
- **Browser:** each task was checked in a real browser at desktop and phone landscape size (812×375), in the built-in browser pane, against a save that was restored afterwards.
- **Phone:** only PROTO-A (1.7.0) has been measured on the owner's phone so far. See "Waiting on the phone".

## Core scenarios

| ID | Scenario | Status | Evidence |
|---|---|---|---|
| SC-01 | Recruit, earn XP, promote, wound, save | ✅ | `soldiers.test.js` "SC-01 / Prototype C"; `chronicle.test.js` "§10.8 / SC-03" |
| SC-02 | Partial or missed pay | ✅ | `soldiers.test.js` and `accounts.test.js` "SC-02": records count crowns really paid, the chest first |
| SC-03 | A veteran dies after a long career | ✅ | `chronicle.test.js` "§10.8 / SC-03": the roll of honour keeps the summary, counting their last battle |
| SC-04 | Fight in a 3× forest arena | ✅ | `arena.test.js`, `camera.test.js`: the camera follows, world coordinates throughout, reserves inside the arena, no softlock |
| SC-05 | Tactical view: pick the archers, send them | ✅ | `tactics.test.js` "SC-05" and the coordinate conversion tests |
| SC-06 | Start a battle on Balanced | ✅ | `prep.test.js` "SC-06": two taps, useful orders (from 1.19.0 everyone follows the hero) |
| SC-07 | Custom deployment, save and load before battle | ✅ | `prep.test.js` "SC-07" (a reload commits nothing) and "remember and skip" (the Custom layout is kept) |
| SC-08 | A friendly patrol rides in | ✅ | `reinforce.test.js` "SC-08": arrival time, entry side, losses applied once, no double battles |
| SC-09 | An enemy party arrives from elsewhere | ✅ | `reinforce.test.js` "SC-09": seen ones named before the fight, others announced 10 s ahead; you can still retreat |
| SC-10 | Battle paused for five real minutes | ✅ | `clock.test.js` "SC-10" |
| SC-11 | Five minutes of fighting | ✅ (changed) | Owner decision 2026-11-17: a battle costs a fixed 4 hours however long it lasts. `clock.test.js` "a fought battle costs 4 hours, whether it lasts ten seconds or five minutes" |
| SC-12 | Auto-resolve the same encounter | ✅ | `clock.test.js` "SC-12"; the one commit path (`encounter.test.js`): no duplicate rewards or costs |
| SC-13 | Merchant with 200 crowns | ✅ | `merchant.test.js` "SC-13": every entry a real trade from the budget, your purse and cargo untouched, no same-town loop |
| SC-14 | Merchant finds nothing profitable | ✅ | `merchant.test.js` "SC-14": capital kept, "no safe trade" reported |
| SC-30 | Load a save across a v2 schema migration | ✅ | `save-migration.test.js` with saves made by the real 0.14, 0.28, 1.2, 1.3, 1.4, 1.13, 1.14 and 1.15 builds (and 0.3, 1.0): each imports and loads from storage, keeps a pre-migration copy, and plays on |
| SC-31 | Import a partial or damaged save | ✅ | `save-migration.test.js` "import rejects a partial save…"; `portable.test.js` "rejected: unknown IDs, listed" |
| SC-32 | Storage full | ✅ | `save-migration.test.js` "an import that cannot be stored reports failure and changes nothing (SC-32)" and "a write only counts once it reads back" |
| SC-33 | A save refers to removed or modded content | ✅ (new in 2.0.0) | `v2-acceptance.test.js` "SC-33". Before 2.0.0 a soldier of an unknown troop was quietly dropped on load. Now the save is refused, naming the soldier and the troop. It is kept exactly as it was under `crownless_save_incompatible`, and starting a new game erases nothing. An import lists every unknown ID |
| SC-34 | Phone, large arena, cavalry and reinforcements | 🟡 phone run needed | Debug panel: **Big battle 40 + help**: the 3× forest with cavalry on both sides, an allied party riding in at 8 s and an enemy one at 12 s, waiting in reserve while the field is full. The result screen reports fps, drawing and simulation ms, the slowest frame and who rode in. Headless: 0.55 ms of simulation per frame (0.42 without the parties). `v2-acceptance.test.js` "SC-34 (headless)" |
| SC-35 | App backgrounded mid-battle | ✅ | `v2-acceptance.test.js` "SC-35". The page pauses and lets go of every held input when hidden (`js/input.js`). A long gap advances one capped step: 0.05 s in battle and 0.1 s on the map, so nothing catches up |
| SC-36 | Ten ordinary fights without opening tactics | ✅ | `prep.test.js` "SC-36"; V2-T2 measured every setup in close fights |
| SC-37 | The same fight in person and auto-resolved | 🟡 owner: later | Shared rules, explained odds, no extra rewards or costs (V2-T2). Auto-resolve is fairer to a company since 1.19.0, but fighting in person with a company still wins far more often than the stated odds. Owner (2026-11-18): Simulate should be only slightly worse than fighting, and a strong fighter should be able to turn a close battle. Kept as is for 2.0, for a later balance pass (make fought company battles harder) |
| SC-38 | Only food and loot, no commodity trading | ✅ | The campaign bot never trades commodities and never sells loot, and its campaigns stay viable: `npm run economy` (12 × 60 days: money growing, wages short about once a campaign, food almost never out) |
| SC-39 | A merchant on Cautious for 30 days | ✅ | V2-12 and V2-T1: a 200-crown budget ends worth 313–332 on a market route, every crown accounted for, reports in plain words; stock that waits is sold so capital doesn't sit idle |

SC-15 to SC-29 and SC-40 to SC-42 belong to later phases (businesses, delegated armies, holdings, rulers and tournaments). They are not part of v2.0.

## Prototype G: the hands-off campaign

The same six campaigns (30 days each) were played by:
- a player who auto-resolves every fight and never changes a setting;
- one who fights in person and only picks a preset;
- an expert who picks setups, rallies, and keeps a quartermaster and a merchant.

Each run saved at day 15, closed, reloaded from that save and played on.

| Style | Money (median) | Soldiers | Won / lost | Hero down | Extra screens | Warnings | Stuck | Resumed |
|---|---|---|---|---|---|---|---|---|
| Hands-off | 165 | 13 | 116 / 79 | – | 0 | 2 | 0 | 6/6 |
| Presets | 481 | 20 | 155 / 21 | 60 | 33 | 7 | 0 | 6/6 |
| Expert | 763 | 20 | 197 / 11 | 43 | 142 | 3 | 0 | 6/6 |

- **All three are viable:** nobody got stuck, and every run picked up exactly where its save left off. The hands-off player needs no screens beyond the defaults.
- **Attention pays:** the expert does best, with fewer losses and more money. This comes from better choices under the same rules, not a hidden bonus.
- **The gap between hands-off and fighting in person** is large. That's SC-37's open balance question.
- **"Hero down"** counts battles where the bot hero (which walks straight at the enemy) fell, and the company fought on and usually won (V2-T2). A real player falls far less.
- **The expert never needed Rally:** no group routed while its hero was standing.

A short version runs as a test: `v2-acceptance.test.js` "Prototype G (short)".

## Simulations at 2.0.0

- **Campaigns (8 × 30 days):** 139 wins, 95 losses, 0 stuck.
- **Story:** all 200 reach an ending (85 Valedorn, 87 Aurelian, 28 compromise), with a median of 11.7 days.
- **Economy (12 × 60 days):** income from contracts and spoils; upkeep about a quarter of it; median money 221 at day 60.
- **Frame cost:** 0.42 ms of simulation per frame at 40 units on the large maps; the big battle with parties riding in, 0.55 ms.

## Waiting on the phone

1. **SC-34:** run Debug → **Big battle 40 + help** on the Zenfone and note fps, drawing ms and the slowest frame from the result screen. The target is PROTO-A's: 60 fps, under about 2 ms per frame.
2. **Feel:**
   - the larger company fights with the new Balanced;
   - the hero-down charge;
   - the approach banner;
   - morale messages;
   - the Orders panel's Rally button;
   - the Accounts screen at phone size.
3. **SC-37 balance:** whether close fights in person feel too easy (see above).
