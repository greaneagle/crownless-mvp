# Crownless — Phase 11, "The Art of War" (plan for 6.0.0)

_Written 2026-11-26 at build 5.0.0 (commit 4c0a044, the P10-T commit, with nothing after it: checked with `git log` at the start of planning). **A plan only: nothing here is built.** Each task waits for the owner's word to start. This document is the phase's design and strategy; each task's specification and Brief is in [`NEXT-TASKS.md`](NEXT-TASKS.md) ("Phase 11"), and the order, versions and decisions are summarised in [`NEXT-PLAN.md`](NEXT-PLAN.md) §6c and §8. The preliminary Phase 12 is a separate document, [`PHASE-12-ROADMAP.md`](PHASE-12-ROADMAP.md)._

**How to read the labels.** **Required** is what the owner's direction asks for. **Illustrative** is an example of a direction, not a commitment (a name, a number, a pairing). **Needs evidence** is a choice that waits on a measurement the plan schedules. No balance number in this plan is a target unless it is taken from an existing owner target (B-01's "fought 5–15 points over the stated odds", P9-B1's frame budgets) or is measured first by P11-00.

---

## 1. Executive summary

Crownless 5.0.0 already has most of the machinery of a combat game: attack phases (windup, active, recovery), frontal arcs, an input buffer, shields that block and cover a neighbour, braced spears, cavalry that ramp up and ride through, archers who need a clear shot, formations, divisions, four layers of command, morale with rout and rally, reserves on both sides, sieges, tournaments and a code-drawn art kit that already draws swing phases, thrusts, bow draws and horses.

What it lacks is **difference**. Every melee weapon in the game shares one timing (0.16 s windup, 0.12 s active, 0.24 s recovery), one 90° arc and unlimited targets inside it; items differ only by a damage number; Shield, Archery and Riding do nothing; Agility does nothing; the hero cannot shoot or ride in battle; and the hero's body is not built from equipment at all but from a fixed "hero" troop row (speed 142, reach 67), faster and longer-armed than nearly every soldier. Section 3 shows, from the code, why that makes holding Attack the best tactic, and why equipment and group tactics feel weak.

Phase 11 therefore **builds depth on what exists rather than replacing it**:
1. **One authoritative combat profile** (P11-01) resolved from data for every fighter (hero, companion, soldier, lord, tournament fighter, practice dummy) and read by the simulation, the AI, the auto-resolve, the previews and the art. In its first build it reproduces 5.0.0 exactly, proven by identical seeded battles.
2. **Loadouts and one shared gear check** (P11-02, P11-03): carried versus wielded, a primary and secondary weapon, shields stowed when a weapon needs both hands, requirements by attribute, skill and training, every limit explained in words before purchase, equipping, preparing, entering a tournament and using.
3. **What you see is what you use** (P11-04, P11-01's timing): the hero's figure, portrait, sheet and previews drawn from the active loadout and mount; the dangerous part of every drawn attack is the dangerous part of the simulation.
4. **A combat rhythm** (P11-05, P11-06): weapon-specific commitment, a longer recovery after a swing that hits nothing, limited targets per swing, shield pressure, brief capped stagger, weapon guard, armour weight and movement. Mashing stays possible and comfortable; timing beats it.
5. **Bows, crossbows and horses for the hero** (P11-07, P11-08) on the existing projectile and cavalry foundations, with assisted aim on phones.
6. **Soldiers and commanders who use all of it** (P11-10 to P11-15): individual AI with styles and honest reactions, troops defined by their weapons, formations whose shapes really behave differently, combined arms proven in a controlled tactics lab, a Prepare screen and a short battle report.
7. **Regional arms, specialist instructors and tournaments of several formats** (P11-16 to P11-19), all on the same engine and rules.
8. **Balance last but measured throughout** (P11-20, P11-T): composition-aware auto-resolve only as far as the measurements support it, honest odds, the world checked for regressions; acceptance with the owner's play on the phone.

There are **22 tasks** in six playable milestones (§5), from **5.0.1** (P11-00) to **6.0.0** (P11-T). The four blocking decisions were answered by the owner on 2026-11-26 (§17): old saves stay ignored (D-P11a keeps D-P10g), the level cap rises so the budget fits the combat skills (D-P11b), Two-Handed and Polearm join the skills (D-P11c), and the hero's body follows their equipment like everyone's (D-P11d).

---

## 2. The 5.0.0 repository, as verified

**Baseline.** Build 5.0.0, commit `4c0a0447b54a72345c0aba970a3a41c176bd6fb7` (2026-11-26), working tree clean, no later commits. Save schema **v30** in code (`js/save.js` `VERSION = 30`), the world's edition 2 (`worldEdition`), old saves refused and kept under D-P10g. 942 fast tests, 269 browser tests (9 visual skipped until the Linux baselines exist), 16 slow files. Runtime: about 42,000 lines in `js/` and `data/`, no runtime dependency; Playwright is the only development dependency.

### 2.1 Combat engine (`js/combat.js`, `js/units.js`)
| What | Where | Today |
|---|---|---|
| Attack timing | `units.SWING` | One timing for every melee attack in the game: windup 0.16 s, active 0.12 s, recovery 0.24 s (GDD §6's one-handed sword) |
| Attack rate | `combat.COOLDOWN` | The hero may attack every `SWING.total` (0.52 s); every AI melee fighter every 0.86 s, whatever the weapon |
| Arc and targets | `resolveSwing` | 90° frontal arc; **every** opponent in reach and arc is hit once per swing |
| Reach | troop `reach` | 48 for most foot, 70–72 for spears and pikes, 70 for cavalry; the **hero 67** (the `hero` troop row) |
| Speed | troop `speed` | Foot 82–94, cavalry 125–150; the **hero 142** on foot |
| Damage | `mitigate` | `max(1, round(raw × 100 / (100 + 4 × armour)))`; one damage kind; armour is a number from the troop or the hero's summed items |
| Being hit | `hit` | 6 px knockback on every hit, a 0.14 s flash; no interruption of the target's own swing, no stagger, no stun |
| Shield | `hit`, `groups.shouldGuard` | A raised shield absorbs **every** frontal blow (120° arc) for ever, at 65% walking speed; AI shield troops raise it **the same frame** an opponent in front winds up (no reaction time); shield cover protects the neighbour on the shield side |
| Hero input | `updateHero` | Move, Attack (tap, hold, Space, mouse), Block (hold); a 100 ms input buffer; Attack held swings again at once on every cooldown |
| Braced spears | `groups.braceAgainst` | `brace: true` troops (and any soldier in a square) stop a charging rider in front and hurt it ×1.6 |
| Cavalry | `cavalryAi` | Ramp to full speed in 0.8 s, ×1.2 charge bonus past 0.6 momentum, ride through, wheel after 0.6 s; Hold and Follow keep them back |
| Archers | `startAttack`, `updateArrows` | Fire only when the nearest opponent is inside `range + 20`; the arrow then flies 1.6 s at 240–300 px/s (384–480 px) whatever the range; a miss is an angle error by `accuracy`; hit radius 19 px around the target's chest; trees, walls and crates stop arrows; raised shields and shield cover stop arrows from the front; no friendly fire; a step of at most 0.05 s, so a bolt faster than about 380 px/s could pass through a target |
| Hero ranged and mounted | — | **None.** The hero is always on foot with one melee weapon; the horse (`equipment.horse`) only speeds the map |
| AI | `ai`, `enemyTarget` | Retarget every 0.17–0.41 s, go to the nearest (the enemy prefers archers, the wounded and a lone hero), swing when inside reach; no spacing, no waiting for an opening, no use of the opponent's recovery |
| Morale | `js/morale.js` | Cohesion per group from losses, odds, flanks, routs, veterans, the hero, supplies; hold, waver, fall back, rout; Rally every 30 s |
| Formations | `js/formations.js`, `js/divisions.js` | Loose, shield wall (slower, shields up, wider cover, strike over), wedge (quicker, ×1.3 first blow), line (×0.9 speed), column (×1.1), square (braces on every side, ×0.5); a ford breaks them; per division |
| Command | `js/divisions.js`, `js/prep.js`, `js/tactics.js` | Six division slots; Auto, Balanced, Defensive, Aggressive and Custom plans; captains, facings, three saved plans; live timed orders (Move, Charge, Fall back, Face; now, 5 s, 10 s, on the volley) |
| Scale | `BATTLE`, `shareOf` | 20–200 at once (default 150); fields shared by numbers; reserves on both sides; stall guard after 45 s |

### 2.2 The hero, items and progression (`js/character.js`, `data/items.js`, `data/character.js`)
- **Slots:** weapon, offhand, head, body, hands, feet, horse, ring. One weapon; the offhand is a shield or nothing.
- **Items:** 23 pieces of gear. Weapons: worn sword (17), hand axe (19), arming sword (21), war mace (22), knight's sword (25): all one-handed melee, differing **only** in damage. Shields: oak (block), kite (block, +1 armour), heater (block, +2). Helmets 1–3 armour, body 1–5, hands 0–1, feet 1–2. Horses nag, rouncey, courser: map travel +10%, +20%, +35%, nothing in battle. Every item has a `weight` that **nothing in combat reads** (only trade goods' weight is used).
- **Forging** (`js/blacksmith.js`, `C.forge`): pieces become items of their own (`arming_sword+1`, `forgedFrom`), +2 damage or +1–2 armour a level, two levels at most.
- **The hero's numbers** (`heroCombat`): HP `60 + 5 × Strength`; damage = weapon × (1 + 0.03 × One-Handed); armour = the sum of worn items; `canBlock` from a shield. Reach, speed and attack rate come from the `hero` troop row and do not change with gear.
- **Skills** (8): one-handed (+3% damage), leadership (company size), tactics (auto-resolve), pathfinding (travel), trade (prices) work; **shield, archery and riding are described as "later update" and do nothing**.
- **Attributes** (4): Strength gives HP; Intelligence gives XP; **Agility and Charisma do nothing in play** (Charisma only meets story conditions; Phase 10 recorded the scout's +1 Agility as "not counted").
- **Progression:** level cap 10 (the GDD's MVP cap), XP to the next level `round(100 × L^1.35)` (about 8,400 XP from 1 to 10), one skill point a level (9 earned), one attribute point at even levels (5 earned), attributes start at 5 (+1 from the origin; maximum 20), skills at 0 (+1 from the origin; maximum 10).
- **Effective skill** (`character.skill`) adds item bonuses (the Ring of Roads) and the companions' and retinue's bonuses: anything that gates equipment on it would be circular.

### 2.3 Troops (`data/troops.js`)
41 troops in six realms, the outlaws and the free cities, three tiers. HP and damage rise with the tier (T1 about 45/7, T2 60/10–13, T3 80/14–18). The `look` names a weapon (sword, axe, club, spear, pike, lance, bow, crossbow), but **the weapon is drawing only**: an axeman and a footman of the same tier fight with the same timing, arc and reach. Capabilities are flags (`shield`, `brace`) and a `ranged` block. The content check `lookAgrees` infers "crossbow" from a projectile speed of 300 or more. Two oddities: the Legionary braces with a sword's reach (48); the Pavisier is a braced shield-and-sword troop. Women's lines (Hrothmark's shieldmaidens, the League's balestriere, the outlaw huntresses; D-P10d) are their own troops with their own upgrades.

### 2.4 Tournaments (`js/tourney.js`, `data/tournaments.js`)
Eight host towns, every 14 days (staggered), 3 days open; eight fighters; three bouts on the battle engine (`g.duel`: the hero alone against one fighter on the tourney ground, no soldiers, morale or orders); one loaner kit (arming sword, kite shield, iron helm, gambeson, boots); opponents are a Mercenary, a stronger Mercenary and a Sellsword with multiplied HP and damage, +8% per earlier win in that town; fee 20 + 0.5 × renown (20–150); prize 150 / 50 crowns, renown, standing; ×0.6 per earlier win in the town (floor 0.2); a 28-day cooldown; a named rival. The hero's own gear is never moved; a bout left unfinished is forfeit. **In a bout the hero keeps reach 67 against the opponent's 48 and attacks 1.65 times as often.**

### 2.5 Auto-resolve (`js/autoresolve.js`)
Power = Σ tier power (T1 1, T2 1.7, T3 2.5) × 1.5 for the company's soldiers, plus the hero's `HP × damage / (45 × 7)` (× 1.5 with a shield), × (1 + 0.03 × Tactics); odds by a power law (2 for a skirmish rising to 4.2 for a battle of 80 and more), clamped to 10–90%. **Composition is invisible**: twenty archers and twenty spearmen of one tier are the same number, and so are cavalry against spears. P9-B2 already recorded that a company with many archers wins far above Simulate's odds in big battles.

### 2.6 Art (`js/art/`)
- **The kit** draws a look (`data/troops.js` `LOOKS`, `CL.content.LOOK`) in a pose. Weapon parts exist for sword, axe, greataxe, club, hammer, spear, pike, lance, staff, bow (with `bowSize`), crossbow; horses in profile; shields by culture.
- **The hero** is drawn from `heroFor(character, canBlock)`: always mail, a plumed helm, a sword; only the shield follows the gear. A tournament kit changes nothing but the shield. Portraits and the creator's preview use the same look.
- **Poses** read `CL.units.SWING` for the phase lengths (`poseOf`), so any weapon timing other than the sword's would be drawn wrong today.
- **Mounting is a role:** `body()` draws a horse only for `role === 'cavalry'`; `units.mass`, `charging`, `passesThrough` and `combat.ai` branch on the role too (about 15 role checks across `combat.js`, `units.js`, `groups.js` and the art). A mounted hero would today need to stop being the hero.
- **Caches:** per battle a `WeakMap` of looks per unit (built once, never invalidated); baked frames keyed by `look.key|face|step|team|pose|scale`, where `look.key` is `troop|realm|seed` (seed one of four), 3,000 kept, least recently used dropped. The hero and anyone mid-action in a small battle are drawn live. A look that changes inside a battle (a weapon switch, a mount lost) would be drawn stale; two soldiers of one troop with different gear would collide in the bake cache.
- **Budgets** (P10-G2, headless): 200 on the field draws in 0.7–0.85 ms at full speed, within about 1.2× of the old sprites. **No physical-device numbers yet for the new art** (P10-T's phone list).

### 2.7 Tests and tools that Phase 11 will lean on
`scripts/parity.js` (fought by the campaign bot's hero against Simulate; B-01's target), `scripts/extras.js` (formations, high ground, the wagon, each switched off in turn), `scripts/bench-battle.js` and Debug → Battle benchmark (average simulation and drawing per frame and the slowest frame; no percentiles, no cache or memory figures), `tests/slow/battle-parity.test.js`, `battle-extras`, `tests/combat.test.js`, `cavalry`, `tourney`, `formations`/`extras`, `art-battle`, `tests/browser/battle.spec.js`, `tourney.spec.js`, `art.spec.js`. **The campaign bot's hero walks at the nearest enemy and holds Attack inside 70 px** (`tests/helpers/campaign-bot.js`): every parity figure since B-01 is a button-masher's.

### 2.8 Stale documentation found (to correct; see §18)
- `docs/SAVE-FORMAT.md`: its header says schema v28 and "saves from every older build still load"; the code is v30 and D-P10g refuses every save from before 4.2.0. The export table's `version` row stops at 6. (Corrected in this planning task: header only.)
- `docs/ROADMAP.md` §1: "last reviewed at 3.0.0", "11 classic-script modules", "169 PNGs", "34 tests": a picture of 0.3. (Header corrected in this task; §1 left as the historical record with a note.)
- `js/worlds.js` and `#worldPick` in `index.html` still carry the world chooser and the `crownless_world` key, though P10-02 made one world. Code, so not touched here: a cleanup for P11-02, which touches the save path anyway.
- `data/character.js` describes Shield, Archery and Riding as "later update": they become real in P11-05, P11-07 and P11-08.
- `docs/ART-STYLE.md` says the hero's look comes from `heroFor(character, canBlock)`: replaced in P11-04.

---

## 3. Why holding Attack wins, and why equipment and tactics feel weak

These are read from the code above; P11-00 measures them (§9).

1. **The hero out-reaches and out-paces almost everyone.** Reach 67 against 48 means the hero can hit a footman from 49–67 px where the footman cannot reply; speed 142 against 82–94 (and 125–150 for horse) means the hero chooses every engagement and can always leave. Standing still and swinging inside 67 px is already the optimal distance-control play.
2. **The hero attacks 1.65 times as often as anyone else** (0.52 s against 0.86 s), whatever the weapon, and holding Attack re-swings on every cooldown. There is no cost to a swing that hits nothing.
3. **Every swing hits everything in a 90° cone**, so swinging into a crowd is never wasted; there is no reason to pick a target.
4. **Being hit changes nothing but HP and a 6 px push.** No interruption or stagger means trading blows is always even in tempo, and the faster attacker (the hero) wins every trade.
5. **The AI never uses an opening.** It closes to 38 px and swings when its cooldown allows; it does not wait outside reach, does not punish a miss and does not time a block. Shield troops raise their shields the instant the hero winds up, which looks clever but simply turns the fight into "swing until the shield troop's own cooldown makes it swing back".
6. **Blocking is free and total.** A raised shield stops every frontal blow for as long as it is held; the only counter is a flank. The hero can turtle; AI shield troops can't be pressured.
7. **Equipment differs by one number.** A hand axe, a mace and a sword differ only in damage (17–25), so the most expensive weapon is simply best; armour is a sum with no weight, so the heaviest is simply best; the horse does nothing in battle; there are no bows or two-handed weapons for the hero. With nothing to trade off, there is nothing to choose.
8. **Formations differ by small multipliers.** A line is a slower loose block (×0.9), a column a quicker one (×1.1); neither changes frontage, engagement or flank exposure. On Hold, soldiers leave their place to fight anything within 85 px. A shield wall and the square do have real effects (frontal cover, bracing on every side), and the wedge's first blow is real, but their benefit hasn't been measured against a plain charge since P7-11 measured each feature alone.
9. **Auto-resolve can't see composition,** and the parity bot charges, so neither the odds nor the measurements reward combined arms.
10. **The art can't show a difference that doesn't exist,** and the one it could show (the hero's gear) isn't drawn.

The fix is not to make input unresponsive or to punish repeated presses, but to give each weapon a commitment, make misses and blocked blows cost tempo, let blows interrupt within limits, give the AI honest reactions and the patience to use openings, give the hero the same body rules as everyone else (D-P11d), and give equipment, formations and composition real trade-offs that show on screen.

---

## 4. Outstanding from Phase 10 (inherited, not Phase 11 regressions)

| Item | Kind | Where it is planned |
|---|---|---|
| The screenshot baselines (Linux, Docker; the 9 `@visual` tests skip until then) | Pending check | The night run, whenever the owner runs it in Phase 11 (`docs/PENDING-CHECKS.md`): baselines of the build current then; until they exist the visual tests skip and art tasks review screenshots by hand |
| The whole `battle-parity` (30–45 min) | Pending check | The night run, whenever it comes. The 5.0.0 reference is P11-00's short parity run (40 seeds); if the whole file is wanted for 5.0.0 itself, the night run also runs it from a worktree of commit 4c0a044 |
| The 10- and 30-year long runs on the tuned world | Pending check | The night run, whenever it comes; a failure is judged against P10-T's results, and against 5.0.0 from a worktree of 4c0a044 when it is unclear whether Phase 11 caused it |
| The owner's phone play of 5.0.0 (P10-T's seven items: a new kingdom and origin, the map, every town, battles of 40 and 100, the menus, the world after the story, SC-34) | Owner | P11-00: before P11-01, together with the Phase 11 baseline questionnaire (§13) |
| Risings about one in three years (target one to three a year); wars under 20% of days on one seed in three; runaway realms over 30 years | Tuning, open | **Phase 12** (P12 area P), unless P11-20's world check shows Phase 11 made them worse |
| Physical-device frame times for the new art (only headless numbers so far) | Measurement | P11-00 (owner's phone, Debug benchmark) and P11-12 |
| Gate A's real-phone combat-feel checklist (open since 0.4.0) | Owner | Folded into P11-00's questionnaire and P11-05's milestone play |
| SC-37 (balance) "the owner's feel check on the phone" since B-01 | Owner | P11-00 baseline, P11-05 and P11-T |
| R-01–R-03 commercial readiness | Deferred by the owner | Out of Phase 11 and Phase 12 (no packaging, payments or accounts) |
| W-09 route planning, A-01 accessibility review, splitting `js/ui.js` | Backlog | Unchanged; P11 tasks that touch `js/ui.js` split the part they touch only if it helps (NEXT-PLAN §10) |

**Rule for the phase:** a failure P11-00 finds in a check that only Phase 10 code reaches is inherited; it is recorded and fixed by P11-00 itself only if it blocks the baseline. Anything that changes after P11-01 is measured against P11-00's numbers and counts as a Phase 11 regression.

---

## 5. Master table, order and milestones

**Readiness:** **Ready** (start on the owner's word), **Ready after decision** (an owner decision in §17 first), **Specified** (detailed; re-checked against the code when it starts, because earlier Phase 11 tasks change what it builds on). **Priority:** P1 the phase fails without it; P2 required by the owner's direction; P3 required but smallest-viable scope is acceptable.

| ID | Task | Size | Priority | Needs | Version | Milestone | Readiness |
|---|---|---|---|---|---|---|---|
| **P11-00** | Baseline, measuring tools and the inherited checkpoint | M | P1 | — | 5.0.1 | M0 Baseline | ✅ Done (H-00 to come) |
| **P11-01** | One combat profile for every fighter (no change in play) | L | P1 | P11-00 | 5.1.0 | M1 | ✅ Done |
| **P11-02** | Carried and wielded: loadouts and one gear check | M–L | P1 | P11-01 | 5.2.0 | M1 | ✅ Done |
| **P11-03** | The progression budget and equipment requirements | M–L | P1 | P11-02 | 5.3.0 | M1 | ✅ Done |
| **P11-04** | The equipment you see | M–L | P1 | P11-02 (parallel with P11-03) | 5.4.0 | M1 | ✅ Done |
| **P11-05** | Melee rhythm and defence | L | P1 | P11-01, P11-04 | 5.5.0 | **M1 "The weapon in your hand"** | ✅ Done (M1 played, owner 2026-11-26: good) |
| **P11-06** | Armour, weight and movement | M | P2 | P11-05 | 5.6.0 | M2 | ✅ Done |
| **P11-07** | Bows and crossbows in your hands | L | P1 | P11-05, P11-06 | 5.7.0 | M2 | ✅ Done |
| **P11-08** | Fighting from the saddle | L | P1 | P11-06, P11-07 | 5.8.0 | **M2 "Bow and horse"** | ✅ Done |
| **P11-09** | Controls, feedback and teaching (consolidation) | M | P1 | P11-05, P11-07, P11-08 | 5.9.0 | M2 | ✅ Done |
| **P11-10** | Fighters who think: individual AI and styles | L | P1 | P11-05, P11-07, P11-08 | 5.10.0 | M3 | ✅ Done |
| **P11-11** | Troops by their weapons | M–L | P1 | P11-10 | 5.11.0 | M3 | ✅ Done |
| **P11-12a** | The storybook look: baseline and integration analysis (D-P11m) | M | P1 | P11-11 | 5.11.1 | M3 | ✅ Done |
| **P11-12b** | The Stonebridge vertical slice: the character system and Stonebridge | L–XL | P1 | P11-12a | 5.12.0 | M3 (**the owner accepts the slice**) | ✅ Done (accepted 2026-11-27) |
| **P11-12c** | The environments: every town, battlefield, siege and the map | XL | P1 | P11-12b and its acceptance | 5.12.1 | M3 | ✅ Done |
| **P11-12d** | One UI language across every screen | L | P1 | P11-12b | 5.12.2 | M3 | Specified |
| **P11-12e** | Performance, caches, visual regression and acceptance (the original P11-12) | M–L | P1 | P11-12c, P11-12d | 5.12.3 | **M3 "Soldiers who fight like it"** (**the owner accepts the graphics and the phone**) | Specified |
| **P11-13** | Formations and orders that hold | L | P1 | P11-11 | 5.13.0 | M4 | Specified |
| **P11-14** | Combined arms and the tactics lab | M–L | P1 | P11-13 | 5.14.0 | M4 | Specified |
| **P11-15** | Prepare and the battle report | M | P2 | P11-14 | 5.15.0 | **M4 "Command that matters"** | Specified |
| **P11-16** | Regional arms | M | P2 | P11-11, P11-03 | 5.16.0 | M5 | Specified |
| **P11-17** | Masters at arms: specialist training and the practice yard | L | P2 | P11-16 | 5.17.0 | M5 | Specified |
| **P11-18** | The walls and other special fields | M | P1 | P11-13, P11-08 | 5.18.0 | M5 | Specified |
| **P11-19** | The lists: tournament formats | L | P1 | P11-10, P11-17 | 5.19.0 | **M5 "Masters and lists"** | Specified |
| **P11-20** | Auto-resolve, military balance and the world | M–L | P1 | P11-14, P11-18, P11-19 | 5.20.0 | M6 | Specified |
| **P11-T** | Tuning and acceptance | M | P1 | all | **6.0.0** | **M6 "The Art of War"** | Specified |

**Why this order.**
- The **profile comes first and changes nothing** (P11-01), so every later difference is a deliberate data change measured against an identical baseline.
- **Loadouts and requirements early** (P11-02, P11-03): the shape of the save and of every equipment screen is settled once, before weapons multiply.
- **Art beside mechanics, not after** (P11-01 moves the poses onto the profile's timing; P11-04 draws the real gear before the melee rhythm, so P11-05's timings are judged on screen).
- **Melee, then armour, then ranged, then mounted** (P11-05 to P11-08): ranged and mounted both depend on commitment and movement rules, and mounted archery needs both.
- **Controls consolidated mid-phase** (P11-09), after the three new input families exist, not at the end.
- **AI after the player's mechanics** (P11-10), so the AI follows the same rules; **troops after the AI** (P11-11), because a troop is a profile plus a style.
- **A performance checkpoint** (P11-12) once the variety of looks and AI exists, before formations multiply the work. **Expanded (D-P11m, 2026-11-27)** into the storybook graphics, UI and performance milestone P11-12a to P11-12e: a baseline, a Stonebridge vertical slice the owner accepts, then every environment, one UI language, and the performance and visual acceptance; P11-13 waits for the owner's final acceptance.
- **Formations, then combined arms, then Prepare** (P11-13 to P11-15).
- **Regional arms, then training, sieges, tournaments** (P11-16 to P11-19): instructors teach regional arms; tournament formats use the training, the styles and the mounted and ranged rules.
- **Balance and auto-resolve last** (P11-20), but every task measures its own effect against P11-00 and keeps parity inside the band it was in.

**Playable milestones (the owner plays each before the next begins):**
| Milestone | After | What the owner tries (scripted in §13) |
|---|---|---|
| M0 Baseline | P11-00 | 5.0.0 as it is: the phone list and the combat questionnaire |
| M1 The weapon in your hand | P11-05 (5.5.0) | Duels and small fights with a sword and shield, an axe, a mace, a two-handed weapon and a spear; switching weapons; seeing the gear on the hero; the requirement messages in a shop |
| M2 Bow and horse | P11-09 (5.9.0) | A contract fought as an archer, as a mounted knight and as a horse archer; the new controls on the phone |
| M3 Soldiers who fight like it | P11-12e (5.12.3) | Battles against each realm's troops; bandits against veterans; the frame rate at 40, 100, 150, 200; the storybook look everywhere (the Stonebridge slice accepted first, after P11-12b) |
| M4 Command that matters | P11-15 (5.15.0) | The same battle won by charging and by a plan; Prepare and the report |
| M5 Masters and lists | P11-19 (5.19.0) | A specialist training quest; a siege; three tournament formats |
| M6 The Art of War | P11-T (6.0.0) | The acceptance sessions (§13) |

**Parallel work.** P11-03 and P11-04 touch different files (`js/character.js`, `data/character.js`, the shop and sheet UI against `js/art/`) and may run side by side. Nothing else in the phase should: almost every task touches `js/combat.js` or the profile.

---

## 6. Equipment and the combat profile (design requirements)

### 6.1 One resolved profile
**Required.** A fighter's combat numbers come from one function, `CL.profile.of(unit)` at battle start and `CL.profile.resolve(source, context)` anywhere else (sheet, shop, preview, auto-resolve, tests), built from:
1. a **family** (`data/weapons.js`, new): the defaults for a kind of weapon;
2. an **item** (`data/items.js`) or a **troop**'s weapon reference, overriding the family where it differs;
3. the **wielder**: attributes, skills, training, armour weight, mount, traits, fine kit, morale;
4. the **context**: on foot or mounted, a tournament's rules, the map (walls, ladders), the formation.

The simulation, the AI, the art, the auto-resolve, the previews and the requirement checks read the resolved profile; **no other module computes reach, timing or damage of its own.** A test greps for literals of the old constants (`SWING.`, `COOLDOWN.`, `reach - 1`) outside the profile.

### 6.2 Profile fields
Not every family uses every field; unset means the family default.

| Field | Meaning | Used by |
|---|---|---|
| `family` | sword, axe, mace, greatsword, greataxe, spear, polearm (pike), lance, shortbow, longbow, composite bow, crossbow, unarmed | everything |
| `hands` | 1 or 2 | the gear check (shield stowed), the art (grip) |
| `damage` | raw damage (the item's existing `stats.damage` stays the source) | combat |
| `reach`, `minRange` | the far edge of a blow; the distance inside which a long weapon hits weakly (spears, pikes, lances) | combat, AI spacing, art length |
| `windup`, `active`, `recovery` | seconds; the dangerous part is `active` | combat, AI, art (normalised progress) |
| `miss` | extra recovery when a swing hits nothing (in seconds, or a factor) | combat (mashing costs tempo) |
| `arc`, `maxTargets` | the cone of a blow and how many it can strike | combat |
| `pierce` | how much of the target's armour it ignores (maces) | `mitigate` |
| `shieldPressure` | how hard it presses a raised shield (axes) | defence |
| `knockback`, `stagger` | push distance and the chance or strength to interrupt a windup | combat (capped, §10.4) |
| `poise` | from armour and two-handed grip: resistance to stagger | combat |
| `moveDuringAttack` | walking speed while committed | combat |
| `guard` | `shield` (full frontal block), `weapon` (a narrower guard that takes part of a blow), `none` | defence |
| `mounted` | usable from horseback: `yes`, `no`, `penalty` | gear check, combat |
| `armourLimit` | the heaviest armour it works well with (a bow and plate) | gear check, combat |
| `ranged` | `range` (effective), `maxRange`, `draw` (or `reload`), `speed` (projectile), `spread` (accuracy), `drop` (damage past the effective range), `ammo` | archery |
| `switch` | seconds to bring this weapon to hand | loadouts |
| `req` | attributes, skills, training (§7) | the gear check |
| `look` | the art kit's part and length (`weapon`, `len`, `bowSize`, grip) | art |

### 6.3 Families (initial selection; values to be set by P11-05 to P11-08 against measurements)
**Required:** a small set with distinct identities, built mostly from kit parts that already exist. **Illustrative:** the identities below follow the owner's direction; none of the trade-offs is a number yet.

| Family | Identity | Existing kit part | Hero items (existing → new) | Troops today that use it |
|---|---|---|---|---|
| Sword (1H) | Versatile: middling reach and speed, 2 targets, a shield | sword | worn, arming, knight's sword | footmen, guards, legionaries, mercenaries… |
| Axe (1H) | Shield pressure and impact, shorter reach, 1–2 targets | axe | hand axe | axemen, huscarls, reavers, clansmen |
| Mace (1H) | Ignores some armour, staggers, short | club, hammer | war mace | levies (club), militia |
| Greatsword (2H) | Longer reach, wider arc, slower recovery, no shield, weapon guard | **new part** (a longer sword, two-handed grip) | new | none (a lord's or champion's weapon) |
| Greataxe / longaxe (2H) | Heavy impact, knockback, long commitment | greataxe | new (Hrothmark longaxe, §6.5) | none today |
| Spear (1H, short) | Reach and distance control; a shield allowed; braces | spear | new | spearmen, horse scouts, light horse |
| Pike / polearm (2H, long) | Longest reach, weak inside `minRange`, braces strongly, no shield | pike | new (regional) | pikemen |
| Lance (mounted) | Damage from momentum, only from the saddle, weak at a standstill | lance | new | riders |
| Shortbow | Quick draw, mobile, shorter range, usable mounted (with penalty) | bow (`bowSize` 1) | new | hunters, skirmishers |
| Longbow | Range and power, slow draw, foot only, light armour | bow (`bowSize` 1.15) | new | longbowmen, marksmen, fell wardens |
| Composite / horse bow | Compact, made for the saddle, short range | **new part** (recurve) | new (regional, D-P11g) | none today |
| Crossbow | Slow reload, high damage and pierce, flat fast bolt, simple to aim (Strength, not Archery) | crossbow | new | the League's and Saltreach's crossbows |

**Explicitly not in the initial set** (scope): throwing weapons, flails, daggers, dual wielding, javelins. A family can be added later as data plus a kit part.

### 6.4 No universal best
**Required design rules,** checked by P11-05 to P11-08's scripted matchups and P11-20's balance pass:
- Every family has at least one matchup it wins and one it loses against another family at a similar price (the matrix in §10.5).
- Price buys **refinement inside a family** (a little more damage, a slightly shorter recovery, a better guard) or **a different trade-off**, never a strict improvement on every field across families. A cheap spear must beat an expensive sword at holding a rider off; a cheap shortbow must beat a dear longbow at shooting while moving.
- Forged variants (`+1`, `+2`) keep their family, profile, look and requirements (`forgedFrom`), and add only what `C.forge` adds.
- The loaner kit of a standard tournament is a middling sword and shield, usable by a new character (no requirement above the starting values).

### 6.5 Regional arms (P11-16; from the realms' existing identities)
**Required:** a limited set, consistent with `data/factions.js` and the troop lines. **Illustrative names** (final names from the owner or kept as working names):

| Realm (its description in the data) | Regional piece | Why it fits | Training? |
|---|---|---|---|
| Valedorn ("knightly border lords"; Rider with a lance; Longbowman) | A knight's lance and a warhorse (destrier); the Valedorn warbow | Its only cavalry is a lancer; its archers are longbowmen | Lance couching: yes. Warbow: Archery and Strength, no training |
| Aurelian Remnant ("heirs of imperial law"; legionaries with heater shields) | A legion spear that keeps the shield (short spear + heater) | Its spearman → legionary line already braces with a shield | No (a requirement in Polearm) |
| Hrothmark ("heavy infantry and axemen") | The Hrothmark longaxe | Its whole line carries axes | Yes |
| Vessaro League ("crossbowmen and light horse") | The League arbalest (a heavy crossbow); a light-horse mount | Its archers are crossbows; its cavalry the fastest in the data | Arbalest: Strength only. Light horse: Riding |
| Kingdom of Ostrand ("shieldmen and bowmen" of the cliffs) | The cliff bow (a long-ranged bow from high ground) and the Ostrand kite | Its bowmen are its identity | No |
| Saltreach League ("pikes and crossbows") | The flats pike (the longest polearm) | Its line is pike and crossbow | Yes (Polearm) |
| The free ports (Merrow, Gullhaven: "full of swords for hire") | A compact horse bow, taught by a foreign master | **No realm in the data has horse archers**; a free port's mercenary master adds the style without changing any kingdom (D-P11g) | Yes |

Nothing here adds a troop line, changes a realm's description or touches the women's lines.

---

## 7. The progression budget (P11-03; decision D-P11b)

### 7.1 What a character can reach today
| | Start | Earned by level 10 | Best case at level 10 |
|---|---|---|---|
| Attribute points | 5 in each of 4, +1 in the origin's | 5 (levels 2, 4, 6, 8, 10) | **10** in one attribute (11 for the origin's own); for two attributes, e.g. 8 and 8 (or 9 and 7) |
| Skill points | 0 in each of 8, +1 in the origin's | 9 | **9** in one skill (10 for the origin's own); in practice 2–3 skills at 3–4 |
| Origins' attribute | traveller Agility, noble Charisma, **farmhand Strength**, scout Agility, peddler Charisma | | |

Consequences:
- A **Strength 10** requirement costs every attribute point a non-farmhand earns in the whole game; **Strength 12 is unreachable** for anyone. A Riding 4 requirement plus Archery 4 for a horse bow is 8 of 9 skill points, leaving nothing for Leadership, Tactics, Trade or Pathfinding.
- Today only **five skills do anything**; Phase 11 makes Shield, Archery and Riding real, and may add Two-Handed and Polearm (D-P11c). That is 8–10 skills competing for 9 points: specialisation would become accidental failure.
- **Agility does nothing yet.** It is the obvious home for movement, recovery and draw speed, which also makes the traveller's and scout's +1 count.
- **Phase 12** will want points for trade, leadership and social skills: the budget must leave room for it now.
- **XP pace is unmeasured.** How many game days a campaign takes to reach level 10 is not recorded anywhere; P11-00 measures it with the campaign bots (days to each level on several seeds and styles).

### 7.2 Options (for D-P11b)
| Option | What changes | For | Against |
|---|---|---|---|
| **A. Keep the cap; low requirements** | Requirements stay at or below about 7 in an attribute and 3 in a skill | No change to progression | Requirements are trivial; specialisation means little; Shield, Archery and Riding compete for the same 9 points |
| **B. Raise the cap** | `MAX_LEVEL` from 10 to a higher cap (20 proposed), the curve kept for levels 1–10 so the early game is unchanged, and a flatter curve after 10 so the later levels come at a measured pace; the same grants per level | Doubles the budget; specialisation and a second interest are both possible; Phase 12 gets room | XP pace after 10 must be measured and tuned; renown, wages and enemies don't scale with level, so nothing else changes |
| **C. Training as well as points** | Specialist instructors (P11-17) grant permanent unlocks and, for some, +1 to a combat skill (once each, capped) | Rewards travel and goals, not grinding; doesn't inflate levels | On its own, too few points to matter; must not become a chain of errands |
| **D. Proficiency from use** | Combat skills rise a little from use in battle | RuneScape-like satisfaction | Inflation and grinding by design; hard to bound; duplicates points |

**Proposed default: B + C, without D.** A higher cap with an unchanged early curve, plus training unlocks (and a capped +1 from a few instructors), and the design rule below. D is left out (it invites grinding); it can be reconsidered in Phase 12's general progression (P12 area D).

### 7.3 The design rule for requirements (whatever the option)
**Required,** checked by a Node test over every item (`tests/requirements.test.js`):
1. **Ordinary equipment** (everything sold in a village, every origin's kit, the standard loaner kit) needs nothing above a new character's values (attributes 5, skills 0).
2. **An advanced piece** (sold only in towns) may need at most what a character reaches by a **middle level** (P11-03 sets it from the measured pace) while spending **no more than half** of the points earned by then on the attributes and skills it names.
3. **An elite or regional piece** may need at most what a character reaches by a **late level** with half the points, **plus** its training.
4. No requirement may exceed `5 + 1 (origin) + all attribute points earned at the cap` in an attribute or `MAX_SKILL` in a skill (unreachable requirements fail the test).
5. A character with **no combat investment at all** (every point in Trade, Leadership and Charisma) still has at least one usable weapon of each of the sword, spear, shortbow and crossbow families, a shield and a riding horse. Basic play never depends on points.

### 7.4 Base and effective values
**Required.** Requirements check **base** values: allocated attributes and skills, the origin's grants, training unlocks and story grants (`story.js` can already raise an attribute). They do **not** count bonuses from equipped items, companions, retinue, traits, morale or the battle. This prevents circular requirements (a ring that meets a horse's requirement) and makes a requirement mean the same in every screen. Performance (draw speed, turning, recovery) may use effective values.

### 7.5 Existing characters (D-P11a: old saves ignored)
- No migration: a campaign from before the budget change is not supported (D-P11a). Any save that still loads gets the new skills at 0 through `sanitize`, and nothing more.
- Retraining is a paid service at a master (P11-17, D-P11i), useful to any character who wants to change their build.
- Equipped items that don't meet their requirements stay equipped, are carried into battle **only if the gear check allows it** (otherwise the next valid loadout is used, §8), and the sheet says why with a way to fix it. **Nothing is ever removed from the inventory by a requirement.**

---

### 7.6 The measured curve (P11-03, 5.3.0)
**Decided:** cap 20, middle level 10, late level 15 (`data/character.js` `budget`). Levels 1–10 cost what they did (8,428 XP); from 10, each level costs 550 XP more than the one before (2,239 for 10→11, 7,189 for 19→20): 25,123 XP to level 15 and 55,568 to 20. Set from P11-00's pace (170–205 XP a day, about the same past the cap) and measured on the first try with `node scripts/progression.js 180 1` (11.5 min), so no second try was needed:

| Style | L10 | L12 | L14 | L15 | L16 | Level / XP by day 60 · 120 · 180 |
|---|---|---|---|---|---|---|
| hands-off | 54 | 82 | 120 | 144 | 175 | 10 / 9,868 · 14 / 20,847 · 16 / 30,701 |
| presets | 49 | 83 | 119 | 140 | 168 | 10 / 10,180 · 14 / 21,031 · 16 / 32,933 |
| expert | 58 | 82 | 116 | 135 | 154 | 10 / 9,083 · 14 / 21,901 · 17 / 36,369 |
| ruler | 54 | 82 | 120 | 144 | 175 | as hands-off |

At that pace level 20 comes around day 280–325: a long campaign, as D-P11b asks. The 360-day run on three seeds (the night run) confirms the far end.

## 8. Loadouts and the gear check (P11-02, P11-03)

### 8.1 Carried and wielded
**Required.**
- New slot **`weapon2`** (a second weapon, carried) beside `weapon`; the offhand stays the shield slot; a new **`ammo`** slot (a quiver or bolt case, if D-P11e's items are used); the existing horse slot also means the battle mount (P11-08).
- An **active loadout**: `primary` (weapon + shield if allowed) or `secondary` (weapon2 + shield if allowed). The shield is **stowed** (drawn on the back) whenever the active weapon needs two hands or is a bow or crossbow; it comes back on switching.
- **Preferences** kept in the save (`c.loadout`): which loadout starts a battle (`primary` by default), on horse or on foot (`ride` by default when the horse can fight and the field allows), and the last valid choice for each kind of battle. Basic players never see this: the defaults pick a valid loadout.
- **One place for each item.** Every item is in exactly one of the inventory or one slot. Switching, forging, selling, capture, loaning, tournaments, import and restore keep that invariant; a Node test runs a random sequence of every operation and checks the count of each item after each one.

### 8.2 The gear check
**Required.** `CL.gear.check(c, kit, context)` returns a list of findings, each `{ kind, code, item, text, have, need, fix }`:
| Kind | Meaning | Example (wording style; final text in P11-02/P11-03) |
|---|---|---|
| `incompatible` | Cannot be used together, or here | "This bow cannot be used from horseback." "Horses can't go onto the walls: you will fight on foot." |
| `requirement` | Not yet met; met by training or points | "You are not strong enough to wield this weapon: it needs Strength 10; you have 7." "You have not completed this weapon's training: Master Hrolf in Hrothgard teaches it." |
| `penalty` | Works, but worse | "Your armour is heavy for this bow: it draws slower." |
| `note` | A consequence the player may not expect | "This weapon needs both hands: your shield will be slung on your back." |
| `advice` | Optional | "A spear holds riders off better than a sword." |

The same check, with the same words, is used by: the market and armoury (before buying; buying an unusable item is allowed after a warning), the character sheet (equip, switch, compare), the blacksmith (forging keeps requirements), Prepare (the loadout this battle), tournament registration (the format's rules), training (what an instructor needs), the battle itself (a weapon that fails falls back to the next valid loadout, unarmed only if nothing fits, and says so), and save loading (an invalid loadout is replaced by a valid one, with a message, never by removing items).

**Never silent:** a disabled control always carries its reason (as `rights.may` already does for permissions); the reason is in text and an icon shape, never colour alone; it fits at 812×375 at Larger text.

### 8.3 Comparisons
**Required:** a compare view in the sheet and the shops: damage, reach, attack speed (as "quick / steady / slow" by default, seconds on "Details"), protection, weight, impact (pierce, shield pressure, stagger), hands, mounted use, and requirements met or not. Progressive disclosure: one line by default ("Longer reach, slower, needs both hands"), the exact numbers on request.

---

## 9. Baseline measurements (P11-00)

**Required before P11-01** (the short runs only). All headless runs under 20 minutes; longer ones wait for the owner's night run, which comes whenever the owner chooses during Phase 11 (owner, 2026-11-26) and does not hold up P11-01.

| Measurement | Tool (new ones marked) | Records |
|---|---|---|
| Duels | **`scripts/duel-lab.js`** (new): the hero against one fighter, by three pilots: *masher* (today's bot), *timer* (waits at the edge of its reach, strikes into the opponent's recovery), *turtle* (blocks until the opponent swings, then strikes) | Win rate, time, HP left, hits taken, per weapon, per opponent troop and per tournament round, 40 seeds |
| Small skirmishes | `scripts/parity.js` (the five scenarios) | Fought (masher) vs Simulate vs odds, losses |
| Mixed armies and big battles | `parity.js --big`, `extras.js` | The same at 40 and 100; each extra on and off |
| Equipment effect | `duel-lab.js --weapons` | Each of the five weapons and three armour sets against the same opponents: the spread of outcomes (today: damage only) |
| Default vs intelligent command | **`scripts/tactics-lab.js`** (new): equal armies, terrain and seeds; plans: *all charge*, *Auto*, *a scripted combined-arms plan* (infantry line holds, archers behind on high ground, cavalry on a flank after the volley), hero passive or active | Win rate, casualties, duration, ground held |
| Sieges | `parity.js --siege 30` (about 15 min) | Storming and defending (5.0.0: +19 and +5) |
| Tournaments | `duel-lab.js --tourney` | Win rate per round per pilot; how often a new character wins; fees and prizes over five tournaments in one town |
| Battle duration and casualties | all of the above | Seconds, losses each side |
| Parity | `parity.js` 40 seeds (under 20 min) here; the whole `battle-parity` on the night run, whenever it comes (from a worktree of 4c0a044 for 5.0.0's own numbers) | The 5.0.0 reference |
| Frame time and memory | `scripts/bench-battle.js` and Debug → Battle benchmark **extended**: frame-time percentiles (p50, p95, p99, frames over 16.7 and 33 ms), update vs draw, bake-cache size and hit rate, look-cache count, JS heap (where the browser reports it) | 40, 100, 200; Sharp, Balanced, Fast; desktop and the phone profile headless; the owner's phone |
| Touch usability | The owner's questionnaire (§13) | Free text and 1–5 scores |
| XP pace | **`scripts/progression.js`** (new) over the campaign bots | Game days to each level, by style and seed |

The results go in the new `docs/PHASE-11-VALIDATION.md` under "The 5.0.0 baseline", which P11-T completes.

---

## 10. Combat rhythm (P11-05 to P11-08)

### 10.1 Melee
**Required:**
- Each weapon's windup, active and recovery from its profile; the hero obeys the same cooldown rules as everyone (D-P11d).
- **A swing that hits nothing recovers longer** (`miss`). Hold-to-attack and the input buffer stay (accessibility); they simply swing on time, so a held button against a patient opponent whiffs and gives openings.
- **Limited targets** per blow (`maxTargets`, nearest first inside the arc).
- **Interruption within limits:** a blow that lands during the target's windup interrupts it when its `stagger` beats the target's `poise`; a staggered fighter is immune to another stagger for a short time; no fighter can be staggered more than once in a set window; knockback shrinks on repeated hits (no hit chains, no stunlock; §10.4).
- **Reach is the weapon's**, with spears weak inside `minRange`, so a sword-user who steps inside a spear wins, and a spear-user who keeps distance wins.
- **Feedback:** whiff (a small dust arc and a soft sound), out of reach (the swing stops short visibly), blocked (the existing pale arc and block sound), interrupted (a jolt and a distinct sound), stagger (a short sway). Enemy windups readable by pose (already drawn) and, for the hero's current opponent and anyone winding up at the hero, a small glint at the weapon tip (shape, not colour; off with Reduced effects only if the pose still reads).

### 10.2 Defence
**Required:**
- **Shield block** as now (120° front), plus **shield pressure**: each blocked blow adds pressure by its weapon's `shieldPressure`; at the limit the guard breaks (a short stagger, the shield lowered); it recovers while not blocking. The **Shield skill** raises the limit and the recovery and widens the arc a little. AI shield troops use the same rule.
- **Honest reactions:** AI guards after a reaction delay that depends on its style and tier, never in the same frame (P11-10).
- **Weapon guard** (two-handed and spear users with no shield): Block raises the weapon; it takes part of a frontal blow, not all, in a narrower arc. **Timed parry** (a guard raised just before the blow lands deflects it and opens the attacker) is an **experiment** in P11-05: kept only if the owner likes it at M1 (D-P11j); the game never requires it.
- **Movement is defence:** stepping out of reach during the opponent's windup makes it whiff (and whiffs cost recovery); no separate dodge button.
- **Counters by timing, not a button:** striking an opponent who is in recovery after a whiff or a blocked blow is the counter. No combos, no special attacks.

### 10.2a The chosen numbers (P11-05, 5.5.0)
Measured with `duel-lab.js` and `parity.js` in two tries (docs/PHASE-11-VALIDATION.md, "Melee rhythm"). Seconds; reach in px; `data/weapons.js`.

| Family | Reach | Windup / active / recovery | Cooldown | Miss | Arc | Targets | Stagger / poise | Shield pressure | Knockback | Moving while committed | Guard |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Sword | 52 | 0.16 / 0.12 / 0.26 | 0.68 | 0.20 | 90° | 3 | 1.2 / 1 | 1 | 6 | 50% | shield |
| Axe | 46 | 0.20 / 0.12 / 0.28 | 0.74 | 0.24 | 80° | 1 | 1.6 / 1 | 2.5 | 8 | 45% | shield |
| Mace | 46 | 0.20 / 0.12 / 0.28 | 0.74 | 0.24 | 70° | 1 | 2.6 / 1 | 1.5 | 9 | 45% | shield |
| Greatsword | 64 | 0.26 / 0.16 / 0.36 | 0.92 | 0.30 | 120° | 3 | 2.2 / 2.5 | 2 | 10 | 30% | weapon |
| Greataxe | 60 | 0.32 / 0.16 / 0.42 | 1.04 | 0.36 | 100° | 2 | 3 / 2.5 | 3.5 | 14 | 25% | weapon |
| Spear | 70 | 0.18 / 0.10 / 0.24 | 0.68 | 0.18 | 40° | 1 | 1.1 / 1 | 1 | 5 | 50% | shield (weapon without one) |
| Pike | 72 | 0.22 / 0.12 / 0.30 | 0.82 | 0.22 | 30° | 1 | 1 / 2 | 1 | 4 | 30% | weapon |
| Fists | 40 | 0.14 / 0.10 / 0.20 | 0.60 | 0.15 | 90° | 1 | 0.5 / 1 | 0.5 | 4 | 60% | none |

The bows, the crossbow and the lance keep 5.0.0's sword (P11-07, P11-08). A blow's second and later targets take 70% (0.6 left the outnumbered company 20 points under the odds). Stagger: the windup is lost and nothing new for 0.3 s; immune for 0.9 s. Knockback halves on each repeat inside 1.2 s. A shield's capacity is 4 (a sword's blow is 1), it sheds 1.5 a second while down and stays down 1 s once broken; the Shield skill adds 10% capacity and recovery and a degree each side a point. A weapon guard lets 45% through in a 90° arc. AI shields come up 0.2 / 0.13 / 0.1 s (T1 / T2 / T3) after a blow is seen coming, and never during their own swing (its recovery is the opening). The hero's body (D-P11d): a pace of 100 px a second (soldiers walk 82–94), +2% a point of Agility above 5, and 98% / 96% / 92% in a gambeson, leather and mail until P11-06's load; reach and cooldown are the weapon's, the same as everyone's. The skills: +3% damage and 2% less recovery a point for the weapon's own skill (at most a third). The tap buffer is measured to when the hero is next ready (the swing's end or the cooldown).

### 10.3 Armour and movement (P11-06)
**Required:** a **personal load** (worn and wielded items' existing `weight`; cargo never counts) against a capacity from Strength. Load lowers foot speed and, for heavy pieces, recovery and draw; armour raises protection and poise. **Agility** lowers the movement and recovery penalties; **Riding** lowers them in the saddle; the horse carries the load for speed but not for turning or weapon handling. No stamina bar (the owner's exclusion of "mandatory complex stamina management"); if P11-06's measurements show a sprint is needed for light builds, a short, automatic, uncapped-in-time sprint may be proposed, not built by default.

**Target styles (required to be viable, measured by P11-06's duel and skirmish matrix):** light duelist, shield infantry, heavy infantry, spearman, foot archer, mounted knight, mounted archer.

### 10.4 Limits against exploits
| Exploit | Guard |
|---|---|
| Stunlock, infinite interruption | Stagger immunity after a stagger; a cap per window; heavy poise for two-handers and heavy armour |
| Knockback chains | Repeated knockback on the same target shrinks within a window; walls and crowds stop it |
| Multi-hit sweeps | `maxTargets`; the second target takes less |
| Whiff-cancel by switching weapons | Switching is blocked while committed; a switch has its own time; each weapon's cooldown and reload carry over ("ready at") |
| Turtling forever | Shield pressure; flanks; AI that walks round a turtle (P11-10) |
| Kiting on foot | The hero's speed from load and Agility, not 142 (D-P11d); archers slowed while drawing |
| Endless circling on horseback | Turning radius by mount and Riding; bows from the saddle only at a walk or with a penalty; AI archers and spears answer circling riders (P11-10); the stall guard |
| Uncatchable horse archers | Ammunition (§10.6), mounts that cannot turn on the spot, shooting from the saddle slowed or penalised at a gallop, enemy cavalry that pursues archers |
| Charging through everything | Braced spears and squares (already), the lance's momentum rule, collision with the hero's mount, confined maps without horses |

### 10.5 The matchup matrix (required evidence, not a balance target)
P11-05 to P11-08 each fill a matrix of `duel-lab` and `tactics-lab` results: family against family (sword-and-shield, axe-and-shield, mace, greatsword, greataxe, spear-and-shield, pike, lance, shortbow, longbow, crossbow) and style against style. Acceptance asks that **every row has at least one clear win and one clear loss** and that **no row wins everything**; how clear "clear" is comes from P11-00's noise (±8 points at 40 seeds, B-01's note).

### 10.6 Ranged (P11-07)
**Required:**
- The hero shoots with **Attack held to draw and released to loose** (a tap shoots as soon as the draw allows), the draw and reload from the profile; walking is slowed while drawing; a crossbow is loaded once and then aimed, but reloading is slow and (for heavy crossbows) on the spot.
- **Aim, by default assisted:** the shot goes to the best target in the facing cone (nearest threat, or the target the hero last struck; a target ring shows who); **manual aim** on PC by the mouse and on phones by an optional "aim" setting (drag on the field toward the target with the right thumb while the left moves; never three touches). The setting is off by default.
- **Effective range in the flight, not only in the choice:** each projectile carries its `maxRange` and loses damage past the effective `range`; it falls after `maxRange`; collision is swept (segment against circle), so no speed passes through a target; shields, cover and line of sight as now.
- **Ammunition** (D-P11e default): each bow or crossbow has a quiver of a fixed number of shots per battle, refilled after the battle from the company's stores without buying arrows; a quiver item may raise it; empty, the hero switches to the melee weapon automatically (or by the switch button) and the HUD says "Out of arrows". Reloads, switches and the quiver can't be reset by switching back and forth.
- **Archery skill:** draw speed and spread; **Strength:** heavy bows' draw and crossbows' reload.
- **Feedback:** a draw ring around the hero, the target ring, "too far" when the target is past the effective range, "no clear shot", the quiver count on the HUD.

### 10.7 Mounted (P11-08)
**Required:**
- `u.mounted` and `u.mount` (the horse's profile: speed, acceleration, turning, combat suitability, its own HP if D-P11f) are separate from `role` and identity: the hero stays the hero, a companion stays a companion. Every `role === 'cavalry'` check is reviewed and changed to a capability check where it means "on a horse" (§2.6).
- **Horses:** the nag stays a travel horse (cannot be ridden into battle, or only with a heavy penalty: P11-08 decides by playtest); the rouncey a light riding horse; the courser fast; plus up to two new combat mounts (a warhorse for weight and charge; the League's light horse for speed). Each has a Riding requirement (§7.3's rule) and a distinct trade-off; the dearest is not best at everything.
- **Mounted melee** from the profile (`mounted: yes/no/penalty`); the **lance** deals damage from momentum (none at a standstill); **braced spears stop the hero's charge too**; collision: the hero's horse rides through foot as charging cavalry do, by the same rule.
- **Mounting rules:** chosen at Prepare (or by the remembered default); **no horses** on the walls, ladders and courtyards, in the narrow streets or where a tournament format forbids them (said before the battle); dismount during a battle by a button; no remount in a battle (first version). If the horse falls (D-P11f), the hero is unhorsed with a short stagger and fights on foot; the horse is not lost after the battle.
- **Riding skill:** turning, acceleration, the mounted-weapon penalty and the mounted-bow penalty.
- **Controls:** the same joystick steers; the horse keeps momentum (a lighter touch turns, holding a direction builds speed); Attack strikes on the side the horse faces (or the aimed side on PC).

---

### 10.8 Fighting styles (P11-10, 5.10.0)
- **Data:** `data/styles.js` (`C.fighting_styles`): reaction (s, never under 0.05), patience (s), spacing, opportunism, guardUse (0–1), retreatAt and preferRange (px), pursue, and `duel` for the tournament's. A troop's style is its `style` (checked), else by kind (`CL.styles.forTroop`): T1 foot brawler, T2 soldier, T3 veteran (heavy with an axe or mace), spears and pikes spear, archers skirmisher, riders rider.
- **The rules, all from what is drawn:** the guard comes up a reaction after a blow is seen, and only as often as guardUse; a foe recovering, staggered, with a broken guard or running is an opening, struck a reaction after it is seen by opportunism; a longer weapon keeps at its reach's edge (decided once a target); a patient fighter waits just outside a ready opponent's reach (for its patience, then closes) and strikes one who steps into its own; a foe busy with someone else is pressed at once; archers step back from foot inside retreatAt and hold preferRange; riders count archers nearer and a braced front (or a square) facing them much further, and ride out after a grind among foot.
- **Detail by distance:** the full style within 360 px of the hero and in every duel; further off, the simple rule. The guard's reaction and use everywhere.
- **Tournaments:** the rounds' styles (rusher, shield-wall, counter-striker); a rival keeps one by name. The semi-final's HP 1.3 → 1.15.
- **Measured:** `docs/PHASE-11-VALIDATION.md` "Fighting styles".

## 11. Code-drawn art adaptation plan

**Rules kept from D-P10k and `docs/ART-STYLE.md`:** one palette, one outline, one light, the raised three-quarter view, seeded stable variation, phone readability, honesty; looks in data; missing parts added to the kit and the Art gallery; the drawing only reads the game; no images, no sprites, no generated art; the asset guard and the no-image browser test stay.

| Need | Change | Task |
|---|---|---|
| Timing per weapon | `poseOf` reads the unit's profile and `CL.units.attackProgress(u)` (phase and normalised k from the same numbers the simulation uses), never `CL.units.SWING` | P11-01 |
| The hero's gear | `heroFor` is replaced by `G.fig.heroFrom(character, activeKit, context)`: identity (face, hair, skin, cloak, trim, your banner) from the creator, everything worn and held from the active loadout: helmet by item, armour class by item, shield active or slung, the active weapon, the mount | P11-04 |
| Item looks | Every item has a `look` (its kit part, length and colours), validated like troop looks; forged pieces share their base's | P11-04 |
| New parts | Greatsword (long blade, two-handed grip), a mace head distinct from the club, the longaxe (a variant of greataxe), the composite bow (recurve), a heavy crossbow (arbalest) and its windlass pose, a slung shield on the back, a quiver on the hip or back, plate pieces only if the item set includes plate | P11-04, P11-07, P11-16 |
| Two-handed grip | Both hands on the haft; recovery pose lower; guard pose with the weapon across | P11-04, P11-05 |
| Defence and impact poses | Shield pressure (the shield arm pushed back), guard broken (shield dropped), stagger (a lean), weapon guard, the parry deflection (if kept) | P11-05 |
| Ranged poses | A bow drawn over the real draw time, held at full draw, loosed; the crossbow's reload and aim; the hero's target ring and draw ring | P11-07 |
| Mounted hero and companions | The horse drawn for `u.mounted`, from the mount's look; rider poses for each weapon on horseback; the lance couched by momentum | P11-08 |
| Troop looks from profiles | `lookAgrees` checks the look against the profile's family (bow, crossbow, long weapon, mounted), not against projectile speed or reach | P11-11 |
| Readability at scale | The live cue (the dangerous part) always drawn for the hero, the hero's opponent and anyone attacking the hero, even in a big battle; elsewhere the baked steps, three per phase as now; checked at 812×375 with 100 and 200 on the field | P11-05, P11-12 |
| Icons | Code-drawn icons for weapon families, shields, helmets, armour, horses and quivers in the sheet, shops and Prepare (`G.ui` icons) | P11-04 |
| Portraits | The hero's portrait and the party sheet show the helmet (or bare head) and armour worn | P11-04 |
| The Art gallery | A Phase 11 page: every family and item in four facings and each pose (windup, active, recovery, guard, stagger, draw, reload, mounted) at 1× and enlarged | P11-04, extended by each art task |

**The storybook look (D-P11m, P11-12a to P11-12e).** The rules above stand; the shapes change to the approved references: the v0.7 full-body figures (rounded heads with tiny features, two-segment arms, separate legs, no ear in profile, the drawing foreshortened by 0.875 for the raised view, never the positions), warmer outlines, the concept's buildings, cobbles and trees, and one UI language. The work is ported into the native functions (`figure`, `horse`, `building`, `portrait`…) with their contracts kept; NEXT-TASKS P11-12 has the subtasks and `docs/STORYBOOK-INTEGRATION.md` the analysis.

**Caching (required, P11-04 and P11-12):**
- The look key gains an **equipment signature** (the active weapon, shield state, helmet, armour class, mount) so different gear never collides in the bake cache.
- A look is rebuilt when its signature changes (a weapon switch, a shield stowed, unhorsed): the per-battle `WeakMap` stores the signature with the look and compares it each frame (a cheap string compare).
- Soldiers keep **four variants a troop** plus their fine-kit flag: the signature is a property of the troop's profile, not of each soldier, so the number of keys grows with troops × variants, not soldiers.
- A test counts distinct bake keys over a 200-fighter battle of every realm with switches and mounts, and checks it stays under the cache's size; the LRU bound stays 3,000 unless P11-12 measures a reason to change it.

---

## 12. Mobile and PC usability strategy

**Principles (required):** the two-thumb layout stays (joystick left; Attack, Block, Orders, Map, Zoom on the right); no new permanently visible button unless a measurement in P11-09 shows a context control can't do it; every control keeps 44 px or more and grows with the text size; nothing relies on colour alone.

| Input | Phone | PC |
|---|---|---|
| Move | Joystick (as now) | WASD / arrows |
| Attack / shoot | ATTACK: tap to strike or shoot; hold to keep striking or to draw and release | Space or left mouse; hold to draw |
| Defend | BLOCK: hold (shield, or weapon guard) | Shift or right mouse |
| Switch weapon | **A small switch control on the ATTACK button's edge** showing the other weapon's icon (one tap), or a swipe across ATTACK (P11-09 tries both on the phone and keeps one) | Q (and the mouse wheel when not zooming) |
| Aim | Assisted by default (a target ring); optional drag-to-aim on the field with the right thumb | The mouse pointer (optional), or assisted |
| Mount | Chosen at Prepare; Dismount in the Orders panel | The same; a key (proposed X) |
| Orders | As now (ORDERS, MAP; keys 1–3, F, H, C, R) | As now |

**Stuck input (required, P11-09):** releasing a touch outside a button, a pause, a modal, backgrounding the page, orientation change, a battle ending mid-hold, a weapon switch mid-hold, and a lost pointer all clear `attackHeld`, `blockHeld`, the draw and the joystick (`input.js` already clears some on blur at lines 516–517; P11-09 adds a browser test for every case).

**Teaching (required, P11-09):** the origin quests' first fight shows the existing controls card, then one hint at a time when first relevant: "strike when they miss", "a blocked axe tires your shield", "switch to your bow", "hold to draw", "riders turn slowly". The guide's steps stay skippable (D-P10c). How to Play gains a "Fighting" topic by stage. A **practice yard** (P11-17) lets a player try anything safely.

---

## 13. Human playtesting scenarios

Each is played by the owner on the phone (Zenfone 10, Chrome) and once on a PC, at the milestone named. Each ends with the short questionnaire: *Was it fun (1–5)? Did you understand why you won or lost? What did you not understand? What felt unfair? What would you change first?* The notes go in `docs/PHASE-11-VALIDATION.md`.

| ID | Milestone | Scenario |
|---|---|---|
| H-00 | M0 | 5.0.0: P10-T's seven phone items; a contract battle, a lair and a tournament, fought by holding Attack and then fought carefully: does careful play feel any better? (the baseline answer) |
| H-01 | M1 | Five duels in the practice debug arena: sword and shield, axe, mace, a two-handed weapon, a spear, against a looter, a footman and a huscarl each |
| H-02 | M1 | A shop visit with too little Strength: buy a greatsword after the warning, try to equip it, read the sheet, find the way to fix it |
| H-03 | M1 | Switch between sword-and-shield and a two-handed weapon in a fight; see the shield slung and back |
| H-04 | M2 | A bandit contract as a foot archer with a shortbow, then a longbow: draw, aim, run out of arrows, switch to the sword |
| H-05 | M2 | The same contract as a mounted knight with a lance, then against braced spears |
| H-06 | M2 | A horse archer against a band with cavalry: can they catch you; can you win without circling for ever? |
| H-07 | M3 | Against each realm's T2 and T3 lines: do they feel different (axes on your shield, crossbows, pikes, light horse)? |
| H-08 | M3 | Battles of 40, 100 and 200 on the phone: frame rate, can you see who is about to strike you? |
| H-09 | M4 | The tactics lab's battle, played twice: everyone charges; then a plan (line holds, archers on the hill, cavalry after the volley) |
| H-10 | M4 | A commander who barely fights (the hero stays back) wins a battle by orders alone |
| H-11 | M4 | A fighter who never touches orders wins a contract on Auto |
| H-12 | M5 | A specialist training quest from hearing of it to the unlock; then a failed attempt and a retry |
| H-13 | M5 | A siege assault and a defence with a mounted hero (dismounted by the walls' rule, told before) |
| H-14 | M5 | Three tournament formats: the standard lists (loaner kit), an own-equipment duel, an archery contest; and a mounted format if built |
| H-15 | M6 | A new character's first week (any origin): is the opening fight understood without reading? |
| H-16 | M6 | A character built toward a specialist weapon from a new game: the requirement messages along the way, a paid retraining at a master |
| H-17 | M6 | An evening of ordinary contracts and tournaments (the owner's usual play): is it more fun than in 5.0.0? (the main acceptance question) |

---

## 14. Tournament format and compatibility framework (P11-19)

**Required.** `data/tournaments.js` keeps the shared schedule and economy and gains `formats`; each host has a tradition (a weighted list of formats). A format is data:
```js
{ id, name, kit: 'loan' | 'own', loan: { weapon, offhand, head, body, feet, horse?, ammo? },
  mount: 'foot' | 'horse' | 'either', weapons: 'melee' | 'ranged' | 'mixed', families: [...], armour: { max },
  bouts: 'duel' | 'targets' | 'course' | 'melee', rounds: [...], eligibility: { renown?, level?, training? },
  injuries: 'none' | 'hp', withdraw: true, prize: {...}, fee: {...} }
```
**Initial formats** (required: the first three; the rest **needs evidence** that the shared engine supports them cheaply):
| Format | Kit | Engine use | Notes |
|---|---|---|---|
| The standard lists (today's) | loan, foot, melee | `g.duel` as now | Must stay possible for a new character: the loan kit meets §7.3 rule 1 |
| Own-arms duels | own, foot, melee (or mixed) | `g.duel` | Rewards investment, training, requirements |
| Heavy weapons | own or loan two-handers | `g.duel` | Exercises poise, stagger, weapon guard |
| Archery contest | loan or own bow, foot | the battle engine with standing targets as units that can't move or strike; score by hits and distance in a time | Uses the same projectiles; not a separate game |
| Mounted lists | loan horse and lance, or own | `g.duel` with both mounted | Needs P11-08 |
| Mounted archery course | horse and bow | targets along a track | Needs P11-07 and P11-08; **investigative** |
| Team melee (2v2 or 3v3) | loan | a small fixed encounter on the battle engine, no orders | **Investigative**: only if it needs no new engine work |

**Rules for all:** the format, kit, eligibility, prize and fee are shown **before** the fee is paid, with the gear check's findings for the hero; loaner gear is never put in the inventory, own gear is never moved (the duel reads the kit, as today); the bracket, results and rewards commit once; a reload mid-bout forfeits as now; time passes as now; injuries per format (none by default; `hp` would carry the bout's wounds to the next bout only); withdrawing between bouts keeps any finalist prize earned. Opponents get a **style** (P11-10) and the format's kit; their strength grows by **better styles and kit** before multipliers of HP and damage; the rival keeps their style.

**Attractiveness (needs evidence):** P11-00 measures crowns and renown per day of tournament play against contracts; P11-19 proposes changes to the diminishing prize (×0.6 a win, floor 0.2), the fee curve and the 28-day cooldown only if they make repeated tournaments not worth entering, keeping the anti-farm intent (a town's prize still falls with repeat wins; a different town or format is fresh).

**Phase 12 boundary:** nobles at the lists, invitations, introductions, romance and politics at tournaments are Phase 12 (P12 area L).

---

## 15. Balance and auto-resolve validation strategy

1. **Keep the owner's balance goal** (B-01, memory): Simulate only slightly worse than fighting; a strong fighter can turn a close battle. Measured as fought (by the *timer* pilot) 5–15 points over the stated odds on average, as B-01 set it. **New:** fought by the *masher* pilot should be no worse than about the stated odds (basic play viable; the band is set from P11-00's spread, not invented).
2. **Every combat task re-runs** `parity.js` (the five scenarios, 40 seeds) and `duel-lab.js` with all three pilots, and reports the change against P11-00. A task that moves parity out of its band says so and fixes it within its two tries (NEXT-TASKS's rule) or records it for P11-20.
3. **The tactics lab** (P11-14) is the proof that tactics matter: for each comparison (§16 in NEXT-TASKS's P11-14), the plan beats indiscriminate charging on the same armies, terrain and seeds by a margin larger than the measured noise, in at least one of win rate, losses or ground held.
4. **Auto-resolve** (P11-20): troop power from the profile (HP × damage rate × armour factor, computed once per troop at content load), not the tier alone; **composition modifiers only where the tactics lab measured a consistent effect** (for example cavalry against a side with many unprotected archers; spears against cavalry); the hero's power from the profile; all cheap enough for the world simulation (no per-battle simulation; a lookup per troop pair kind). The odds explanation lists any composition effect in words.
5. **The world** (P11-20): `node scripts/landed.js 360 --seed 1..3` (about 3 minutes) for wars, sieges, deaths and forts against P10-T's numbers; the 10- and 30-year long runs on the night run. A regression caused by Phase 11 (a realm losing its forts faster, armies destroyed far more often) is fixed in P11-20; inherited political tuning stays for Phase 12.
6. **Economy** (P11-20): `npm run economy` and the campaign bots for wages, equipment prices, loot (new items in the tables), tournament rewards, training costs, healing; recovery after a total defeat (the bot's captured-and-released path); the five origins' balance (`tests/slow/origins.test.js`).

---

## 16. Saves and compatibility (decided: old saves are ignored)

**The owner, 2026-11-26 (D-P11a): "ignore old saves! no migration needed, old saves don't need to work!"** D-P10g stays in force for Phase 11: no migrations, no fixture folders, no old-save tests. New saved state gets defaults through `sanitize`; a save that can't be made sense of, or one a task chooses to refuse, is refused and kept as today (`crownless_save_other_world`). Each task that changes the save's shape may bump `VERSION` so the field list stays documented, with no `MIGRATIONS` entry.

**Save shape changes (one line in SAVE-FORMAT each, no migration):**
| Task | Change |
|---|---|
| P11-02 | `equipment.weapon2`, `equipment.ammo` (null), `loadout` preferences |
| P11-03 | Two new skills (0), `character.training` (empty) |
| P11-08 | Mount preference inside `loadout` |
| P11-17 | Training progress (in `story`'s state) and unlocks (`character.training`) |
| P11-19 | Tournament formats: `tourney.hosts[*].format`, the bracket's format and loaned kit |

**Rules:**
- **Possessions never vanish:** an item whose id still exists stays where it was; an item a requirement now forbids stays equipped or in the pack; an invalid loadout is replaced by the next valid one at battle time, never by moving items; unknown items are refused by name as today (SC-33).
- **Training unlocks are permanent and idempotent:** an unlock recorded twice is one unlock; rewards are granted under a result id (`CL.encounter`'s exactly-once pattern).
- **Packs:** items, families, formats and instructors may come from packs (namespaced ids); `docs/WORLD-FORMAT.md` documents each new table and field; `npm run check-pack` checks them with the same messages; the sample pack gains one item with a profile and a look; a save records its packs as today.
- **Import, export, backup and restore** unchanged in behaviour; each new field passes through `check`, `sanitize` and `portable.parse`.
- **Size:** new state is bounded (loadout, a few training records, tournament format per host); the world-sim test's 4 MB limit holds.
- **Docs:** `docs/SAVE-FORMAT.md` gets each step, and its stale header is corrected (done in this planning task).

---

## 17. Owner decisions

**Blocking** (answered by the owner on 2026-11-26):

| ID | Question | Decision | Blocks |
|---|---|---|---|
| **D-P11a** | Save compatibility in Phase 11 | **Owner, 2026-11-26: decided. Ignore old saves** (D-P10g kept): no migrations, fixtures or old-save tests | — |
| **D-P11b** | The progression budget | **Owner, 2026-11-26: decided. Raise the level cap so the budget fits the combat skills of D-P11c** (20 proposed, confirmed by P11-03 with §7.3's rule over all ten skills), levels 1–10 unchanged and a measured, flatter curve after 10; training unlocks (and a capped +1 from some instructors); **no proficiency from use** | P11-03 |
| **D-P11c** | The combat skills | **Owner, 2026-11-26: decided.** Keep **One-Handed**, **Shield**, **Archery**, **Riding**; add **Two-Handed** and **Polearm**; crossbows need Strength (not Archery) and use Archery only for accuracy; no separate Crossbow skill | P11-03 |
| **D-P11d** | The hero's body | **Owner, 2026-11-26: decided. The same rules as everyone:** reach, timing and attack rate from the active weapon; speed from a base walking speed, load and Agility (the `hero` troop row's 142 and 67 go); the hero stays stronger through HP, gear, skills and the player's own timing | P11-05 |

**With a working default** (not blocking; the owner may change them before the task):

| ID | Question | Proposed default | Task |
|---|---|---|---|
| D-P11e | Ammunition | A quiver of shots per battle, refilled free after it from the company's stores; quiver items raise it; no arrows to buy | P11-07 |
| D-P11f | Can the hero's horse be hurt? | Yes, in battle only: the horse has HP; if it falls the hero is unhorsed; it is never lost or lamed after the battle | P11-08 |
| D-P11g | Where mounted archery comes from | A compact horse bow taught by a foreign master in the free ports (Merrow, Gullhaven); no realm's identity or troop lines change | P11-16, P11-17 |
| D-P11h | Tournament traditions by host | Valedorn's towns the mounted lists and the standard lists; Aurelian the standard and own-arms duels; Hrothmark heavy weapons; the Vessaro League and Saltreach crossbow and archery contests; Ostrand archery; the free ports open own-arms | P11-19 |
| D-P11i | Retraining | Retraining for crowns at a master (no free retraining: old saves are ignored, D-P11a) | P11-17 |
| D-P11j | Timed parry | An experiment in P11-05, kept only if the owner likes it at M1; never required. **M1 (owner, 2026-11-26): "everything is good"**; the parry stays as built (a setting, off by default) until the owner says otherwise | P11-05 |
| D-P11k | Mid-battle remount | No remount in a battle in the first version (dismount only) | P11-08 |
| D-P11l | Versions | Each task a minor version from 5.1.0 in build order; P11-00 the patch 5.0.1; P11-T ships 6.0.0 (as D-V1). **P11-12's subtasks** (D-P11m): P11-12a 5.11.1, P11-12b 5.12.0, P11-12c 5.12.1, P11-12d 5.12.2, P11-12e 5.12.3, so no later task is renumbered | all |
| **D-P11m** | The storybook graphics and UI overhaul | **Owner, 2026-11-27: approved,** from the developer handoff v0.7: the approved Stonebridge concept is the definitive environmental direction and the character workshop v0.7 the definitive character design (acceptance requirements, not inspiration); integrated into the native renderer (no prototype installed or copied over the game), procedural and code-drawn (D-P10k kept), gameplay untouched; the owner accepts the Stonebridge slice before the rest of the game is converted, and the finished graphics and the phone numbers before P11-13. Prepare and the report stay for P11-15, formations for P11-13 | P11-12a–e |

**Decisions carried over and kept:** D-P10a/D-P10f (long runs only on the owner's yes; pending checks; the night run), D-P10k (code-drawn art), D-P10d (women soldiers in their lines, 15%), D-P9a (battle size 20–200, default 150; not raised in Phase 11), D-P9e (command in layers, every one optional), D-P9d (save size up to 10 MB), the per-task contract and the Brief way of working (NEXT-PLAN §7, NEXT-TASKS "How each task runs"), commit only when asked, never push.

---

## 18. Risks and blockers

| Risk | Likelihood | Guard |
|---|---|---|
| The profile refactor silently changes 5.0.0's battles | Medium | P11-01's golden tests: seeded battles (the bench battle, every parity scenario, a duel, an assault) give identical results before and after |
| Making the hero ordinary (D-P11d) makes battles too hard for a basic player | High | The masher pilot's parity band (§15); the hero keeps HP and gear; P11-05 measures and tunes within two tries; the owner's M1 play decides |
| Too many systems at once overwhelm the controls | Medium | One context switch control; assisted aim by default; P11-09 consolidates; every hint once; M2's phone play |
| Requirements frustrate (equipment you bought but can't use) | Medium | §7.3's rule enforced by a test; warnings before buying; paid retraining at a master; the gear check's "how to fix" |
| No universal best is hard to prove | Medium | The matchup matrix (§10.5) as an acceptance check, not opinion |
| Performance falls with per-soldier gear variety and smarter AI | Medium | Equipment signature by troop, not soldier; AI detail by distance from the hero; P11-12's checkpoint with percentiles; the owner's phone |
| Bake-cache keys explode | Low–medium | The key test (§11); signatures by troop × variant |
| Auto-resolve drifts from fought battles | High | Parity every combat task; composition modifiers only from measured effects |
| World balance shifts (armies fight differently, so wars and sieges change) | Medium | `landed` at P11-20; the long runs on the night run |
| Tournaments become a farm (own-kit formats reward gear) | Low | The anti-farm rules kept per town and format; renown-scaled fees |
| Save state left inconsistent by new fields | Low | `sanitize` defaults for every new field; round-trip tests of the new state (no old-save tests, D-P11a) |
| Visual baselines don't exist yet (Docker) | Certain until the night run (some time in Phase 11) | Until then visual tests skip and each art task's screenshots are reviewed by hand; the baselines are made from the build current at the night run |
| The owner's phone time is the bottleneck | High | Six milestones, each with a short scripted session (§13); headless measurements do the rest |
| Scope (22 tasks, most L) | High | Required versus investigative split in every task; investigative items dropped first; the phase's exit is the acceptance list, not the task list |

**Blockers today:** none. D-P11a to D-P11d were decided 2026-11-26, and the night run (the visual baselines need Docker Desktop running) comes whenever the owner chooses during Phase 11.

---

## 19. Phase 11 acceptance criteria (P11-T, 6.0.0)

Phase 11 is not complete because weapons exist or tests pass. Each criterion names its evidence.

**Technical**
1. One resolved profile: no reach, timing or damage computed outside `CL.profile` (grep test); the art reads the same attack progress (test: drawn phase equals simulated phase on every frame of a seeded battle).
2. Every item is in exactly one place after any sequence of equip, switch, forge, sell, buy, capture, loan, tournament, import and restore (randomised Node test).
3. Every equipment limitation is explained in words wherever it applies (browser tests over the shop, sheet, blacksmith, Prepare, registration and the battle's fallback).
4. Saves: new state round-trips through `check`, `sanitize`, export and import; possessions and training are kept within a campaign (old saves ignored, D-P11a).
5. Packs: a pack item with a profile and a look loads, is checked and plays.
6. The green tiers: `npm test`, lint, typecheck, the full browser suite, the whole slow suite, the visual tests against the Linux baselines.

**Balance** (all against P11-00's numbers, with B-01's band)
7. Timing beats mashing: in `duel-lab`, the *timer* pilot beats the *masher* by a clear margin against skilled opponents (T2 and T3, tournament rounds) and the masher still beats inexperienced ones (looters, T1) at about its 5.0.0 rate.
8. No universal best: the matchup matrix (§10.5) has a win and a loss in every row.
9. The seven styles (§10.3) are each viable in skirmishes (none below the masher's 5.0.0 rate at its own price point).
10. Tactics matter: the tactics lab's plans beat indiscriminate charging (§15.3) on every scripted comparison; a passive hero with good orders wins its lab battle; an active hero with Auto wins a contract.
11. Parity: fought (*timer*) 5–15 points over the stated odds on average; fought (*masher*) not below about the odds; Simulate within B-01's distance of fighting; sieges inside −5 to +25.
12. The world: `landed` 360 days on three seeds within P10-T's ranges (or a recorded reason); the long runs' invariants hold.
13. The economy: the bots' companies grow as in 5.0.0's runs (P9-B3's 85–95 by day 180 as the reference); the five origins inside their band.

**Accessibility and controls**
14. No new permanently visible battle button beyond the switch control (or none, if P11-09 chose the swipe); every control 44 px or more at every text size; no information by colour alone; the stuck-input cases pass.
15. Assisted aim by default; nothing needs three simultaneous touches.

**Performance**
16. Battles of 40, 100 and 200 with mixed weapons, cavalry, archers, sieges and the hero's loadouts: on the owner's phone at Balanced, 60 fps at 40, and the largest size at 30 fps or better no lower than P9-B1's 200 (or the owner accepts the measured size); p95 frame time recorded; the bake cache inside its bound; identical simulation at Sharp, Balanced and Fast (test).

**Human (the owner's sessions, §13)**
17. H-17: ordinary contracts and tournaments are more fun than in 5.0.0 (the owner's word).
18. H-01, H-04, H-05, H-06: different weapons, archery and mounted combat are recognisable, usable and distinct.
19. H-02, H-12: requirements are understood; training feels like a goal, not an errand.
20. H-09 to H-11: command and personal fighting are each enough to win.
21. H-13, H-14: sieges and the tournament formats work by their announced rules; the hero is drawn in the gear actually used, the tournament's kit in the lists.
22. H-15: a new player understands the first fight without reading.

---

## 20. Phase 11 exclusions

Not in Phase 11 (Phase 12 or never):
- **Phase 12 systems:** the manpower and recruitment-pool system, the trade rebalance, business expansion, broad contract variety, general world events, political progression, relationships, courtship and romance, regional storytelling, history archives, the returning-player recap, a late-game redesign, social tournament activities. Limited adjustments that keep those systems working after combat changes are allowed, and each is named and justified in its task.
- **Never in these phases:** multiplayer; realistic weapon physics; combos; many special abilities; body-part damage; mandatory stamina management; a large durability system; a horse-management simulation; unrelated minigames (the archery contest uses the battle engine's own projectiles); larger maximum battle sizes as a goal; a new graphical style; sprites, image files or external art; commercial packaging, payments, accounts, ads or store integration; anything that breaks offline play.
- **Not by default** (could be proposed with evidence): a sprint, horse loss or injury after battle, mid-battle remounting, throwing weapons, dual wielding, per-soldier equipment management.
