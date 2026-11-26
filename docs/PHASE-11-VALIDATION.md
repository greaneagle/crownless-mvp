# Crownless 6.0 — Phase 11 validation

_Opened at build 5.0.1 (P11-00), 2026-11-26. Phase 11, "The Art of War" (`docs/PHASE-11-PLAN.md`), must show that timing, equipment and command matter more than in 5.0.0. This document holds the 5.0.0 baseline every Phase 11 task measures against, each milestone's play notes, and (at P11-T, 6.0.0) the acceptance. P11-00 changed no rule, number, look or screen: every figure below is 5.0.0's._

## The tools

| Tool | Run | What it measures |
|---|---|---|
| `tests/helpers/pilots.js` | (used by the labs) | The hero flown three ways through the player's own inputs (`g.joystick`, `g.attackHeld`, `g.blockHeld`), reading only what the screen shows: **masher** (the campaign bot: walk at the nearest enemy, hold Attack inside 70 px), **timer** (keeps at its reach − 4, strikes into the opponent's recovery or within 0.1 s after its active window, steps in after 1.5 s without a swing), **turtle** (holds Block while a swing within reach winds up or lands, strikes in the gaps); and **passive** for the tactics lab (stays behind the company) |
| `scripts/duel-lab.js` | `npm run duel-lab -- [seeds] [--weapons] [--field] [--tourney] [--series]` | The hero alone against one fighter: win %, left % (no blow for 45 s, the opponent slipped away), seconds, HP left, blows given, taken and blocked |
| `scripts/tactics-lab.js` | `npm run tactics-lab -- [seeds] [--plans …] [--hero …] [--maps …] [--army …]` | Two equal armies under a plan (`charge`, `auto`, `plan:line`, `plan:fallback`), hero passive or active: win %, losses each side, seconds, ground held |
| `scripts/progression.js` | `npm run progression -- [days] [seeds] [--styles …]` | The campaign bots from a new game: the day of each level, the level and XP at days 60, 120, 180 and 360, XP by source |
| `scripts/bench-battle.js` | `npm run bench -- [seconds] [--sizes …]` | The simulation per frame in Node: mean, p50, p95, p99, slowest, frames over 16.7 and 33 ms, JS heap |
| `scripts/bench-browser.js` | `npm run bench:browser -- [seconds] [--sizes …] [--sharpness …] [--profiles …]` | Debug → Battle benchmark in headless Chromium, desktop and phone profile, each Sharpness |
| Debug → Battle benchmark | in the game | Now also: frame p50/p95/p99, frames over 16.7 and 33 ms (1 ms allowed for timer jitter), simulation and drawing p95, the bake cache's pictures and hit rate, the looks built, the JS heap (Chromium) |

**Seeds.** The duels are deterministic in 5.0.0: one fighter against the hero plays the same way from every seed, so 40 seeds give the same row as one (the AI's retarget timer is the only roll, and it doesn't change a one-on-one). The noise check (±8 points) is therefore met for the duels. Later tasks that add rolls (P11-05 onward) will make the seeds matter. The tactics lab's spread is under its table.

## The 5.0.0 baseline

### Duels (`duel-lab.js`, 40 seeds)

The hero is the test fixture's new Farmhand (85 HP, Strength 5, One-Handed 0); each armour set has a shield. On the tournament ground (`tourney_lists`):

| Opponent | Pilot | Win % | Seconds | HP left (won) | Given | Taken | Blocked |
|---|---|---|---|---|---|---|---|
| Looter | masher | 100 | 2.3 | 87% | 3.0 | 2.0 | 0 |
| Looter | timer | 100 | 3.6 | 100% | 3.0 | 0 | 0 |
| Looter | turtle | 100 | 2.6 | 93% | 3.0 | 1.0 | 1.0 |
| Footman | masher | 0 | 13.0 | – | 0 | 12.0 | 0 |
| Footman | timer | 0 | 15.9 | – | 0 | 12.0 | 0 |
| Footman | turtle | 0 (100% slipped away at 45 s) | 45.0 | – | 0 | 0 | 39.0 |
| Huscarl | masher | 0 | 7.9 | – | 0 | 7.0 | 0 |
| Huscarl | timer | 0 | 12.1 | – | 0 | 7.0 | 0 |
| Huscarl | turtle | 0 (100% slipped away) | 45.0 | – | 0 | 0 | 38.8 |

The open field (`--field`, `grass_field`) gives the same picture: looters always beaten, a footman or huscarl never (the masher landed 0.1 blows on a footman in 40 duels), the turtle in a 45 s stand-off.

**What it shows (the plan's §3, measured).** Against a shielded opponent (footman, huscarl, mercenary, sellsword) no blow from the front ever lands: the AI raises its shield whenever the hero winds up and it is not itself committed (`js/groups.js` `shouldGuard`), and it isn't committed in its recovery, which is exactly where the timer strikes. Waiting for an opening is worth nothing; the masher and the timer lose the same way, and only lose more slowly by keeping away. The turtle blocks every blow (39 in 45 s) and nobody lands anything.

**A scratch check (not a pilot, recorded for P11-05).** A hero who starts a swing the moment the opponent starts its own windup lands while the opponent is committed and can't raise the shield: 20 of 20 against a footman (4 blows each), and 6 blows on a huscarl before losing (0 of 20). In 5.0.0 the only timing that pays is trading blows inside the opponent's swing, the opposite of the rhythm Phase 11 designs (strike into the recovery, after a whiff).

### Equipment effect (`duel-lab.js --weapons`, 40 seeds)

| Kit | Against a looter (masher) | Against a footman / huscarl |
|---|---|---|
| Worn Sword, Hand Axe, Arming Sword, War Mace (17–22 damage) | 3 blows, 2.3 s, 87% HP left: identical | 0% for every pilot |
| Knight's Sword (25) | 2 blows, 1.8 s, 93% HP left | 0% |
| Light / medium / heavy armour (Arming Sword) | 87% / 87% / 89% HP left | lose in 10.9 / 13.0 / 14.1 s to a footman, 7.9 / 7.9 / 9.9 s to a huscarl |

Four of the five weapons give the same duel: only damage differs, and 17 to 22 damage all take a looter in three blows. Armour only stretches a lost fight by a few seconds. Today, equipment chooses how long you last, never how you fight.

### Tournaments (`duel-lab.js --tourney`, `--series`, 40 seeds)

| Earlier wins in the town | Pilot | Champion | First bout won |
|---|---|---|---|
| 0, 1, 2, 3 | masher | 0% | 0% (lost in 11–14 s) |
| 0, 1, 2, 3 | timer | 0% | 0% (lost in 14–16 s) |
| 0, 1, 2, 3 | turtle | 0% | 0% (the bout never ends: a bout has no stall rule, both shields up for the 600 s cap) |

Five tournaments in a row at Stonebridge: a new character never wins a bout, pays 20 crowns each time, and is 100 crowns down after five. The loaner kit (Arming Sword and Kite Shield) against a mercenary (shield) can't land a frontal blow, so the lists can't be won by any of the three pilots. A player who learns the windup trade above can win.

### Small skirmishes (`parity.js`, 40 seeds)

| Scenario | Size | Odds | Simulated | Fought (masher) | Over the odds | Gap | Lost: simulated / fought | Seconds |
|---|---|---|---|---|---|---|---|---|
| lone-hero | 1v3 | 86 | 83 | 100 | +14 | +18 | 0.00 / 0.00 | 11 |
| small | 6v6 | 89 | 85 | 100 | +11 | +15 | 1.15 / 0.00 | 12 |
| close | 7v8 | 79 | 73 | 98 | +19 | +25 | 1.35 / 0.47 | 14 |
| veterans | 10v10 | 79 | 73 | 83 | +4 | +10 | 1.82 / 2.42 | 20 |
| outnumbered | 6v11 | 61 | 60 | 78 | +16 | +18 | 1.45 / 1.85 | 19 |

### Mixed armies and big battles (`parity.js --big`, `extras.js`, 40 seeds)

| Scenario | Size | Odds | Simulated | Fought | Over the odds | Lost: simulated / fought | Seconds |
|---|---|---|---|---|---|---|---|
| close×8 @40 | 49v64 | 76 | 70 | 100 | +24 | 11.82 / 0.23 | 32 |
| veterans×6 @40 | 55v60 | 87 | 83 | 100 | +13 | 9.57 / 1.55 | 55 |
| close×8 @100 | 49v64 | 76 | 70 | 100 | +24 | 11.82 / 1.20 | 16 |
| veterans×6 @100 | 55v60 | 87 | 83 | 100 | +13 | 9.57 / 0.23 | 35 |

| Extra | Win % on / off | Lost on / off | Seconds on / off |
|---|---|---|---|
| Shield wall vs Reavers (Defensive, steady hero) | 95 / 80 | 1.27 / 2.20 | 30 / 37 |
| Shield wall vs crossbows | 85 / 43 | 1.38 / 3.83 | 30 / 32 |
| Wedge (Aggressive) | 100 / 100 | 1.13 / 0.20 | 13 / 13 |
| High ground: archers on the knoll vs crossbows | 58 / 45 | 4.72 / 5.15 | 33 / 35 |
| A ford breaks the wedge | 100 / 100 | 1.02 / 1.52 | 15 / 15 |
| Soldiers mind the wagon (wagon through 40% / 38%) | 78 / 80 | 1.85 / 1.75 | 12 / 12 |

### Default against intelligent command (`tactics-lab.js`, 40 seeds)

Equal armies, 8 footmen, 4 spearmen, 6 hunters and 4 riders a side, battle size 60 (everyone on the field), about 10 minutes. Lost and killed: the share of each side cut down; held: the share of each side still fighting inside the middle third of the field at the end.

| Map | Hero | Plan | Win % | Lost % | Killed % | Seconds | Held (yours / theirs) |
|---|---|---|---|---|---|---|---|
| Open country | passive | charge | 30 | 80 | 50 | 32 | 25 / 0 |
| Open country | passive | Auto | 78 | 53 | 79 | 45 | 0 / 0 |
| Open country | passive | plan:line | **100** | 20 | 68 | 83 | 0 / 0 |
| Open country | active | charge | 23 | 63 | 44 | 27 | 23 / 3 |
| Open country | active | Auto | 43 | 55 | 58 | 25 | 43 / 4 |
| Open country | active | plan:line | 80 | 42 | 85 | 27 | 77 / 0 |
| Hill slopes | passive | charge | 35 | 77 | 56 | 31 | 29 / 0 |
| Hill slopes | passive | Auto | 13 | 84 | 55 | 51 | 0 / 0 |
| Hill slopes | passive | plan:line | **100** | 21 | 66 | 74 | 0 / 0 |
| Hill slopes | active | charge | 40 | 63 | 56 | 27 | 40 / 11 |
| Hill slopes | active | Auto | 30 | 64 | 50 | 30 | 28 / 3 |
| Hill slopes | active | plan:line | 55 | 48 | 69 | 27 | 51 / 0 |

**What it shows.**
- **Command already pays in 5.0.0.** The shield wall on Hold with the archers behind and the cavalry sent in on the first volley wins every battle with the hero kept back, against 30–35% for an all-out charge, and loses a quarter as many soldiers. The enemy comes on to a held line: its own plan doesn't hold back.
- **Auto is uneven.** 78% on open ground but 13% on the hills with the hero back. On equal odds (about 50%) Auto picks Balanced, whose infantry follow the hero, so a hero who stays back drags the line backwards off the rise.
- **A fighting hero makes good plans worse.** The masher walks out to the nearest enemy: plan:line falls from 100% to 80% (open) and 55% (hills). When the hero falls, every division charges (`heroDownOrders`) and the held line breaks.
- **Noise.** At 40 seeds a win rate near 50% carries about ±8 points. The differences between plans (45–70 points) are far beyond it, so 80 seeds aren't needed for the baseline. A task tuning near a threshold should run more.
- `plan:fallback` (on request, `--plans plan:fallback`) wasn't part of this run. In a 4-seed trial it did no better than charging.

### Sieges (`parity.js --siege 30`, about 15 min)

On the next night run (owner, 2026-11-26: `docs/PENDING-CHECKS.md`). Until then, 5.0.0's numbers from P10-T: storming +19, defending +5 over the odds.

### Frame time and memory

**The simulation in Node** (`bench-battle.js 45 --sizes 40,100,200`, the benchmark's battle, ms a frame at 60 Hz):

| Size | Mean | p50 | p95 | p99 | Slowest | Over 16.7 / 33 | Heap |
|---|---|---|---|---|---|---|---|
| 40 | 0.53 | 0.47 | 0.83 | 1.10 | 2.04 | 0 / 0 | 22 MB |
| 100 | 1.35 | 1.19 | 2.26 | 2.69 | 3.68 | 0 / 0 | 34 MB |
| 200 | 3.19 | 3.03 | 4.33 | 5.21 | 10.94 | 0 / 0 | 38 MB |

**Debug → Battle benchmark, headless Chromium** (`bench-browser.js 30`, 30 s a size as in the game):

| Profile | Sharpness | Size | fps | Simulation / drawing (mean) | p95 sim / draw | Frame p50 / p95 / p99 | Bake cache | Looks | Heap |
|---|---|---|---|---|---|---|---|---|---|
| desktop | Sharp | 40 / 100 / 200 | 60 | 0.3–1.0 / 0.8–0.9 ms | ≤ 1.3 / ≤ 1.7 ms | 16.7 / 16.8 / 16.8 | 256 / 874 / 973, 99–100% hits | 40 / 112 / 204 | 11 MB |
| desktop | Balanced | 40 / 100 / 200 | 60 | 0.3–1.0 / 0.8–0.9 ms | ≤ 1.4 / ≤ 1.6 ms | 16.7 / 16.8 / 16.8 | 227 / 779 / 842, 100% | 40 / 106 / 205 | 14 MB |
| desktop | Fast | 40 / 100 / 200 | 60 | 0.3–1.1 / 0.7–0.9 ms | ≤ 1.6 / ≤ 1.7 ms | 16.7 / 16.7 / 16.8 | 266 / 716 / 857, 99–100% | 40 / 109 / 192 | 10 MB |
| phone | Sharp | 40 / 100 / 200 | 60 | 0.3–1.0 / 0.9 ms | ≤ 1.5 / ≤ 1.9 ms | 16.7 / 16.7 / 16.8 | 231 / 837 / 1,048, 100% | 43 / 106 / 200 | 11 MB |
| phone | Balanced | 40 / 100 / 200 | 60 | 0.3–1.0 / 0.8–0.9 ms | ≤ 1.3 / ≤ 1.5 ms | 16.7 / 16.8 / 16.8 | 289 / 753 / 930, 99–100% | 43 / 107 / 195 | 11 MB |
| phone | Fast | 40 / 100 / 200 | 60 | 0.2–1.0 / 0.7–0.8 ms | ≤ 1.3 / ≤ 1.5 ms | 16.7 / 16.8 / 16.8 | 248 / 808 / 939, 100% | 44 / 109 / 192 | 13 MB |

No frame missed 60 fps anywhere. Headless Chromium holds every frame at the display's 16.7 ms, so its frame times show only that the budget is met; the simulation and drawing times, the caches and the looks are the figures to compare. The bake cache grows with the size (about 250 pictures at 40, 1,000 at 200, almost every draw a hit), and there is one look per fighter drawn. The owner's phone (Debug → Battle benchmark there) is the real measure and is part of H-00.

**About the benchmark's battle (inherited, for P11-12).** On the large field the two sides only meet after about 20 s (the first blow at 19.7 s at 40, later at 200), so a short run measures the approach. The `stuck` count in `bench-battle.js` (19 / 49 / 93 at 20 s, the same in 5.0.0's own script) is the company on Follow standing round a still, god-mode hero, not a fault of the AI.

### XP pace (`progression.js 180 1`, about 11 minutes)

A new Farmhand (`scripts/simulate-campaign.js`'s start) played by each bot style for 180 days, seed 1. XP keeps counting past the cap.

| Style | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 | L10 | XP by day 60 / 120 / 180 | Battles / contracts |
|---|---|---|---|---|---|---|---|---|---|---|---|
| hands-off | 4 | 7 | 10 | 15 | 21 | 29 | 35 | 45 | 54 | 9,868 / 20,847 / 30,701 | 22,641 / 8,060 |
| presets | 1 | 4 | 7 | 11 | 15 | 20 | 29 | 38 | 49 | 10,549 / 22,608 / 37,283 | 24,568 / 12,715 |
| expert | 1 | 4 | 5 | 8 | 16 | 21 | 30 | 44 | 55 | 9,289 / 21,520 / 35,019 | 23,744 / 11,275 |
| ruler | 4 | 7 | 10 | 15 | 21 | 29 | 35 | 45 | 54 | 9,868 / 20,847 / 30,701 | 22,641 / 8,060 |

(The day each level came. The ruler plays as hands-off until it can found a realm, which it didn't in 180 days, so their rows agree.)

**What it shows (for P11-03).**
- **Level 10, the cap, comes on day 49 to 55.** That is 8,428 XP, at about 170–205 XP a day.
- **XP keeps coming at the same pace.** After the cap the bots earn about 30,000–37,000 XP in 180 days: about 3.5 to 4.5 times what levels 1–10 cost. A curve past 10 set so the top level "comes in a long campaign" has that pace to work with.
- **Battles give two thirds of the XP**, contracts the rest; the story none (the bots play the plain start).
- The 360-day pace on three seeds is on the next night run.

### XP pace past level 10 (5.3.0, P11-03: `progression.js 180 1`, 11.5 min)

The curve from P11-03 (levels 1–10 as before; then 550 XP more a level). The same bots and seed as above; the day each level came:

| Style | L10 | L12 | L14 | L15 | L16 | Level / XP by day 60 · 120 · 180 |
|---|---|---|---|---|---|---|
| hands-off | 54 | 82 | 120 | 144 | 175 | 10 / 9,868 · 14 / 20,847 · 16 / 30,701 |
| presets | 49 | 83 | 119 | 140 | 168 | 10 / 10,180 · 14 / 21,031 · 16 / 32,933 |
| expert | 58 | 82 | 116 | 135 | 154 | 10 / 9,083 · 14 / 21,901 · 17 / 36,369 |
| ruler | 54 | 82 | 120 | 144 | 175 | as hands-off |

Levels 1–10 came on the same days as at 5.0.1 for hands-off, presets and the ruler; expert reached 10 on day 58 instead of 55 (its XP by day 60 is 9,083 against 9,289; the cause was not looked into). Level 15 on days 135–144, level 16 on 154–175; at 170–200 XP a day, level 20 comes around day 280–325. The 360-day run on three seeds is on the night run.

### Touch usability and how 5.0.0 feels (H-00)

The owner's session on the phone (Zenfone 10, Chrome), and once on a PC (`docs/PHASE-11-PLAN.md` §13):
1. P10-T's seven phone items (every scene in the new art, the battle benchmark, the map stress test).
2. A contract battle, a lair and a tournament, each fought **by holding Attack**, then **fought carefully**. Does careful play feel any better?

The questionnaire, after each:

| Question | Contract battle | Lair | Tournament |
|---|---|---|---|
| Was it fun (1–5)? | | | |
| Did you understand why you won or lost? | | | |
| What did you not understand? | | | |
| What felt unfair? | | | |
| What would you change first? | | | |
| Did careful play feel better than holding Attack? | | | |

_Waiting on the owner._

### Long runs (the night run, whenever the owner chooses)

On `docs/PENDING-CHECKS.md`: the visual baselines by Docker, the whole `battle-parity`, `tests/slow/long-run.test.js` and `npm run long-run` on three seeds, and `progression.js` 360 days on three seeds. 5.0.0's own numbers for those, if wanted, from a worktree of commit 4c0a044.
