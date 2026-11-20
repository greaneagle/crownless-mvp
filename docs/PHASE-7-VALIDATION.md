# Crownless 2.23 — Phase 7 acceptance (P7-T)

_Build 2.23.0, 2026-11-20. Phase 7, "The Living Company", is complete in code: B-01 and P7-01 to P7-11. This is the evidence that its exit holds in the bot, the measurements behind it, and what still waits on the owner's play._

## The exit (design §26.3)

> An independent player builds a lasting company with non-combat roles, delegates, earns through trade or property, and meets dynamic consequences, without needing a title.

It is scripted as `tests/slow/phase7-exit.test.js`: the expert bot plays 90 days of the real campaign with the world's events running, saving at day 45 and playing on from the reloaded save. Two seeds in the test; three in the table below (`scripts/prototype-g.js`, `run(seed, 'expert', 90)`).

| Part of the exit | How it is checked | Seeds 1 / 2 / 3 at day 90 |
|---|---|---|
| **A lasting company** | Still fielding 10 or more soldiers at day 90, resumed from its save, never stuck, few hardship warnings | 19 / 19 / 19 soldiers; resumed 3 / 3; stuck 0; 3 / 4 / 3 warnings (wages short, food) |
| **Non-combat roles** | A surgeon, a scout, a blacksmith and a quartermaster hired, four or more kept | All five (quartermaster, merchant, surgeon, scout, blacksmith) in every run |
| **Delegates** | The quartermaster buys; detachments go out under their own captains and come back | 9 / 10 / 10 detachments sent, 3 / 3 / 3 back so far |
| **Earns through trade or property** | A mill that has run and made money, or a merchant up on its stake | Mill −14 / +190 / +82 over 4–5 weeks; merchant 160 / 164 / 165 on 150; money 4,175 / 3,697 / 3,631 |
| **Dynamic consequences** | World events seen and joined; the news; the chronicle | Events seen 23 / 22 / 23, joined 3 / 4 / 4; 8 news lines kept; 80 chronicle entries |
| **Without a title** | Holds no land | None held (Phase 8 brings holdings) |

**✅ The exit holds in the bot.** The owner's play is the other half of the acceptance (below).

## Prototype G with followers and officers

`npm run prototype-g` (6 campaigns × 30 days, the same seeds for each style; from 2.23.0 the world's events run in every style, and the expert also keeps a surgeon, a scout and a blacksmith, sends detachments, buys a mill where it would pay and joins events):

| Style | Money (median) | Soldiers | Won / lost | Hero down | Roles | Detachments | Events joined | Warnings | Resumed |
|---|---|---|---|---|---|---|---|---|---|
| Hands-off | 168 | 17 | 166 / 63 | — | 0 | 0 | 0 | 2 | 6 / 6 |
| Presets only | 614 | 20 | 205 / 19 | 125 | 0 | 0 | 0 | 2 | 6 / 6 |
| Expert | 585 | 17 | 199 / 25 | 118 | 5 | 8 | 8 | 8 | 6 / 6 |

Every style gets through the same campaign and resumes after a reload. Over 30 days the expert's roles cost about what they bring: a little less money and three fewer soldiers than presets-only, and more warnings. Over 90 days they pay off (the exit table: 3,600–4,200 crowns). The hands-off player never opens a screen.

## Economy pass

`npm run economy` (12 campaigns × 60 days, the hands-off bot):

- **Income per campaign-day:** spoils 59.6, contracts 52.1.
- **Spending per campaign-day:** training 44.7, hiring 18.1, wages 17.6, gear 11.1, food 7.8, captors 5.2.
- **Median money:** 68 at day 15, 161 at day 30, 534 at day 60 (448 at B-01, 2.11.0). Renown 290 and level 10 at day 60, 20 soldiers (85% of them tier 3).
- **Hardship per campaign:** wages short 0.8, ran out of food 0, desertions 0.

Healthy by V2-T1's measures. Nothing to tune.

## Battle passes

**Parity** (`npm run parity`, 40 seeds, Balanced): fought battles over the stated odds; B-01 aims for 5–15 points.

| Scenario | Odds | Simulate | Fought | Over the odds |
|---|---|---|---|---|
| Lone hero, 1 v 3 | 86% | 83% | 100% | +14 |
| Small, 6 v 6 | 89% | 85% | 100% | +11 |
| Close, 7 v 8 | 79% | 73% | 93% | +14 |
| Veterans, 10 v 10 | 79% | 73% | 80% | +1 |
| Outnumbered, 6 v 11 | 61% | 60% | 65% | +4 |

Unchanged since B-01. P7-11's formations leave Balanced as it was.

**Escort ambushes** (P7-11 left them too easy when fought). Counting a fight as won only if the wagon comes through (the contract's success), with the parity bot over 40 seeds:

| Setting | Over the odds, 4 ambushes | Average |
|---|---|---|
| 2.22.0: 70 HP wagon, raiders strike at once | +19, +19, +8, +29 | +18.9 |
| Raiders lie in wait until the front closes | +15, +18, +8, +29 (30 seeds) | about +17 |
| Raiders every second Reaver | −23, +4, +11, +21 | +3.3 |
| The band starting further off | −46, −59, +11, −21 | −28.6 |
| **2.23.0: raiders lie in wait, 40 HP wagon** | **+4, +19, +6, +26** | **+13.9** |

In 2.23.0 the wagon-raiders lie still in cover until the band's front closes with the company (or one of them is hit), and the wagon has 40 HP. That brings the average into B-01's 5–15. The four ambushes are 8 Reavers and 4 looters, 4 and 4, 6 looters, and 6 looters and 5 Reavers against small companies. The spread between them is wider than in open battle.

**Battle extras** (`npm run extras`, 40 seeds, each effect on and off): the shield wall against crossbows 100% won against 73% (0.57 soldiers lost against 2.60), against Reavers 0.63 lost against 1.07; the wedge 75% against 63%; archers on the knoll 60% against 40%. Soldiers minding the wagon still make no clear difference to whether it is saved (63% against 70% now; 63% against 65% in 2.22.0). With the parity bot the hero leads the company to the front. Whether that rule earns its place is for the owner's play to show.

## How it was checked

- **Node:** 704 fast tests (`npm test`) and 12 slow (`npm run test:slow`, with the Phase 7 exit on two seeds and the battle extras' measurements), all passing; `npm run lint` (Biome and the TypeScript check) clean.
- **Browser:** 153 Playwright tests at desktop and phone landscape size (812×375), all passing (9 more apply to one device only).
- **Runs:** Prototype G, the economy report, parity and the extras, as above.

## Waiting on the owner's play

The exit's second half ("in the owner's play") can't be scripted. On the phone, please check:

1. **A Phase 7 company over a few weeks:**
   - hire a surgeon, a scout and a blacksmith;
   - send a detachment, buy a mill, take part in an event;
   - check that it all reads clearly and needs no daily clicks.
2. **B-01's open check:** can a close fight be turned by fighting well?
3. **The shield wall and the wedge:**
   - Do they feel different?
   - Is the Orders panel's formation row easy to reach at 812×375? (It sits below Rally and may need a scroll.)
4. **An escort ambush:** is the wagon worth protecting, and is losing it fair?
