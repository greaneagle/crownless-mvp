# Crownless 5.0 — Phase 10 acceptance (P10-T)

_Build 5.0.0, 2026-11-26. Phase 10, "Ways In", is complete in code: P10-00 to P10-09, the art (P10-G1 to P10-G6) and P10-T. This is the evidence that its aim holds in the bot, the tuning carried over from Phase 9, the old failures, and what waits on the owner's phone. By the owner's word for this task, no run here took over an hour: the longest, the 42 campaigns, about 41 minutes._

## The aim (NEXT-PLAN §6b)

> You choose a kingdom and one of five origins. Each origin's opening quest is a small tutorial that leads to the same common quest. After it the world is open: the main story can be followed, or the world played as a sandbox.

| What | Evidence | |
|---|---|---|
| Every origin from every kingdom leads into the common quest | `tests/slow/origins.test.js`: the 5 origins × 6 kingdoms (30 openings) played by the story bot, each into Q1, inside the band (below) | ✅ |
| The main story from anywhere, to an ending | `tests/cast.test.js` (every realm's cast, no text left uncast); `npm run simulate:story -- 6 --every` reached an ending from all six (P10-04); `tests/slow/gate-d-campaigns.test.js`, 42 campaigns, 7 a kingdom (below) | ✅ |
| A guide for the first steps, with any origin | `tests/guide.test.js` (each origin's first steps, Skip, Show hints again, the stages) | ✅ |
| One world, open after the opening | `tests/old-saves.test.js`, `tests/slow/second-world.test.js` (a company from Gullhaven), `tests/slow/landed.test.js` and `world-sim` (the world alone) | ✅ |
| Drawn in code | `tests/assets.test.js` (no image but the three icons), `tests/browser/art.spec.js` (no screen requests an image) | ✅ |

## The origins' balance

`tests/slow/origins.test.js` (about 50 s), worth = gold + 15 a soldier + worn gear; the band is in `data/origins.js` (`origin_rules`). Every one of the 30 rows is inside the band.

| Origin | Gold | Soldiers | Worn gear | Level | Renown | Worth | The edge |
|---|---|---|---|---|---|---|---|
| Traveller | 44–64 | 2 | 77 | 1 | 5 | 151–171 | the horse (in the gear) |
| Noble | 35–62 | 3 | 75 | 1–2 | 5–7 | 155–182 | the axe (in the gear) |
| Farmhand | 60–87 | 3 | 42 | 1 | 3–5 | 147–174 | three men without a fee |
| Scout | 49–99 | 2 | 42 | 1–2 | 5–8 | 121–171 | +1 Agility (not counted) |
| Peddler | 78–100 | 2 | 42 | 1 | 5 | 150–172 | a merchant's thanks (in the gold) |

✅ **Confirmed** over all five and every kingdom. The scout is lowest in Aurelia and Hrothmark (121), within the band and with an edge the worth does not count. No retune.

## The world's tuning

P9-T's targets, moved here by the owner's rule. Measured with `node scripts/landed.js 360 --seed <n>`: the world alone for a year after the story's ending, three seeds side by side (about 3 minutes). At most two tries a number.

| What | Target | 4.15.0 (seeds 1, 2, 3) | 5.0.0 | |
|---|---|---|---|---|
| Wars | 20–50% of days | 23%, 23%, 34% | 22%, 27%, 15% | ✅ on two seeds; seed 3 under (below) |
| Risings | one to three a year | 0, 0, 0 (3–6 factions, all eased or met) | 0, 1, 0 | ❌ open (below) |
| Lords' deaths | two to six a year | 2, 0, 1 | 6, 5, 3 | ✅ |
| The coast's wars | the coast fights as a region of the one world | Ostrand–Saltreach 13–19 days; the coast's realms at war with the rest 20–85 days a pair | the same | ✅ |
| A realm keeps its last fort | no realm without a fort | Valedorn lost both by day 87 on seed 3 (its capital too), and `landed` failed | every realm keeps one on every seed; `landed` passes | ✅ |

What changed:
- **Deaths** (one try): a lord beaten in battle dies of wounds 12% of the time (6% before; 3% before 4.0.0). A second measurement with the same rule gave 5, 7 and 8, so a year of the world alone sees about 3–8.
- **The last fort** (one try): a siege of a realm's last fort needs three times its defence to begin (`lastFortRatio`, 2 before). The lords keep riding at its walls, but take it only with an army that outweighs it, so no realm is wiped out in its first months. This cost seed 3 its war days: with Valedorn not overrun, it was at war on 15% of days, not 34%.
- **Risings** (two tries): a mediator eases a faction's members by 2, not 5 (P9-T's 10 before that). The second try (0, a mediator buying time only) gave 1, 0 and 0, the same as the first, and was undone. The factions form (3–5 a year) but now most end with the AI ruler meeting their demands: a faction riding with half the loyal lords' strength is given what it asks.

### Open

- **Risings** are about one in three years of the world alone (target one to three a year). Both tries are used. What keeps them down is the AI ruler meeting demands it fears (`RULES.fear` in `js/rebellion.js`), a design choice: a weaker AI ruler would see more risings and more civil wars.
- **Wars** on one seed in three under 20% of days, once the last-fort rule stopped a realm being overrun. The war rules had their two tries in P9-T.
- **Runaway realms** (P10-00, a 30-year matter): not measured here (the 30-year run is about 50 minutes a seed). The last-fort rule may slow a runaway further. For the next night run.

## Sieges (B-01)

`node scripts/parity.js --siege 30`: the assault on the walls fought by the bot's careful captain, and simulated, 30 seeds a side, at a battle size of 150 (about 15 minutes).

| Side | Odds | Simulated | Fought | Over the odds | Target |
|---|---|---|---|---|---|
| Storming (4.15.0) | 41% | 33% | 60% | +19 | −5 to +25 ✅ |
| Defending (4.15.0) | 65% | 50% | 53% | −12 | −5 to +25 ❌ |
| Defending, the whole garrison beside you (try 1) | 65% | 50% | 87% | +21 | ✅, above B-01 |
| **Defending, 95% of it (5.0.0, try 2)** | 65% | 50% | 70% | **+5** | ✅ |

**Tuned** (two tries): defending a fort's walls, 95% of its garrison runs to the stretch under attack and fights beside you (90% before, P9-B5; the rest hold the other walls). At 90% a fought defence came out 12 under the odds, and no better than Simulate; at the whole garrison 21 over. At 95% it is 5 over, and 20 over Simulate (Simulate counts your company behind the walls as part of the defence). Storming is unchanged.

## The old failures

Each run alone on the final code.

| Slow file | Before (P10-00 and since) | 5.0.0 | Why |
|---|---|---|---|
| `landed` | failed: a realm with one riding lord (seed 1, 4.2.0); Valedorn without a fort (seed 3) | ✅ passes (325 s) | the last-fort rule (above) |
| Phase 7 exit | failed on seed 2 (316 crowns, 500 wanted) | ✅ passes (334 s) | the world's draws moved again; no change |
| Phase 8 exit | failed since 3.11.0 | ✅ passes (144 s) | no change: the one world's history no longer trips it |
| Phase 9 exit | failed since 4.2.0: Westholt never fell | ✅ passes (122 s) | the test's setup: the rising's households twice what a siege needs to begin (it already set them "as a longer civil war would"). A failed assault lifted the siege before, and the army turned to the vassals' other forts |
| Prototype D | failed since 3.11.0 | ✅ passes (33 s) | the test's setup: Aurelia raises no army while you serve it (on some rolls its own lords took Westholt and left nothing to retake), and you bring 48 men to Westholt's whole garrison of 59, not 12 |
| Prototype F | failed since 3.11.0 | ✅ passes (2 s) | the test's setup: no relief and no army for the two days of the siege (Aurelia's army relieved it within a day), and no lord dies of wounds in the setup |
| `battle-parity` sieges | defending −7.7 at 40 seeds, −12 at 30 | ✅ +5 at 30 seeds (the parity script; the whole file is for the night run) | the defending share (above) |

The three test changes are setup, not rules: each prototype is about lords' answers or a retake, and the bigger world's armies (from 4.2.0) came into their scenes. Each keeps the original checks.

## The scenario matrix (SC-01 to SC-52)

SC-01 to SC-44 are as in `docs/PHASE-9-VALIDATION.md`, with these changes: **SC-29** (long runs) is `tests/slow/long-run.test.js` (10 years) and `npm run long-run` (30 years, P10-00); **SC-30** (a save across a migration) is replaced by the refusal of an older world's save (`tests/old-saves.test.js`, D-P10g); **SC-34** (a phone, a large arena) is still the owner's phone, now in the new art.

The new start scenarios:

| Scenario | How it is accounted for |
|---|---|
| SC-45 A new game in each kingdom | `tests/cast.test.js` (every realm's cast and start town), `tests/browser/startup.spec.js` (choosing Ostrand) |
| SC-46 Each origin's opening quest, into the common quest | `tests/origins.test.js` (each opening walked), `tests/slow/origins.test.js` (5 × 6 by the bot) |
| SC-47 The main story begun far from the March | `tests/cast.test.js` (Q1 from Saltreach, Vessaro's columns), `gate-d-campaigns` (7 a kingdom) |
| SC-48 A first-time player's guide, skipped or followed | `tests/guide.test.js`, `tests/browser/startup.spec.js` |
| SC-49 Waiting days on the map, cut short by a band | `tests/map-speed.test.js`, `tests/browser/world-map.spec.js` |
| SC-50 A walk through every walkable town | `tests/town-hubs.test.js` (every person reached from the gate and back), `tests/browser/settlement.spec.js` |
| SC-51 Women in the ranks, their lines and faces | `tests/women-soldiers.test.js`, `tests/art-ui.test.js` |
| SC-52 Every screen in the code-drawn art, no image | `tests/art*.test.js`, `tests/assets.test.js`, `tests/browser/art.spec.js`; the visual baselines (pending) |

## The art (P10-G1 to P10-G6)

Done in code and checked headless; the rest is the owner's phone.
- **Headless benchmark** (P10-G1's baseline, desktop and an emulated phone): battles of 40, 100 and 200 at 60 fps everywhere; the map 48–60 fps. After P10-G2 to P10-G4 the new art draws within about 1.2× of the old sprites (`docs/NEXT-TASKS.md`).
- **The visual baselines:** not made; they need Docker. In `docs/PENDING-CHECKS.md` for the next night run.

## How it was checked

- **Fast tests:** 942 pass (`npm test`), with the houses and assault cases at the new numbers.
- **Lint:** clean but the 2 old warnings. **Typecheck:** clean.
- **Slow:** every file this task reaches, each alone and each under 8 minutes but the campaigns: `landed`, `world-sim`, `second-world`, `test-world`, `campaign-bots`, `happenings-bots`, `battle-extras`, `origins`, the Phase 7, 8 and 9 exits, Prototypes D and F all pass. `gate-d-campaigns` (42 campaigns, 7 a kingdom, about 41 minutes) passes: an ending from every kingdom, all three endings, every stage and branch, and the sandbox after. It first failed on the compromise ending, which needs the road, the packet and the evidence in one campaign: by chance once in 42 on 4.15.0's rolls and none on 5.0.0's. The story bot now plays a kept packet like a player who kept it for a reason (the road half the time, both charters on the table when it can); `tests/q4.test.js` plays the compromise directly as before. The siege parity (above).
- **Browser:** the full suite, 269 passed, 9 skipped, none failed (4.5 minutes), the five that failed under load in P10-G6 among them.
- **Not run** (the owner: nothing over an hour): the whole of `battle-parity` (its open-field scenarios are unchanged since P10-00), the 10- and 30-year long runs and the visual baselines. All three are in `docs/PENDING-CHECKS.md` for the next night run.

## Waiting on the owner's play (phone)

1. **A new game in another kingdom** (say Ostrand or the Vessaro League), with an origin you have not played: the opening quest into Q1, the guide's steps.
2. **The map** in the new art, zoomed out and in, by day and night: frame rate and taps (the map stress test in Debug, against P10-G1's baseline).
3. **Every town:** walk each of the eight, talk to someone, leave.
4. **Battles of 40 and 100,** fought: frame rate (Debug → battle benchmark), readability of the units and banners, the Prepare panel and the HUD.
5. **The menus:** the party sheet, a soldier's card, the Realm screen's lords and arms, a conversation's portrait, the market's icons.
6. **The world after the story,** a season or two: do wars, sieges and deaths feel alive?
7. **SC-34:** a mid-range phone, a large arena with cavalry and reinforcements: frame time and touch.
