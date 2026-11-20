# Crownless — Release Notes

## v2.24.0 — Holdings and the lords of the realms (P8-02) · 2026-11-20

### New
- **Every town, fort and village of a kingdom is now a holding,** held by one of its lords or by its ruler. Each village answers to its seat, the nearest fort or town of its kingdom. When a fort changes hands its villages go with it, and the lords who lost them keep a claim.
- **The people of the realms.** Each kingdom has a ruler and five or six lords and ladies, with their families. Some hold a fort and a village, some a village alone, and some nothing at all. Vessaro is ruled by a queen.
- **The Realms screen** (open the Journal, then "The Realms: who holds what"): who holds each place, who holds its gates, and who claims it; and each lord with what they hold, their kin and their home. Nothing here needs doing yet.
- **Tap a place on the map** and you are told who holds it.

### Changed
- **Soldiers have men's names.** Regular soldiers and levies are men. Followers, tournament fighters and nobles can be men or women. Soldiers already in your company keep their names.
- When Greywall passes to Aurelia at the end of the story, Highmere and Brackenfield now go with it. An older save that ended that way is updated when it loads.

### Under the hood
- Save version 19. Saves from 2.23.0 load with the same world, and the story reads the same.
- Debug → Holdings: move a fort's gates to the next realm, give a holding to the next lord, or lay a claim to it.
- **Tests:** 719 fast and 12 slow Node tests, 157 browser tests (21 skipped: the visual baselines, Linux only, and those for one device only).

## v2.23.0 — Phase 7 acceptance (P7-T) · 2026-11-20

### Changed
- **Escort ambushes are fairer.** The Reavers who go for the wagon now lie in wait until the rest of the band has closed with your company, instead of striking first and alone. The wagon burns sooner (40 HP, was 70). Fought ambushes were being won far more often than the odds said; now they are about as hard as any other close fight.

### Under the hood
- **Phase 7 is complete in code.** `docs/PHASE-7-VALIDATION.md` holds the evidence: the design's exit as a scripted 90-day campaign, Prototype G with followers and officers, and the economy and battle passes.
- **The expert test player** now hires a surgeon, a scout and a blacksmith, sends detachments, buys a mill and joins the world's events. The world's events now run in Prototype G (`npm run prototype-g`).
- **Tests:** 704 fast and 12 slow Node tests, 153 browser tests (9 more apply to one device only and are skipped on the other).

## v2.22.0 — Formations, high ground and the wagon (P7-11) · 2026-11-20

### New
- **Formations for your infantry,** in Orders: Loose (as before), Wall and Wedge. You never need them.
- **The shield wall** closes the infantry up on Hold or Follow. They are slower, keep their shields up whenever a foe is near, strike over them, and each raised shield covers the soldiers on both sides. It is strong against archers: in our tests the company won 100% against crossbows in a wall and 73% without. The Defensive setup now starts in a wall.
- **The wedge** points the infantry at the enemy on Follow or Charge. They are quicker, and the first blow on each new foe lands harder and shakes them, but nobody covers anyone.
- **Hills.** Fights in the hills and mountains now take place on the new Hill Slopes. Archers standing on a rise shoot a quarter further, and yours start on the company's knoll and hold it.
- **Fords break formations.** Soldiers wading the shallows fight loose.
- **Protect the wagon.** When Reavers spring the ambush on a caravan you are escorting, its wagon stands behind your company and some of them burst from cover on your flank to burn it. If it burns, or you lose, the caravan and your contract are lost. The battle's top line shows how the wagon is doing, and the result says whether it came through.

### Changed
- An escort ambush now springs close by instead of marching in from the far side of the field.

### Under the hood
- Each effect is measured on its own, on and off on the same fights: `npm run extras`.
- Debug tools: Hills battle 30, Wagon ambush 20.
- No save change.
- 703 fast and 10 slow Node tests, 153 browser tests (9 more apply to one device only and are skipped on the other).

## v2.21.0 — The mill (P7-10) · 2026-11-20

### New
- **Your first business: a mill.** Buy one in a village (300 crowns) or a town (600) with a market, from the town screen. Before you buy, its card says what the village miller would make there at today's prices.
- **It runs itself.** Every payday the miller buys grain and sells flour in that market, at the same prices as you, paying for grain and the wage from the mill's own money. You put crowns in or take them out at the mill.
- **No magic money.** The miller grinds a sack only while its flour still pays for its grain. A busy week makes grain dearer and flour cheaper there, so where grain is dear a mill may earn nothing.
- **Weekly reports.** Every week's numbers are on the mill's card and in Accounts, and a bad week says why: grain too dear, no money for the wage, a cracked millstone, your price limits.
- **The owner's law.** The settlement's owner takes a tenth of the sales. If the place changes hands you are told. If its owner turns Hostile to you, you are warned, and seven days later they seize the mill and its money unless you sell it first or mend relations.
- **Selling.** You can sell the mill from anywhere, for 60% of what you paid, plus its money.
- **For experts:** hire a master miller (more flour from each sack), and set price rules for the most to pay for grain and the least to take for flour.
- **Flour** is a new trade good in every market.

### Fixed
- Markets now restock while you travel. Restocking used to be rounded away in the map's small time steps, so prices recovered mostly when you rested.

### Under the hood
- A business keeps its own ledger, so a week's trading never pushes your own lines out of the Accounts ledger. Captors never take a mill's money.
- Save schema v18 (businesses); older saves migrate.
- Debug tools: Mill: run a week; Mill: owner Hostile.
- 692 fast and 9 slow Node tests, 149 browser tests (9 more apply to one device only and are skipped on the other).

## v2.20.0 — Tournaments (P7-09) · 2026-11-19

### New
- **Tournaments in the great towns.** Stonebridge, Eastwatch, Hrothgard, Vessara and Merrow each hold one every two weeks. The news announces it, and entries stay open three days.
- **The bracket.** Eight fighters on foot and three bouts. You fight each bout yourself, alone, with ATTACK and BLOCK on one fenced field, and each round is harder.
- **Loaner gear.** You fight in tournament gear. Your own gear stays in your pack and can never be lost there.
- **Prizes.** The champion wins crowns, renown and the host's goodwill; the finalist wins less. Falling in the first bout costs a little renown, never your company.
- **Rivals.** Whoever beats you becomes your rival and may turn up in later tournaments, met only in a final.
- **No farming one town.** Entry fees rise with your renown, each win in a town is worth less than the last, and you can enter the same town again only after four weeks.

### Under the hood
- A new one-on-one duel mode on the battle engine, with no soldiers, reserves, morale or orders. A bout's result goes to the bracket, never the battle results. A bout left unfinished (the page reloaded mid-fight) counts as lost.
- Save schema v17 (tournaments); older saves migrate.
- Debug tools: Tournament here.
- 675 fast and 9 slow Node tests, 145 browser tests (9 more apply to one device only and are skipped on the other).

## v2.19.0 — World events (P7-08) · 2026-11-19

### New
- **The world has things going on.** As it changes, events start in its settlements, and the news says where:
  - **food shortage** where grain is dear: sell rations to the reeve at the old price;
  - **Reavers in a village's fields**, with a bounty for whoever drives them off: take it and the band is marked on your map;
  - **a militia asking to be drilled** where a kingdom is at odds with its neighbours: a day of drill for crowns, reputation and experience;
  - **a courier** with a letter to carry to another town in time;
  - **refugees** near a war: feed them, or take on those who can fight.
- In that settlement each event has a card: what is going on, what happens if no one helps, how long it has, and one decision. A choice you cannot make says why.
- Each event lasts a few days and ends once. Ignored, it has the consequence its card states: grain stays dear, farms are plundered, or, if you were asked and rode on, you lose a little reputation.
- What your company had a hand in goes into its chronicle. The Journal lists the events you know of.
- The same kind of event does not come back to a region for a while. None of it stands in the story's way.

### Under the hood
- Save schema v16 (world events); older saves migrate and start with none.
- Debug tools: World event here.
- 664 fast and 9 slow Node tests, 143 browser tests (9 more apply to one device only and are skipped on the other).

## v2.18.0 — Soldier traits (P7-07) · 2026-11-19

### New
- **Service shapes your soldiers.** Each earns one trait, once, at a milestone of their own record (never at random):
  - **Steadfast** after 8 battles: their group holds together longer;
  - **Cautious** after a second wound: slower to engage, lets runners go, takes less from each blow and falls less often;
  - **Impulsive** after felling 8 enemies: goes in early and hits harder, but takes more wounds.
- You are told when it happens. The trait shows on the soldier's row and card, and on the roll of honour. A card without a trait shows the milestones still ahead.
- Traits count in fought battles, in Simulate and on patrols.

### Under the hood
- No save schema step: the trait is a new optional field, and older saves load unchanged.
- 654 fast and 8 slow Node tests, 139 browser tests (9 more apply to one device only and are skipped on the other).

## v2.17.0 — More companions (P7-06) · 2026-11-19

### New
- **Three companions beyond the March,** each in their own land, each joining after a small errand of their own:
  - **Sigrun** in Hrothgard: a huntress of the clans who wants the raiders of the Steading broken (+1 Tactics);
  - **Iacopo** in Vessara: a League crossbow captain with a 120-crown debt (+1 Trade);
  - **Livia** in Tessaro: a legion medic who wants the deserters who robbed her village dealt with (+1 Shield).
- **With you,** they take a party slot, eat, draw a weekly wage and fight beside you. When they fall they are wounded, never killed. They lend their skill while fit and can captain a patrol.
- **Loyalty,** shown on the Party sheet with what each one cares about:
  - wages paid and victories raise it; missed wages and defeats lower it;
  - so does what you do: Sigrun hates paying Reavers to pass, Iacopo hates a late wage, and Livia hates attacks on a kingdom's patrols and caravans.
- **Leaving:** unhappy, they warn you and say why. If it goes on, they leave for good, but never without warning.

### Under the hood
- Saves are now schema v15 (the companions). Older saves update on load, and a copy is kept as it was.
- 648 fast and 8 slow Node tests, 137 browser tests (9 more apply to one device only and are skipped on the other).

## v2.16.0 — Detachments (P7-05) · 2026-11-19

### New
- **Send part of your company out under a captain** (Detachments, in a settlement's menu or from Party on the map). A captain is a veteran (tier 3, 10 battles) or your companion. Choose who goes and the order:
  - hunt bands around where you are, or patrol a road between two places;
  - for how many days;
  - when to turn back, whether to keep clear of stronger parties, and whether to fight only good odds.
- **Out on their own:** they take food from your stores and pay from the chest, fight what they meet, and send word.
- **Coming back:** they turn back when their time is up, their food or pay runs out, they are too few, or they are beaten. You can send a courier to call them back.
- **Rejoining:** meeting you, they rejoin the company with everything that happened to them. Beaten, the captain comes back wounded with the survivors.
- Soldiers away still count toward your party size.

### Under the hood
- Saves are now schema v14 (detachments). Older saves update on load, and a copy is kept as it was.
- 640 fast and 8 slow Node tests, 135 browser tests (9 more apply to one device only and are skipped on the other).

## v2.15.0 — The scout (P7-02) · 2026-11-19

### New
- **A scout** to hire in any town (Accounts, 45 crowns and 8 a week):
  - your company sees half as far again;
  - they warn you the moment a hostile party is seen: "about 8 Reavers to the north-east, riding this way". Their numbers are a scout's guesses: close, not exact;
  - as you set off, they say how long the ride should take and which bands are known near the way;
  - when you attack a band, you get more ground to set up on.

### Under the hood
- Saves are now schema v13 (the scout). Older saves update on load, and a copy is kept as it was.
- 630 fast and 8 slow Node tests, 133 browser tests (9 more apply to one device only and are skipped on the other).

## v2.14.0 — Pursuit and detection (P7-04) · 2026-11-19

### New
- **You see only so far, and so do they:**
  - everyone sees less at night (the map darkens), further from hills, and hardly into a forest;
  - the map shows the parties near you, and a faded "?" where you last saw one, for a day;
  - a contract target's mark stays until you find it.
- **Hide** (in a forest, H): your company is much harder to spot until you set off. A small company is harder to spot than a big one.
- **Losing them:** a band (or a hostile patrol) that loses sight of you rides to where it last saw you, searches there for a few hours, then gives up.
- Story bands and the caravan you escort are always on the map, so nothing a quest needs gets lost.

### Under the hood
- No save change beyond a few optional fields; older saves load as they are.
- 624 fast and 8 slow Node tests, 131 browser tests (9 more apply to one device only and are skipped on the other).

## v2.13.0 — The blacksmith (P7-03) · 2026-11-19

### New
- **A blacksmith** to hire in any town (Accounts, 50 crowns and 8 a week). They work wherever you are:
  - **Forge your gear**, up to twice per piece. A forged weapon hits 2 harder per level, forged armour stops 1 or 2 more. It costs crowns and iron from your cargo (buy iron at a market), and the piece becomes "+1" or "+2".
  - **Fine kit** for up to five of your soldiers: tougher in battle (+1 armour, +8 hit points), and they count for a little more when you simulate.
- Forged gear sells for more, but never for what the plain piece costs to buy. Nothing wears out.

### Under the hood
- Saves are now schema v12 (the blacksmith). Older saves update on load, and a copy is kept as it was.
- 617 fast and 8 slow Node tests, 129 browser tests (9 more apply to one device only and are skipped on the other).

## v2.12.0 — The surgeon (P7-01) · 2026-11-19

### New
- **A surgeon** to hire in any town (Accounts, 60 crowns and 10 a week). After every battle, fought or simulated, they tend the fallen:
  - about a third of those who would have died are saved, one medicine each;
  - a few are saved even without medicine;
  - wounds heal in a day and a half instead of two;
  - the result screen names who was saved.
- **Medicine** at any market (15 crowns). Your quartermaster keeps some in stock while a surgeon rides with you (4 to start, changeable). Captors take half of it.

### Fixes
- Going back from a long screen such as Accounts no longer leaves the settlement menu scrolled down on a phone.

### Under the hood
- Saves are now schema v11 (the surgeon and medicine). Older saves update on load, and a copy is kept as it was.
- 611 fast and 8 slow Node tests, 127 browser tests (9 more apply to one device only and are skipped on the other).

## v2.11.0 — Battle balance (B-01) · 2026-11-19

Simulate is now only a little worse than fighting, and a close fight is a fight.

### Changes
- **Honest odds:** in a melee numbers count twice over, so the stronger side wins more often than its share of the strength (2 : 1 is now 80%, not 67%). The encounter screen, Simulate and fights between parties on the map all use the new odds.
- **The enemy fights better:**
  - its foot comes on in a loose line instead of one at a time, unless it already outnumbers you;
  - it goes for your archers, your wounded, or you if you stray from your soldiers;
  - it holds a little longer, and a band defending its lair holds longer still.
- Fought close battles now come out a few points better than the stated odds, not every time.

### Fixes
- A battle could stall for good when two wounded enemies hung back where your archers had no clear shot and another wave was still to come. Now they slip away and the next wave comes on.

### Under the hood
- `scripts/parity.js` can try one change at a time (`tweak`).
- 603 fast and 8 slow Node tests, 125 browser tests (9 more apply to one device only and are skipped on the other).

## v2.10.0 — The bigger world, tuned (W-08) · 2026-11-19

### Changes
- **Food follows the price of grain:** a little cheaper among the western farms (7 crowns a ration), dearer up in the highlands (9), and it moves with the market. Most markets still sell at 8.

### Under the hood
- The whole realm was played headlessly for 60 days at a time: the economy report, the campaign bot (now also touring every capital, `--roam`), 200 stories and Prototype G. No run got stuck, every story reached an ending, and the economy is as healthy as before the world grew. The figures are in `docs/NEXT-PLAN.md` ("Phase W validation").
- The test bot no longer rides across the whole realm to clear one lair.
- 597 fast and 7 slow Node tests, 125 browser tests (9 more apply to one device only and are skipped on the other).

## v2.9.0 — War and peace, and a world that scales (W-07) · 2026-11-19

### New
- **Kingdoms go to war and make peace.** Every pair of kingdoms is at peace, in tension or at war:
  - At peace, their patrols pass each other by, but a border incident can sour things.
  - In tension or at war, their patrols fight wherever they meet, and enough clashes turn tension into war.
  - Wars end when both sides are worn out, and a long quiet cools tension into peace.
  - The news tells you each time, and names the region.
  - Valedorn and Aurelian stay in tension over Greywall until the story's ending decides: peace after the road peace, war if a crown takes the fort.
- **Debug → Map stress 80**, for checking on a phone: 80 parties and a day every second on the map. It reports simulation and drawing time separately, and how long a save takes, then puts your campaign back as it was.

### Changes
- The world simulation is faster and steadier: about two and a half times faster with 80 parties.
  - It only looks at nearby parties.
  - Parties far from you act once an hour.
  - Two parties can no longer slip past each other between steps.
  - Each region has a limit on how many parties it fills with.
- The map draws only what is in view.
- How to Play → The lands explains war and peace.

### Under the hood
- Saves are now schema v10, adding relations between kingdoms. 2.7 and 2.8 saves update on load, and a copy is kept as it was.
- `node scripts/bench-map.js --season` runs 90 days of a full world without the browser.
- 596 fast and 7 slow Node tests, 125 browser tests (9 more apply to one device only and are skipped on the other). Gate D's random story check counts the two mirror-image Q3 sales as one branch (a fixed test walks both).

## v2.8.0 — Errands beyond the March (W-05c) · 2026-11-19

### New
- **Three errands in the new lands,** each from someone in its capital who has a few words about their land:
  - **Wolves in the Pass**, from Steward Ingrid in Hrothgard: raiders have walled off the mountain pass on the road to Greywall.
  - **Timber for the Shipwrights**, from Factor Salviati in Vessara: bring timber from the cheap north to the League's yards.
  - **False Lights**, from the Clerk of the Council in Merrow: hire the city's sell-swords and put out the wreckers' lanterns on the far west coast.
- **How to Play → The lands** describes the realm: who holds which land, what their soldiers are like, where goods are cheap, and where to find work.
- A tip, **Beyond the March**, the first time you ride out of the March.

### Fixes
- Merrow listed the Mercenary twice for hire.

### Under the hood
- 584 fast and 5 slow Node tests, 125 browser tests (9 more apply to one device only and are skipped on the other); 17 tests for the errands, 7 for tips and help.

## v2.7.0 — The bigger world (W-05b) · 2026-11-19

The Border March is now the heart of a world about four times its size.

### New
- **The Sundered Realm.** The March lies whole in the middle, as it was: the same places, roads and distances, and the same story. Around it:
  - **Valedorn and Aurelian** reach further west and east, each with a new castle and two villages.
  - **Hrothmark**, a kingdom of highland clans in the northern forests and mountains, fields heavy infantry and axemen.
  - **The Vessaro League**, merchant towns of the southern marsh and coast, fields crossbowmen and light horse.
  - **The Free City of Merrow**, a free port in the south-east, hires out sell-swords and has the best market and armoury in the land.
  - 31 settlements in all, every town with a contract board.
- **Twelve new troops:** each new kingdom has its own tier 1 to 3 tree with a cavalry branch, and soldiers with names of their own culture. They use the existing figures until their own art is drawn.
- **Real terrain:** a mountain range with a pass, hills, a marsh, a river to the sea with a ford and a bridge, and the coast.
- **Two new trade goods:** timber (cheap in the north) and wine (cheap on the coast).
- **The wider world is busy:** Reaver bands with two lairs in every region and two new lair fights, patrols for every kingdom, and caravans running between the capitals and Merrow.
- **News names the region** ("The roads of the northern highlands are not safe…").

### Changes
- **Campaigns from before 2.7.0 can't continue in the bigger world.** The game starts a new campaign and tells you why. Your old save is kept in the browser, untouched. Importing an old save file is refused with the same reason.
- How to Play mentions the lands beyond the March and the new kinds of ground.

### Under the hood
- The art team's asset request list is in `docs/ASSETS.md`.
- The test bots pick the nearest lair and contract board, and the story bot keeps to the March.
- 578 fast and 5 slow Node tests, 125 browser tests (9 more apply to one device only and are skipped on the other). New fixture set `tests/fixtures/saves-2.7`: the first saves of the bigger world.

## v2.6.0 — Terrain and the river ford (W-05a) · 2026-11-18

The Border March plays as before; this prepares the bigger region's ground.

### New
- **A new battlefield, the River Ford:** two armies meet across a shallow river, and everyone wading through it moves at half speed. Try it from Debug → Ford battle 30; in the bigger region it will be where fights at river crossings happen.

### Under the hood
- New kinds of ground for the bigger region, each with its travel speed and its battlefield: hills, mountains (crossed fastest by a road through a pass), marsh, rivers (slow to wade, quick at fords and bridges) and the sea along a coast. Everything stays passable, just slower.
- Which battlefield a fight uses now comes from the world's data.
- 567 fast and 5 slow Node tests, 125 browser tests (9 more apply to one device only and are skipped on the other).

## v2.5.0 — A data-driven world (W-04) · 2026-11-18

Nothing changes in play: the Border March plays exactly as before. This prepares a bigger world.

### Under the hood
- The world's size, kingdoms, start, named regions and opening view now come from its data, and the code no longer assumes the Border March, two kingdoms or a 100 × 100 map. Content checks make sure everything on the map lies inside it and belongs to its kingdoms.
- A three-kingdom test world on a 150 × 120 map, played by the tests and by a bot for 30 days.
- Debug → Bandits near me no longer caps their position at the old map edge.
- 560 fast and 5 slow Node tests; the browser tests unchanged.

## v2.4.0 — Battle zoom (W-03) · 2026-11-18

### New
- **Zoom the battle** on a large battlefield: pinch the field with two fingers (or use the mouse wheel) for anything from 0.75× to 1.5×, or press the new zoom button beside MAP (Z on a keyboard) to switch between 1× and 0.75×. The view keeps you in the middle, and the game remembers your zoom for the next battle.
- A pinch never swings, moves you or sends anyone: one finger on the field does nothing, and the joystick and buttons work as before while zoomed.
- Pinching in again at the widest zoom opens the whole field (the tactical overview); spreading your fingers there closes it.
- Zoom only changes what you see: your company spots enemies and the battle runs exactly as at 1×.

### Changes
- On a phone, a tap on the small map or in the overview now acts when your finger lifts (so a pinch can't send a group by accident).

### Under the hood
- 555 fast and 4 slow Node tests, 123 browser tests (9 more apply to one device only and are skipped on the other). The battle benchmark gives the same battles as 2.3.0.

## v2.3.0 — Map camera and gestures (W-02) · 2026-11-18

### New
- **Look around the map:** drag it to pan, pinch (or + and −) to zoom in up to 2.4×, mouse wheel and arrow keys on a computer. Only a tap sets off, so dragging or pinching never sends your company anywhere. While zoomed in, the view follows your company; **Centre** brings it back after you have looked away, and arrows at the edge of the screen point to you and to your contract or quest targets. The game remembers your zoom on this device.
- Zoom only changes what you see: journeys take the same time, bands find you the same way and every rule is the same at any zoom. Today's map fits the screen at 1×, so you can't zoom out further; a bigger map will let you.

### Fixes
- A tap on the map now acts when your finger lifts, not when it lands.

### Under the hood
- The ground of the map is drawn once and reused, and what is off screen isn't drawn.
- The map's sense of distance moved from the drawing into the map's data.
- Debug panel → Map drawing test: frame rate and drawing time at "fit" and at 2.4×, for phones.
- 548 fast and 4 slow Node tests, 115 browser tests (7 more apply to one device only and are skipped on the other).

## v2.2.0 — Text size (W-01) · 2026-11-18

### New
- **Text size** (Settings, at the top): Small, Normal, Large or Larger. The game's text and buttons grow at once, without a reload, in every menu and panel, on the map (place names, labels) and in battle (the HUD, banners, Orders), and stay that way on this device. The page doesn't pinch-zoom, because pinching is for the map and the battlefield, so this is how to enlarge the text. It doesn't enlarge the pictures or follow your phone's font size. How to play explains it.

### Fixes
- **Phones:** every button, slider and list control is now at least 44 px tall (some in Settings, Party and the soldier card were smaller), and grows with the text.
- The menu's own buttons (Leave, Back, Continue) stay on screen when a menu is taller than the screen.
- The top-left panel no longer runs under the buttons when one of them changes ("Wait" becomes "Stop waiting").
- Prepare's "Simulate" button no longer cuts off its odds.
- "PAUSED" is centred.

### Under the hood
- Browser checks of every key screen at all four sizes, on a desktop and five phone sizes, and with the desktop zoomed to 150%. Larger screenshots for the main screens.
- Debug panel → Sharp canvas, to measure a sharper canvas on a phone (decision D-R1); the practice result shows which canvas and text size were measured.
- 534 fast and 4 slow Node tests, 103 browser tests (5 more apply to one device only and are skipped on the other).

## v2.1.1 — Test hygiene (H-01) · 2026-11-18

Nothing new to play.

### Under the hood
- **Test games are isolated:** each gets its own seeded `Math`, so a seeded run gives the same result alone or after others (before, games shared the host's, and results could depend on run order). A new test checks it in a fresh process.
- **Faster tests:** `npm test` takes about 8 s instead of 22 s. The whole-campaign bot tests run under `npm run test:slow`; CI runs both.
- **Measurement tools:** `npm run parity` compares fought and auto-resolved battles over the same encounters (for the coming balance pass), and `npm run bench:map` times the world simulation for 10 to 200 parties (for the bigger world).
- The repository keeps LF line endings on every machine (`.gitattributes`).
- 531 fast and 4 slow Node tests, 86 browser tests.

## v2.1.0 — Browser tests (W-00) · 2026-11-18

The first step of Phase W ("A Bigger World", `docs/NEXT-PLAN.md`). Nothing new to play; two fixes.

### Fixes
- **Phones:** the Orders panel no longer grows up under the Pause button, which covered its close button at 812×375. It stops below the top-right buttons and scrolls if it must.
- **Battles:** an Attack pressed in the first moments of a battle is no longer lost. The hero started with a short random cooldown meant only to stagger the soldiers' first blows.

### Under the hood
- **Browser regression tests** with Playwright (the project's first development dependency; the game still has none): startup, character creation, loading saves, the map, settlements and the streets, a battle and its controls, Save & export, and layout checks on a desktop and a landscape phone with touch. Screenshot comparisons against Linux baselines. CI runs them on every push and pull request, and they block the deploy.
- Save fixtures from the real 2.0.0 build, ready for the save migration into the bigger world (W-06).
- 533 Node tests, 86 browser tests.

## v2.0.0 — "The Living Warband" (testing release) · 2026-11-18

The second version of Crownless. The Border March is the same region and story; what changed is the company you lead, the battles you fight and the world around them. Built in 20 steps (1.1.0 to 1.19.0) from the owner's v2.0 design, every step tested and checked in a browser. It's a **testing release**: the evidence is in `docs/V2-VALIDATION.md`, and a few things still wait on a phone run.

### Your company
- **Every soldier is a person:** a name from their homeland's culture, where and when they joined, and a service record (battles, kills, wounds, crowns actually paid), with short service notes. Rename them, upgrade them one at a time, or retire a veteran with honour.
- **A troop tree you discover** as you meet, hire and train troops. The Mercenary can now train into the Sellsword.
- **A company chronicle** in the Journal (who joined, promotions, notable battles, who fell, quests), and a **roll of honour** for those who fell, deserted or retired.
- **Accounts:** your purse, a company chest that pays wages first, and a ledger of every crown in and out.
- **Camp followers:** a **quartermaster** who keeps the next wages aside and food in stock within a weekly budget, warning you before shortages, and a **merchant** who trades a budget you give them at the markets you visit, at your prices, and tells you what they did and why.

### Battles
- **Large battlefields** three screens across, with a following camera, a minimap of what your company has seen, and a tactical overview that holds the battle while you send a group to a spot.
- **Battle preparation:** Balanced, Defensive, Aggressive or Custom (drag each group's flag); Simulate explains its odds. Ambushes leave less room.
- **Soldiers fight as groups:** loose ranks, shields raised against blows from the front, a raised shield covering the ally beside it, braced spears against cavalry, archers who need a clear shot.
- **Morale:** groups on both sides waver, fall back and rout; Rally steadies your soldiers. Nothing about it is rolled.
- **Nearby reinforcements:** parties close enough to hear a fight and reach it join it, at a worked-out time from their side of the field; a friendly kingdom's patrol helps you, Reavers help Reavers.
- A battle takes a fixed 4 hours of map time, fought or auto-resolved. Battles always end: if you fall, your company fights on.

### The world
- **Errands:** five small optional quests that show the new systems.
- Every encounter's result is applied exactly once; parties in a battle can't be beaten elsewhere at the same time.

### Under the hood
- Save schema v9, with each step migrating older saves (fixtures from real old builds back to 0.3), a pre-migration copy kept, partial saves refused, and a save naming content this version lacks kept safe instead of thinned.
- Seeded random streams; one campaign clock; domain events; 528 automated tests; a type check on the core modules; bot campaigns, story runs, an economy report and Prototype G.

### Known limits
- **Fought and auto-resolved battles:** fighting in person with a company still wins far more often than Simulate's odds. A later balance pass will make close fights harder (owner, 2026-11-18).
- **Phone checks still to do:** the big battle with reinforcements (Debug → Big battle 40 + help) and the feel of the new battles.
- English only. The art is still the v1 sprites; an art guide is planned (ART-01).

## v1.0.0 — "The Border March" (MVP) · 2026-11-17

The first complete version of Crownless: a top-down 2D warband RPG for the browser, playable on phones (landscape, touch) and desktops (keyboard and mouse). Every gate of the MVP design is passed (Gates A–E, `docs/GATE-*-VALIDATION.md`).

### The game
- **You:**
  - A wanderer with a name, a look (presentation and cloak colour) and a background: Farmhand, Scout or Peddler.
  - Levels, attributes and eight skills.
  - Equipment in eight slots, from about 30 items, with armouries in towns.
- **Battles:**
  - Real-time top-down fights where you swing and block in person, with timed swings and a frontal shield.
  - Your company fights alongside under group orders (infantry, archers, cavalry; Follow, Hold, Charge).
  - Three battle maps with cover, enemy waves, and reserves that step in as others fall.
  - Soldiers fight shoulder to shoulder, and riders charge through.
  - Before a fight you can also auto-resolve, pay, threaten or retreat.
- **The company:**
  - 15 troop types across two kingdoms and the Reaver bands, with upgrade trees.
  - Food, weekly wages, morale and desertion.
  - Wounds and deaths; capture without game over.
  - **Mara**, a companion with her own fate.
- **The Border March:**
  - Ten settlements (two towns, two forts, six villages); Stonebridge's streets can be walked.
  - Patrols, caravans and Reaver bands moving on the map, with off-screen fights.
  - Six trade goods whose prices move with trade, caravans and raids.
  - Regional news, and frontier clashes between the kingdoms.
- **Work:** bandit hunts, caravan escorts and deliveries from the town boards.
- **Politics:** reputation with the Valedorn Crown and the Aurelian Remnant (Friendly, Neutral, Hostile), and forts that change hands.
- **The story:** four quests ("A Stranger's Wage", "The Broken Seal", "Two Banners", "The Greywall Verdict") with real choices.
  - Three endings: the Crown holds Greywall, the Remnant takes it, or the road peace.
  - The sandbox carries on afterwards.
- **Comfort:**
  - Synthesized music and sound effects.
  - Settings: volumes, battle size, health bars, reduced effects, tips, full screen.
  - First-time tips and How to Play.
  - Full screen on Android, and Add to Home Screen on any phone.
  - Phone-sized layout.
- **Saves:**
  - Autosave, including when the page is hidden, with a backup copy and a notice if it's ever needed.
  - A guard against the game being open in two tabs.
  - Export and import between devices, by file or pasted text, with a checksum and strict validation.
  - Reminders to keep an exported copy.

### Under the hood
- Plain HTML5 Canvas and classic JavaScript: no bundler, no runtime dependencies, no network use, no accounts. Hosted on GitHub Pages.
- Content lives in data files and is validated at load. Sprites are the owner's own (made with AI through Sprite Studio), and sound and map are code; see `docs/ASSETS.md`.
- **Tests:** 332 automated tests, including:
  - 60 randomized whole-story runs per test run, with no soft-locks and every ending reached
  - money and battle-result exploit probes
  - five v1.0 save fixtures that every later build must keep loading
- **Tools:** headless campaign and story simulations (`npm run simulate`, `npm run simulate:story`) and a battle benchmark (`npm run bench`).
- **Measured** on a Zenfone 10 (Chrome): 60 fps with 30 units in battle.
- The save format is frozen as schema v2 (`docs/SAVE-FORMAT.md`).

### Known limits
- Mercenaries have no upgrade path. The v2 troop tree will show "max tier" and add more paths.
- A raised shield protects only its holder; shield cover for neighbours is planned for v2 formations.
- Hairstyles in character creation wait for art.
- English only. No in-game text size setting, and pinch-zoom is off.
- Browser storage can be cleared by the browser (notably iOS Safari after about 7 days unused). Export a copy now and then.

### What's next
v2.0 "The Living Warband" (`docs/V2-PLAN.md`):
- named soldiers with service records
- a troop tree discovered as you play
- bigger battles with a camera, minimap, deployment presets and smarter units
- reinforcements arriving mid-battle
- a company chronicle
- a quartermaster and a merchant to hire
