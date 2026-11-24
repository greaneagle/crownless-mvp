# Crownless — Plan after 2.0: zoom and a bigger world, then Phases 7–9

_Written 2026-11-18 at build 2.0.0 (commit 0415109); **reviewed and corrected the same day against commit c66d94c** (see §11, "Review log"); **Phase 8 re-specified 2026-11-20 at build 2.23.0** (§5; review log items 21–36). This is the working plan for everything after v2.0. It replaces the outlines in `docs/V2-PLAN.md` §6–§8; V2-PLAN stays the record of how v2.0 was built. Each task's specification is in [`NEXT-TASKS.md`](NEXT-TASKS.md). Sources: the owner's direction (2026-11-18), the v2 design documents (`Crownless_v2_0_Feature_and_Systems_Design_Part_1.md` and `_Part_2.md`, chiefly §11–§24, §26–§28) and the code._

## 0. The owner's direction (2026-11-18)

- **Focus:** zooming, then Phases 7, 8 and 9, and **make the game bigger**. Most later features (officers, nobles, holdings, sieges, diplomacy, kingdoms) can't be tested properly in a world of ten settlements and two kingdoms.
- **Deferred:**
  - Art: a separate team is working on it (ART-01 and asset work are off this plan, except the asset request lists below).
  - Commercial readiness, packaging, demo and storefront (R-01–R-03): after the art.
  - The battle balance pass: Simulate only slightly worse than fighting; a strong fighter able to turn a close battle. Scheduled as B-01.
- **Plan review instructions (2026-11-18):**
  - Keep the plan and the product vision.
  - Correct gaps, risky sequencing, optimistic sizes and missing requirements.
  - Keep task IDs.
  - Keep the development principles: simple defaults, optional depth, no unnecessary micromanagement, campaign continuity.
  - Keep the testing rules and add tests.
  - Leave design decisions to the owner as proposed defaults.
  - Mark which tasks are ready and which are provisional.
  - Add **W-00, browser regression testing**, before W-01 and W-02.
  - Strengthen W-01's accessibility and layout requirements.
  - Make W-02's input and camera model explicit.

**What this plan does with that:** a **testing and world-scale foundation first** (browser tests, zoom, a data-driven world with no hard-coded map size, a bigger map, saves moved safely into it, a world simulation that scales). Then Phases 7–9 in a world large enough to show them working.

## 1. Where the game stands (2.0.0)

### What is built
- **The world:**
  - The Border March: 10 settlements (2 towns, 2 forts, 6 villages), two kingdoms (the Valedorn Crown, the Aurelian Remnant) and the Road Reavers.
  - 3 name cultures, 16 troop types, 28 items, 6 trade goods.
  - Two roads, a river, forests and hills.
  - 9 roaming parties.
  - Regional news and frontier clashes. Forts can change owner.
- **The story:** four quests with three endings, and five errands.
- **The company:**
  - Named soldiers with service records.
  - A discovered troop tree, the chronicle and roll of honour.
  - Accounts and a ledger.
  - The quartermaster and the merchant.
  - Mara, the companion.
- **Battles:**
  - Large arenas with a following camera, a minimap and a tactical overview.
  - Battle preparation with presets and Custom placement.
  - Group AI, morale and rally.
  - Nearby reinforcements.
  - A fixed 4 hours of map time per battle.
- **Foundations:**
  - Save schema v9, with migrations from every old build and fixtures from real builds.
  - One commit path for results; domain events.
  - Seeded random streams; one campaign clock.
  - A JSDoc type check on the core modules.
- **Tests and tools:**
  - **528 Node logic tests**, about 21 s for `npm test` (533 at 2.1.0, plus 86 browser tests from W-00; from 2.1.1, 531 fast tests in about 8 s and 4 slow ones under `npm run test:slow`).
  - Bots: campaign, story, Prototype G, an economy report, a battle benchmark.
- **CI:** `.github/workflows/deploy.yml` runs `npm test` and `npm run lint` on every push and pull request, then deploys `main` to GitHub Pages.
- **No dependencies, not even for development:** Biome, TypeScript and http-server run through `npx`; there is no `package-lock.json`.
- **Evidence:** `docs/V2-VALIDATION.md`, `docs/RELEASE-NOTES.md`.

### Still open from v2.0
| Item | Who | Note |
|---|---|---|
| SC-34 phone run | Owner | Debug → **Big battle 40 + help** on the Zenfone; target 60 fps under about 2 ms per frame |
| Feel check of the v2 battles | Owner | New Balanced, hero-down charge, morale, reinforcements, the Rally and Accounts screens |
| SC-37 battle balance | ✅ B-01 (2.11.0); the owner's feel check on the phone to come | Fought company battles were far easier than Simulate's odds; now a few points over them |
| Push and (optionally) tag 2.0.0 | Owner | Nothing is pushed or tagged by the assistant |

### Limits that block a bigger game (verified in the code at c66d94c)
- **The world map can't grow:**
  - It is a fixed 0–100 space drawn to fill the 960×540 canvas (`js/world.js` `VIEW`: 8.8 px per map unit across, 4.96 down). There is no map camera, pan or zoom.
  - `mapDist` takes its vertical aspect from that view (`Y_ASPECT = VIEW.sy / VIEW.sx`), so gameplay distance is tied to the drawing constants.
- **The 0–100 map size is hard-coded beyond the view.** About 15 places clamp to it:
  - `js/parties.js`: party destinations to 2–98 (lines 144–209 and 440), saved positions and anchors to 0–100 (583–597);
  - `js/world.js`: tap targets (134) and the saved position (335–336);
  - `js/contracts.js`: saved contract targets to 0–100, with a fallback of 50, 50 (332);
  - `js/story.js`: quest band spots capped at 98 (272);
  - `js/parties.js`: new parties are created at 50, 50 before placement (47).
  
  A larger map would silently squash positions back into the old square.
- **One world is hard-wired:**
  - `MAP_ID = 'border_march'` in `js/world.js`.
  - The kingdom ids in `FACTION_EMBLEM` (`js/render.js`), `FACTION_ORDER` (`js/troops.js`) and the debug fort switch (`js/debug.js`).
  - The campaign bot's contract boards (`tests/helpers/campaign-bot.js:134`: Stonebridge and Eastwatch).
- **Map input starts travel on pointer-down** (`js/input.js` ~224 calls `CL.world.click` at once). Drag-to-pan and pinch-to-zoom need a gesture-aware handler first.
- **Travel and party movement are straight lines** with terrain speed factors (`world.update`, `parties.move`). Impassable terrain (for example "rivers crossed only at fords") would leave the player and parties stuck without route planning.
- **The world simulation was sized for nine parties:**
  - every party is stepped every 15 game minutes;
  - contacts are checked pair by pair (`resolveContacts`, `frontierClash`);
  - detection is a distance test;
  - `reinforce.plan` scans all parties.
- **No zoom anywhere:**
  - the page blocks pinch-zoom (`user-scalable=no`, and `touch-action:none` on the body);
  - there is no text size setting;
  - battles have one fixed scale.
- **The canvas is a fixed 960×540 backing store** (`index.html`, `CL.W`), stretched to the screen with `image-rendering: pixelated` and no `devicePixelRatio` scaling. On a phone with a device pixel ratio of 3, every canvas pixel covers about 2.5 screen pixels, so canvas text that W-01 enlarges, and a map that W-02 zooms, stay at that resolution (blocky rather than sharper). Decision D-R1.
- **The world map is redrawn whole every frame** (`drawWorld` in `js/render.js`): grass, forest polygons with tree dots found by calling `terrainAt` per dot, hills, roads and rivers. Its cost grows with the map's area. The grass mottling is placed in screen coordinates, so it would slide under a moving camera. There's no cached terrain layer for the world map (the battle minimap has one: `terrainImage`), and no measurement of map drawing (`npm run bench` measures battles only).
- **Randomness:**
  - The world simulation uses the campaign's seeded stream (`rngSeed`) and named streams for casualties, loot, upkeep and names (`js/autoresolve.js`), so the same seed gives the same world.
  - Battles use `Math.random` (`CL.rand`, `js/combat.js`), so browser and Node tests pin `Math.random` to make battles repeatable.
- **No duel or one-on-one mode exists.** The tournament (P7-09) has no "duel mechanics" to reuse. It needs a one-on-one arena mode built on the battle engine.
- **Politics is a single owner per fort** (`c.owners`), with reputation as one number per kingdom. That's enough for two kingdoms, too thin for holdings and nobles.
- **Rendering of new troops:** soldiers are drawn by role (`allyArt.infantry` / `allyArt.archer`; cavalry by `troopArt`), so new troop types render with existing sprites until the art team delivers. That's a cosmetic gap, not a blocker.
- **Testing gaps:**
  - Rendering, input, gestures and layout are only checked by hand in a browser.
  - Test games in one Node process can leak state into each other (seen in V2-T2: results depended on run order).
  - Bot-heavy tests will slow `npm test` as the world grows.
- **Hygiene:**
  - `js/ui.js` is about 1,800 lines.
  - Line-ending warnings on every commit (LF in the repository, CRLF on Windows checkout).

## 2. The plan at a glance

```text
Phase W   "A Bigger World"      — browser regression tests, test hygiene, text size, map and battle zoom,
                                  a data-driven world with no hard-coded map size, the bigger region with
                                  saves moved into it, a world simulation that scales, tuning
Phase 7   "The Living Company"  — the balance pass, followers, pursuit, officers and detached patrols,
                                  companions, traits, world events, tournament, a mill, battle extras
Phase 8   "The Landed World"    — lords, holdings, permissions, allegiance, castellans, sieges, nobles;
                                  acceptance: Prototype D, "The Dispossessed Lord"
Phase 9   "Kingdoms & Houses"   — battles and the company at a bigger scale with command in layers,
                                  realms, diplomacy, founding a kingdom, rebellion, armies, houses,
                                  the lords' loose ends, modding and a second world
Phase 10  "Ways In"             — map speed and a Wait screen, one world (the coast joins the map), walkable
                                  capitals, a kingdom to start in, five origins with their own opening quests
                                  into one common quest, the main story from anywhere, onboarding, the UI
                                  toward the references, women soldiers; graphics when they fit
```

Each phase ends playable, measured and documented. The order follows the design's dependency map (Part 2 §26.6) with one change: **the world grows first**, at the owner's request.

## 3. Phase W — "A Bigger World"

**Readiness labels:**
- **Ready:** specified enough to implement now.
- **Ready after decision:** waits on an owner decision in §8.
- **Specified:** detailed, re-checked when the task starts.
- **Provisional:** an outline that will be specified when its phase starts.

| ID | Task | Readiness | Size | Needs | Save |
|---|---|---|---|---|---|
| **W-00** | ✅ **Done in 2.1.0.** **Browser regression testing** (new): Playwright on the static game; smoke and flow tests for startup, creation, loading a fixture save, map, settlement, battle, save/export/import, layouts; screenshots of key screens; a CI job. W-01 and W-02 add their own tests to it | Done (D-T1: yes) | **M–L** (5–8 days) | — | — |
| **H-01** | ✅ **Done in 2.1.1.** **Test and measurement hygiene** (new): isolate test games from each other; split fast and slow tests; `scripts/parity.js` (fought versus auto-resolve); a map-simulation benchmark; `.gitattributes` for line endings | Done | S | — | — |
| **W-01** | ✅ **Done in 2.2.0.** **Text size and UI scale:** four sizes; all HTML and canvas text, buttons, menus, overlays, tips and dynamic content; no reload; layout and touch-target rules; automated tests at all four sizes | Done (D-R1 phone numbers pending) | M | W-00 | — |
| **W-02** | ✅ **Done in 2.3.0.** **World-map camera and gestures:** a gesture-aware map input (tap, drag, pinch; no travel from a drag or pinch); a reusable camera transform kept apart from gameplay distance; zoom from "fit the map" to 2.4×; follow, pan, clamp, edge markers, hit-testing | Done (owner's phone check pending) | **M–L** | W-00 | — |
| **W-03** | ✅ **Done in 2.4.0.** **Battle zoom:** 0.75×–1.5× on the field and in the overview, with the same gesture handling | Done (phone numbers pending) | S–M | W-02 | — |
| **W-04** | ✅ **Done in 2.5.0.** **A data-driven world:** no kingdom ids, world id or 0–100 bounds in code; map bounds, start and kingdoms from the world package; a three-kingdom test world in the tests | Done | M | — | — |
| **W-05a** | ✅ **Done in 2.6.0.** **World geometry and terrain** (split from W-05): map bounds over 100; new terrain kinds (mountain, marsh, coast, ford, bridge) as passable terrain with costs; battle maps for each; a ford battle map | Done (D-W1, D-W4: defaults) | M | W-02, W-04 | — |
| **W-05b** | ✅ **Done in 2.7.0.** **The bigger region's content** (split from W-05): kingdoms, cultures, troop trees, settlements, parties, markets, garrisons, news and contracts; the asset request list for the art team; bots that read the world's boards. Old saves refused and kept (D-W2) | Done (D-W1, D-W3: defaults; D-W2: refuse old saves) | L | W-05a | — (world id) |
| **W-05c** | ✅ **Done in 2.8.0.** **New-region errands and help** (split from W-05): two or three errands outside the March; How to Play and tips for the bigger map | Done | S | W-05b | — |
| **W-06** | ✖ **Not needed** (D-W2, owner 2026-11-19: old saves are refused, not moved in). Was: saves move into the bigger world by a v10 migration | Dropped | — | — | — |
| **W-07** | ✅ **Done in 2.9.0.** **A world simulation that scales:** spatial grid, swept contacts for coarse steps, step budgets, map culling, war and peace between kingdoms (the March pair kept as the story needs) | Done (D-W5: default) | M–L | W-05b, H-01 | v10 |
| **W-08** | ✅ **Done in 2.10.0** (the owner's phone session still to come). **Tuning and acceptance** of the bigger world, with a validation section (below) | Done | S–M | W-00–W-07 | — |
| **W-09** | **Route planning** (new, optional in Phase W): a terrain-cost route planner for the player's travel and for parties; required before any impassable terrain and before P7-04's "Avoid danger" | Ready after decision D-W4 | M | W-05a | — |

**Proposed size of the world (owner decision D-W1):**
- **Area:** about four times today's, on a 200 × 200 map-unit grid at the same travel scale.
- **Kingdoms:** four (Valedorn and Aurelia as now, a northern kingdom, a southern or coastal league), plus the Reavers and a free city.
- **Settlements:** about 32.
- **The Border March** stays whole in the middle, so its story, errands and tests stay valid.

### Phase W validation (W-08, build 2.10.0, 2026-11-19)

How the bigger world was checked, as `docs/V2-VALIDATION.md` did for 2.0. Every run is headless on the real game logic; "local" is the campaign bot working where it is, "roaming" (`--roam`, new) is the same bot touring every capital's contract board and taking on lairs up to two days away.

**What was found and changed**
- **The bot, not the economy, had broken.** The economy report at 2.7–2.9 looked like a collapse next to 2.6: contracts 9–11 crowns a day against 40, 3–4 soldiers at day 60 against 17, renown halved. The cause was the campaign bot: since 2.7 it took on the nearest beatable lair *anywhere*, so it crossed the realm for one fight and spent days riding. It now takes lairs within about a day's ride (30 map units; 60 when roaming), as a player would. Nothing in the game changed for this.
- **Food follows the grain.** Rations cost 8 everywhere. They now follow the local grain price at half strength: 7 among the western farms (Oakford, Redfield, Ashby, Fernley), 8 at most markets, 9 in the highlands and the eastern March, moving with the market.
- **Checked and kept:**
  - contract pay (already per league of distance, and the bot's contract income is as before);
  - patrol and band density (about 0.4–0.8 parties per 1,000 square map units in every region; the March a little thinner than in 2.6.0, about 7 parties in it against 9);
  - road and open-ground speeds (the farthest capitals are about 1.3 days apart);
  - caravans' effect on the markets they reach.

**Economy (12 campaigns × 60 days, `npm run economy`), against V2-T1's measures**

| | 2.6.0 (the March alone) | 2.10.0 local | 2.10.0 roaming |
|---|---|---|---|
| Income per day: spoils / contracts | 44.2 / 39.5 | 47.4 / 43.8 | 54.6 / 30.7 |
| Spending per day: training, hiring, wages, food, captors, gear | 32.7, 19.0, 10.7, 7.3, 6.7, 4.7 | 37.7, 19.3, 12.0, 7.2, 6.8, 5.2 | 24.8, 20.1, 9.0, 4.8, 11.1, 11.8 |
| Money (median) at days 15 / 30 / 60 | 85 / 60 / 221 | 74 / 157 / 244 | 86 / 137 / 245 |
| Renown at days 30 / 60; level | 82 / 216; 9 | 110 / 236; 9 | 103 / 220; 9 |
| Soldiers at day 60 (T3 share) | 17 (67%) | 18 (72%) | 13 (40%) |
| Per campaign: wages short, out of food, desertions | 1.6, 0.3, 0 | 1.3, 0.5, 0.2 | 0.3, 0, 0 |

Healthy by V2-T1's measures: money grows without hoarding, and hardship is rare. A roaming company earns less from contracts (more of its time is riding between capitals), is captured more often (harder lairs and bands away from the March) and spends more on gear, but ends as rich.

**Campaign bot (8 × 60 days, `npm run simulate`):** local 418 wins, 154 losses, 182 contracts; roaming 369 wins, 207 losses, 117 contracts. **No run stuck** in either.

**Story (`npm run simulate:story`, 200 runs):** all 200 reach an ending (85 Valedorn, 98 Aurelian, 17 compromise; 2.0.0: 85 / 87 / 28). Every Q1, Q2 and Q3 branch comes up, both mirror-image Q3 sales included (7 and 6). Mara saved 135 times, lost 65. Days to an ending: median 33.8 (2.0.0: 11.7), from 8.3 to 103.1. The story bot now wanders only the March's regions, and a busier world (war and peace, more parties) slows it down; that is worth watching in the phone session, not a soft-lock.

**Prototype G (6 campaigns × 60 days, each saved at day 30, reloaded and played on):**

| Style | Money (median) | Soldiers | Won / lost | Hero down | Extra screens | Warnings | Stuck | Resumed |
|---|---|---|---|---|---|---|---|---|
| Hands-off | 229 | 17 | 358 / 117 | – | 0 | 7 | 0 | 6/6 |
| Presets | 1,893 | 20 | 434 / 10 | 55 | 38 | 3 | 0 | 6/6 |
| Expert | 1,192 | 20 | 417 / 14 | 54 | 362 | 2 | 0 | 6/6 |

All three styles are viable over 60 days and every run resumed exactly. The gap between auto-resolving and fighting in person is still wide: that is B-01's.

**Tests:** fast, slow and browser suites green at 2.10.0 (counts in the release notes).

**Waiting on the owner's phone** (W-08's acceptance, and W-02, W-03, W-05b and W-07's):
1. text sizes on the map and in battle;
2. map gestures: drag, pinch and Centre on the bigger map, at "fit" and at 2.4×;
3. battle zoom: Big battle 40 at 0.75×;
4. Debug → **Map stress 80**: fps, simulation and drawing ms and the slowest frame at both zooms (target: no slowdown spikes);
5. a look at the whole realm: labels, the lands' errands, the Beyond the March tip.

## 4. Phase 7 — "The Living Company" (independent captain)

**Exit (design §26.3):** an independent player builds a lasting company with non-combat roles, delegates, earns through trade or property, and meets dynamic consequences, without needing a title.

| ID | Task | Readiness | Size | Needs | Save |
|---|---|---|---|---|---|
| **B-01** | ✅ **Done in 2.11.0** (phone check to come). **Battle balance pass** (owner, deferred): make fought company battles harder (enemy cover and ranks, steadier enemy morale, smarter targeting) rather than inflating Simulate; target 5–15 points over the stated odds | Done | M | H-01 (parity script) | — |
| **P7-01** | ✅ **Done in 2.12.0.** Surgeon (fewer deaths, faster healing, medicine) | Done | S–M | V2-11 | v11 |
| **P7-02** | ✅ **Done in 2.15.0.** Scout (detection, pursuit warnings, route estimates) | Done | S–M | P7-04 | v13 |
| **P7-03** | ✅ **Done in 2.13.0.** Blacksmith (capped, targeted upgrades; no durability) | Done | S | V2-11 | v12 |
| **P7-04** | ✅ **Done in 2.14.0** ("Avoid danger" routes wait for W-09). Pursuit and detection (vision, night, last-seen, search, hiding; "Avoid danger" routes) | Done | **L** (was M) | W-07; W-09 for routes | v12 (optional fields) |
| **P7-05** | ✅ **Done in 2.16.0.** Officers and detached patrols (SC-17, SC-18) | Done | L | W-07 | v14 |
| **P7-06** | ✅ **Done in 2.17.0.** More companions | Done | M | P7-05 | v15 |
| **P7-07** | ✅ **Done in 2.18.0.** Soldier traits | Done | S | — | optional field |
| **P7-08** | ✅ **Done in 2.19.0.** Dynamic world events | Done | M | W-07 | v16 |
| **P7-09** | ✅ **Done in 2.20.0.** Tournament (foot-melee duels in a new one-on-one arena mode) | Done | **M–L** | — | v17 |
| **P7-10** | ✅ **Done in 2.21.0.** First business: a mill | Done | M | V2-11, W-05b | v18 |
| **P7-11** | ✅ **Done in 2.22.0.** Battle extras (formations, an objective, terrain) | Done | M | B-01, W-05a | — |
| **P7-T** | ✅ **Done in 2.23.0** (owner's play to come). Tuning and acceptance: [PHASE-7-VALIDATION](PHASE-7-VALIDATION.md) | Done | S | all above | — |

## 5. Phase 8 — "The Landed World"

**Exit (design §26.4, Prototype D):** acquire a holding, lose it, return to a landless captain's life, change allegiance and retake it, all in one save and without losing personal campaign continuity.

_Re-specified 2026-11-20 at build 2.23.0 (commit 09176e8), against the code and the design (Part 1 §4, §16, §17; Part 2 §18.4, §20, §22.5, §24.2, §25.3, §27.1–27.2, §28.1). The full specifications are in [`NEXT-TASKS.md`](NEXT-TASKS.md#phase-8--the-landed-world)._

### What Phase 8 starts from (verified at 09176e8)
- **Land never changes hands in play.** `c.owners` holds the eight forts' kingdoms; the other 23 settlements take their owner from content. Only the story (Q4 sets Greywall) and the Debug panel call `realm.setOwner`. W-07's wars bring clashes and exhaustion, never a siege, so Prototype D's "lost while away" can't happen until P8-06a.
- **Nobody in the world is a person.** Kingdoms have no rulers or lords; parties are templates (`bandit`, `patrol`, `caravan`, `detachment`). The only people are the company: soldiers, companions, followers and the hero.
- **Politics is one number per kingdom:** reputation in −100…100 shown as Friendly, Neutral or Hostile. `realm.welcomes` (no recruiting or contracts where Hostile) and the mill's owner's law are the only rights checks.
- **Garrisons are fixed content.** `realm.garrison` reads a fort's troops from data; nothing tracks losses, wages or food.
- **Captivity runs one way.** A beaten player is held, robbed and released (`time.capture`); the company never holds anyone.
- **What Phase 7 gives Phase 8:**
  - captains and the companion leading parties (P7-05), the pattern for castellans;
  - the mill with its own budget account and owner's law (P7-10), which becomes real when villages change hands;
  - the rise and archers' range (P7-11), reused on the walls;
  - the Greywall Courtyard battle map (Q4), the one walled map;
  - pursuit (`wantsPlayer`, P7-04), reused for lords who hunt a defector;
  - the expert bot and Prototype G (P7-T).
- **Save schema v18.** No fixtures exist after 2.7.0's; v19 (holdings) is the largest step since v2.

### Corrections in this re-specification
1. **P8-02 no longer needs W-06** (dropped by D-W2). Holdings migrate from v18's `c.owners`, with fixtures from 2.23.0.
2. **Holdings come first.** The order follows the design's dependency map ("explicit ownership / claims → loss / retake → fiefs → politics"): P8-02 holdings, P8-03 permissions, then P8-01 lords. P8-02 brings the rulers and lords as **people** (data, no parties); P8-01 puts the lords on the map.
3. **P8-06 is split** into **P8-06a, sieges on the map** (encirclement, preparation, starvation, surrender, relief, the AI's own sieges at war) and **P8-06b, the assault battle**. Without 06a no fort is ever lost while the player is away.
4. **Rebel, sovereign and deposed move to Phase 9** (P9-03, P9-04). P8-04 builds independent, mercenary and sworn vassal, with release, defection and expulsion.
5. **P8-07's nobles are P8-01's lords,** given needs, motives and opinions of each other. Phase 8's player is never a ruler, so Prototype F's "order" is a request: the player asks two lords for help, and the ruler's summons go through the same model.
6. **Lords don't die in Phase 8** (captured, ransomed, wounded). Succession and heirs belong to houses (P9-06).
7. **Story safety:** Greywall and Ashgate are story forts. They can't be besieged by the AI or granted until Q4 ends (as D-W5 keeps the March pair in tension), so the story's `owner` conditions keep their meaning.
8. **Readiness labels added,** with three blocking decisions (D-P8a–D-P8c) and two with defaults (D-P8d, D-P8e).
9. **Every settlement is a holding, and lords vary** (owner, 2026-11-20). Villages, forts and towns each have their own holder: a lord or the ruler. A lord may hold one place, several, or none: some lords only campaign, often a landed lord's kin. Villages are each a fief of their own, tied to a **seat** (a fort or a town) whose controller they follow in war. The first grant a player is likely to get is a village.
10. **No vacant fiefs; men and women** (owner, 2026-11-20; D-P8f, D-P8g). A conquered fief goes to its conqueror or the ruler, by the conqueror's choice (ask, suggest someone, hand it over, or keep it and risk expulsion). People have a gender; noblewomen are lords in full, and regular soldiers are men.

### The tasks, in build order
| ID | Task | Readiness | Size | Needs | Save |
|---|---|---|---|---|---|
| **P8-02** | ✅ **Done in 2.24.0.** **Holdings model:** every settlement a holding with a sovereign, legal holder (a lord or the ruler), controller, administrator, claims and seat, replacing `c.owners`; rulers and lords (landed, landless, holding several) as people with kin; the story's owner conditions kept; a read-only Realm screen | Done | **L** | W-04, W-07 | v19 |
| **P8-03** | ✅ **Done in 2.25.0.** **Permissions:** `CL.rights.may(c, who, action, place)` with readable reasons, replacing the scattered checks | Done | S | P8-02 | — |
| **P8-01** | ✅ **Done in 2.26.0.** **Lords on the map:** a `lord` party per lord, landed or landless, with intentions shown on tap; handled by encounters, auto-resolve, reinforcements, contracts, news and the battle lock; lords captured and ransomed both ways | Done | M–L | P8-02, W-07 | v20 |
| **P8-04** | ✅ **Done in 2.27.0.** **Allegiance:** independent, mercenary contract, sworn vassal; release, defection, expulsion; a consequence preview; obligations | Done | M | P8-01, P8-03 | v21 |
| **P8-05** | ✅ **Done in 2.28.0.** **Fiefs and castellans:** grants; a castellan or the default steward; policies (garrison, tax, reserves, repairs); the holding's own budget and weekly report; garrisons tracked | Done | M | P8-04, P7-05, P7-10 | v22 |
| **P8-06a** | ✅ **Done in 2.29.0.** **Sieges on the map:** encirclement, preparation, starvation, surrender, relief and resolution; the AI's lords besiege at war; warnings; anti-snowball | Done | M–L | P8-01, P8-05, V2-09 | v23 |
| **P8-06b** | ✅ **Done in 2.30.0.** **The assault battle:** a generated walled map (wall, gate, ladders, courtyard), attack and defence, Simulate's wall bonus, a Debug-panel phone test | Done | M–L | P8-06a, P7-11 | — |
| **P8-07** | ✅ **Done in 2.31.0.** **Named nobles: needs, opinions and rivalries (Prototype F):** lords' needs (land, coin, men, safety, standing); relationship, interest, obligation and fear toward the player, their ruler and each other; friends, rivals and feuds; obey, negotiate, delay or refuse with reasons; the ruler's summons; grants weighed by opinion; AI lords changing realm by the player's rules; the lords' own petitions | Done | **M–L** | P8-01, P8-04, P8-06a | v24 |
| **P8-08** | ✅ **Done in 2.32.0.** **Losing and retaking land (Prototype D):** every loss path, the landless view, claims that persist, retaking by siege or petition; Prototype D as a scripted scenario and a Debug start | Done | M | P8-02–P8-07 | optional fields |
| **P8-T** | ✅ **Done in 3.0.0.** **Tuning and acceptance:** revenue and war pace, anti-snowball runs, a landed bot in Prototype G, Prototype D and F as slow tests, a validation document | Done | S–M | all above | — |

**Version:** each task a minor version (2.24.0 on); **P8-T ships 3.0.0** (D-V1).

### Phase 8's testing additions (on top of the per-task contract, §7)
- **A scripted scenario per design acceptance:** SC-19 to SC-24 and SC-44 each become a Node test on the real campaign; Prototype D (P8-08) and Prototype F (P8-07) become slow tests.
- **Invariants checked after every world day in the bots** (design §25.3): one controller and at most one legal holder per holding; no person holding a holding of a realm they aren't sworn to; no duplicate troops, money or holdings across a change of hands; a claim never pays revenue.
- **A no-player world run** (`npm run landed`, added in P8-06a): 180 days of the world alone, reporting forts taken, sieges started, lifted and won, and each kingdom's forts.
- **Phone:** P8-06b's assault map gets a Debug-panel test like Big battle 40.
- **The bots:** a "landed" campaign style (P8-05) that swears, takes a fief and keeps the default steward; Prototype G runs it from P8-T.
- **Test tiers (§7):** the whole slow suite runs at the checkpoints after P8-01, P8-05, P8-06b and P8-T; in between, each task runs only the slow files its code reaches. Prototypes D and F join the slow suite as files of their own, so they can run alone.

## 6. Phase 9 — "Kingdoms & Houses"

Every Phase 9 task is **Specified** (2026-11-22; NEXT-TASKS has each in full). The four battle-scale tasks at its head come first (owner, 2026-11-22): armies (P9-05) need them. Each task is checked against the code when it starts.

| ID | Task | Size | Needs |
|---|---|---|---|
| **P9-B1** | ✅ **Done in 3.1.0**; the owner's phone benchmark in 3.1.1 (150 at 60 fps; the size up to 200). **Battle size, measured and raised:** a phone benchmark at 40, 60, 80, 100, 120 and 150 fighters; the performance work it shows is needed (cheaper thinking and drawing for far and idle fighters); the battle size adjustable in Settings from 20 to 150, with a default chosen by the measurement | M–L | B-01, P7-11 |
| **P9-B2** | ✅ **Done in 3.2.0.** **Proportional battles, reserves on both sides:** the field shared by army size (300 against 200 at a size of 100 fights 60 against 40), both sides feeding in reserves as their men fall, and nearby parties joining a side's reserve; waves kept only for fixed encounters | M | P9-B1, V2-09 |
| **P9-B3** | ✅ **Done in 3.3.0.** **A bigger company:** no hard cap of 20; a limit up to 200 grown by Leadership, renown, companions as officers and land; wages, food, recruits, the Party screen and the world's other parties scaled to match | M–L | P9-B2, P8-05 |
| **P9-B4** | ✅ **Done in 3.4.0** (big battles' parity to P9-T). **Command in layers:** divisions you name and fill, formations per division, and four depths of command, each optional: none (a good plan chosen for you), orders by troop type, captains and placing each division, and live command on the field (timed flanks, falling back before a volley) | L | P9-B2 |
| **P9-B5** | ✅ **Done in 3.5.0** (balance at a battle size of 40 to P9-T). **The walls at the world's scale** (owner, 2026-11-22: a small task before P9-L1). P9-B3 made the garrisons three times bigger, but the walls' assault still fed them in waves of 8, so storming a fort became easy. The assault re-fitted for armies: one army a side sharing the field, the part of the garrison on the stretch under assault, ladders that take two at a time, and a stalled army withdrawing whole | S–M | P9-B3, P9-B4 |
| **P9-01** | ✅ **Done in 3.7.0** (the league's council at war, and the treasuries' growth, to P9-T). **Realms as organisations:** a treasury per realm (the crown's tenth, its own land, tolls; mercenaries, garrisons, ransoms paid from it), the ruler's purse separate, laws (a crown or a league, the crown's share, succession, the cap of fiefs, who declares war), offices (marshal, steward, chancellor) | M–L | P8-05, V2-11 |
| **P9-02** | ✅ **Done in 3.8.0** (trade and access with no effect yet; how often pacts break, to P9-T). **Diplomacy and treaties:** peace, truce, nonaggression, alliance, military access, trade and tribute, with dates, terms and breach; trust between realms; the AI treating by its interests; a Diplomacy tab | M | W-07, P9-01 |
| **P9-03** | ✅ **Done in 3.9.0** (no AI realm founded in the 180-day runs, to P9-T; your own treaty offers later). **Founding or taking a kingdom:** realms founded in play (D-P9f), independent holdings, recognition, vassals, ruling delegated to officers by policy (SC-41), by the player or an AI lord | L | P8-04, P8-08, P9-01, P9-02 |
| **P9-04** | ✅ **Done in 3.10.0** (no rising in a year of the world alone, to P9-T). **Rebellion and deposition:** grievances into factions around a claimant, warnings, the ruler's responses, demands, civil war and its outcomes; the deposed play on (SC-26, SC-27) | L | P8-07, P9-03 |
| **P9-05** | ✅ **Done in 3.11.0** (armies often go home with nothing to do; no capital fell in five worlds of 180 days; to P9-T). **Armies and campaigns:** armies of several parties under a commander, raised by summons, with objectives (besiege, relieve, raid, pursue, defend) and supply; battles of armies; capitals that can fall (D-P9h) | L | P8-06a, P8-06b, P9-B4, P9-01 |
| **P9-06** | ✅ **Done in 3.12.0** (open for P9-T: few marriages; Valedorn lost every fort on one landed seed; Phase 8 exit, Prototypes D and F fail since 3.11.0). **Houses, marriage and claims:** houses as entities, marriage with agency (the player too), deaths (D-P9g), succession by the realm's law, claims that outlive their holder; no generations by default | M–L | P8-07, P9-01, P9-04 |
| **P9-L1** | ✅ **Done in 3.6.0.** **The living lords' loose ends** (from P8-07 and P8-08): lords ransoming each other's kin, asking each other for men, the land-hungry seeking sieges beyond the summons, the "escort my caravan" petition, and getting a lost fort back for service as well as for a price | M | P8-07, P8-08 |
| **P9-07** | ✅ **Done in 3.13.0** (open for P9-T: packs tried in the desktop pane only; the official world stays in data/*.js). **Modding:** the world package as a documented JSON format, namespaced ids, data-only packs in IndexedDB with precise errors, saves tied to their packs (SC-33) | M–L | W-04 |
| **P9-08** | ✅ **Done in 3.14.0** (open for P9-T: the coast's wars end in a truce within days and seldom return; played in the desktop pane only). **Creator tools and a second world:** a pack checker, a map preview, a smaller second official world the bots play | L | P9-07 |
| **P9-T** | ✅ **Done in 4.0.0** (open for P10-00: wars on 9–18% of days, few risings, a realm can lose its last fort). **Tuning and acceptance:** (no run over 20 minutes; the long runs and the checkpoint moved to P10-00, owner 2026-11-24) a ruler style in Prototype G, design §18.9 as a scripted campaign, SC-01–44 accounted for, `docs/PHASE-9-VALIDATION.md` | M | all above |

## 6b. Phase 10 — "Ways In"

**Specified 2026-11-24 with the owner, and re-ordered the same day.** You choose a kingdom and one of five origins. Each origin's opening quest is a small tutorial that leads to the same common quest. After it the world is open, as in Mount & Blade: the main story can be followed, or the world played as a sandbox. The owner may add tasks from play. The full specifications are in NEXT-TASKS.

| ID | Task | Size | Needs |
|---|---|---|---|
| **P10-00** | **Phase 9's long runs and checkpoint** (moved from P9-T): the 20- and 100-year tools, built on short slices the evening of the night run; then the night run (the long runs, the whole slow suite, the full browser suite, `docs/PENDING-CHECKS.md`). Runs only when the owner asks for the night run; the next task fixes what it found | M | — |
| **P10-01** | ✅ **Done in 4.1.0.** **Map speed and the Wait screen:** Normal (1 game hour a second, the new default) and Fast (4, today's), a HUD button and a setting, and a hint; a Wait screen of days and hours that fades out and back, runs the world on, and stops for an encounter | M | P9-T |
| **P10-02** | **One world:** the Sundered Coast joins the map as a region; the world chooser and the second official world go; older saves refused | M–L | P10-01 |
| **P10-03** | **Walkable towns:** every capital and free city, each with its own layout and people | L | P10-02 |
| **P10-04** | **Choose your kingdom, and the main story from anywhere:** a start town per realm; the story's people and places by role; Q1 becomes the common quest | L | P10-03 |
| **P10-05** | **Origins, the frame and the first three:** the unhorsed traveller, the impoverished noble, the farmhand; every origin ends in about the same state, with one small edge | L | P10-04 |
| **P10-06** | **Origins, the scout and the peddler,** and the balance check over all five | M | P10-05 |
| **P10-07** | **Onboarding and hints:** a guide for the main beginner steps with any origin, hints for the rest, one setting to turn them off, How to Play by stage | M | P10-06 |
| **P10-08** | **UI and menus** toward the references (renderer changes allowed; partial is fine) | L | P10-07 |
| **P10-09** | **Women soldiers** in two realms and one bandit type (15% of recruits, their own lines), and a few placeholder portraits | M | P9-T |
| **P10-G1** | **Graphics, battles,** toward the references, whenever it fits (renderer changes allowed; partial is fine) | L | — |
| **P10-G2** | **Graphics, towns,** toward the references, whenever it fits (renderer changes allowed; partial is fine) | L | P10-03 |
| **P10-T** | **Tuning and acceptance:** the world's open tuning (wars, risings, deaths), the old failures, the origins' balance, `docs/PHASE-10-VALIDATION.md`; ships 5.0.0 | M | all above |

## 7. Order, versions, saves and the per-task contract

### Order
1. **W-00, then H-01.** Browser tests and test hygiene come first, so every later task can add tests and measure reliably.
2. **W-01 and W-02,** each extending W-00's browser tests. Then **W-03**.
3. **W-04** (data-driven world, no hard-coded bounds). It can run in parallel with W-01–W-03, since it touches different files.
4. **W-06's fixtures:** generated from the real 2.0.0 build **before** any content changes (as for every earlier schema step).
5. **W-05a,** then **W-05b + W-06 together in one build,** then **W-05c**. (2026-11-19: W-06 dropped by decision D-W2; W-05b refuses old saves instead, in 2.7.0.)
   
   **Why together:** a build with the bigger map but no migration would load 2.0 saves with unshifted coordinates; with `main` deployed to Pages, that would hit real players.
6. **W-07,** then **W-08.** **W-09** if the owner chooses impassable terrain (D-W4), or before P7-04's "Avoid danger" routes.
7. **B-01** early in Phase 7, then Phase 7 roughly in table order (P7-04 before P7-02; P7-05 before P7-06).
8. **Phase 8** in the build order of §5 (re-specified 2026-11-20): P8-02, P8-03, P8-01, P8-04, P8-05, P8-06a, P8-06b, P8-07, P8-08, P8-T. W-09 is not needed: sieges and lords move on passable terrain.
9. **Phase 9** (specified 2026-11-22): **P9-B1, P9-B2, P9-B3, P9-B4, P9-B5**, then **P9-L1**, **P9-01, P9-02, P9-03, P9-04, P9-05, P9-06, P9-07, P9-08**, **P9-T**. P9-B1's phone measurement decides how far P9-B2 and P9-B3 can go. Each task is a minor version from 3.1.0; P9-T ships 4.0.0. Whole-suite checkpoints after P9-B2, P9-B4, P9-04 and P9-06; P9-T's moved to P10-00 (owner, 2026-11-24).
10. **Phase 10** (specified 2026-11-24, re-ordered the same day): **P10-01** to **P10-09**, then **P10-T**. **P10-00** runs on the owner's night run, whenever asked. The graphics tasks **P10-G1** and **P10-G2** go in whenever they fit. Each task is a minor version in build order from 4.1.0; P10-00 is a patch; P10-T ships 5.0.0. No fixed whole-suite checkpoints: a task that needs a long run asks "now, or the next run?", and deferred checks go in `docs/PENDING-CHECKS.md`.

### Versions (owner decision D-V1)
- Proposed: each finished task bumps the minor version (2.1.0, 2.2.0, …); fixes bump the patch.
- The end of Phase 8 ships **3.0.0**, the end of Phase 9 **4.0.0**, the end of Phase 10 **5.0.0**.
- H-01 and documentation-only work bump the patch.

### Save schema steps (each with a migration, fixtures from the build before it, and SAVE-FORMAT updated)
| Schema | Task | Change |
|---|---|---|
| — | W-05b | No schema step: the world id changed (`sundered_realm`), so saves of the old March are refused and kept (D-W2). v10 is free for the next change |
| v10 | W-07 (2.9.0) | Relations between kingdoms (war, peace) |
| v12+ | Phase 7 tasks with "Save: yes", in the order they ship | One step per task, never two tasks in one step |
| v19 | P8-02 | Holdings and people: `c.owners` → `c.holdings`, rulers and lords in `c.people`. Fixtures from 2.23.0 first (`tests/fixtures/saves-2.23/`) |
| v20 | P8-01 | Lords' parties, prisoners (`c.prisoners`) |
| v21 | P8-04 | Allegiance (`c.allegiance`) |
| v22 | P8-05 | Fief administration: garrisons, policies, prosperity, the holding's book |
| v23 | P8-06a | Sieges (`c.sieges`) |
| v24 | P8-07 | Nobles' opinions (of the player, the ruler and each other), debts, petitions and history |
| v25 | P9-01 | Realm treasuries and books, offices, laws where they differ from the data |
| v26 | P9-02 | Treaties, trust between realms |
| v27 | P9-03 | Realms founded in play, the player's realm and policies, independent holdings |
| v28 | P9-04 | Factions, demands, rebellions |
| v29 | P9-05 | Armies, raids' effects |
| v30 | P9-06 | Houses, marriages, deaths, heirs |
| (none) | P9-07 | A save's packs: an optional `packs` field, so no schema step (3.13.0) |
| (none) | P9-08 | A save's world was already recorded (`worldId`); a save of the other official world opens that world (3.14.0) |
| later | Phase 9 | Re-specified at its start |

**Device settings** (text size, zoom levels) need no schema step. They live in `crownless_settings`, whose loader already fills missing keys with defaults.

### The per-task contract (from v2, `docs/V2-PLAN.md` §5, with additions)
- **Green:** `npm test` and `npm run lint` pass. From W-00 on, the browser tests pass too. From P8-01 on, the longer suites run where a task needs them and at checkpoints (owner, 2026-11-20; "The test tiers" below).
- **Tested:** new logic gets Node tests. New screens, controls or gestures get browser tests (W-00). New saved state gets a migration, fixtures and a save round-trip test.
- **Played:** checked in a real browser at desktop and phone landscape size (812×375). Performance-sensitive tasks (W-03, W-05, W-07, P8-06, P9-05) add or extend a Debug-panel test for the owner's phone, as PROTO-A and SC-34 did.
- **Explained:** How to Play and the first-time tips cover new player-facing systems. Debug tools cover new state, so testers can reach it.
- **Art:** tasks that add places, troops or icons write an **asset request list** for the art team (`docs/ASSETS.md`) and ship with placeholders. Art never blocks a task.
- **Versioned:** the version in its five places; ROADMAP, this plan, NEXT-TASKS (marked done), README and the v1 documentation updated; SAVE-FORMAT for schema steps.
- **Owner-gated:** commits only when the owner asks; never push, tag, open pull requests or publish releases.

### The test tiers (owner, 2026-11-20)
The slow suite takes about 28 minutes, nearly all of it the 60-campaign story check (`tests/slow/gate-d-campaigns.test.js`, about 27 minutes; the other eleven take 1–2½ minutes each and run beside it). The full browser suite takes about 3 minutes. So, from P8-01 on:

| Tier | What | When |
|---|---|---|
| **Every task** | `npm test` and `npm run lint`; the task's own browser specs, desktop and phone; `layout`, `text-size` and `settlement` specs when the task changes a screen, the HUD, `index.html` or `style.css` | Always |
| **Full browser suite** | `npx playwright test` | When a task changes shared UI (the HUD, the settlement menu, the overlay, `style.css`, `index.html`), and at every checkpoint |
| **The slow files the task touches** | `node --test tests/slow/<file>` for each one the task's code reaches (table below) | When the task changes what they exercise |
| **The whole slow suite** | `npm run test:slow` | At the checkpoints: after **P8-01**, **P8-05**, **P8-06b** and **P8-T** (every two or three tasks), and before any build the owner plays on the phone |

| Slow file | Exercises | Run it when a task changes |
|---|---|---|
| `gate-d-campaigns` (≈27 min) | Every quest and ending from a fresh start (60 seeds), and the sandbox after the ending | The story, quests, dialogue, the story forts or their villages, anything that can move Greywall or Ashgate, or travel inside the March |
| `battle-parity`, `battle-extras` | Fought against simulated odds; formations, high ground, the wagon | Combat, units, auto-resolve, reinforcements, battle maps (P8-06b's assault) |
| `campaign-bots` | No stalls over eight seeds; a short Prototype G | The campaign loop: money, wages, recruiting, contracts, encounters, the bots' styles |
| `world-sim` | 80 parties over 90 days, save size, long rests | World parties, their counts and budgets (P8-01's lords), anything new in the save that grows with time |
| `happenings-bots` | World events over 90 days | World events, or what they depend on (owners, parties) |
| `phase7-exit` | Followers, detachments, the mill and events over 90 days | Followers, detachments, businesses, the accounts |
| `test-world` | The three-kingdom test world plays and reloads | The world package, its data rules (seats, nobles), anything that might assume the Sundered Realm |

Each task's report says which tiers ran, and which slow files were skipped and why. A checkpoint that fails is fixed before the next task starts.

### From P9-L1: one task, one section (owner, 2026-11-23)
Each remaining Phase 9 task in `docs/NEXT-TASKS.md` ends with a **Brief**: where to start in the code, the defaults already decided, the save step, the build order, the tests to write, the exact checks to run, what to play and what to leave out. The way of working that goes with it is in NEXT-TASKS ("How each task runs from P9-L1"). In short: read only the task's section; run each check once (the task's own Node files while building; `npm test` and lint at the end; only the named browser specs and slow files); tune a number at most twice and leave the rest to P9-T; note failures outside the task and don't fix them there; play only what the Brief names; keep the Done paragraph to eight bullets. The tiers above still hold at the checkpoints (after P9-04, P9-06 and P9-T).

## 8. Decisions for the owner

Decisions marked **blocking** must be made before the named task starts. The others have a working default.

| ID | Question | Proposed default | Blocks |
|---|---|---|---|
| **D-T1** | Add Playwright as the project's first **development** dependency (with a `package-lock.json`)? | **Decided yes (owner, 2026-11-18):** `@playwright/test` 1.64.1, pinned, Chromium only; the game itself stays dependency-free | W-00 (done) |
| **D-T2** | Where are screenshot baselines authoritative? | CI's Linux Chromium; local runs check behaviour and skip pixel comparison unless asked (fonts and rendering differ between machines) | W-00 |
| **D-W1** | How big should the world be? | About 4× today's area (200 × 200 map units), four kingdoms plus the Reavers and a free city, about 32 settlements. **Owner, 2026-11-18: the default.** | **W-05a, W-05b (blocking)** |
| **D-W2** | Keep the Border March inside the bigger world, and move existing saves in? | Yes and yes: the March whole in the middle at a fixed offset; every save migrates (W-06). **Owner, 2026-11-19: keep the March, but refuse old saves (kept safe, not migrated); W-06 dropped.** | W-05b, W-06 |
| **D-W3** | New kingdoms' names, cultures and feel? | Placeholder names fitting each culture, data-driven and renameable later; troop lines with a distinct style each (northern heavy infantry, southern crossbows and light horse). **Owner, 2026-11-19: the default.** | W-05b |
| **D-W4** | Impassable terrain (rivers crossed only at fords and bridges, mountains)? | **No in Phase W:** all terrain passable at a cost (rivers very slow except at fords and bridges); impassable terrain only after W-09 route planning. **Owner, 2026-11-18: the default.** | W-05a |
| **D-W5** | The two March kingdoms in W-07's war and peace | Valedorn and Aurelia stay at "tension" (frontier clashes, as now) until Q4 ends; the endings set peace (road peace) or war (one side holds Greywall). **Taken as the default in 2.9.0 (not blocking).** | W-07 |
| **D-Z1** | Zoom range | Map: from "fit the whole map" to 2.4× (on today's 100 × 100 map that means no zoom-out below 1×); battle: 0.75×–1.5×; text size: four steps | W-02, W-03 |
| **D-R1** | Sharper canvas: draw the canvas at the screen's pixel density instead of a fixed 960×540? | **Not in Phase W by default.** W-01 and W-02 work at 960×540. W-01 measures a backing store at `min(devicePixelRatio, 2)` × 960×540 with the Debug-panel battle and map tests on the Zenfone. It's adopted only if the frame budget holds (60 fps, about 2 ms of drawing); otherwise it goes to the backlog. **2.2.0:** the switch is in (Debug → Sharp canvas; the practice result names the canvas mode); waiting on the owner's phone numbers | W-01 (measurement only) |
| **D-V1** | Version numbering after 2.0 | Minor per task; 3.0.0 at Prototype D; 4.0.0 at the end of Phase 9 | — |
| D-P7a | First follower in Phase 7 | Surgeon | P7 order |
| D-P7b | First business | A mill, then an inn | P7-10 |
| D-P7c | Tournament format | Foot-melee duels in a capital | P7-09 |
| **D-P8a** | How deep sieges go at first | One generated assault map (a wall with a gate and ladder points, a courtyard to fall back to); preparation as ladders (1 day) and a ram (3 days); a starvation track of the fort's food days; surrender when food runs out or the odds are hopeless. No towers, engines or second walls **Owner, 2026-11-20: the default.** | P8-06a, P8-06b |
| **D-P8b** | Which settlements are holdings? | **Every settlement of a kingdom** (villages, forts and towns), each with its own holder, a lord or the ruler; villages tied to a seat (details below the table) **Owner, 2026-11-20: the default.** | P8-02 |
| **D-P8c** | Who are the people of the realms? | **One ruler and about six lords per kingdom:** great lords with a fort, lesser lords with a village, and landless lords who only campaign, with kin ties; about 24 lord parties; lords never die in Phase 8 (details below the table) **Owner, 2026-11-20: the default.** | P8-02, P8-01 |
| D-P8d | How does a player first get a holding? | **Granted by the liege** to a sworn vassal when the crown has a holding to give (one handed to it after a conquest, D-P8f; one taken back from a lord held unransomed for 30 days; one left by a lord who left the realm), or from the crown's own villages after long service. A holding is never vacant: until the ruler grants it, the ruler holds it. The liege weighs the vassals who did most in its taking, the landless lords, service days and renown, so **AI lords compete** for grants. A player's first grant is most likely a **village**; a fort comes with more renown and service. A lord may hold up to three fiefs (tuned in P8-T). An independent who takes a fort must hand it to a kingdom (a reward, or swear and hold it); holding land as an independent is sovereignty (P9-03) | P8-05 |
| D-P8e | What survives a loss or a change of allegiance? | **Always kept:** the person, the warband, money, followers, companions and businesses (under the local law). **A claim persists** after a fort is taken, until renounced; it gives no income or control (§25.3). **Released** from an oath: the fief goes back to the crown, no claim. **Defected or expelled:** the fief is lost but the claim travels with you, and a new liege may back it | P8-04, P8-08 |
| **D-P8f** | Who holds a fief after a conquest? | **Never vacant** (owner, 2026-11-20). It goes to whoever took it, or to the ruler. The conqueror (an AI lord or the player, if not the ruler) chooses one: **ask the liege for it** (the liege decides), **suggest someone** they like (their relationship grows), **hand it to the ruler outright** (relationship and influence with the ruler grow) or **keep it** without asking (the ruler may accept, or expel them and send lords to retake it). When the ruler took it, or it was taken in the ruler's name, the ruler decides who gets it, the player included once they can be a ruler (Phase 9). The same choices and rules for AI lords and the player. **Owner, 2026-11-20: decided.** | P8-02 (no vacant holder), P8-05, P8-06a, P8-07 |
| **D-P8g** | Men and women | **Owner, 2026-11-20: decided.** People of the realms have a `gender`. Noblewomen are lords in full: they hold fiefs, lead parties and can be rulers (queens); followers can be women too. **Regular soldiers (levies and every troop line) are men.** Women soldiers come later as their own troop types. The hero keeps the gender chosen at character creation | P8-02 |
| D-A1 | When art, commercial, packaging and demo come back | After the art team delivers; an art-integration task then | — |
| **D-P9a** | How large may a battle be, and who sets it? | **Owner, 2026-11-22:** adjustable in Settings, from 20 up to **150** fighters on the field at once; the default is the largest size the owner's phone holds at 30 fps or better in P9-B1's benchmark (100 is the hope). Battles of 200 at once are not a goal. **Owner, 2026-11-22, at P9-B1's start (the defaults):** the deployment grows with the size; the benchmark runs on an open field that grows with the size; a device still on the old default moves to the new one (once: a device that never chose follows the default); 60 fps stays the target at 40, 30 fps applies to the larger sizes. **3.1.0:** a provisional default of 100 on a computer and 60 on a phone, until the owner's benchmark. **Owner's phone, 2026-11-22 (3.1.1):** every size from 40 to 150 at 60 fps (at 150, 2.4 ms of simulation and 2.6 of drawing a frame); "smooth and playable; we could even go bigger". The default is now 150 everywhere, and the size goes up to **200** (a choice, not the default, until a benchmark shows 200 holds) | P9-B1 |
| **D-P9b** | How large may the company be? | **Owner, 2026-11-22:** up to **150–200**, not 20; it grows with Leadership, renown, companions (as officers) and land, with a hard ceiling (200 proposed). Those beyond the field come in as reserves | P9-B3 |
| **D-P9c** | How are big armies shared on the field? | **Owner, 2026-11-22: as in Mount & Blade.** Each side's share of the field is its share of the fighters (300 against 200 at a size of 100: 60 against 40, never fewer than 10 a side); both sides send reserves in as men fall, keeping that share; a fixed encounter (a lair, a story fight) keeps its waves | P9-B2 |
| **D-P9d** | How large may a save be? | **Owner, 2026-11-22: up to 10 MB; never optimise for size.** The world-sim test's limit is 4 MB (from 100 KB), because the browser's `localStorage` holds about 5 MB; past that the save moves to IndexedDB (a task when a save nears 4 MB) | — |
| **D-P9e** | How deep is command in battle? | **Owner, 2026-11-22: in layers, every one optional.** 1: no orders, a good plan chosen for you from your soldiers and the field; 2: orders by troop type (cavalry follow me, infantry charge, archers hold); 3: captains and placing each division; 4: live command on the field (positions, coordinated flanks, falling back before your archers loose). Defaults must make the first layer fun | P9-B4 |
| **D-P9f** | Can realms that aren't in the data appear in play? | **Owner, 2026-11-22: the default. Yes.** A realm founded by the player or an AI lord (P9-03) or by rebels (P9-04) is a realm like the data's, with a name its founder chooses, a banner colour from a palette, its capital's culture and troops, and P9-01's laws; every "is this a realm?" asks `realm.realms(c)` | P9-03 |
| **D-P9g** | Do people die? | **Owner, 2026-11-22: the default.** Lords may die rarely, of wounds after a lost battle; of old age only with a setting on (off by default); the player never dies unless a later setting says so (permadeath is in the backlog). No births or ageing (the founding-house model, design §19.3) | P9-06 |
| **D-P9h** | Can capitals fall, and realms end? | **Owner, 2026-11-22: the default. Yes, from P9-05.** A capital besieged by an army is the hardest siege; taken, its ruler moves the seat; a realm with no holdings left is gone, and its lords seek service elsewhere | P9-05 |
| **D-P9i** | How long are the long runs? | **Owner, 2026-11-22: the default.** 20 simulated years in the slow suite, 100 years in an overnight script (`npm run long-run`), both with delegated rulers and no player. **Owner, 2026-11-24:** moved to P10-00 | P10-00 |
| **D-P10a** | Long runs in Phase 10 | **Owner, 2026-11-24: decided.** A run over 20 minutes or overnight is suggested with its length, and runs only on the owner's explicit yes. The owner may ask for a full overnight run at any time; it then does every pending check | all of Phase 10 |
| **D-P10b** | How does a game begin? | **Owner, 2026-11-24: decided.** There is no default start. You choose a kingdom and an origin (five: today's three backgrounds rewritten, the unhorsed traveller and the impoverished noble). Each origin's opening quest ends in the same common quest and about the same state (one small, balanced edge each). The main story is playable from any kingdom and origin, and optional. No start inside politics | P10-04 to P10-06 |
| **D-P10c** | Onboarding | **Owner, 2026-11-24: decided.** A guide for the main beginner steps only, with any origin; hints for everything deeper; one setting turns them off | P10-07 |
| **D-P10d** | Women soldiers | **Owner, 2026-11-24: decided.** In a couple of realms and one bandit type, not more. Mixed into the normal recruits at 15% (85% men), with their own progression. A few generic portraits with varied hair and beards, not one each | P10-09 |
| **D-P10e** | Map speed and art | **Owner, 2026-11-24: decided.** The map starts slow, and today's speed stays available with a toggle and a hint. An art pass toward the references, partial updates allowed. **Later the same day:** split into the UI and menus (P10-08, the priority) and graphics (P10-G1, P10-G2, whenever they fit) | P10-01, P10-08, P10-G1, P10-G2 |
| **D-P10f** | Long runs, step by step | **Owner, 2026-11-24: decided.** No environment-variable gates. After a task that needs a long or night run, ask: now, or the next run? Deferred checks are written in `docs/PENDING-CHECKS.md`. The night run does them all, with P10-00; the next task fixes what it found | all of Phase 10 |
| **D-P10g** | Old saves | **Owner, 2026-11-24: decided.** Ignored completely: no migrations, fixtures or old-save tests. New state gets defaults; a changed world refuses older saves | all of Phase 10 |
| **D-P10h** | One world | **Owner, 2026-11-24: decided.** No separate sandbox world: the whole game is a sandbox with a minor story. The coast joins the main map; its realms may be reworked. The world-package loader stays for packs | P10-02 |
| **D-P10i** | Wait | **Owner, 2026-11-24: decided.** A Wait screen with days and hours: the screen fades out, the world moves on as it would, it fades back and says how long passed. A band or lord reaching you stops the wait, says so, and opens the encounter | P10-01 |
| **D-P10j** | Towns and the story | **Owner, 2026-11-24: decided.** Every capital and free city is walkable, none alike, before the story task. The story is cast to fit each kingdom, with characters added as needed; every origin's tutorial leads into the common quest (Q1, which keeps its ending), then the open world; the end is the same for every start. `gate-d-campaigns` splits and reduces its seeds | P10-03, P10-04 |

### D-P8b and D-P8c in full (owner, 2026-11-20: the defaults, accepted)

**D-P8b, holdings.** Every settlement of a kingdom is a holding, with its holder set in the world data at the start:
- **Villages** are fiefs of their own: revenue, a militia, no walls. Each is tied to a **seat**, a fort or town of the same kingdom, and follows the seat's controller in war. When the seat falls, its villages pass to the conqueror, who grants them anew, and their holders keep claims.
- **Forts** have walls and a garrison, and can be besieged (P8-06a).
- **Towns:** in this world, the four capitals and Merrow. Each capital is its ruler's own holding and isn't besieged in Phase 8 (P9-05). The model lets a town be held by a lord, for later worlds or a ruler's grant.
- **Merrow,** the free city, has no fiefs.

**D-P8c, people.** Per kingdom, one ruler and about six lords, each lord with a party on the map:

| Who | Holds | Per kingdom |
|---|---|---|
| **The ruler** | The capital and a village; stays at the capital (not on the map in Phase 8) | 1 |
| **Great lords** | A fort, usually with a village | 2 |
| **Lesser lords** | A village | 1–2 |
| **Landless lords** | Nothing; they campaign. A landed lord's son, daughter, brother or cousin, or a household knight of the ruler | 2 |

- That is about 4 rulers and 24 lords, with culture names.
- **Kin ties** (`kin`) link lords to each other and to rulers. They feed opinions (P8-07: what you do to one, their kin remember) and grants (a landless lord is first in line for a fief the ruler gives).
- **Men and women** (D-P8g): each person has a `gender`; lords and rulers are of either, and so are their parties' leaders. Regular soldiers are men.
- **No holding is ever vacant** (D-P8f): every holding has a holder at all times, a lord or the ruler.
- **No fixed classes** (owner, 2026-11-20). Rank is never stored: it is what a person holds and which office they have now, and the same rules apply to every lord and the player. The ruler is an **office** (`c.rulers`), not a kind of person: it doesn't move in Phase 8, but in Phase 9 a lord can become a ruler, and a ruler can be deposed and ride on as a lord.
- **Holdings move between lords in play:** a landless lord granted a village becomes a lesser lord; a lord who loses their only fief becomes landless and campaigns on. No lord holds more than three fiefs (tuned in P8-T). The ruler's office isn't capped: what the crown holds until it grants it counts as the ruler's, so a ruler may hold more.
- Merrow is ruled by a council (no person).
- Lords are captured, ransomed and wounded but **never die in Phase 8**; heirs come with houses (P9-06).

## 9. Risks

| Risk | Guard |
|---|---|
| Map gestures set off travel by accident | W-02's gesture state machine; Node tests of it and W-00 browser tests that drag and pinch without travelling |
| A bigger world slows the phone | W-07 grid, swept contacts and budgets; H-01's map benchmark; W-02's cached terrain layer and culling; a Debug-panel map test for the Zenfone that reports drawing and simulation ms |
| Saves grow too large for `localStorage` or too slow to write on the phone | Owner, 2026-11-22 (D-P9d): up to 10 MB is fine; nothing is optimised for size. The browser's `localStorage` holds about 5 MB, so the world-sim test fails past 4 MB, and the save moves to IndexedDB before it gets there. W-07 measured a save write on the phone |
| An old migration changes meaning when content changes later | Migrations stay pure: W-06's offset is a constant written into the migration, never read from the current world data |
| Saves broken between builds | W-05b and W-06 ship together; fixtures from 2.0.0 before content changes; the pre-migration copy; SC-33's protections |
| Hidden 0–100 assumptions | W-04 removes every hard-coded bound, with a test that the literals are gone and a test world bigger than 100 |
| Coarse world steps miss contacts or change outcomes | Swept (segment) contact tests; bots re-baselined and the change documented; determinism tests |
| Screenshot tests are flaky | Baselines only from CI's Linux Chromium (D-T2); behaviour tests separate from pixel tests; a documented update procedure |
| Scope creep (the design is huge) | Each phase has a stated exit; ideas failing the design's prioritisation rule (Part 2 §26.7) go to the backlog |
| Management fatigue as holdings and nobles arrive | Defaults that work hands-off; Prototype G repeated each phase; "forced screens" counted |
| One kingdom swallows the others once sieges exist | Design §20.7: one siege per realm at a time; sieges only at war, and wars end by exhaustion (W-07, now counting siege losses); a taken fort starts with half a garrison and 30 days of unrest; lords go home to refill after a siege; no free armies. `npm run landed` runs 180 days of the world alone (P8-06a, P8-T) |
| The holdings migration breaks the story or old saves | Fixtures from 2.23.0 before any change (P8-02); a test that every story `owner` condition reads the same before and after migration; story forts locked until Q4 ends |
| Land brings chores | A default steward and balanced policies (P8-05); one weekly holding report folded into the week's log; a landless player sees a short claims view, never an empty chores screen (SC-21); forced screens counted in Prototype G (P8-T) |
| Balance drifts as features stack | A tuning task closes every phase, with the bots, the parity script and the owner's phone |

## 10. Backlog (not scheduled)

- **A-01, keyboard and screen-reader accessibility review** (separate from W-01's text scaling): focus order, visible focus, labels on icon buttons, live regions for the message line, and what a canvas game can offer screen-reader users.
- Other languages (English only for now).
- Generational play (heirs), permadeath and ironman settings.
- Follower capture and rescue; parties that raid baggage or shadow survivors (V2-09 "not done").
- The merchant choosing its own routes; per-good quartermaster rules beyond P7-01's medicine.
- Waypoints and target priorities in battle.
- Splitting `js/ui.js`. Do it when a task touches a part anyway, never as a standalone rewrite.

## 11. Review log

**2026-11-18, review of commit c66d94c (owner's review instructions).** IDs kept; nothing removed from the vision.

1. **Added W-00, browser regression testing,** before W-01 and W-02 (owner). Playwright needs the owner's yes as the first development dependency (D-T1).
2. **Added H-01, test and measurement hygiene.** The test-game state leak, fast and slow test split, the parity script and a map benchmark were in the backlog, but B-01, W-07 and W-08 depend on reliable measurements.
3. **W-01 strengthened (owner):**
   - everything that shows text, no reload, the realistic phone sizes;
   - touch targets of at least 44 CSS px;
   - no information lost to truncation;
   - zoom limits documented;
   - tests at all four sizes.
   
   Screen-reader and keyboard work moved to its own backlog item (A-01).
4. **W-02 made explicit (owner):**
   - a gesture state machine replacing travel on pointer-down;
   - a reusable camera transform separate from gameplay distance;
   - zoom never affecting rules;
   - the behaviour below "fit" defined;
   - tests that drag and pinch never travel.
5. **W-04 now removes every hard-coded 0–100 bound** (about 15 places, listed in §1). Namespaced ids moved to P9-07 (they'd ripple through validators for no Phase W gain).
6. **W-05 split into W-05a, W-05b and W-05c.** It was one "L" covering terrain, four kingdoms of content, text and errands.
7. **W-05b and W-06 must ship in one build,** and W-06's fixtures must be made before content changes. In separate builds, 2.0 saves would load with unshifted coordinates.
8. **W-09, route planning, added.** Impassable terrain needs it; by default Phase W keeps every terrain passable at a cost (D-W4). P7-04's "Avoid danger" routes depend on it.
9. **W-07 gains swept contacts.** A coarse one-hour step can carry two parties past each other, since a party moves about 3.6 map units per hour against a contact distance of 1.6. It also gains a rule that keeps the March kingdoms' story relationship (D-W5) and an explicit schema step (v11).
10. **Sizes corrected:** W-00 M–L, W-02 M–L, W-07 M–L, W-08 S–M, P7-04 L, P8-01 M–L, P8-02 L, P9-07 M–L.
11. **Readiness labels added,** plus a schema-step table, blocking decisions, and per-task contract additions (browser tests, help text, debug tools, phone tests, asset request lists).
12. **Not received:** the owner's message was cut off after W-02's zoom range (the rest arrived scrambled). The owner couldn't resend it and asked for an independent check instead (items 13–20).
13. **Canvas resolution (new decision D-R1).** The canvas is a fixed 960×540 drawn with `image-rendering: pixelated`, so W-01's larger canvas text and W-02's zoom-in stay at that resolution on a phone. W-01 measures a denser backing store; the default keeps 960×540.
14. **W-02 gains a cached terrain layer.** `drawWorld` redraws all terrain every frame (with a `terrainAt` call per tree dot), so culling alone doesn't keep "fit the whole map" cheap on a 200 × 200 world. The grass mottling moves from screen to map coordinates, and W-02 adds a Debug-panel map drawing test. Desktop keyboard pan and zoom were also added.
15. **W-00 setup details:** fixture settings turn off tips and full screen (`js/fullscreen.js` requests full screen on any touch `pointerup`), and Playwright's output folders are ignored by git.
16. **W-04:** one more hard-coded position, new parties created at 50, 50 (`js/parties.js:47`).
17. **W-06:** migrations stay pure, so the offset is a constant in the migration, never read from the current world data.
18. **W-07:** a save size budget and a phone save-write measurement.
19. **P7-09 re-sized to M–L.** No duel mode exists in the code; the tournament needs a one-on-one arena mode on the battle engine.
20. **P7-01:** the surgeon changes the death threshold but keeps one casualty roll per soldier, so the seeded `casualties` stream and the existing tests stay aligned.

**2026-11-20, re-specification of Phase 8 at build 2.23.0 (commit 09176e8; owner: "do the improved plan and task instructions for phase 8").** IDs kept, with P8-06 split into P8-06a and P8-06b as W-05 was.

21. **P8-02's dependency on W-06 removed** (dropped by D-W2); it migrates from v18 with fixtures from 2.23.0.
22. **Build order changed:** holdings (P8-02) and permissions (P8-03) before lords (P8-01). P8-02 brings rulers and lords as people; P8-01 their parties.
23. **P8-06 split:** sieges on the map (P8-06a) and the assault battle (P8-06b). Nothing in the code takes a fort today, so 06a is what makes "lost while away" possible.
24. **Scope moved to Phase 9:** rebel, sovereign and deposed allegiance (P9-03, P9-04); holding land as an independent (P9-03); towns changing hands (P9-05); lords' deaths and heirs (P9-06).
25. **P8-07 reframed:** its nobles are P8-01's lords; Prototype F's order is a request from the player and the ruler's summons.
26. **Story forts locked** (Greywall, Ashgate) until Q4 ends, so the story's owner conditions keep their meaning.
27. **Decisions:** D-P8a made concrete; D-P8b (which places are holdings), D-P8c (the realms' people) added as blocking; D-P8d (first holding) and D-P8e (what survives a loss) with defaults.
28. **Testing:** the design's SC-19–SC-24 and SC-44 as scripted tests, the §25.3 invariants checked daily in the bots, a no-player world run (`npm run landed`), a landed bot style, and Prototypes D and F as slow tests.
29. **Owner, 2026-11-20: lords as in a feudal sandbox.** Every settlement is a holding (villages, forts and towns) held by a lord or the ruler. Lords may hold nothing (campaigning kin and household knights), one place or several, with kin ties. Villages are fiefs tied to a seat. D-P8b, D-P8c and D-P8d rewritten; P8-02, P8-01, P8-05, P8-06a, P8-07 and P8-08 follow. About 24 lord parties instead of 8, inside W-07's budgets (checked with Map stress 80 in P8-01).
30. **Owner, 2026-11-20: no fixed classes.** Rank is what a person holds and their office now, never stored; the same rules for every lord and the player. The ruler becomes an office (`c.rulers`, P8-02) so Phase 9 can move it: AI lords and the player may become rulers (P9-03, P9-04, succession in P9-06), and a deposed ruler rides on as a lord. P8-07 grows to needs (land, coin, men, safety, standing), lord-to-lord opinions, friends, rivals and feuds, grants weighed by opinion, and AI lords changing realm and losing fiefs by the player's rules (size M → M–L).
31. **Owner, 2026-11-20: D-P8a, D-P8b and D-P8c taken as their defaults.** P8-02, P8-06a and P8-06b are Ready; nothing blocks the start of Phase 8. D-P8d and D-P8e keep their working defaults.

**2026-11-20, orientation check of the Phase 8 specs against the code at 9826a3e (before P8-02).**

32. **"Now" corrected in P8-02:** Q4's owner effect is in `data/dialogue.js` (the `greywall_parley` choices), not `data/quests.js`; and the callers of `realm.owner` also include `js/contracts.js`, `js/happenings.js`, `js/parties.js` (with `realm.holdings`), `js/render.js`, `js/tourney.js`, `js/ui.js`, `js/world.js`, `js/save.js`'s required fields, `scripts/make-save-fixtures.js` and `types/crownless.d.ts`.
33. **Owner, 2026-11-20: Greywall's villages follow it.** Seats are the nearest fort or town of the same kingdom; Greywall's are Highmere and Brackenfield, so the Aurelian Q4 ending (and a migrated save of it) hands them to Aurelia too ("it's just a quest").
34. **Owner, 2026-11-20: no vacant fiefs (D-P8f).** A fief goes to its conqueror or the ruler; the conqueror asks for it, suggests someone, hands it to the ruler or keeps it (and may be expelled for it). P8-02's holder is never null; P8-05, P8-06a and P8-07 follow.
35. **Owner, 2026-11-20: men and women (D-P8g).** People have a gender; noblewomen hold land, lead parties and rule. Regular soldiers are men, so P8-02 splits each name culture's given names and soldiers draw only men's names; women soldiers come later as their own troop types.
36. **P8-02 details settled at the check:** the domain event is `HoldingChanged` (the events are PascalCase, and nothing listens yet); the story lock is enforced in grants, sieges and the Debug panel, not in `setOwner`, so the existing tests that move Greywall before Q4 stay as they are; a village may have no seat only when its kingdom holds no fort or town (the W-04 test world's Iron Reach); the v19 migration's constants are for `sundered_realm`, and other worlds' saves keep only their owner overrides for `sanitize` to complete.
37. **Owner, 2026-11-22: battles and the company at Mount & Blade's scale.** The company limit of 20 and the battle size of 40 are too small: the company should reach 150–200 (D-P9b) and a battle 100–150 at once, adjustable (D-P9a), with big armies sharing the field by size and both sides reinforcing from reserves (D-P9c). Three tasks open Phase 9, P9-B1 (measure on the phone and raise the battle size), P9-B2 (proportional battles) and P9-B3 (the bigger company), before armies (P9-05), which now needs them.
38. **Owner, 2026-11-22: what else Phase 9 needs, and Phase 10.** The save budget goes: up to 10 MB is fine (D-P9d), the world-sim test now fails past 4 MB, where `localStorage` (about 5 MB) would force a move to IndexedDB. Command comes in four optional layers, from none to live command, with divisions and formations (D-P9e, P9-B4). The Phase 8 loose ends go to Phase 9 as P9-L1, for a living world. Onboarding, origin stories with their own opening quests, more origins and women soldiers go to a new Phase 10, "Ways In", which the owner will add to after testing.
39. **Phase 9 specified (2026-11-22, the owner's request).** Every Phase 9 task now has a full specification in NEXT-TASKS (problem, build, layers, save, edges, out, tests, acceptance), from design §18–§20 and §23: realms with treasuries, laws and offices (P9-01), treaties and trust (P9-02), founding or taking a kingdom with ruling delegated (P9-03), rebellion and deposition (P9-04), armies with supply and capitals that can fall (P9-05), houses, marriage, deaths and succession (P9-06), modding (P9-07), creator tools and a second world (P9-08), and the acceptance with long runs (P9-T). Save steps v25–v30. Four proposed defaults for the owner: D-P9f (realms founded in play), D-P9g (deaths), D-P9h (capitals fall), D-P9i (the long runs). The slow files per task and five whole-suite checkpoints are in NEXT-TASKS's Phase 9 introduction.

**2026-11-22, orientation check of the Phase 9 specs against the code at d343553 (before P9-B1).**

40. **Owner, 2026-11-22: D-P9f to D-P9i taken as their defaults,** and four points of P9-B1 settled (D-P9a's row): the deployment grows with the size (it was capped at 12 foot, 8 archers and 6 riders, so a battle of 150 would have started with about 26 of the company on the field); the benchmark is an open field grown for the size; a device on the old default moves to the new one; 60 fps stays the target at 40.
41. **Found at the check, for later tasks:** fighters running from the field hold no place, so reserves step in while they are still on it and drawn (the benchmark saw up to 193 on the field at a size of 150): P9-B2's share should count them. B-01's parity "at 100" means nothing until P9-B2 and P9-B3 bring battles bigger than 40, so P9-B1 tests big battles by the same rules (the stronger side wins at 40, 100 and 150) and P9-B2 re-measures parity at 100. Every realm is looked up from the content (about 50 places ask for a faction, about 65 for the list of kingdoms), none with the campaign: P9-01's treasuries are the moment to make that lookup campaign-aware, before P9-03's founded realms.
42. **Owner's phone benchmark, 2026-11-22 (3.1.1):** 40 to 150 all at 60 fps, the slowest frame 17 ms; at 150, 2.4 ms of simulation and 2.6 of drawing, about a third of a 60 fps frame. The phone is about as fast as the development machine in Node. The default becomes 150 (D-P9a's rule: the largest size measured), and the owner's "we could even go bigger" raises the ceiling to 200 (fields grow to 4.2 screens; 200 joins the benchmark). This changes nothing in P9-B2 or P9-B3's specifications: the share of the field is a fraction of whatever the size is, and a company of 150–200 now fits on the field at once.
43. **P9-B2 (3.2.0): fighting a band as one army changed B-01's balance.** A band on the map came in waves of 8, which had quietly helped the company (it fought them a few at a time). As one army, the equal fight (10 against 10) fell to 35% fought against odds of 79%, and the outnumbered one rose to 88% against 61% (the enemy swarmed when it had the numbers). B-01's line is now looser (175 px of slack, from 55) and always kept: parity at 40 is again 5–15 points over the odds on average. **Open for P9-B4 and P9-T:** in big battles a company with many archers wins far above the odds Simulate states (close ×8: +37 at 40 and 100), because Simulate values an archer like any soldier of its tier; a company of foot is near the odds (veterans ×6 at 100: −6).
44. **P9-B3 (3.3.0): the limit is no longer what holds a company back; its pay is.** With room for 200, the bots grow to about 55–60 soldiers in 180 days and stay near 60 over a year, spending the 10,000–12,000 crowns they used to hoard at 20. A hundred soldiers cost about 700 crowns a week, more than a captain earns in the March. **For the owner:** should a company of 100+ be within a captain's means (more income: bigger fights beyond the March, contracts paying by the company's size, land), or should armies that big belong to lords and realms (P9-01's treasuries, P9-05's armies)? The world's armies are data (`armies` in the world package): households and garrisons three times the data's at the same cost, parties beyond the March 2.5 times.
45. **Owner, 2026-11-22: raise the income** (on item 44). Contracts fit the company (a hunt's band and an escort's ambush, matched to its strength, may grow past 14 with the square root of its size over 20, and pay for it), and mercenary service pays the company's wages and a tenth more. The bots, as careful captains (three weeks' wages in hand past 20, property before growing past 20), reach 85–95 soldiers by day 180 and 109–116 at a year, on about 2,000–2,500 crowns and 2–3 warnings.
46. **P9-B4 (3.4.0): command in layers.** Six division slots over the roles (a company that never changes them fights as before), formations per division with line, column and square, Auto as layer 1 (and the enemy's plan by the same rules, for armies of more than 20 only: given to every band, it took the small fights to 100% fought), captains and plans of your own as layer 3, and live, timed orders on the tactical map as layer 4. **Open for P9-05 and P9-T:** fought big battles stay far over Simulate's odds (+29 to +37 at 40 and at 100); a company wins every fair big fight with no orders. **Found at the checkpoint, from P9-B3:** the slow siege test fails since 3.3.0. The garrisons grew three times and the test's company did not, so the odds of storming fell to 10%, while the fight still wins 58%: the walls' garrison comes in waves of 8. Scaled to the world (a company of 48), the odds are Phase 8's again (41%) but the fight wins every time; as one army sharing the field it wins none and some fights never end. The assault needs re-fitting for armies: **owner, 2026-11-22: a task of its own before P9-L1, P9-B5.**
47. **P9-B5 (3.5.0): the walls at the world's scale.** The assault fights as one army a side, against the part of the garrison on the stretch of wall under attack (58% storming, 90% beside you defending); a ladder takes two at a time, slowly, and nobody strikes from one; a stalled shared battle now ends, its reserves withdrawing too. At a battle size of 150 storming is +19 over the odds and defending +1. **Open for P9-T:** at 40 storming is far easier and defending harder, as big battles are there; and the balance is steep (one defender more or less on the wall moves storming by 20 points).
48. **Owner, 2026-11-23: the tasks take too long.** Most of each battle task's effort went around it: reading the whole plan, running suites again, tuning loops (P9-B5's third to fifth tries). From P9-L1 every task has a Brief in NEXT-TASKS with the code to start from, decided defaults, the save step, the build order and its exact checks, and a lean way of working: each check once, tuning time-boxed to two tries, failures outside the task noted rather than fixed, play only where there is a screen. No task was split; P9-03 and P9-05 got a build order in steps instead (P9-05 in two halves).
49. **Owner, 2026-11-24: Phase 10 re-ordered** (after the orientation check). P10-00 leaves the order and runs on the night run. The Wait screen joins map speed (P10-01). Two tasks are new: one world, the coast joining the map (P10-02), and walkable capitals and free cities (P10-03), before the story. The art pass is split into the UI and menus (P10-08) and graphics (P10-G1, P10-G2, whenever they fit). Old saves are ignored. Tasks renumbered in build order (D-P10f to D-P10j).
