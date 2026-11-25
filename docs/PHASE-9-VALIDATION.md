# Crownless 4.0 — Phase 9 acceptance (P9-T)

_Build 4.0.0, 2026-11-24. Phase 9, "Kingdoms and Houses", is complete in code: P9-B1 to P9-B5, P9-L1, P9-01 to P9-08 and P9-T. This is the evidence that its exit holds in the bot, the measurements behind the tuning, what is still open, and what waits on the owner's play. By the owner's rule of 2026-11-24, no run here took more than 20 minutes: the long runs (SC-29) and the whole slow suite moved to P10-00._

## The exit (design §18.9)

> A player ruler can command a vassal army, negotiate a treaty, appoint a castellan and issue a land grant. A disloyal noble can decline an order, create a faction and rebel. If the player loses the war and is deposed, the same save continues with the player as a free claimant.

**`tests/slow/phase9-exit.test.js`**, a scripted campaign of about 130 days in one save, reloaded twice, with the world's parties riding (about 2 minutes):

| Step | What happens | Checked |
|---|---|---|
| Found | You hold Westholt Castle (test setup, with 600 renown and 40 soldiers) and declare a realm there; Valedorn accepts it in its 7 days | You rule; no war with the old crown |
| Vassals | Four of Hrothmark's lords who resent their king and think well of you ask to swear; you accept | Four vassals of your realm |
| Rule | You grant a village and a fort to vassals, appoint a veteran castellan at Westholt, offer Aurelia a treaty of trade (it accepts), and raise your army: your vassals answer and ride with you | Holders, the castellan, the treaty, the army |
| Reload | Saved and loaded again | Same day, soldiers, realm, vassals and castellan |
| Decline, faction | You wrong three vassals; one declines your summons, with reasons; the three form a faction, warn you three times and make demands | Refused with reasons; a faction of the wronged; your message |
| Rise, lose | You refuse; they rise; their army fights its crown first and takes Westholt while you are away; with no fort left to you, they win | Civil war; deposed |
| Go on | Saved and loaded again: a free claimant with your company and a claim on Westholt; the bot plays 10 more days | Independent; no stall; no invariant broken |
| Throughout | The §25.3 invariants after every day; soldiers and holdings never doubled | No problem on any day |

**✅ The exit holds in the bot.** The owner's play is the other half (below).

Building it found six faults, all fixed in 4.0.0:
- After a reload, a realm you founded got a made-up ruler with no home, besides you (the next lord to ride out crashed the game).
- Your court granted your own land away, your seat included (a realm founded at a fort could lose its capital the same way).
- The old crown besieged your new realm's seat while its 7-day answer was pending, and took it before answering.
- A rising's army raided whoever was nearest, not the crown it rose against.
- A civil war ended by "exhaustion" like any war, and so in a truce, whatever the rebellion's state.
- A lord who changed realm stayed in his old realm's army until its next muster (the invariants caught it on one day).

Two more surfaced in the measurements: a lord who died stayed married (the invariants, after deaths doubled), and the test loader dropped every party of a loaded save (so armies broke at each reload in a test, not in the game).

## Prototype G as a ruler (SC-41)

`node scripts/prototype-g.js 12 3 ruler`, and in `tests/slow/campaign-bots.test.js`: a captain with a fort, 600 renown and 40 soldiers (test values) founds a realm on day 0, then leaves it to the officers' default policies while auto-resolving every fight.

| Seeds × days | Founded | Forced screens | Stuck | Invariants | Reload resumed |
|---|---|---|---|---|---|
| 3 × 12 | 3 of 3, day 0 | 0 | 0 | 0 | 3 of 3 |

## Tuning

At most two tries a number. Measured with `node scripts/landed.js 360 --seed <n>` (the world alone for a year, three seeds side by side, about 3 minutes; `--seed` is new) and `scripts/parity.js` with 10 to 20 seeds.

| What | Target | Before | 4.0.0 | |
|---|---|---|---|---|
| Treasuries | no realm broke at peace in 360 days | none | none (lowest 48, Aurelia at war) | ✅ |
| Treaties | each pair signs one in 360 days | every pair | every pair (7–13 a seed) | ✅ |
| Wars | 20–50% of days | 15–16% | 9–18% | ❌ open |
| Rebellions | one to three risings a year | 0, 0, 0 | 1, 0, 0 | ❌ open |
| Armies | two to six campaigns a year | 9–23 raised | 7–15 raised (2–4 a realm) | ✅ read per realm |
| Capitals | one falls on at most one seed in three | none | none | ✅ |
| Lords' deaths | two to six a year | 2, 0, 2 | 0, 5, 1 | ❌ open (chance) |
| Big battles at 40 and 100 | at most 25 over the odds | close ×8 +37, veterans ×6 +29 | +24, +13 | ✅ |
| The walls at 40 | −5 to +25 | storming +19, defending +13 | the same (unchanged) | ✅ |
| Small fights (B-01) | 5–15 over the odds | +4 to +19 | +6 to +19 | as before |

What changed:
- **Big battles** (one try): Simulate's odds sharpen with the battle's size. The square law holds while the weaker side is 20 or less, and its power rises to 4.2 by 80 (a steady edge tells more surely in a battle than in a skirmish). The same rule for every field battle, yours and the AI's. Assaults on the walls keep the square law they were tuned on (P9-B5).
- **Deaths** (one try): a lord beaten in battle dies of wounds 6% of the time (was 3%).
- **Wars** (two tries): a war lasts at least 20 days (was 12) and ends by exhaustion after 40 fallen (was 12, which one clash of armies reached). That gave 22–26% of days, until the bigger-battle odds made field battles decisive: now 9–18%. The second try (80 fallen) changed nothing: truces, not exhaustion, end the wars now.
- **Rebellions** (two tries): a member taken prisoner stays in the faction; a mediator is worth +5 (was +10). Factions form 4–5 times a year, but a mediator still eases most of them below their grudge.

## The scenario matrix (SC-01 to SC-44)

| Scenario | How it is accounted for |
|---|---|
| SC-01 Recruit, earn, promote, wound, save | `soldiers.test.js` "SC-01" |
| SC-02 Partial or missed pay | `soldiers.test.js`, `accounts.test.js` "SC-02" |
| SC-03 A veteran dies after a long career | `chronicle.test.js` "SC-03" |
| SC-04 A 3× forest arena | `arena.test.js` |
| SC-05 Tactical view, an archer group | `tactics.test.js` |
| SC-06 Balanced preset | `prep.test.js` |
| SC-07 Deployment kept over save and load | `prep.test.js` |
| SC-08 A friendly patrol joins | `reinforce.test.js` |
| SC-09 An enemy patrol arrives | `reinforce.test.js` |
| SC-10 Paused five minutes | `clock.test.js` |
| SC-11 Five minutes of fighting | `clock.test.js` (the owner's 4-hour rule, V2-VALIDATION) |
| SC-12 Auto-resolve, no duplicates | `clock.test.js` |
| SC-13, SC-14 The merchant | `merchant.test.js` |
| SC-15 A mill | `business.test.js` |
| SC-16 A town with your inn taken | `business.test.js`, `sieges.test.js` |
| SC-17, SC-18 Detachments | `detachments.test.js` |
| SC-19 Sworn, granted a fief | `fiefs.test.js` |
| SC-20 Your fort falls while away | `claims.test.js`, `sieges.test.js`, `slow/phase8-exit.test.js` |
| SC-21, SC-22, SC-23 Landless, defect, retake | `claims.test.js`, `slow/phase8-exit.test.js` |
| SC-24 A noble refuses an order | `nobles.test.js`, `slow/phase9-exit.test.js` |
| SC-25 Your alliance made and broken | `founding.test.js` "SC-25" (new in 4.0.0: a ruler's own treaty offers) |
| SC-26 Deposed by your vassals | `rebellion.test.js` "SC-26", `slow/phase9-exit.test.js` |
| SC-27 Refuge with an old enemy | `rebellion.test.js` "SC-27" |
| SC-28 A tournament at low level | `tourney.test.js` (fees, losses recoverable, the anti-farm cooldown) |
| SC-29 100 years with delegated commanders | **moved to P10-00** (the owner's rule: no run over 20 minutes); the 360-day runs here held every invariant every day |
| SC-30 A save across a migration | `save-migration.test.js` |
| SC-31, SC-32 A partial import; storage full | `save-migration.test.js`, `browser/load-save.spec.js` |
| SC-33 A modded save with content gone | `realm.test.js`, `v2-acceptance.test.js`, `browser/load-save.spec.js`, `packs.test.js` |
| SC-34 A phone, a large arena | `v2-acceptance.test.js`; **the owner's phone** |
| SC-35 Backgrounded mid-battle | `v2-acceptance.test.js` |
| SC-36 Ten fights without tactics | `prep.test.js` |
| SC-37 Fought and auto-resolved | `battle-tuning.test.js`, `slow/battle-parity.test.js`, the tuning above |
| SC-38 Food and loot only | `npm run economy` (V2-VALIDATION) |
| SC-39 A merchant on Cautious | V2-12 and V2-T1 (V2-VALIDATION) |
| SC-40 A mill on its default manager | `business.test.js` |
| SC-41 Ruling while fighting | `founding.test.js` "SC-41", `slow/campaign-bots.test.js` (Prototype G's ruler) |
| SC-42 An expert's measurable difference | `fiefs.test.js`, `slow/battle-extras.test.js` |
| SC-43 One system advanced, the rest default | `divisions.test.js` (your divisions kept with the save, the rest on Auto) and `fiefs.test.js` (each holding's policies its own) |
| SC-44 A castle lost with policies set | `fiefs.test.js` "SC-44" |

## How it was checked

- **Fast tests:** 913: 911 of 912 passed together (`npm test`; the cross-device export test failed once under load and passed alone), and the engine-range case added after, with its file.
- **Lint:** clean but the 2 old warnings. **Typecheck:** clean.
- **Slow files this task reaches**, each alone and each under 8 minutes: `phase9-exit`, `campaign-bots` (with the ruler), `second-world`, `world-sim`, `test-world` pass. `landed` fails: Aurelia loses its last fort by day 60 on seed 2 (the same kind of failure as seed 3 since 3.11.0, now on another seed).
- **Not run** (the owner's rule): `battle-parity` (about 26 minutes) and the whole slow suite (about 44 minutes): both are P10-00's, with the long runs. Prototypes D and F and the Phase 8 exit failed at the P9-06 checkpoint and were not rerun.
- **Browser:** the full suite once at the end: 231 passed, 21 skipped, 4 failed in `packs.spec.js` (the sample pack's and the coast's engine ranges stopped before 4.0.0; widened to before 5.0.0, then 4 of 4). `realm.spec.js` 12 of 12, with the new treaties case.
- **Played at 812×375** by taps: declared a realm at Westholt (test setup: held, 600 renown, 40 soldiers), offered Hrothmark trade (accepted), then broke it (trust −40, the offer hidden for a month).

## Open, for P10-00 or later

- Wars on 9–18% of days (the target 20–50%): truces end them soon after a decisive battle.
- Risings: one in three years of the world alone (the target one to three a year): mediators settle most factions.
- Deaths: 0–5 a year, by chance (the target 2–6).
- A realm can lose its last fort (Aurelia on seed 2, Valedorn on seed 3 before).
- The Sundered Coast: one war a year, 19 days of 360 (it starts at war; truces and few patrols keep the peace after).
- Few marriages (1–3 a year of 9–16 matches sought); no AI lord founds a realm in most years.

## Waiting on the owner's play (phone)

1. **Found a realm** (Debug → Holdings → a fort → Declare my realm, or by play): the Your realm tab, its treaties cards, an offer accepted or declined with a reason, and a treaty broken.
2. **Rule while riding** for several days: only messages, no screen forced (SC-41).
3. **Raise your army** and give it an order; ride with it into a battle of the new size.
4. **A big battle** (40 or more a side) fought and simulated: does Simulate's odds feel right?
5. **A faction in your realm:** its warnings, its demands, refuse them, the civil war; deposed or not, the game goes on.
6. **The Sundered Coast** on a phone (P9-08's open item), and a content pack on a phone (P9-07's).
7. **SC-34:** a mid-range phone, a large arena with cavalry and reinforcements: frame time and touch.

## P10-00: the night run (4.3.1, 2026-11-25)

The owner asked for it on 2026-11-25, with the long run cut to 30 years ("100 years doesn't make sense") and the rest a little shorter. The long-run tools were built and tried on a one-year slice first. Then, in one go: the full browser suite, the whole slow suite and 30 years of the world alone; then again on the fixed code.

**The long run** (`npm run long-run`, the world alone, every invariant every day, plus no negative money, no holding changing hands back and forth in a day, no endless loop of events, no realm with more than half the land):

| Seed | First run (4.3.0) | Final (4.3.1) |
|---|---|---|
| 1 | from day 1721, a lord counted in an army he had left; day 2083, the day threw (a landless realm's patrol) | 30 years, every invariant held; the most land one realm held: 48% |
| 2 | Hrothmark past half the land on day 1374 (year 4), all of it by day 3854 | every invariant held; Hrothmark past half on day 6726 (year 19), at most 86% |
| 3 | a founder holding a village for the realm he left (day 3857, and three more later); Aurelia past half on day 3155 | every invariant held; Aurelia past half on day 3155 (year 9), at most 76% |

- The save after 30 years: 178–191 KB (the budget is 4 MB). A day of the world alone: 200–380 ms, falling as the realms fight down to fewer parties.
- `tests/slow/long-run.test.js` (10 years, seed 1): passes.

**Fixed:** the landless realm's patrols (they stand down), the army muster (a member whose party is not the army's has left it), a founder's village that cannot follow (given up to the old crown, with a claim), a rising that loses all its land (the crown's win), and runaway realms (overstretched past a quarter of the land: sieges need up to 4× more to begin, no surrender for hopeless odds). The world runs three times faster (the roads were rebuilt at every terrain lookup since the coast joined in 4.2.0; terrain the same at all 461,648 points checked).

**The slow suite** (final code): 14 of 22 pass. `gate-d-campaigns` (40 campaigns) passes. Failing, all recorded for P10-T:
- `battle-parity`, sieges: defending a fort comes out under the odds (−12 at 30 seeds; −7.7 at 40, the test allows −5); attacking +18.7. Not run since 4.0.0's sharper odds.
- The Phase 7 exit, seed 2: the company ends with 316 crowns (the test wants 500). It passes at 4.1.0; at 4.1.0 seed 3 ends with 461. The bigger world's draws; the bot meets 1–3 world events in 100 days, against 5–6 before the coast.
- `landed` (a founded realm with one riding lord, seed 1), the Phase 8 and Phase 9 exits, Prototypes D and F: as before.
- `happenings-bots` failed its 120-second guard only with four long runs beside the suite; alone it takes 36 s (117 s before the speed-up).

**The browser suite:** 244 passed, 9 skipped; the tourney bout ("BOUT LOST") and the `lords` ransom cases made steady (20 of 20 and 10 of 10).

### Open, for P10-T

- **Runaway realms** on two seeds of three, though years later and smaller than before. The overstretch numbers have had their two tries; what else could check a leader (rivals allying against it, unrest in conquered land) is a design choice.
- Siege balance when defending; the Phase 7 exit's money on seed 2; the known scenario drift.
- Wars and risings: still few in the world alone (0–5 wars at a year's end).
