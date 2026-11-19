# Crownless — Release Notes

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
