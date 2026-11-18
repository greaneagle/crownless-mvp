# Crownless — Plan after 2.0: zoom and a bigger world, then Phases 7–9

_Written 2026-11-18 at build 2.0.0 (commit 0415109). This is the working plan for everything after v2.0. It replaces the outlines in `docs/V2-PLAN.md` §6–§8; V2-PLAN stays the record of how v2.0 was built. Sources: the owner's direction (2026-11-18), the v2 design documents (`Crownless_v2_0_Feature_and_Systems_Design_Part_1.md` and `_Part_2.md`, chiefly §11–§24, §26–§28) and the state of the code._

## 0. The owner's direction (2026-11-18)

- **Focus:** zooming, then Phases 7, 8 and 9, and **make the game bigger**. Most of the later features (officers, nobles, holdings, sieges, diplomacy, kingdoms) can't be tested properly in a world of ten settlements and two kingdoms.
- **Deferred:**
  - Art: a separate team is working on it (ART-01 and asset work are off this plan).
  - Commercial readiness, packaging, demo and storefront (R-01–R-03): after the art.
  - The battle balance pass: Simulate should be only slightly worse than fighting, and a strong fighter should be able to turn a close battle (owner, 2026-11-18). It is scheduled below (B-01).

**What this plan does with that:** it puts a **world-scale foundation first** (zoom, a data-driven world, a bigger map, a world simulation that scales). Then the Phase 7–9 features are built in a world large enough to show them working.

## 1. Where the game stands (2.0.0)

### What is built
- **The world:**
  - The Border March: 10 settlements (2 towns, 2 forts, 6 villages), two kingdoms (the Valedorn Crown, the Aurelian Remnant) and the Road Reavers.
  - 3 name cultures, 16 troop types, 28 items, 6 trade goods.
  - Two roads, a river, forests and hills.
  - 9 roaming parties: 3 Reaver bands, 2 patrols per kingdom, 2 caravans.
  - Regional news and frontier clashes. Forts can change owner.
- **The story:** four quests with three endings, and five errands (V2-Q).
- **The company:**
  - Named soldiers with service records.
  - A discovered troop tree, the chronicle and roll of honour.
  - Accounts and a ledger.
  - Two camp followers: the quartermaster and the merchant.
  - Mara, the companion.
- **Battles:**
  - Large arenas with a following camera, a minimap and a tactical overview.
  - Battle preparation with presets and Custom placement.
  - Group AI with shields, cover and braced spears.
  - Morale, rout and rally.
  - Nearby reinforcements.
  - A fixed 4 hours of map time per battle.
- **Foundations:**
  - Save schema v9, with migrations from every old build and fixtures from real builds.
  - One commit path for results; domain events.
  - Seeded random streams; one campaign clock.
  - A JSDoc type check on the core modules.
  - 528 automated tests.
  - Bots: campaign, story, Prototype G, an economy report, a battle benchmark.
- **Evidence:** `docs/V2-VALIDATION.md` (every v2 core scenario), `docs/RELEASE-NOTES.md`.

### Still open from v2.0
| Item | Who | Note |
|---|---|---|
| SC-34 phone run | Owner | Debug → **Big battle 40 + help** on the Zenfone; target 60 fps under about 2 ms per frame |
| Feel check of the v2 battles | Owner | New Balanced, hero-down charge, morale, reinforcements, the Rally and Accounts screens |
| SC-37 battle balance | Plan: B-01 | Fought company battles are far easier than Simulate's odds |
| Push and (optionally) tag 2.0.0 | Owner | Nothing is pushed or tagged by the assistant |

### Limits that block a bigger game (found in the code)
- **The world map can't grow.** It is a fixed 0–100 space drawn to fill the 960×540 canvas (`js/world.js` VIEW: 8.8 px per map unit across, 4.96 down). There is no map camera, pan or zoom, so more settlements would mean smaller, untappable icons.
- **One world is hard-wired.** `MAP_ID = 'border_march'` is in `js/world.js`. The kingdom ids appear in code in a few places: `FACTION_EMBLEM` in `js/render.js`, `FACTION_ORDER` in `js/troops.js`, and the debug fort switch.
- **The world simulation was sized for nine parties.** `js/parties.js` steps every party every 15 game minutes and checks contact pair by pair. With lords, armies and many more bands that needs a spatial index and a budget.
- **No zoom anywhere.** The page blocks pinch-zoom (`user-scalable=no`), there is no text size setting, and battles have one fixed scale.
- **Politics is a single owner per fort** (`c.owners`), with reputation as one number per kingdom. That is fine for two kingdoms, too thin for holdings and nobles.
- **Small hygiene:**
  - `js/ui.js` is about 1,800 lines.
  - Test games in one process can leak state into each other (seen during V2-T2: results depended on run order). It doesn't affect the game, but it makes measurements noisy.
  - Line-ending warnings on every commit (LF in the working tree, CRLF on checkout).

## 2. The plan at a glance

```text
Phase W   v2.x  "A Bigger World"        — zoom and text size, a data-driven world, the map camera,
                                          a larger region with more kingdoms, a world simulation that scales
Phase 7   v2.x  "The Living Company"    — followers, officers and detached patrols, pursuit, world events,
                                          tournament, first business, battle extras, the balance pass
Phase 8   v2.x  "The Landed World"      — lords on the map, holdings and claims, allegiance, castellans,
                                          sieges, named nobles; acceptance: Prototype D, "The Dispossessed Lord"
Phase 9   v3.0  "Kingdoms & Houses"     — realms and diplomacy, rebellion and deposition, houses and marriage,
                                          armies, modding and a second world
```

Each phase ends playable, measured and documented, like v2.0 did. The order follows the design's dependency map (Part 2 §26.6) with one change: **the world grows first**, at the owner's request, so the rest can be tested at scale.

## 3. Phase W — "A Bigger World" (zoom and world scale)

**Goal:** a region large enough that kingdoms, lords, holdings and wars have room to happen, readable on a phone, without losing the Border March or anyone's save.

| ID | Task | What it involves | Acceptance | Size | Needs |
|---|---|---|---|---|---|
| **W-01** | **Text size and UI scale** | A device setting (Small / Normal / Large / Larger) that scales the HUD, menus, panels and canvas text; layouts that reflow at 812×375 with the largest size; optionally allow browser pinch-zoom on menus without breaking battle touch | Every screen usable at the largest size on a phone; no clipped buttons; a layout test at each size | M | — |
| **W-02** | **World-map camera: pan and zoom** | A camera for the strategic map: follow the party, drag to pan, pinch / wheel / buttons to zoom (three or four levels), clamped to the map, a recentre button. Hit-testing, labels, edge markers and the contact checks work at any zoom; icons and labels stay a readable size | The current map plays exactly as now at the default zoom; a tap hits the right settlement or party at every zoom; touch and mouse both work; test of screen↔map conversion at each zoom | M | — |
| **W-03** | **Battle zoom** | Pinch / wheel zoom in battle (for example 0.75×–1.5×) and in the tactical overview, around the camera's follow point; the minimap shows the view box | Hits, taps and orders land correctly at every zoom; the stress test and benchmark unchanged at 1× | S–M | — |
| **W-04** | **A data-driven world** | One world package: `world_map` carries its kingdoms, cultures, regions and start; no kingdom or map id in code (emblems and colours from the faction data, troop-tree order from the data, debug tools generic); the current game becomes the `border_march` package; namespaced ids reserved (Phase 9) | Grep finds no kingdom ids in `js/`; a test world with three kingdoms and different names loads and plays; content validation covers the package | M | — |
| **W-05** | **The bigger region** | Grow the map into a larger region (proposed below) with the Border March as one part of it, unchanged in layout and story: more kingdoms and their cultures, names and troop trees, settlements, roads, rivers with fords and bridges, forests, hills and a mountain pass, more lairs, caravans and patrols. Text, news and contracts for each kingdom | Every settlement reachable; travel times sensible; each kingdom has a working troop tree and recruits; story and errands still play; the content validator passes | L | W-02, W-04 |
| **W-06** | **Saves move into the bigger world** | A save migration that keeps every existing campaign: the Border March coordinates map into the new region, parties and sites carry over, reputation with new kingdoms starts neutral, fixtures from 2.0.0 | Fixtures from 2.0.0 (and older) load into the new world with the same soldiers, gold, day, quests and position | M | W-05 |
| **W-07** | **A world simulation that scales** | A spatial index for parties (contacts, detection, reinforcements), a per-step budget, map-drawing culling, news and clashes between any pair of kingdoms, simple war and peace states between kingdoms (the seed of Phase 9 diplomacy) | 60+ parties simulated over 90 days headless with no slowdown spikes; frame cost on the map within budget on the phone; Prototype G and the story bot still pass | M | W-05 |
| **W-08** | **Tuning and acceptance of the bigger world** | The campaign, economy and story bots across the whole region; travel, upkeep and contract pay re-tuned for longer distances; a phone check | Bots never stuck; economy report healthy (as V2-T1); owner plays on the phone | S | W-01–W-07 |

**Proposed size (to decide, see §8):**
- **Region:** about four times the area of today's map.
- **Kingdoms:** **four**, plus the Reavers and one neutral free city:
  - Valedorn and Aurelia (as now, with the Border March between them);
  - a northern kingdom and a southern or coastal one (new cultures and troop lines).
- **Settlements:** **about 32**:
  - each kingdom with a capital town, two forts or castles and three to five villages;
  - the free city;
  - more lairs and sites.

That gives Phase 8 enough holdings and nobles, and Phase 9 enough realms for alliances and wars that don't always involve the player.

## 4. Phase 7 — "The Living Company" (independent captain)

**Exit (design §26.3):** an independent player builds a lasting company with non-combat roles, delegates, earns through trade or property, and meets dynamic consequences, without needing a title.

| ID | Task | What it involves | Acceptance | Size | Needs |
|---|---|---|---|---|---|
| **B-01** | **Battle balance pass** (owner, deferred from V2-T2) | Make fought company battles harder rather than inflating Simulate: enemy shields and ranks where their troops carry shields, steadier enemy morale, smarter enemy targeting; re-check Balanced and the hero-down charge | Fought results about 5–15 points above the stated odds in close fights (the fought-versus-auto parity script); a strong fighter can turn a close battle; owner's phone check | M | — |
| **P7-01** | **Surgeon** | A follower who improves survival and recovery: more fallen are wounded instead of killed, wounds heal faster; needs medicine (a supply) and pay; triage reported after battle | Measured fewer deaths per battle; can be ignored; costs explained | S–M | V2-11 |
| **P7-02** | **Scout** | A follower who widens detection on the map, warns of pursuit and parties ahead, estimates travel time and danger on a route | Warnings follow detection rules (no omniscience); route estimates shown | S–M | P7-04 |
| **P7-03** | **Blacksmith** | Upgrades rather than durability chores: paid gear upgrades for the hero and a few chosen soldiers (no armour decay) | Upgrades capped and targeted, never mandatory (design §12.4) | S | V2-11 |
| **P7-04** | **Pursuit and detection** | Limited vision on the map (day and terrain), last-seen positions, parties that search, hide in forests, give up a chase; the player's own visibility; route preferences (roads, safety) | A band loses you in a forest; a patrol searches your last-seen spot; tests for each rule | M | W-07 |
| **P7-05** | **Officers and detached patrols** | Appoint a companion or a veteran soldier as a captain; detach soldiers into a separate party with an order package (objective, area, rules, resources, autonomy); soldiers keep their histories; wages and food follow them; reports come back (design §11.3, SC-17, SC-18, Prototype C) | Soldiers are in exactly one party; a captain defeated returns wounded and everything reconciles once; save and reload mid-order | L | W-07 |
| **P7-06** | **More companions** | Two or three recruitable companions with their own motives and small quests, each a possible officer | Each can join, leave and lead a detachment | M | P7-05 |
| **P7-07** | **Soldier traits** | Two or three traits with visible effects and trade-offs (for example Steadfast: steadier morale; Cautious: pursues less), earned at real milestones (design §10.4) | Effects measurable in battle tests; shown on the soldier card | S | — |
| **P7-08** | **Dynamic world events** | Events that change state and offer a choice: shortages, infestations, militia requests, couriers, refugees; they feed news, the chronicle and contracts (design §13.4, §21.2) | Each event resolves once; ignoring one has a stated consequence; no event loop | M | W-07 |
| **P7-09** | **Tournament** | One format first: a foot-melee duel bracket in a capital town, with entry fee, prizes, renown and readable rules; losses hurt but are recoverable (design §15, SC-28) | No infinite reward farm (cooldown, fee); playable on touch | M | — |
| **P7-10** | **First business** | A mill or an inn bought in a town, run by a manager with an income and expense ledger, affected by war and the local market; independent of rank (design §14, SC-15, SC-40, Part 2 §27.2) | Runs without daily clicks; costs and failures reported; no magic profits; what happens when the town changes hands | M | V2-11, W-05 |
| **P7-11** | **Battle extras** | One or two more formations (shield wall, wedge), a battle objective (hold a point, protect a wagon), terrain interactions (hills give archers range, fords slow) (design §6.4, §8) | Each makes a measurable difference under the same rules (SC-42) | M | B-01 |
| **P7-T** | **Tuning and acceptance** | Prototype G again in the bigger world; the design exit test as a scripted scenario; economy and battle passes | Exit condition met by a bot and by the owner's play | S | all above |

## 5. Phase 8 — "The Landed World"

**Exit (design §26.4, Prototype D):** acquire a holding, lose it, return to a landless captain's life, change allegiance and retake it, all in one save, without losing personal continuity.

| ID | Task | What it involves | Acceptance | Size | Needs |
|---|---|---|---|---|---|
| **P8-01** | **Lords on the map** | Named lords leading parties and armies for their kingdoms (replacing anonymous patrols in part): they patrol, hunt, raid, gather, with simple goals | Lords' parties move with visible intentions (design §13.1); they can be met, fought, captured and released | M | W-07 |
| **P8-02** | **Holdings model** | Sovereign realm, legal holder, occupier, administrator and private owner kept separately, replacing `c.owners`; a save migration (design §17.1, §24.2) | Every fort and town has a clear holder and occupier; tests of every transition; no duplicated land | M | W-04 |
| **P8-03** | **Permissions** | Rights computed from oaths, offices and ownership, never "is the player a king" (design §4.3) | A test table of who may do what | S | P8-02 |
| **P8-04** | **Allegiance** | Independent, mercenary contract, sworn vassal, rebel, sovereign, deposed; switching with a preview of the consequences; obligations (muster, service) (design §16, §22.5) | Switching keeps personal property and warband; consequences shown before confirming | M | P8-02 |
| **P8-05** | **Fiefs and castellans** | Being granted or taking a holding; a castellan or steward running it with policies (garrison, tax stance, reserves, repairs) and a default steward; real revenue through the accounts (design §17.2) | Holding revenue and costs in the ledger; works hands-off with defaults | M | P8-02, V2-11 |
| **P8-06** | **Sieges** | Encirclement, preparation, one assault map (walls, gates, ladders), resolution; surrender, capture and ransom; relief armies via the reinforcement rules (design §20.4–20.6) | A siege can be won, lost, lifted or surrendered; no softlock; phone performance on the assault map | L | P8-01, V2-09 |
| **P8-07** | **Named nobles** | A handful per kingdom with stable motives (relationship, interest, obligation, fear) and explained obey, negotiate or refuse decisions (design §18.4, Prototype F) | Two nobles given the same risky order respond differently for reasons the player can read | M | P8-01, P8-04 |
| **P8-08** | **Losing and retaking land** | Losing a holding while away; claims that persist; landless continuity; reconquest (design §17.3, SC-20–23) | Prototype D runs as a scripted test and by the owner | M | P8-02–P8-06 |
| **P8-T** | **Tuning and acceptance** | Economy with revenue; war pace; anti-snowball checks (design §20.7) | Prototype D passes; bots across 90 days stable | S | all above |

## 6. Phase 9 — "Kingdoms & Houses"

**Exit (design §26.5, §18.9, §19.6):** a player can found or take a kingdom and rule it while still fighting in person; diplomacy, rebellion and deposition work without game over; a house carries on.

| ID | Task | What it involves | Acceptance | Size | Needs |
|---|---|---|---|---|---|
| **P9-01** | **Realms as organisations** | A kingdom's treasury, laws and offices; the ruler's personal wealth separate from the realm treasury (Part 2 §18.1) | Accounts for every realm; offices filled and vacated | M | P8-02, V2-11 |
| **P9-02** | **Diplomacy and treaties** | War, peace, alliance, truce, trade access; durations and breach rules; AI kingdoms making treaties among themselves (Part 2 §18.3) | Treaties expire and break consistently; reputation reacts (SC-25) | M | W-07, P9-01 |
| **P9-03** | **Founding or taking a kingdom** | Declaring a realm from held land; recognition and enforcement separate from the claim (Part 2 §28) | A player kingdom with vassals and delegated authority (SC-41) | M | P8-04, P9-01 |
| **P9-04** | **Rebellion and deposition** | Noble ambitions, claimants, escalating warning signs, civil war; deposition is not a game over (Part 2 §18.5–18.6, SC-26, SC-27) | A deposed ruler keeps person and warband and can seek refuge or restoration | L | P8-07, P9-03 |
| **P9-05** | **Armies and campaigns** | Armies as larger parties made of lords' retinues; muster, march, supply; large battles through the battle-size cap and reserves (Part 2 §20) | A campaign of several sieges without a stall or snowball; phone performance | L | P8-06, W-07 |
| **P9-06** | **Houses, marriage and claims** | A founding-house model: the player's house, marriages as alliances, claims; generational play optional and later (Part 2 §19) | Marriage changes relations and claims consistently; no forced aging | M | P8-07 |
| **P9-07** | **Modding: a declarative content format** | World manifest, namespaced ids, validation and safe import of data-only packs; compatibility errors (SC-33 is already in place) (Part 2 §23) | A sample pack adds a troop line and a settlement without code; a removed pack gives a precise error | M | W-04 |
| **P9-08** | **Creator tools and a second world** | Tools to build and check a world package; a second official world, smaller, to prove the format (Part 2 §23.1, §28) | The second world plays end to end | L | P9-07 |
| **P9-T** | **Tuning and acceptance** | Long runs (SC-29: 100 simulated years with no exploits or loops), ruler fatigue (SC-41), the full scenario matrix | All core scenarios SC-01–42 covered | M | all above |

## 7. Order and versions

1. **Phase W first:** W-01 and W-02 (zoom), W-04 (data-driven world), then W-03, W-05, W-06, W-07 and W-08. W-01–W-04 are independent of each other and could run in any order.
2. **B-01 early in Phase 7.** It's independent of the world and improves every later battle feature.
3. **Phase 7** in the table's order, roughly. P7-04 (pursuit) comes before the scout, and P7-05 (officers) before more companions.
4. **Phase 8, then Phase 9.** Each phase ends with its tuning and acceptance task.

**Versions (proposed, to confirm):**
- Each finished task bumps the minor version, as in v2 (2.1.0, 2.2.0, …); fixes bump the patch.
- The end of Phase 8 (Prototype D passing) ships **3.0.0**, and the end of Phase 9 **4.0.0**.
- The save schema keeps its own numbers: v10, v11, …, one per task that changes the save's shape, each with a migration and fixtures from the build before.

**Per-task contract** (as in v2, `docs/V2-PLAN.md` §5):
- Each task ends green: `npm test` and `npm run lint`.
- It's playable in a real browser at desktop and phone size, with the version bumped in its five places.
- ROADMAP, this plan, README and the v1 documentation are updated, plus SAVE-FORMAT for schema changes.
- Commits only when the owner asks; never push or tag.

## 8. Decisions for the owner

| Question | Proposed default | Why it matters |
|---|---|---|
| How big should the world be? | About 4× today's area, four kingdoms plus the Reavers and a free city, about 32 settlements | Sets the work in W-05 and the room for Phases 8–9 |
| Keep the Border March inside the bigger world? | Yes, as one region, layout and story unchanged | Keeps saves, story, errands and tests valid |
| Do existing saves move into the bigger world? | Yes (W-06), as every save so far | Otherwise 2.x saves would be stranded |
| New kingdoms' feel and names? | Placeholder names that fit each culture, data-driven, renameable later (as V2-03 decided) | Lore can come with the art team |
| Zoom: how far on the map and in battle? | Map: three or four levels; battle: 0.75×–1.5×; text size: four steps | W-01–W-03 scope |
| First follower in Phase 7? | Surgeon (most felt in every battle) | P7 order |
| First business? | A mill (the design's suggestion), then an inn | P7-10 |
| Tournament format? | Foot-melee duels in a capital town | P7-09 |
| How deep should sieges go at first? | One assault map, with a simple preparation and starvation track | P8-06 scope and phone cost |
| Version numbering after 2.0? | Minor per task; 3.0.0 at Prototype D; 4.0.0 at the end of Phase 9 | Release labels |
| When do art, commercial, packaging and demo come back? | After the art team delivers; an art-integration task then | Off this plan until then |

## 9. Risks

| Risk | Guard |
|---|---|
| A bigger world slows the phone | W-07 spatial index and budgets; measure on the Zenfone at the end of W-05 and W-07, as PROTO-A did |
| Map zoom breaks hit-testing or travel | W-02 keeps the default zoom identical to today and tests every conversion |
| Save migration into the new world loses something | W-06 fixtures from 2.0.0 and every older build; the pre-migration copy; SC-33's protections |
| Scope creep (the design is huge) | Each phase has a stated exit; anything that fails the design's prioritisation rule (Part 2 §26.7) goes to a backlog |
| Management fatigue as holdings and nobles arrive | Defaults that work hands-off; Prototype G repeated each phase; "forced screens" counted |
| Balance drifts as features stack | A tuning task closes every phase, with the bots and the owner's phone |

## 10. Backlog (not scheduled)

- Other languages (English only for now), and accessibility extras beyond W-01.
- Generational play (heirs), permadeath and ironman settings.
- Follower capture and rescue; parties that raid baggage or shadow survivors (V2-09 "not done").
- The merchant choosing its own routes; per-good quartermaster rules.
- Waypoints and target priorities in battle.
- Small hygiene:
  - split `js/ui.js`;
  - isolate test games from each other (the shared-state leak seen in V2-T2);
  - a `.gitattributes` for line endings.
