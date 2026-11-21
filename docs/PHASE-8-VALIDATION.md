# Crownless 3.0 — Phase 8 acceptance (P8-T)

_Build 3.0.0, 2026-11-21. Phase 8, "The Landed World", is complete in code: P8-02, P8-03, P8-01, P8-04, P8-05, P8-06a, P8-06b, P8-07, P8-08 and P8-T. This is the evidence that its exit holds in the bot, the measurements behind the tuning, and what still waits on the owner's play._

## The exit (design §28.1, §17.6)

> A player can acquire land, lose it, go landless, change allegiance and retake it, as one ongoing character, without any quest-specific reset.

It is scripted twice:

- **`tests/slow/phase8-exit.test.js`**, a 120-day campaign in one save, reloaded at day 60 (the page closed and opened again), with the world's parties riding:

  | Step | What happens | Checked |
  |---|---|---|
  | Serve and swear | The landed bot plays days 0–25 as Valedorn's mercenary; the company swears fealty | Sworn to Valedorn |
  | Acquire | At war with Hrothmark, the company besieges and storms Ulfstead Hold, asks the crown for it, and accepts the grant | Ulfstead held by the player, before day 60 |
  | Reload | Saved at day 60 and loaded again | Same day, same soldiers, same holder |
  | Lose | Hrothmark's lords besiege and take Ulfstead while the company is at Stonebridge | Held by Hrothmark; a claim kept |
  | Landless, change allegiance | The Claims view, no fiefs; the company defects, serves Aurelia, swears to it | Sworn to Aurelia |
  | Retake | Aurelia at war with Hrothmark: the company besieges and retakes Ulfstead; Aurelia backs the claim | Held by the player again, for Aurelia |
  | Throughout | The §25.3 invariants after every day; soldiers and holdings never doubled | No problem on any day |

- **`tests/slow/prototype-d.test.js`** (P8-08), the dispossessed lord: a fort and its village, a warband and a mill; the fort taken while away; cast out; 15 days landless; service and fealty to the enemy's enemy; the fort retaken and the claim backed.

**Prototype F** (P8-07, `tests/slow/prototype-f.test.js`): the same high-risk request to two lords; Lady Avice obeys, Lord Hamon names a price, and the reasons name the factors; freeing his sister lowers his price.

**✅ The exit holds in the bot.** The owner's play is the other half of the acceptance (below).

## Tuning

### What a fief earns

On the defaults (the steward, normal tax, 22 in a fort's garrison), a week, measured over 12 weeks:

| Holding | Before 3.0.0 | 3.0.0 |
|---|---|---|
| A fort (Westholt, Castra Nova, Ulfstead) | −19 (tax 48, garrison 56, steward 6, the crown's tenth 5) | **+10** (tax 80, the crown's tenth 8) |
| A village (Ashby, Fernley, Calvinum, Highmere) | +22 | +22 |

A fort now pays for itself, and a fort with its village makes about 30 a week. A contract brings about 360 a week (52 a day, P7-T's economy pass), so land is a modest income beside the company's work, not a reason to stop. The AI's forts run on the same rules, so their treasuries no longer drain. The change: the fort tax base from 60 to 80, and a fort's prosperity at the start from 40 to 50.

### War pace and anti-snowball

`npm run landed 180 6`: the world alone for 180 days after the story's ending, six seeds, nobody playing.

| Seed | Wars | Forts taken | Forts per realm at the end (V/A/H/Ve) | Lords: landless / one / several | Landless lords who won land | Landed lords who lost it all | Changed realm |
|---|---|---|---|---|---|---|---|
| 1 | 4 | 5 | 3 / 2 / 2 / 1 | 6 / 10 / 6 | 4 of 8 | 2 | 1 |
| 2 | 4 | 5 | 3 / 2 / 2 / 1 | 7 / 8 / 7 | 3 of 8 | 2 | 2 |
| 3 | 4 | 3 | 1 / 3 / 2 / 2 | 10 / 3 / 9 | 0 of 8 | 2 | 1 |
| 4 | 4 | 4 | 4 / 1 / 2 / 1 | 9 / 4 / 9 | 2 of 8 | 3 | 1 |
| 5 | 4 | 5 | 1 / 3 / 2 / 2 | 8 / 6 / 8 | 2 of 8 | 2 | 3 |
| 6 | 4 | 9 | 1 / 3 / 2 / 2 | 8 / 6 / 8 | 2 of 8 | 2 | 1 |

- **Every realm keeps a fort** in every seed. Before 3.0.0 one seed in six saw Valedorn lose its last fort around day 120: the besiegers stormed it on the first day, before its relief could come. Now a realm's last fort is stormed only after the ram (three days) and at 75% odds, and surrenders only to hunger.
- **Forts change hands** 3–9 times in 180 days, not every week.
- **No lord gathers a realm's land:** the most any lord holds is 40% of a realm's holdings (two of Vessaro's five).
- **The lords' politics:** 1–3 lords change realm a run, always after grumbling at court; 0–15 rivalries and 2–4 feuds form from grants and conquests, and 0–6 friendships from sieges fought together. Every realm keeps at least four riding lords.

### Siege odds

`node scripts/parity.js 40 --siege`: fought on the walls against Simulate, 40 seeds each.

| Scenario | Odds | Simulate | Fought | Over the odds |
|---|---|---|---|---|
| Your assault on Castra Nova, three days in | 46% | 38% | 55% | +9 |
| Your defence of it | 60% | 53% | 75% | +15 |

Unchanged since P8-06b, inside B-01's 5–15.

### Thresholds

Left as they are, by what the bots show:

- **To swear fealty:** 150 renown and 20 days as a mercenary (or the story's favour). The landed bot swears on days 30, 50, 33 and 30.
- **A sworn vassal's first land:** the crown's own village after **30** days of service (from 60). The landed bot is granted its first village on days 72, 80 and 73, and the fourth run, sworn on day 50, is not granted one by day 90.
- **Ransoms:** 100 crowns and 25 a soldier the lord led: 400–700 crowns for most lords, a week or two of a company's income by the time it fights lords.
- **The cap of three fiefs** and the lords' party sizes by what they hold (12 landless, 16 a village, 21 a fort or town, 3 more a fief): unchanged.

## Prototype G with a landed player

`node scripts/prototype-g.js 90 4` (4 campaigns × 90 days, the same seeds for each style, saved at day 45 and reloaded). The landed style serves the kingdom whose capital it is at, swears when it may, takes the grants it is offered, and leaves the steward and the defaults.

| Style | Money (median) | Soldiers | Won / lost | Sworn | Landed by day 90 | Forced screens per 10 days | Invariants broken | Resumed |
|---|---|---|---|---|---|---|---|---|
| Hands-off | 494 | 20 | 371 / 59 | — | — | 0 | 0 | 4 / 4 |
| Presets only | 3,534 | 20 | 407 / 8 | — | — | 0 | 0 | 4 / 4 |
| Expert | 2,513 | 19 | 407 / 9 | — | — | 0 | 0 | 4 / 4 |
| Landed | 4,331 | 20 | 413 / 8 | 4 / 4 | 3 / 4 | 0.08 | 0 | 4 / 4 |

**Forced screens** are the decisions that interrupt the map: a ransom offer, a grant, the conqueror's choice, your fort besieged. The landed player meets about one in 120 days: the grant of its first village. A siege of its fief, a conquest or a captured lord bring one more each, when they happen. On the map a day passes in about 6 seconds of travel (4 game hours a second), so 10 campaign days are a minute or two of riding plus the stops; a captain without land meets none.

## How it was checked

- **Node:** 806 fast tests (`npm test`) and the whole slow suite (`npm run test:slow`: 17 tests in 11 files, among them the Phase 8 exit and Prototypes D and F; about 42 minutes), all passing; `npm run lint` (Biome and the TypeScript check) clean.
- **Browser:** 187 Playwright tests at desktop and phone landscape size (812×375), all passing (9 skipped: the visual baselines, Linux only, and those for one device only).
- **Runs:** the landed world, Prototype G and siege parity, as above.

## Waiting on the owner's play

The exit's second half ("in the owner's play") can't be scripted. On the phone, please check:

1. **Prototype D from the Debug panel** (Debug → Nobles → Prototype D start): you hold Westholt Castle and Ashby for Valedorn, with 12 soldiers and a mill, and Hrothmark's lords gather against Westholt.
   - Play the loss and the return: the siege alarm, the Claims tab, pressing your claim (ask your liege, buy it back, or change crowns and retake it).
   - Is it clear at each step what you lost, what you kept and what you can do?
   - The war is real: Valedorn's lords may relieve Westholt, and then you keep it.
2. **A landed campaign of a few weeks:** serve, swear, take the land you are granted, and leave it to the steward. Does the fief run itself, with one line a week and no chores?
3. **The lords:** on the Realms screen's Lords tab, ask a few lords for help. Do their answers and reasons read sensibly? Do the news lines about lords grumbling, leaving and refusing summonses make the world feel alive, or noisy?
4. **The frame rate** (open since P8-01 and P8-06b): Debug → Map stress 80 with the lords riding; Debug → Siege assault 30 and Siege defence 30. Each reports its fps when it ends.
5. **The siege battle:** storm a fort's walls once, and defend one once (be inside a fort when it is stormed). Do the ladders, the gate and the ram read clearly at 812×375?
