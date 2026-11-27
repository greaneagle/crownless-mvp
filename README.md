# Crownless 5.17.0 — The Border March

A single-player, top-down party-battle prototype in plain HTML5 Canvas and classic JavaScript. There's no bundler, no runtime dependencies and no server (Playwright, for the browser tests, is the only development dependency). It's published to GitHub Pages straight from `main`.

- **Design spec:** [`Crownless_MVP_GDD_v1.md`](Crownless_MVP_GDD_v1.md). The engine is HTML5 Canvas, not the Godot the spec recommends.
- **Full v1 documentation** (rules and numbers, architecture, how to add content, what v2 brings and where its details are): [`docs/V1-DOCUMENTATION.md`](docs/V1-DOCUMENTATION.md)
- **Current behavior (regression reference):** [`docs/BASELINE.md`](docs/BASELINE.md)
- **Status and plan:** [`docs/ROADMAP.md`](docs/ROADMAP.md); the v2 plan is [`docs/V2-PLAN.md`](docs/V2-PLAN.md), from the owner's v2.0 design documents
- **Release notes:** [`docs/RELEASE-NOTES.md`](docs/RELEASE-NOTES.md); v2.0 acceptance: [`docs/V2-VALIDATION.md`](docs/V2-VALIDATION.md); Phase 7 acceptance: [`docs/PHASE-7-VALIDATION.md`](docs/PHASE-7-VALIDATION.md); Phase 8 acceptance: [`docs/PHASE-8-VALIDATION.md`](docs/PHASE-8-VALIDATION.md)
- **What comes next:** [`docs/NEXT-PLAN.md`](docs/NEXT-PLAN.md): browser regression tests, zoom and a bigger world, then Phases 7–9 (Phase 8, the landed world, complete in 3.0.0: holdings and the people of the realms in 2.24.0, permissions in 2.25.0, lords on the map in 2.26.0, allegiance in 2.27.0, fiefs in 2.28.0, sieges in 2.29.0, the assault battle in 2.30.0, named nobles in 2.31.0, losing and retaking land in 2.32.0, tuning and acceptance in 3.0.0; Phase 9, kingdoms and houses, complete in 4.0.0: battles of 20 to 200 at once in 3.1.0 and 3.1.1, armies sharing the field by their numbers in 3.2.0, a company of up to 200 in 3.3.0, command in layers with divisions in 3.4.0, the walls at the world's scale in 3.5.0, the lords' loose ends in 3.6.0, realms with treasuries, laws and offices in 3.7.0, treaties and trust in 3.8.0, realms founded in play in 3.9.0, rebellion and deposition in 3.10.0, armies and campaigns in 3.11.0, houses, marriage and succession in 3.12.0, content packs in a declarative format in 3.13.0, creator tools and a second world in 3.14.0, tuning and acceptance in 4.0.0; Phase 10, ways in, complete in 5.0.0: map speed and the Wait screen in 4.1.0, one world with the coast in 4.2.0, walkable capitals and free cities in 4.3.0, the night run and its fixes in 4.3.1, your kingdom and the story from anywhere in 4.4.0, origins and their opening quests in 4.5.0, the scout and the peddler in 4.6.0, a beginner guide and hints in 4.7.0, the UI toward the references and the fog of sight in 4.8.0, women soldiers and soldiers' portraits in 4.9.0, the art kit in the game in 4.10.0, battles in the new art in 4.11.0, towns in the new art in 4.12.0, the world map in the new art in 4.13.0, the UI and portraits in the new art in 4.14.0, the old graphics removed in 4.15.0, tuning and acceptance in 5.0.0); every task specified, with its readiness, in [`docs/NEXT-TASKS.md`](docs/NEXT-TASKS.md)

## What is playable

- Create your hero: a name, a cloak colour, and a background (Farmhand, Scout or Peddler). You start with 60 crowns, a worn sword, clothing, an oak shield and some food, and no soldiers.
- Equip loot from the **Party** screen. Strength sets your HP, your weapon and One-Handed skill set your damage, armor reduces hits, a shield is needed to block, and Pathfinding or a horse speeds up travel.
- Travel the Border March, a strategic map with 10 settlements. Click or tap to travel; roads are faster and forests slower, and time passes as you go.
- Enter settlements to hire troops and rest. Valedorn towns train Levies and Hunters, Aurelian towns train Recruits and Skirmishers, and the two towns also hire out Mercenaries. Party size starts at 8 soldiers (wounded included) and grows with Leadership, renown, companions as officers and land, up to 200 (from 3.3.0), and every troop's stats come from `data/troops.js`.
- **A living map:** kingdom patrols hunt bandits, caravans haul goods (which moves prices), and Road Reaver bands rob caravans and hunt travellers who look weak. Use **Wait** (or Space) to let time pass.
- **Progression:** battles earn XP. Your hero levels up to 10 and gets skill points every level and an attribute point every second level. Soldiers who fight earn XP and can be upgraded along the Valedorn and Aurelian troop trees for gold. Party size grows with Leadership and renown.
- **Reputation:** the Valedorn Crown and the Aurelian Remnant each see you as Friendly, Neutral or Hostile. Contracts and beating Reavers on their land raise it; attacking their patrols or caravans lowers it. Friendly gives +2 party slots. Hostile kingdoms refuse recruits and contracts, and their patrols hunt you. Greywall and Ashgate forts can change hands.
- **Contracts:** Stonebridge and Eastwatch post three kinds of work. **Bandit hunts:** find the gold-marked band and break it, then return for pay. **Caravan escorts:** ride beside a wagon to another settlement (it only rolls while you stay close) and beat the Reaver ambush on the road. **Deliveries:** carry goods (with a refundable deposit) or a sealed letter. Escorts and deliveries pay on arrival, and every finished contract wins favour with the town's kingdom.
- **Regional news:** every two days a line of news reaches you (shown on the map and kept in the Journal): Reavers robbing caravans, patrols beaten or victorious, Valedorn and Aurelian patrols skirmishing on the border, forts changing hands, and your own deeds. Markets talk about what moved their prices: a robbed caravan makes its goods cost more where it was going; caravans, escorts and deliveries that arrive make them cheaper.
- **Encounters:** when bandits catch you, or you attack their camps, choose **Attack** (fight it yourself), **Auto-resolve** (the odds are shown), **Negotiate** (pay their toll, or intimidate them if you're much stronger) or **Retreat** (faster parties get away more often).
- **One world (4.2.0):** the Sundered Coast, a separate world from 3.14.0, is now the realm's far east, past Castra Nova and Merrow: the Kingdom of Ostrand on its cliffs and the Saltreach League on its salt flats, at war with each other, the Free Port of Gullhaven between them, and the Gullspine fells above. There is no world to choose any more. Saves from before 4.2.0 are refused and kept safe.
- **Women soldiers and portraits (4.9.0):** Hrothmark's shieldmaidens, the Vessaro League's crossbow women and the western outlaws' huntresses, about one hire in seven of their lines, each in her own line; and a small face for every soldier, kept in the save.
- **The look and the fog (4.8.0):** deep navy panels with thin gold borders, cream serif headings, gold pixel icons, a dialogue box and a party sheet after the art references. On the map you see further with Pathfinding, Mara, a horse, your forts and your patrols, and what you cannot see lies under a light fog.
- **A guide and hints (4.7.0):** the first steps (a town, hiring, the map, food, an encounter, the first battle, saving) each shown once when it is needed, skippable one at a time or all at once; a hint card the first time anything deeper comes up; How to Play opens at your stage, from captain to ruler.
- **Origins (4.5.0, 4.6.0):** who you were before the road. The unhorsed traveller, the impoverished noble, the farmhand, the scout and the peddler each begin with a short opening quest that teaches the basics and leads into the common quest, with one small edge each, all ending in about the same place.
- **Choose your kingdom (4.4.0):** a new game begins in any of the six realms, in its start town. The main story is told from there: the same quests, choices and endings, cast from the people and places around you. Begun in Valedorn, it is the Border March's story as before.
- **The long run (4.3.1):** `npm run long-run` plays the world alone for 30 years and checks every rule every day. The first night run found four faults, now fixed, and a realm that could swallow the map, now held back once it has more than a quarter of the land. The world runs three times faster.
- **Walkable towns (4.3.0):** every capital and free city has streets of its own, no two alike: Stonebridge's ford, Eastwatch's forum, Hrothgard's hill in the snow, Vessara's harbour, Merrow's river and bridge, Gullhaven's jetties, Harrowgate's walls on the cliff and Calder's salt market. Each has an innkeeper, a merchant, a recruiter and an elder or official, named in its own tongue.
- **Map speed and waiting (4.1.0):** the map runs at Normal speed, an hour a second; the ▶ button beside the zoom (or Settings) switches to Fast, four hours a second. **Wait** opens a screen of days and hours: the screen darkens while the world goes on, and lightens when the time is up; a band or lord that reaches you cuts it short and you face them.
- Real-time four-direction hero movement. Sword swings have a visible windup, a strike window and a recovery, and hit everything in a 90° arc in front of you.
- A frontal shield block that covers 120°. It can't cancel a swing you've already started, and enemy windups are drawn in red so you know when to block.
- Allied infantry, archers and cavalry fight alongside you. Archers fire arrows; riders charge, hit 1.2× harder at full gallop, ride through and wheel round.
- Pick a group with **1** (infantry), **2** (archers) or **3** (cavalry), then give an order: **F** Follow, **H** Hold or **C** Charge.
- **Formations and ground (2.22.0):** in Orders, put the infantry in a **shield wall** (closed up, shields up, slower) or a **wedge** (quicker, a harder first blow, no cover). Archers on a hill's rise shoot further, and a ford breaks formations. In an escort ambush, keep the Reavers off the caravan's wagon.
- **The landed world (Phase 8, 2.24.0–3.0.0):** every town, fort and village is a holding of a kingdom, held by one of 22 named lords or its ruler. The lords ride the map with their households; beat one and ransom them. Serve a kingdom as its mercenary or swear fealty as its vassal, and its crown may grant you land: a fief that runs itself with a steward, its money in its own book. Kingdoms at war besiege each other's forts; besiege one yourself and storm its walls in a fought assault. The lords have needs, motives and long memories: ask them for help and they agree, name a price, put it off or refuse, and say why; they quarrel, feud and change sides. Lose your land and you keep a claim, your company and your money: press the claim by siege, through your liege, or by buying it back. The Realms screen (from the Journal) shows who holds what, the lords, your allegiance and your fiefs or claims.
- **Q1 — A Stranger's Wage:** ask Elder Maren in Stonebridge for work. Fetch the grain wagon from Oakford (and survive the ambush), break the Reavers, or help Sergeant Brun raise three recruits. Every route ends with the charter fragment and the first hint of who should hold Greywall.
- **Q2 — The Broken Seal:** Caravan Master Oswin in Eastwatch lost a sealed packet to Reavers on the river road. Fight them, cow them with a big enough company, or pay Wenna the Fence in Highmere for their secret. Then decide who sees the two rival Greywall charters: Captain Aldric of the Crown, Magistrate Vell of the Aurelians, or nobody.
- **Mara:** after Q2, a former imperial scout waits by the inn in Stonebridge. Be honest with her and she rides with you for free, otherwise for 100 crowns. She fights beside you, wears the weapon and armour you give her, and finds faster roads (+1 Pathfinding).
- **Q3 — Two Banners:** after Q2, Captain Aldric and Magistrate Vell both want your sword. Break the other side's column, sell one side's plans to the other, or refuse both and save a caravan from Reavers. Mara rides ahead to scout — reach the clash within 3 days or lose her for good.
- **Q4 — The Greywall Verdict:** both banners march on Greywall. Declare for the Crown, the Remnant or the road, win the deciding battle in Greywall's courtyard, then set the terms at the parley. Three endings: the Crown holds Greywall, the Remnant takes it, or — if you refused both crowns and kept Oswin's packet — the Road Peace. The sandbox carries on afterwards.
- **Story system:** quests and conversations are data (`data/quests.js`, `data/dialogue.js`) run by an interpreter with conditions, effects and event triggers. Talk to Elder Maren for a conversation that changes with your background, renown, reputation and who holds Greywall. The **Journal** lists your quests and objectives.
- **Walk Stonebridge:** stroll the streets and talk to the innkeeper (food, rest, contracts, saving), the merchant (market), the sergeant (hire troops) and the elder. Tap a person to walk over and talk; the classic menu is a tap away.
- **Three battlefields:** you fight on an open field, in a forest clearing (trees block movement and arrows) or at a walled fort courtyard, depending on where the fight happens. Forts show their garrison.
- The battle is two waves of Road Reavers (Looters and Reavers, defined in `data/encounters.js`) and ends in victory or capture. Armor reduces damage, and archers sometimes miss.
- Win gold, renown and loot, which goes into your pack. If you're captured you lose 20% of your crowns and one item, then you're released near a settlement half a day later.
- **Named soldiers (1.4.0):** every soldier has a name from their homeland's culture, where and when they joined, and a service record (battles, victories, kills, assists, wounds, captures, wages actually paid) with short service notes. The Party screen lists them by name with a filter; each has a card where you can rename or upgrade them. Names come from `data/names.js`, which a mod can extend.
- **Troop tree (1.5.0):** a third Party tab shows every troop line as you discover it: troops you have met by name, troops you have hired or trained in full. Troops at the end of a line are at max tier; Mercenaries now train into Sellswords. **Upgrade all ready** upgrades everyone who has earned it after showing the total cost.
- **Large battlefields (1.8.0):** battles in forests and in the open are fought on fields three screens across; the view follows your hero and red markers on the screen edge point to enemies out of sight. The Greywall courtyard stays one screen. Settings → Battlefield: Small brings back the one-screen maps.
- **Group AI and shield cover (1.11.0):** soldiers follow in loose ranks; shield troops raise their shields, and a raised shield also covers the ally just beside it (the hero's too); spearmen stop cavalry charges from the front; archers only shoot with a clear line; orders that can't be carried out say so.
- **Morale, rout and rally (1.12.0):** groups on both sides waver, fall back and rout from heavy losses, being outnumbered, flank attacks and friends running, and veterans and the hero steady them; nothing is rolled. Fleeing enemies count as beaten but leave less loot; your own come back after the battle. Rally (R, or in Orders) steadies the soldiers near you every 30 seconds.
- **Nearby reinforcements (1.13.0):** a battle draws in parties close enough to hear it and reach it within its hours: Road Reavers join their own kind, a friendly kingdom's patrol rides to your aid, a Hostile one comes for you. They arrive at a worked-out time from the side they come from, announced in advance; if the battle ends first, they're too late. Auto-resolve counts them too.
- **Company chronicle and roll of honour (1.14.0):** the Journal keeps your company's own story (recruits, promotions, notable battles, who fell, quests). Soldiers who fall, desert or retire stay on a Roll of honour in Party with where they came from, how long they served and what they did. You can retire a veteran with honour, and the battle result says who did what.
- **Accounts and the quartermaster (1.15.0):** your purse, the company chest and a ledger of every crown in and out; wages come from the chest first. A hired quartermaster keeps the next wages in the chest and food in stock within a weekly budget, warns before shortages and logs every purchase.
- **Merchant follower (1.16.0):** hire a merchant, give them a budget, and they trade it at the markets you visit, at the same prices as you, knowing only prices they have seen; they report what they did and why, and you can stop them or recover everything at any time.
- **Errands (1.17.0):** five small optional quests that show the new systems: a veteran's homecoming, a quartermaster's first stores, a merchant's first venture, a border fight where a Crown watch rides to your aid, and a dug-in band best fought to a plan.
- **Tuning (1.18.0, 1.19.0):** the quartermaster's budget grows with the company and the merchant moves old stock; battles always end (the company fights on when you fall), Balanced brings everyone along, and auto-resolve is fairer to a company that fights in ranks.
- **Battle preparation (1.10.0):** Attack opens a Prepare screen with the real field: Balanced (default), Defensive, Aggressive or Custom (drag each group's flag inside the deployment zone and pick its first order); Fight, or Simulate (auto-resolve with the odds explained). Ambushed, you get less room. You can remember your setup and skip the screen.
- **Minimap and tactical overview (1.9.0):** on a large battlefield a small map at the top shows your company and only the enemies your soldiers have seen; tap it to look there. MAP (phone) or holding Tab (desktop, or M to toggle) opens the whole field with the battle held still; pick a group in Orders and tap where it should go and hold.
- **Time (1.6.0):** a battle takes a fixed 4 game hours of overworld time, fought or auto-resolved; capture 12 hours; a rest a day. The fight's own seconds, pausing and menus pass no time.
- Casualties: 35% of fallen soldiers are killed and the rest are wounded for 2 campaign days. Travelling or resting passes the time.
- **Gear:** about 30 items, including swords, axes and maces, three shields, helmets, armour from gambeson to mail, gloves, greaves and three horses. Find them as loot (better bands drop better gear) or buy them in town armouries.
- **Trade:** buy goods where they're cheap and sell them where they're dear. There are six goods, every market prices them differently, prices move as you trade and settle back over time, and a heavy cargo slows you down. You can also sell spare gear from your pack.
- **Upkeep:** your party eats a ration a day for every 5 people, so buy food in towns and villages. Wages are due every 7 days. Running out of food or missing wages lowers morale, and below 25 soldiers start to desert.
- **Save & export** (in any settlement or on the title screen): export your game as a file, or copy it as text, and import it in another browser or device. Damaged, edited, newer-version or unknown-content saves are refused without touching your game, and the save from before an import can be restored.
- **Full screen on phones:** with Settings → Full screen on (the default on phones), the game hides the browser's address bar on your first tap and locks to landscape (Android Chrome and desktop browsers). iPhone browsers can't do that for web pages, so add Crownless to your home screen instead (Share → Add to Home Screen; on Android, ⋮ → Add to Home screen). Launched from the home screen it runs with no browser bars at all, with its own icon.
- **Tips and How to Play:** the first time each screen or situation comes up (the map, Stonebridge, an encounter, the first battle, the market, low food, points to spend…), a short tip explains it once on this device; the first battle waits on its controls card. **How to play** (title screen, Settings, or a tip's More help) covers every system and lists the touch and keyboard controls. Tips can be switched off or shown again in Settings. The Elder's first quest remains the hands-on tutorial.
- **Sound and settings:** synthesized sound effects and three music loops (menu, world, battle), generated in the browser with no sound files. The ⚙ button (on the map, in town and in battle, which pauses) and the title screen open **Settings**: text size, music and effects volume, battle size (20 to 200 at once, from 3.1.0; it starts at 150 until you choose), health bars over soldiers, and reduced effects. Settings stay on the device and are not part of a save.
- **Text size (2.2.0):** Settings → Text size (Small, Normal, Large, Larger) enlarges the game's text and buttons at once, in every menu and panel, on the map and in battle, canvas labels included; on touch every control stays at least 44×44 px and grows with the text. The page blocks the browser's pinch-zoom because pinching belongs to the game's own map and battle gestures, so text size is the way to enlarge the text. It is not a full replacement: it doesn't enlarge the canvas art, and it doesn't follow the phone's own font size. Desktop browsers' page zoom (Ctrl + / Ctrl −) still works and is supported from 100% to 150%.
- **Map camera (2.3.0):** drag the world map to look around, pinch (or + −, the mouse wheel) to zoom from "fit" to 2.4×, Centre to come back; arrow keys pan and C centres on a computer. A tap travels only when the finger lifts without having moved, so a drag or a pinch never sets off. The zoom is a device setting; it changes nothing in the rules (distance lives in the map's data, and a test runs the same journey at every zoom).
- **Battle zoom (2.4.0):** on a large battlefield, pinch the field (or the mouse wheel) for 0.75×–1.5×, or the zoom button / Z for 1× ↔ 0.75×; the view keeps the hero central and the zoom is a device setting. One finger on the field does nothing and a pinch never attacks or moves; sighting is judged at 1×, so the battle is the same at every zoom.
- **A data-driven world (2.5.0):** the world's size, kingdoms, start, regions and opening view are data (`data/world_map.js`); nothing in `js/` names a kingdom or the world or assumes a 0–100 map, and the tests play a three-kingdom 150 × 120 test world (`tests/helpers/test-world.js`). Nothing changes in play.
- **Terrain (2.6.0):** hills, mountains with passes, marsh, rivers with fords and bridges, and coasts are world data with travel speeds and battlefields of their own, all passable; the River Ford battlefield slows everyone in its shallows (Debug → Ford battle 30). The March has none of the new terrain yet.
- **The bigger world (2.7.0):** the Sundered Realm, about four times the March's area, with the March whole in the middle: Valedorn and Aurelian reach west and east, Hrothmark holds the northern highlands and the Vessaro League the southern coast (their own troops, names and goods), and the Free City of Merrow hires out sell-swords. 31 settlements, lairs in every region, caravans to Merrow, news that names the region. Campaigns saved before 2.7.0 can't continue in it: they are kept safe in the browser, untouched, and a new campaign begins.
- **Errands beyond the March (2.8.0):** someone in each new capital (Hrothgard, Vessara, Merrow) has an optional errand that shows their land: a mountain pass to clear, timber to carry south, wreckers to stop. How to Play → The lands describes the realm, and a tip greets you the first time you leave the March.
- **War and peace (2.9.0):** kingdoms are at peace, in tension or at war, and their patrols act on it: a border incident can sour a peace, clashes turn tension into war, and wars end in exhausted truces. Valedorn and Aurelian stay in tension until the story's ending decides. The world simulation looks only at nearby parties, moves far-off ones once an hour, and never lets two parties pass through each other, so 80 parties run smoothly. Debug → Map stress 80 measures it on a phone; `node scripts/bench-map.js --season` runs 90 days headless. Saves are schema v10.
- **Developer tools** (the Logs and Debug buttons) show on a local dev server. On the published site they are hidden; open the page with `?dev` added to the address (for example `…/crownless-mvp/?dev`) to show them on that device, and `?dev=0` to hide them again. F3 opens the diagnostics panel either way.
- The Debug panel's **Camera test 30 / 40** (1.7.0, PROTO-A) runs a practice battle in a forest three screens across with the camera following the hero, and reports fps, drawing time, the slowest frame and how long the armies took to meet.
- The **Debug** button gives testing shortcuts: hero and troop XP, renown, contracts, crowns, trade goods and prices, spawning or clearing world parties, food and morale, soldiers, items, stats, god mode, time, teleport, win or lose a battle, and wiping the save. Every use is logged.
- The game auto-saves in the browser (after battles, in settlements, and when the page is hidden or closed) and keeps a backup of the previous save; if the latest save is ever unreadable, the one before it loads and you are told. With the game open in two tabs, the older tab stops saving so it can't overwrite newer progress. Save & export shows when you last exported a copy, and the game reminds you now and then (browsers, notably iOS Safari, can clear site storage). Saves from 0.3 and 0.4 are converted automatically. A diagnostics panel (F3) shows logs and can export them as JSON or TXT.
- Landscape phone controls: joystick, Attack, Block and an Orders menu above them. The game pauses when you switch away and asks you to rotate in portrait.
- Gate details and playtest checklists: [`docs/GATE-A-VALIDATION.md`](docs/GATE-A-VALIDATION.md), [`docs/GATE-B-VALIDATION.md`](docs/GATE-B-VALIDATION.md), [`docs/GATE-C-VALIDATION.md`](docs/GATE-C-VALIDATION.md), [`docs/GATE-D-VALIDATION.md`](docs/GATE-D-VALIDATION.md)

| Action | Desktop | Touch |
|---|---|---|
| Travel (map) | Click a place or party; Space halts, or opens Wait | Tap a place or party; Wait button; ▶ speed button |
| Move (battle) | WASD / arrows | Left joystick |
| Attack | Space / left click | Attack |
| Block | Shift / right click | Hold Block |
| Orders | 1 or 2 group, F/H/C order | Orders |
| Pause | Esc | Pause |
| Diagnostics | F3 | Logs |

## Project layout

```
index.html        page shell; loads data/ then js/ as classic deferred scripts
style.css         layout, HUD and touch controls
js/               game runtime, attached to window.Crownless
  core.js         constants, math helpers, diagnostics log
  content.js      ContentDB: lookups into data/ + boot-time validation
  state.js        live game state (CL.game)
  storage.js      storage layer: every save key goes through it (localStorage today)
  events.js       domain events with unique IDs (BattleResolved, SoldierWounded, …) and listeners
  clock.js        the campaign clock: the one way time moves; fixed hours per battle, capture and rest
  soldiers.js     named soldiers: culture names, service records kept from events, notes, filters, rename
  troops.js       the troop tree as discovered (seen or owned), from events and hiring offers
  save.js         save schema v6: structure checks, migrations (0.3, v2 to v5), last-known-good backup, autosave
  camera.js       battle camera: follows the hero in arenas larger than a screen (one-screen maps stay put)
  arena.js        large battlefields generated from data (forest, open field), the Battlefield setting
  tactics.js      what the company can see, the minimap (tap to look) and the tactical overview (send a group)
  prep.js         battle preparation: presets, deployment zones (smaller when ambushed), Custom placement
  groups.js       group AI: soldiers' shields and shield cover, braced spears, archers' line of sight, Follow ranks
  morale.js       battle morale: hold, waver, fall back, rout; fleeing the field; the hero's Rally
  reinforce.js    nearby reinforcements: who joins a battle, when and from where; locked parties; one commit
  chronicle.js    the company chronicle, the roll of honour and "who did what"
  accounts.js     money in separate accounts (purse, company chest, follower budgets); every transfer logged
  quartermaster.js the quartermaster: wages set aside, food bought within a budget, warnings
  merchant.js     the merchant follower: a budget traded through the same market functions, seen prices, reports
  units.js        units built from troop data, swing phases, facing, movement
  combat.js       waves, attacks, AI, arrows, win/loss
  party.js        recruiting, day clock, wounded recovery, battle results and loot
  upkeep.js       food rations, weekly wages, morale, desertion
  trade.js        markets, prices, cargo, selling gear
  world.js        strategic map: travel, terrain, settlements, sites, capture release
  encounter.js    the one commit path for every encounter result (battle, auto-resolve, retreat, toll), exactly once
  town.js         walkable towns (menu first, Walk the streets): walking, townsfolk, talking, cast by role
  autoresolve.js  seeded RNG and GDD auto-resolve (power, odds, casualties)
  spatial.js      a grid of nearby parties for the world simulation (W-07)
  parties.js      patrols, caravans, bandit bands; encounter choices
  contracts.js    contract lifecycle (offer, accept, complete, collect, fail)
  portable.js     save export/import: file format, checksum, strict validation
  character.js    hero creation, attributes/skills, equipment, derived stats
  debug.js        Debug panel testing tools
  settings.js     device settings (volumes, battle size, effects), kept outside the save
  audio.js        Web Audio synthesizer: sound effects and music loops
  tips.js         first-time tips (content in data/help.js)
  fullscreen.js   full screen on tap (Settings), home-screen app detection
  ui.js           overlays, roster, pause, diagnostics panel
  render.js       canvas drawing (battle and world map) and HUD
  input.js        keyboard, mouse, touch buttons, joystick
  main.js         boot and main loop (loads last)
data/             content definitions (window.CROWNLESS_CONTENT): troops, encounters, world map, items, backgrounds, name cultures…
js/art/           the art kit: everything the game shows, drawn in code (docs/ART-STYLE.md)
icons/            the home-screen icons, drawn from the art kit by scripts/make-icons.js
tests/            node:test suite (no dependencies); tests/browser/ holds the Playwright browser specs
playwright.config.js  browser tests: Chromium, a desktop and a landscape-phone project, the test server
scripts/static-server.js  the dependency-free static server the browser tests start
types/            shared types for the type checker only (the page never loads them)
tsconfig.json     type-checker settings: checks the js/ files marked // @ts-check, emits nothing
```

Script order in `index.html` matters, because each module uses the ones loaded before it.

## Develop

**Agents (Claude Code, OpenAI Codex or a person):** the rules are in [`AGENTS.md`](AGENTS.md) (Claude reads them through `CLAUDE.md`); several agents work at once on their own branches and worktrees by [`docs/AGENTS-WORKFLOW.md`](docs/AGENTS-WORKFLOW.md); `npm run agents` shows who is on what.

You need Node 22 or later, and only for the dev tools. The game itself needs nothing.

```bash
npm run serve
```

Then open http://localhost:8123. Opening `index.html` directly from disk also works.

```bash
npm test
```

`npm test` runs the fast logic tests (about 8 s). The bot-heavy ones, which play whole campaigns (the 60-seed story check, the eight-seed stall check, a short Prototype G, 30 days of the three-kingdom test world), are in `tests/slow/`:

```bash
npm run test:slow
```

CI runs both; `npm run test:all` runs both here. The slow suite takes about half an hour, nearly all of it the 60-seed story check, so during Phase 8 it runs whole only at checkpoints; one file runs alone with `node --test tests/slow/<file>.test.js` (see "The test tiers" in `docs/NEXT-PLAN.md`). Every test game is isolated: each gets its own `Math`, seeded from its `seed` unless the test passes a `random`, so a seeded run gives the same result alone or after other games in the same process (`tests/isolation.test.js`).

```bash
npm run lint
```

`lint` runs Biome and then the type checker (`npm run typecheck`, which is TypeScript's `tsc --noEmit` fetched by `npx`). There is no build step: the type checker reads the JSDoc in modules that start with `// @ts-check` (`core`, `save`, `party`, `units`, `combat`, `story`, `world` so far) against the shared types in `types/crownless.d.ts`, and writes nothing. The game still runs the plain `.js` files.

```bash
npm run simulate
```

`simulate` plays brand-new campaigns headlessly with a simple bot (30 days, 8 seeds by default) and prints how each went, as a quick check that the campaign loop doesn't stall.

```bash
npm run simulate:story
```

`simulate:story` plays whole stories from a fresh start to an ending with a randomized bot (200 seeds by default). It reports the endings and branches reached, and prints the last steps of any run that soft-locks. `tests/slow/gate-d-campaigns.test.js` runs the same check on 60 seeds.

```bash
npm run bench
```

```bash
npm run economy
```

`economy` plays bot campaigns (60 days, 12 seeds by default) and reports where the money comes from and goes, from every transfer in the ledger, with money, renown and level at days 15, 30 and the end. For tuning passes (V2-T1).

`npm run icons` redraws the home-screen icons from the art kit, in headless Chromium. The game ships no other image, and `tests/assets.test.js` fails if one appears.

`bench` times the battle simulation per frame at 20, 30, 40 and 60 units on each battle map. Drawing isn't included; measure that on a device with the Debug panel's stress test, which reports fps, simulation and drawing time without touching the campaign.

```bash
npm run parity
```

`parity` fights the same encounters in person (the campaign bot's hero) and auto-resolves them from the same seeded game, 40 seeds each by default (`npm run parity -- 100 --preset defensive`, `--json`). It prints the stated odds, both win rates, soldiers lost each way and the gap: the measurement behind design SC-37 and the balance pass B-01, which aims for fought battles 5–15 points over the stated odds. Seeds are spread with a hash, since consecutive mulberry32 seeds correlate their first draws.

```bash
npm run bench:map
```

`bench:map` times the world simulation per game hour with 10, 25, 50, 100 and 200 parties on the map (`-- --parties 50,400`, `--json`): the parties alone and everything time drives, and the share of each real second of travel. The baseline for W-07's world simulation.

The tests load the logic modules (`core` → `party`) and the `data/` files into a Node `vm` sandbox with the UI stubbed out, so no browser is needed. Rendering, input and layout are covered by the browser tests below, and finally by playing the game on a phone.

## Browser tests

Playwright drives the real game in Chromium (W-00), as a desktop with a mouse (1280×720) and as a landscape phone with touch (812×375, device scale 3). Install once:

```bash
npm ci
npx playwright install chromium
```

```bash
npm run test:browser
```

This runs the behaviour specs in `tests/browser/` (about a minute): startup, character creation, loading saves (real ones from `tests/fixtures/`, damaged and incompatible ones), map travel and encounters, the settlement menu and the streets, a battle from Attack to the result with every control, Save & export (downloads are caught, nothing leaves the machine), and layout. Playwright starts `scripts/static-server.js` on port 8131 itself (`CROWNLESS_TEST_PORT` to change it); add `--project desktop` or `--project phone` for one size, `--headed` to watch, `--debug` to step through.

How the specs work (`tests/browser/helpers.js`):
- Each test gets a fresh browser profile (your own browser's saves are never touched), fixed settings (tips and full screen off, sound muted), a seeded `Math.random`, Playwright's clock, and the developer buttons hidden as on the published site.
- Controls are driven by real input: a click on desktop, a touch tap on the phone (`press`, `pressAt`), raw touches for held buttons, the joystick and gestures (`touch`, `hold`). State is read through `window.Crownless`; waits are on state, never on fixed sleeps. No test calls a game function to skip the thing it tests; the Debug panel (`debug`) is used only to get somewhere quickly.
- `expectLayoutSound(page, controls, { info, scrolled })` checks that controls are inside the viewport, don't overlap and are at least 44×44 CSS px on touch.
- `text-size.spec.js` (W-01) walks every key screen (title, settlement, Accounts, Journal, Party and a soldier's card, the map, Settings, an encounter, Prepare, a battle with Orders open, the result) at all four text sizes on both projects, at Larger on four more phone sizes (667×375, 740×360, 844×390, 915×412) and with the desktop zoomed to 150%. Besides the fixed controls it sweeps every visible button, select and input on each screen: inside the viewport once scrolled to, 44×44 on touch, and no label spilling out of its button.
- `map-camera.spec.js` (W-02) drags (mouse and one finger), pinches with two fingers, wheels and presses + − and Centre on the world map, and checks that none of it ever starts travel while a tap still does, at 2.4× too.
- `battle-zoom.spec.js` (W-03) pinches the battlefield with two fingers, wheels and presses the zoom button and Z, and checks that nothing attacks, moves or is sent meanwhile, and that the joystick, ATTACK, ORDERS and the minimap still work while zoomed.
- `ford.spec.js` (W-05a) plays the River Ford battle at both sizes: the river drawn, walking and wading by real input, a result.
- `load-save.spec.js` loads real saves of the bigger world (`tests/fixtures/saves-2.7`, W-05b) and checks that a save from before it grew is refused, kept safe and explained on the title screen.
- **Rule:** a task that changes the UI or input adds or updates browser specs.

**Screenshots** (`tests/browser/screens.visual.spec.js`, tagged `@visual`) compare ten screens at the Normal text size (the map also zoomed in) and four (title, settlement, map, battle with Orders open) at Larger, on both projects, against baselines in `tests/browser/screenshots/`. The baselines are authoritative only from Linux Chromium, as CI runs it (fonts differ between machines), so on Windows and macOS these tests are skipped, and a screen without a baseline yet is skipped everywhere.
- `npm run test:visual` compares (on Linux, or anywhere with `CROWNLESS_VISUAL=1`).
- `npm run test:visual:docker` makes the baselines in the official Playwright Linux image (needs Docker); `-- --check` compares there instead.
- Without Docker: run the workflow by hand (Actions → "Test and deploy" → Run workflow, tick "update screenshots"), download the `screenshot-baselines` artifact into `tests/browser/screenshots/` and commit it.
- Update the baselines only for an intended visual change, and look at the new images in the commit diff before committing.

To add a spec, put a `*.spec.js` file in `tests/browser/` that uses `test` and the helpers from `./helpers` (the shared `test` also fails on any page error or console error).


## Deploy

On every push to `main`, [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs the tests and lint, and the browser tests in a parallel `browser` job (its report, failure screenshots and traces are uploaded as an artifact), then publishes the repository root to GitHub Pages; either job failing stops the deploy. Pull requests run the checks only. A clean checkout is published, so `node_modules/` and test output never are. In the repository settings, under **Pages**, set the source to **GitHub Actions**. If the browser shows an old copy after a deploy, hard-refresh with Ctrl+Shift+R.

## Known limits

v1.0.0 is the complete MVP: Gates A–E passed (see `docs/RELEASE-NOTES.md`). v2 is under way on `main` (builds 1.1.0 onward; `docs/V2-PLAN.md`). The music is three short synthesized loops, a placeholder the GDD allows until final polish. Ally commands are simple, not a formation system. All the art is drawn in code by the art kit (`js/art/`, [`docs/ART-STYLE.md`](docs/ART-STYLE.md)); see [`docs/ASSETS.md`](docs/ASSETS.md) for where everything comes from. Browser saves can be cleared by the browser.
