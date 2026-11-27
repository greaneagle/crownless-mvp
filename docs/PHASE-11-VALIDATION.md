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

## Melee rhythm (5.5.0, P11-05)

The rules of `docs/PHASE-11-PLAN.md` §10.1–§10.4, the numbers of §10.2a. Two tries, as the plan's rule asks: the first with a blow's second target at 60% and a sword striking two; the second at 70% and three (below, "the second try").

### What the first measurements found (and changed)
- **No shield ever blocked** with the AI's reaction at 0.22–0.3 s: a sword's windup is 0.16 s, so every blow landed before the shield came up. The reaction is now 0.2 / 0.13 / 0.1 s by tier: a trained soldier blocks a sword seen coming, a levy-tier one doesn't.
- **Striking into recovery was always blocked**, because a soldier could raise its shield while recovering from its own swing. A shield now can't come up during its own swing: recovery (longer after a whiff) is the opening (§10.2's counter).
- **The new weapons fought with fists' damage**: their ids (`greatsword`, `greataxe`, `spear`) were also families', and `weaponOf` read the family. Renamed (`great_sword`, `great_axe`, `ash_spear`); a content check refuses the clash.
- **The outnumbered company fell to −39 under the odds** (5.0.0: +16). Measured one change at a time (20 seeds each): the hero's old 0.52 s attack rate and sweeping every foe in the arc were what had carried it. Both go on purpose (D-P11d; §10.4), so the second try gave the sword three targets at 70% for the second and third: +6 at 40 seeds.

### Duels (`duel-lab.js 40`, the Arming Sword and medium armour, the tournament ground)

| Opponent | masher: win / HP left | timer | turtle | 5.0.0 (all three) |
|---|---|---|---|---|
| Looter (T1) | 100% / 93% | 100% / 100% | 100% / 95% | 100% |
| Footman (T2, shield) | 100% / 74% | 100% / 100% | 100% / 93% | 0% |
| Huscarl (T3, shield, axe) | 100% / 13% | 100% / 100% | 100% / 71% | 0% |
| Legionary (T3, shield) | 100% / 33% | 100% / 100% | 100% / 79% | – |
| Pikeman (T2, pike) | 100% / 70% | 100% / 70% | 100% / 100% | – |

Timing now pays: the *timer*, who steps out of a windup and strikes into the recovery, cuts down a huscarl or a legionary untouched; the *masher* wins on a sliver of health. The masher still beats looters as in 5.0.0.

### The lists (`duel-lab.js 40 --tourney`, the loaner kit)

| Earlier wins in the town | masher: champion (final won, HP left) | timer | turtle |
|---|---|---|---|
| 0 | 15% (rounds 1–2 always, the final 15%, 13%) | 100% (100%) | 100% (64%) |
| 1–3 | 0% (rounds 1–2 always; the final never) | 100% | 100% |

5.0.0: nobody ever won a bout.

### Small skirmishes (`parity.js 40`, the masher)

| Scenario | Odds | Simulated | Fought | Over the odds (5.0.0) | Lost: fought |
|---|---|---|---|---|---|
| lone-hero 1v3 | 86 | 83 | 100 | +14 (+14) | 0.00 |
| small 6v6 | 89 | 85 | 100 | +11 (+11) | 0.28 |
| close 7v8 | 79 | 73 | 100 | +21 (+19) | 0.45 |
| veterans 10v10 | 79 | 73 | 100 | +21 (+4) | 1.00 |
| outnumbered 6v11 | 61 | 60 | 68 | +6 (+16) | 2.90 |

Plan §15's band: the masher no worse than about the odds holds everywhere. Close and veterans are further over the odds than B-01's 5–15 (the auto-resolve doesn't yet read the hero's new profile or the families: P11-20).

### Extras (`extras.js 40`): win % on / off

| Extra | 5.5.0 | 5.0.0 |
|---|---|---|
| Shield wall vs Reavers | 100 / 90 | 95 / 80 |
| Shield wall vs crossbows | 78 / 5 | 85 / 43 |
| Wedge | 100 / 100 | 100 / 100 |
| High ground vs crossbows | 30 / 20 | 58 / 45 |
| A ford breaks the wedge | 83 / 78 | 100 / 100 |
| Soldiers mind the wagon | 93 / 93 | 78 / 80 |

Every extra still helps when on. Melee now kills faster than archers shoot (the sword's cooldown is 0.68 s for everyone, was 0.86 for soldiers), so the battles with crossbows on the other side are harder (for P11-07 and P11-13).

### Performance (`bench-battle.js 45`)

| Size | Mean (5.0.0) | p95 | p99 |
|---|---|---|---|
| 40 | 0.54 (0.53) | 0.85 | 1.23 |
| 100 | 1.40 (1.35) | 2.14 | 2.64 |
| 200 | 3.47 (3.19, +9%) | 4.68 | 6.22 |

Inside the task's 10% at 200.

### Weapons (`duel-lab.js 40 --weapons`, every weapon against the five, masher / timer)

The duels are decided by the seed's start, so each cell is all or nothing over 40 seeds. The hero is given what each weapon needs (a lab).

| Weapon | Looter | Footman | Huscarl | Legionary | Pikeman |
|---|---|---|---|---|---|
| Worn Sword | win / win | win / win | **lose** / win | win / win | win / win |
| Hand Axe, War Mace, Arming Sword, Knight's Sword | win / win | win / win | win / win | win / win | win / win |
| Ash Spear | win / win | win / win | **lose** / win | win / win | win / win |
| Greatsword | win / win | **lose** / win | **lose** / win | **lose** / win | win / win |
| Greataxe | win / win | win / win | **lose** / win | **lose** / win | win / win |
| Arming Sword, light or heavy armour | win / win | win / win | win / win | win / win | win / win |

**The matrix (plan §10.5) is not met yet, recorded for P11-10 and P11-11.** Mashed, the two-handers and the spear lose to shield troops (a slow weapon swung into a shield), and timed every weapon wins; but the axe and the mace lose to none of these five, and every weapon wins against the pikeman. The opponents are troops with 5.0.0's own damage and reach, and no styles: the family against family matrix needs P11-10's styles and P11-11's troops on their families.

## Armour and weight (5.6.0, P11-06)

### Foot styles (`duel-lab.js 20 --styles --field`, masher / timer: win %)

| Style (kit) | Load, band | Looter | Footman | Huscarl | Legionary | Pikeman | Hunter | Crossbowman | Rider | Reaver |
|---|---|---|---|---|---|---|---|---|---|---|
| Light duelist (arming sword, clothing) | 4, light | 100 / 100 | 100 / 100 | **0** / 100 | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 | 85 / **0** | 100 / 100 |
| Shield infantry (arming sword, kite, medium) | 11, medium | 100 / 100 | 100 / 100 | **0** / 100 | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 95 | 100 / 100 |
| Heavy infantry (war mace, heater, mail) | 18, heavy | 100 / 100 | 100 / 100 | 100 / 100 | 100 / **0** | 100 / 100 | 95 / 95 | 95 / 95 | 100 / 100 | 100 / 100 |
| Spearman (ash spear, kite, medium) | 13, medium | 80 / 95 | 80 / 95 | **0** / 85 | 80 / 85 | 85 / 95 | 80 / 80 | 80 / 80 | 80 / **0** | 80 / 95 |
| Two-hander (greatsword, helm, leather) | 12, medium | 100 / 100 | **5** / 100 | **0** / 100 | **5** / 100 | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 |

Every style loses somewhere and wins somewhere: no armour set wins every matchup. Heavy armour carries a masher through a huscarl that beats every lighter style, and loses a legionary the light styles beat (shorter reach and a slower tempo against a quick sword); the light duelist loses to a rider that heavy armour shrugs off. The shield infantry's only loss is a mashed huscarl: the middle way, as intended. With no AI styles yet (P11-10), opponents don't exploit a heavy fighter's slowness, so the differences are smaller than they will be.

### Small skirmishes (`parity.js 40`, the masher)

| Scenario | Odds | Fought | Over the odds (5.5.0) |
|---|---|---|---|
| lone-hero 1v3 | 86 | 100 | +14 (+14) |
| small 6v6 | 89 | 100 | +11 (+11) |
| close 7v8 | 79 | 100 | +21 (+21) |
| veterans 10v10 | 79 | 100 | +21 (+21) |
| outnumbered 6v11 | 61 | 63 | +1 (+6) |

The band (the masher no worse than about the odds) holds. The parity company's hero starts light (the Farmhand's kit), so the load itself doesn't change these; troops' poise and the mace's pierce do, a little.

## Bows and crossbows (5.7.0, P11-07)

### Duels (`duel-lab.js 20 --ranged`, the archer pilot, light armour, the open field): win %

| Weapon | Looter | Footman | Huscarl | Hunter | Rider |
|---|---|---|---|---|---|
| Shortbow | 20 | 0 | 0 | 100 | 5 |
| Hunting Longbow | 25 | 0 | 0 | 100 | 0 |
| Light Crossbow | 0 | 0 | 0 | 100 | 0 |

Alone in the open, an archer wins an archers' duel and loses to anyone who closes: a drawing archer walks at half pace, and a footman closes 200 px in two draws. That is the trade the plan wants: a bow needs its company in front of it.

### The hero as an archer in a company (the parity skirmishes, 20 seeds, the archer pilot, a worn sword carried second)

| Scenario | Shortbow | Longbow | Crossbow |
|---|---|---|---|
| small 6v6 | 100 | 100 | 60 |
| close 7v8 | 100 | 100 | 65 |
| veterans 10v10 | 100 | 100 | 65 |

The hero can win a contract as an archer. The crossbow's 2 s reload, standing still, gets the pilot caught.

### Parity and performance

`parity.js 40` (the masher, a sword): +14, +11, +21, +21 and −4 over the odds (outnumbered 58 against 61; inside the ±8 points of 40 seeds). Every troop's shot now flies by its range and is swept; the outnumbered company's hunters lose a little at the far end. `bench-battle.js 45 --sizes 200 --archers` (two in five shooting on each side): 3.30 ms a frame (P11-00's mixed battle 3.19).

## On horseback (5.8.0, P11-08)

### Mounted styles (`duel-lab.js 20 --mounted`, the open field): win % (the rider pilot / the circler)

| Style | Looter | Footman | Spearman | Hunter | Rider |
|---|---|---|---|---|---|
| Lance knight (war lance, destrier, mail) | 100 / 0 | 100 / 0 | 100 / 0 | 100 / 0 | **5** / 0 |
| Sword rider (arming sword, kite, rouncey) | 100 / 0 | 100 / 0 | 100 / 0 | 100 / 0 | **15** / 0 |
| Horse archer (shortbow, rouncey) | 70 / 0 | **0** / 0 | **5** / 0 | 100 / 0 | 80 / 5 |

Viable and distinct: the knight and the sword rider beat foot and archers and lose to riders; the horse archer beats archers and riders and loses to shielded foot. The circler never cuts anyone down: against spears and riders it dies; against the rest no blow lands for 45 s and the stall rule ends the bout (the opponent slips away).

### Against a braced line (20 seeds, the rider pilot, three of each)

| Style | 3 spearmen | 3 footmen |
|---|---|---|
| Lance knight | 85% (37% HP left) | 50% (29%) |
| Sword rider | 60% (24%) | 0% |

The brace stops and hurts the charge (`tests/mounted.test.js`), but a spearman in melee doesn't brace again, and without a shield it loses the melee that follows; three shield-bearing footmen are the harder wall. For P11-10 (AI that re-braces and holds its spears).

### Parity with a mounted hero (`parity.js 40`, the masher on a rouncey)

| Scenario | Odds | Fought (on foot) |
|---|---|---|
| lone-hero | 86 | 100 (100) |
| small | 89 | 100 (100) |
| close | 79 | 88 (100) |
| veterans | 79 | 88 (100) |
| outnumbered | 61 | **0** (58) |

A hero who gallops at the enemy with a company on foot arrives alone and is cut down (a horse at 135 px/s against soldiers' 90; with a slower horse, 105, 35%). Faster interruption resistance or more of each blow on the horse changed nothing (0 of 20 each); only arriving together does. For P11-13 (a company that keeps pace with its rider) and P11-20; Prepare's line warns meanwhile.

## Fighting styles (5.10.0, P11-10)

### Each style against each pilot (`duel-lab.js 20 --ai`, the tournament ground; the hero: Arming Sword, medium)

The opponent's body is a footman's (a spearman's for `spear` and `reach_keeper`, and a brawler in it to compare). *into-opening%*: its blows struck while the hero was recovering, staggered or had a broken guard; *keeps-px*: the mean distance between them over the duel (from the start, so the approach counts); *guarded%*: the hero's blows its shield was already up for.

```
style        body     pilot     win%  secs  hp-left%  taken  into-opening%  keeps-px  guarded%
brawler      footman  masher     100   3.6        91    1.0              0       101         0
brawler      footman  timer      100   4.2       100    0.0             60        94         0
brawler      footman  turtle     100   3.7        92    0.9              8        99         0
soldier      footman  masher     100   3.6        82    2.0             33       103        53
soldier      footman  timer      100  15.0       100    0.0             43        67         0
soldier      footman  turtle     100   3.9       100    0.0              5       100         0
veteran      footman  masher     100   4.4        63    4.2             93        94        25
veteran      footman  timer      100  13.5       100    0.0             17        66         7
veteran      footman  turtle     100   4.2       100    0.0             12        97        11
heavy        footman  masher     100   4.9        57    4.8             73        89        18
heavy        footman  timer      100  11.3       100    0.0             94        71        18
heavy        footman  turtle     100   5.7       100    0.0             85        86        25
spear        spearman masher     100   4.4        50    5.0             20        95         0
spear        spearman timer        0  14.5         0   10.0              2        75         0
spear        spearman turtle     100   5.7        82    1.9             15        87         0
brawler      spearman masher     100   3.6        86    1.4              0       102         0
brawler      spearman timer      100   4.1        70    3.0              0        99         0
brawler      spearman turtle     100   4.0       100    0.0             75        97         0
rusher       footman  masher     100   3.6        91    1.0              0       101         0
rusher       footman  timer      100   4.2       100    0.0             60        94         0
rusher       footman  turtle     100   3.7        92    0.9              8        99         0
shield_wall  footman  masher     100   5.4        51    5.5             45        86        25
shield_wall  footman  timer      100  13.7       100    0.0             40        67        28
shield_wall  footman  turtle     100   5.4       100    0.0             51        88        31
counter      footman  masher     100   4.3        64    4.0            100        95        23
counter      footman  timer      100  10.5       100    0.0            100        72        30
counter      footman  turtle     100   6.2       100    0.0            100        82        65
reach_keeper spearman masher     100   4.4        50    5.0             20        95         0
reach_keeper spearman timer        0  14.4         0   10.0              2        75         0
reach_keeper spearman turtle     100   5.6        81    1.9             16        88         0
```

- **The signatures:** veterans, heavies and counter-strikers strike into openings (73–100% of their blows against the masher; the timer gives few); a spear keeps the timer at its reach and wins every time (a brawler in the same body: 0); a brawler hardly ever guards in time (its reaction, 0.22 s, is slower than a sword's windup).
- **The acceptance (a huscarl's body, 20 seeds):** the masher beats it as a **brawler 20 of 20**, a soldier 20, a **veteran 15**, a **heavy 1** (the huscarl's own style). The timer beats every style, unhurt: strikes into recovery are what the styles leave open.

### Parity (`parity.js 40`, and `--big`), against 5.9.0

| scenario | odds | fought 5.9.0 | fought 5.10.0 | lost 5.9.0 → 5.10.0 |
|---|---|---|---|---|
| close | 79 | 100 | 100 | 0.45 → 0.93 |
| veterans | 79 | 100 | 100 | 1.02 → 0.65 |
| outnumbered | 61 | 65 | 70 | 2.90 → 2.63 |
| close×8 at 40 | 76 | 100 | 100 | 3.95 → 1.60 |
| close×8 at 100 | 76 | **60** | **95** | 16.85 → 8.22 |
| veterans×6 at 40 and 100 | 87 | 100 | 100 | 0.55 → 0.10, 0 → 0 |

The close fights' average is 17.2 over the odds (the slow test allows 2–18; 5.9.0: 15.3). Two rules found here: **patience is for the one who faces you** (a foe busy with someone else is pressed at once: with patience everywhere, your soldiers alone won the outnumbered fight 10% of the time, the enemy's alone 98%); and **a patient fighter strikes a foe who steps into its reach** (it had stood and been cut down by the masher). On 5.9.0 close×8 at 100 was 16 under its odds, below the slow test's floor of −15; now inside.

### The lists (`duel-lab.js 30 --tourney`)

Champion of a new town (and after one win there): masher 17% (0%), as on 5.9.0; timer 100% (100%); turtle 100% (100%; 5.9.0: 97% and 33%). The rounds' styles: a rusher, a shield-wall, a counter-striker; a rival keeps one of the four by name. **Two tries at the multipliers:** the semi-final at HP 1.15 and the final at 1.15 / 1.0 made the masher champion 67%; the final at 1.2 / 1.05, 43%. Kept: only the semi-final's HP lowered (1.3 → 1.15: its shield-wall carries that difficulty now); the final as it was (the counter-striker added none for the masher). Careful play now wins the final: the counter-striker waits for misses that a turtle never makes.

### Cost (`npm run bench`, 20 s each, simulation per frame)

At 200: 3.51 ms against 3.29–3.32 on 5.9.0 (+6%; the budget is 15%); at 100: 1.40 against 1.33. The first version cost +29%: every archer near the hero looked over every foe each frame (now a few times a second, the foes' own lists walked in place) and each unit's style was looked up each call (now kept on the unit). The detail radius, 360 px: 240 and 160 saved little once those were fixed.

## Troops by their weapons (5.11.0, P11-11)

### Tiers (`parity.js 40`; the close fights' average over the odds, 2–18 allowed)

| try | T2 HP | T3 HP | T3 armour | close | veterans | outnumbered | average |
|---|---|---|---|---|---|---|---|
| weapons only (5.10.0's numbers) | ×1 | ×1 | +0 | +21 | +21 | +12 | 17.7 |
| 1 | ×0.92 | ×0.82 | +1 | +21 | +21 | +19 | 20.3 |
| 2 | ×0.96 | ×0.88 | +1 | +21 | +21 | +17 | 19.3 |
| kept | ×1 | ×0.88 | +1 | +21 | +21 | +12 | 17.7 |

Both tries made fighting easier: the enemy's commonest troops are T2 (reavers). Kept: the T3 gives HP for armour (12% less, one more point), the T2 as it was. Big battles (`--big`): close×8 at 40 and 100 won 100% and 95% (odds 76), the veterans' 100% (87).

### The realms' lines, AI against AI (`node scripts/realm-lab.js 6`, new: each realm's squad, three foot and two archers at T2, two foot, two archers and a rider at T3; the free companies five mercenaries or sellswords; from both sides of the field)

```
             valedorn  aurelian hrothmark   vessaro   ostrand saltreach   outlaws      free   mean
valedorn            ·       100        92        83        42        83       100         0     71
aurelian            8         ·         8        58         0        58        58         0     27
hrothmark          33        92         ·        75        17        75        92         0     55
vessaro             0        42         8         ·         8        50        33         0     20
ostrand           100        92       100        92         ·        92       100        42     88
saltreach           0        42         8        50         8         ·        33         0     20
outlaws             0        50        25        75         8        75         ·         0     33
free              100       100        92       100        75       100       100         ·     95
```

```
             valedorn  aurelian hrothmark   vessaro      free   mean
valedorn            ·        67        83        58        25     58
aurelian           92         ·        75        75        17     65
hrothmark          25        33         ·        33         0     23
vessaro            50        50        75         ·         0     44
free               75        83       100       100         ·     90
```

- **Strengths and weaknesses:** at T2 Valedorn beats all but Ostrand and the free companies; Aurelia beats the League, Saltreach and the outlaws and loses to the rest; Hrothmark beats the spear and pike realms and the outlaws; Ostrand loses only to the free companies. **Not met:** the League and Saltreach have no strength in these squads (one tie between them), Hrothmark's T3 none, the free companies (all shields) no weakness.
- **Why (found here, for P11-13 and P11-14):** one against one, a pikeman beats a footman 65%, a spearman 100%, a huscarl a guard 100%; **three against three** the same lines win 0–15%, and so they do **with no styles at all** (huscarls 15%, pikes 0%): a crowd effect of the shared melee rules, not of P11-10. Tried and dropped: a sword striking two (not three) at 70% (huscarls 15%, the outnumbered company 55%), the second target at 50% (no change), long weapons closing only to their own reach (no change), the heavy style's patience 0.8 s (no change). Spears and pikes are meant to fight in a held line (P11-13's formations) and beside others (P11-14's combined arms).
- **Kept from the reviews:** a pike or two-handed weapon guards with the weapon for troops too (plan §10.2); the Legionary's and Pavisier's brace kept as a shield line's skill (no look changes, so no decision needed).

### Lords and fine kit

A lord in person (a guard's body, `duel-lab`'s kit, 20 seeds): the masher wins 0 and the timer 20 at HP ×2, and the same with +2 armour and the veteran style at ×2, ×1.7 and ×1.5: kept ×1.6. Fine kit: +10% damage (a better weapon of the family), +1 armour, +4 HP (was +1 armour, +8 HP).

## The night run (2026-11-27, 5.7.0)

### XP pace over a long campaign (`progression.js 360 3`, 98 min under the run's load)

| Style | Seed | L10 | L15 | L20 | Level / XP at day 360 |
|---|---|---|---|---|---|
| hands-off | 1 / 2 / 3 | 56 / 56 / 57 | 157 / 150 / 157 | 340 / 281 / 321 | 20 / 57,674 · 20 / 73,464 · 20 / 61,984 |
| presets | 1 / 2 / 3 | 103 / 114 / 235 | 194 / 198 / 331 | 329 / 325 / – | 20 · 20 · 16 / 31,218 |
| expert | 1 / 2 / 3 | 73 / 240 / 85 | 157 / 343 / 178 | 288 / – / 324 | 20 · 15 / 28,802 · 20 |

P11-03's curve holds where the company prospers: level 20 between days 281 and 340. The presets and expert bots fought and lost more on 5.7.0 (armour's poise, fixed in 5.8.0), and two of their runs stalled at 15–16.

### Sieges, long runs and the slow suite

`parity.js --siege 30`: storming 70% against odds of 41 (+29), defending 0% against 65 (−65). The 30-year long runs: every invariant held every day except a realm past half the land (seeds 1–3; the same on 5.0.0). The rest, and what was fixed: `docs/PENDING-CHECKS.md` ("Done", "Pending").
