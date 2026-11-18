# Crownless — Plan after 2.0: zoom and a bigger world, then Phases 7–9

_Written 2026-11-18 at build 2.0.0 (commit 0415109); **reviewed and corrected the same day against commit c66d94c** (see §11, "Review log"). This is the working plan for everything after v2.0. It replaces the outlines in `docs/V2-PLAN.md` §6–§8; V2-PLAN stays the record of how v2.0 was built. Each task's specification is in [`NEXT-TASKS.md`](NEXT-TASKS.md). Sources: the owner's direction (2026-11-18), the v2 design documents (`Crownless_v2_0_Feature_and_Systems_Design_Part_1.md` and `_Part_2.md`, chiefly §11–§24, §26–§28) and the code._

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
| SC-37 battle balance | Plan: B-01 | Fought company battles are far easier than Simulate's odds |
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
Phase 9   "Kingdoms & Houses"   — realms, diplomacy, founding a kingdom, rebellion, armies, houses,
                                  modding and a second world
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
| **W-05a** | **World geometry and terrain** (split from W-05): map bounds over 100; new terrain kinds (mountain, marsh, coast, ford, bridge) as passable terrain with costs; battle maps for each; a ford battle map | Ready after decisions D-W1, D-W4 | M | W-02, W-04 | — |
| **W-05b** | **The bigger region's content** (split from W-05): kingdoms, cultures, troop trees, settlements, parties, markets, garrisons, news and contracts; the asset request list for the art team; bots that read the world's boards. **Ships in the same build as W-06** | Ready after decisions D-W1–D-W3 | L | W-05a | v10, with W-06 |
| **W-05c** | **New-region errands and help** (split from W-05): two or three errands outside the March; How to Play and tips for the bigger map | Specified | S | W-05b | — |
| **W-06** | **Saves move into the bigger world:** the v10 migration (every coordinate-bearing field offset); fixtures from the real 2.0.0 build made **before** any content change. **Released together with W-05b** | Ready after decision D-W2 | M | W-04 | v10 |
| **W-07** | **A world simulation that scales:** spatial grid, swept contacts for coarse steps, step budgets, map culling, war and peace between kingdoms (the March pair kept as the story needs) | Specified | M–L | W-05b, H-01 | v11 |
| **W-08** | **Tuning and acceptance** of the bigger world, with a validation section | Specified | S–M | W-00–W-07 | — |
| **W-09** | **Route planning** (new, optional in Phase W): a terrain-cost route planner for the player's travel and for parties; required before any impassable terrain and before P7-04's "Avoid danger" | Ready after decision D-W4 | M | W-05a | — |

**Proposed size of the world (owner decision D-W1):**
- **Area:** about four times today's, on a 200 × 200 map-unit grid at the same travel scale.
- **Kingdoms:** four (Valedorn and Aurelia as now, a northern kingdom, a southern or coastal league), plus the Reavers and a free city.
- **Settlements:** about 32.
- **The Border March** stays whole in the middle, so its story, errands and tests stay valid.

## 4. Phase 7 — "The Living Company" (independent captain)

**Exit (design §26.3):** an independent player builds a lasting company with non-combat roles, delegates, earns through trade or property, and meets dynamic consequences, without needing a title.

| ID | Task | Readiness | Size | Needs | Save |
|---|---|---|---|---|---|
| **B-01** | **Battle balance pass** (owner, deferred): make fought company battles harder (enemy cover and ranks, steadier enemy morale, smarter targeting) rather than inflating Simulate; target 5–15 points over the stated odds | Ready | M | H-01 (parity script) | — |
| **P7-01** | Surgeon (fewer deaths, faster healing, medicine) | Specified | S–M | V2-11 | yes |
| **P7-02** | Scout (detection, pursuit warnings, route estimates) | Specified | S–M | P7-04 | yes |
| **P7-03** | Blacksmith (capped, targeted upgrades; no durability) | Specified | S | V2-11 | yes |
| **P7-04** | Pursuit and detection (vision, night, last-seen, search, hiding; "Avoid danger" routes) | Specified | **L** (was M) | W-07; W-09 for routes | yes |
| **P7-05** | Officers and detached patrols (SC-17, SC-18) | Specified | L | W-07 | yes |
| **P7-06** | More companions | Specified | M | P7-05 | yes |
| **P7-07** | Soldier traits | Specified | S | — | yes |
| **P7-08** | Dynamic world events | Specified | M | W-07 | yes |
| **P7-09** | Tournament (foot-melee duels; needs a new one-on-one arena mode, since none exists) | Specified | **M–L** | — | yes |
| **P7-10** | First business: a mill | Specified | M | V2-11, W-05b | yes |
| **P7-11** | Battle extras (formations, an objective, terrain) | Specified | M | B-01, W-05a | — |
| **P7-T** | Tuning and acceptance | Specified | S | all above | — |

## 5. Phase 8 — "The Landed World"

**Exit (design §26.4, Prototype D):** acquire a holding, lose it, return to a landless captain's life, change allegiance and retake it, all in one save.

All of Phase 8 is **Provisional**: specified as far as possible now, and re-specified at the phase's start.

| ID | Task | Size | Needs |
|---|---|---|---|
| **P8-01** | Lords on the map (a new party kind handled by encounters, auto-resolve, reinforcements, contracts and news) | M–L | W-07 |
| **P8-02** | Holdings model (replacing `c.owners`; the story's owner conditions kept) | **L** (was M) | W-04, W-06 |
| **P8-03** | Permissions | S | P8-02 |
| **P8-04** | Allegiance | M | P8-02 |
| **P8-05** | Fiefs and castellans | M | P8-02, V2-11 |
| **P8-06** | Sieges | L | P8-01, V2-09 |
| **P8-07** | Named nobles (Prototype F) | M | P8-01, P8-04 |
| **P8-08** | Losing and retaking land (Prototype D) | M | P8-02–P8-06 |
| **P8-T** | Tuning and acceptance | S–M | all above |

## 6. Phase 9 — "Kingdoms & Houses"

All of Phase 9 is **Provisional**.

| ID | Task | Size | Needs |
|---|---|---|---|
| **P9-01** | Realms as organisations | M | P8-02, V2-11 |
| **P9-02** | Diplomacy and treaties (grows from W-07's war and peace) | M | W-07, P9-01 |
| **P9-03** | Founding or taking a kingdom | M | P8-04, P9-01 |
| **P9-04** | Rebellion and deposition | L | P8-07, P9-03 |
| **P9-05** | Armies and campaigns | L | P8-06, W-07 |
| **P9-06** | Houses, marriage and claims | M | P8-07 |
| **P9-07** | Modding: a declarative content format (namespaced ids moved here from W-04) | M–L | W-04 |
| **P9-08** | Creator tools and a second world | L | P9-07 |
| **P9-T** | Tuning and acceptance (SC-29, SC-41, the full matrix) | M | all above |

## 7. Order, versions, saves and the per-task contract

### Order
1. **W-00, then H-01.** Browser tests and test hygiene come first, so every later task can add tests and measure reliably.
2. **W-01 and W-02,** each extending W-00's browser tests. Then **W-03**.
3. **W-04** (data-driven world, no hard-coded bounds). It can run in parallel with W-01–W-03, since it touches different files.
4. **W-06's fixtures:** generated from the real 2.0.0 build **before** any content changes (as for every earlier schema step).
5. **W-05a,** then **W-05b + W-06 together in one build,** then **W-05c**.
   
   **Why together:** a build with the bigger map but no migration would load 2.0 saves with unshifted coordinates; with `main` deployed to Pages, that would hit real players.
6. **W-07,** then **W-08.** **W-09** if the owner chooses impassable terrain (D-W4), or before P7-04's "Avoid danger" routes.
7. **B-01** early in Phase 7, then Phase 7 roughly in table order (P7-04 before P7-02; P7-05 before P7-06).
8. **Phase 8, then Phase 9,** each re-specified at its start.

### Versions (owner decision D-V1)
- Proposed: each finished task bumps the minor version (2.1.0, 2.2.0, …); fixes bump the patch.
- The end of Phase 8 ships **3.0.0**, the end of Phase 9 **4.0.0**.
- H-01 and documentation-only work bump the patch.

### Save schema steps (each with a migration, fixtures from the build before it, and SAVE-FORMAT updated)
| Schema | Task | Change |
|---|---|---|
| v10 | W-05b + W-06 | Positions offset into the bigger map; new kingdoms' reputation; owners, markets and spawns for new places |
| v11 | W-07 | Relations between kingdoms (war, peace) |
| v12+ | Phase 7 tasks with "Save: yes", in the order they ship | One step per task, never two tasks in one step |
| later | Phases 8–9 | Holdings (P8-02) is the biggest: owners → holdings |

**Device settings** (text size, zoom levels) need no schema step. They live in `crownless_settings`, whose loader already fills missing keys with defaults.

### The per-task contract (from v2, `docs/V2-PLAN.md` §5, with additions)
- **Green:** `npm test` and `npm run lint` pass. From W-00 on, the browser tests pass too.
- **Tested:** new logic gets Node tests. New screens, controls or gestures get browser tests (W-00). New saved state gets a migration, fixtures and a save round-trip test.
- **Played:** checked in a real browser at desktop and phone landscape size (812×375). Performance-sensitive tasks (W-03, W-05, W-07, P8-06, P9-05) add or extend a Debug-panel test for the owner's phone, as PROTO-A and SC-34 did.
- **Explained:** How to Play and the first-time tips cover new player-facing systems. Debug tools cover new state, so testers can reach it.
- **Art:** tasks that add places, troops or icons write an **asset request list** for the art team (`docs/ASSETS.md`) and ship with placeholders. Art never blocks a task.
- **Versioned:** the version in its five places; ROADMAP, this plan, NEXT-TASKS (marked done), README and the v1 documentation updated; SAVE-FORMAT for schema steps.
- **Owner-gated:** commits only when the owner asks; never push, tag, open pull requests or publish releases.

## 8. Decisions for the owner

Decisions marked **blocking** must be made before the named task starts. The others have a working default.

| ID | Question | Proposed default | Blocks |
|---|---|---|---|
| **D-T1** | Add Playwright as the project's first **development** dependency (with a `package-lock.json`)? | **Decided yes (owner, 2026-11-18):** `@playwright/test` 1.64.1, pinned, Chromium only; the game itself stays dependency-free | W-00 (done) |
| **D-T2** | Where are screenshot baselines authoritative? | CI's Linux Chromium; local runs check behaviour and skip pixel comparison unless asked (fonts and rendering differ between machines) | W-00 |
| **D-W1** | How big should the world be? | About 4× today's area (200 × 200 map units), four kingdoms plus the Reavers and a free city, about 32 settlements | **W-05a, W-05b (blocking)** |
| **D-W2** | Keep the Border March inside the bigger world, and move existing saves in? | Yes and yes: the March whole in the middle at a fixed offset; every save migrates (W-06) | **W-05b, W-06 (blocking)** |
| **D-W3** | New kingdoms' names, cultures and feel? | Placeholder names fitting each culture, data-driven and renameable later; troop lines with a distinct style each (northern heavy infantry, southern crossbows and light horse) | **W-05b (blocking)** |
| **D-W4** | Impassable terrain (rivers crossed only at fords and bridges, mountains)? | **No in Phase W:** all terrain passable at a cost (rivers very slow except at fords and bridges); impassable terrain only after W-09 route planning | W-05a |
| **D-W5** | The two March kingdoms in W-07's war and peace | Valedorn and Aurelia stay at "tension" (frontier clashes, as now) until Q4 ends; the endings set peace (road peace) or war (one side holds Greywall) | W-07 |
| **D-Z1** | Zoom range | Map: from "fit the whole map" to 2.4× (on today's 100 × 100 map that means no zoom-out below 1×); battle: 0.75×–1.5×; text size: four steps | W-02, W-03 |
| **D-R1** | Sharper canvas: draw the canvas at the screen's pixel density instead of a fixed 960×540? | **Not in Phase W by default.** W-01 and W-02 work at 960×540. W-01 measures a backing store at `min(devicePixelRatio, 2)` × 960×540 with the Debug-panel battle and map tests on the Zenfone. It's adopted only if the frame budget holds (60 fps, about 2 ms of drawing); otherwise it goes to the backlog. **2.2.0:** the switch is in (Debug → Sharp canvas; the practice result names the canvas mode); waiting on the owner's phone numbers | W-01 (measurement only) |
| **D-V1** | Version numbering after 2.0 | Minor per task; 3.0.0 at Prototype D; 4.0.0 at the end of Phase 9 | — |
| D-P7a | First follower in Phase 7 | Surgeon | P7 order |
| D-P7b | First business | A mill, then an inn | P7-10 |
| D-P7c | Tournament format | Foot-melee duels in a capital | P7-09 |
| D-P8a | How deep sieges go at first | One assault map, a simple preparation and starvation track | P8-06 |
| D-A1 | When art, commercial, packaging and demo come back | After the art team delivers; an art-integration task then | — |

## 9. Risks

| Risk | Guard |
|---|---|
| Map gestures set off travel by accident | W-02's gesture state machine; Node tests of it and W-00 browser tests that drag and pinch without travelling |
| A bigger world slows the phone | W-07 grid, swept contacts and budgets; H-01's map benchmark; W-02's cached terrain layer and culling; a Debug-panel map test for the Zenfone that reports drawing and simulation ms |
| Saves grow too large for `localStorage` or too slow to write on the phone | Today's played save is about 15 KB. W-07 adds a size test (a 90-day, 80-party save under 100 KB) and measures a save write on the phone |
| An old migration changes meaning when content changes later | Migrations stay pure: W-06's offset is a constant written into the migration, never read from the current world data |
| Saves broken between builds | W-05b and W-06 ship together; fixtures from 2.0.0 before content changes; the pre-migration copy; SC-33's protections |
| Hidden 0–100 assumptions | W-04 removes every hard-coded bound, with a test that the literals are gone and a test world bigger than 100 |
| Coarse world steps miss contacts or change outcomes | Swept (segment) contact tests; bots re-baselined and the change documented; determinism tests |
| Screenshot tests are flaky | Baselines only from CI's Linux Chromium (D-T2); behaviour tests separate from pixel tests; a documented update procedure |
| Scope creep (the design is huge) | Each phase has a stated exit; ideas failing the design's prioritisation rule (Part 2 §26.7) go to the backlog |
| Management fatigue as holdings and nobles arrive | Defaults that work hands-off; Prototype G repeated each phase; "forced screens" counted |
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
