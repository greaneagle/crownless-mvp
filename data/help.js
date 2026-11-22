/* Crownless content: help. Plain classic script; no modules, no fetch.
 * help_topics: the How to Play screen (GDD §11 "initial mappings are documented in Help"), in order.
 *   Each topic has paragraphs and, optionally, controls: [[touch, keyboard/mouse, action], …].
 * tips: first-time tips (Gate E tutorial). Each shows once per device, the first time its moment comes:
 *   on: the screen (map, town, settlement, encounter, battle, trade, contracts, character, journal, realm, ransom, grant, siegeAlarm,
 *       saves, result), and optionally when: a situation js/tips.js knows (lowFood, points, wounded,
 *       reserves, captured, awayFromHome: the party is in a region of the world not marked `home`, atCapital: in a kingdom's capital). text, or
 *       textTouch + textKeys when the controls differ.
 *   help: the How to Play topic its "More help" button opens. pause: a battle waits until it's read.
 * Q1 "A Stranger's Wage" stays the playable tutorial (GDD §4); tips only explain the screens. */
(function (root) {
  root.CROWNLESS_CONTENT = root.CROWNLESS_CONTENT || {};
  var C = root.CROWNLESS_CONTENT;

  C.help_topics = {
    start: {
      id: 'start',
      order: 1,
      title: 'Getting started',
      body: [
        'You are a wanderer on the Border March, where two crowns claim an empire that is gone. Earn a name with your sword, hire soldiers, and decide who Greywall belongs to — or whether it belongs to either. Beyond the March lie the highlands of Hrothmark to the north, the Vessaro League’s southern coast and the free port of Merrow.',
        'Begin in Stonebridge: Elder Maren has work for a stranger. Her quest teaches the rest. The Journal always says what to do next.',
        'Nothing ends the game. Lose a battle and you are captured, lose some crowns and gear, and are let go near a settlement.'
      ]
    },
    map: {
      id: 'map',
      order: 2,
      title: 'The map',
      body: [
        'Tap a town, village, fort, camp or band to travel there. Time passes as you ride: your soldiers eat, wages come due, wounds heal, and the world moves.',
        'Roads are fastest. Hills, forests and marsh slow you, mountains most of all (a road through them is a pass), and a river is slow to wade except at a ford or a bridge; heavy cargo slows you too. Patrols and caravans keep the peace and the trade going; Road Reavers prey on both, and on you if you look weak.',
        'Wait lets time pass where you stand. The panel at the top left shows the day, your crowns, soldiers, food, morale and current quest.',
        'You see only so far, and so do they: less at night, further from hills, hardly into a forest. You see the parties near you; where you last saw one, a faded mark with a ? stays for a day (a contract target’s stays until you find it). A small company is harder to spot than a big one, and in a forest you can Hide (H) until you set off. A band that loses sight of you rides to where it last saw you, searches there for a few hours, then gives up.',
        'Drag the map to look around and pinch (or + and −) to zoom; zoom all the way out to see the whole realm, with the March in its middle. Only a tap sets off, so dragging or pinching never sends you anywhere. While zoomed in, the view follows your company; Centre brings it back after you have looked away, and arrows at the edge point to you and to your contract or quest targets. Zoom changes only what you see: journeys take the same time and bands find you the same way at any zoom. The game remembers your zoom on this device.'
      ],
      controls: [
        ['Tap the map', 'Click the map', 'Travel there'],
        ['Drag the map', 'Drag, or arrow keys', 'Look around'],
        ['Pinch, or + −', 'Mouse wheel, or + −', 'Zoom in and out'],
        ['Centre button', 'C', 'Back to your company'],
        ['Wait button', 'Space', 'Wait / stop travelling'],
        ['Hide button (in a forest)', 'H', 'Hide until you set off'],
        ['⚙ button', '⚙ button', 'Settings']
      ]
    },
    lands: {
      id: 'lands',
      order: 3,
      title: 'The lands',
      body: [
        'The Border March, where the story is told, lies in the middle of the realm. Valedorn holds its west and the shires beyond; Aurelian its east and the old imperial provinces beyond that.',
        'North, over the mountains, are the highland clans of Hrothmark: heavy, slow infantry and axemen. The road from Greywall climbs to them through a pass. South, on the marshy coast, the merchant towns of the Vessaro League field crossbowmen and fast light horse. In the south-east the Free City of Merrow answers to no crown: it hires out sell-swords and has the best market in the land.',
        'Every kingdom has its own troops to hire, and every town posts contracts. Each capital has someone with work for a stranger. Prices differ by land: timber is cheap in the north and wine on the coast, so a company that carries goods between them can do well.',
        'Each land has Reaver lairs of its own, and the news says where trouble is: “the roads of the northern highlands are not safe”. The farthest capitals are a day and a half apart on the road.',
        'Kingdoms are at peace, in tension or at war with each other. At peace their patrols pass each other by, though a border incident can sour things; in tension or at war they fight wherever they meet, and enough fighting turns tension into war. Wars end when both sides are worn out, and long quiet cools tension back to peace. Valedorn and Aurelian stay in tension over Greywall until the story settles it. The news tells you when things change.',
        'Every town, fort and village of a kingdom is a holding, held by one of its lords or by its ruler: a king, a queen or, in Aurelia, the First Magistrate. A lord may hold a fort and a village, a village alone, or nothing at all (their kin and household knights). Each village answers to its seat, the nearest fort or town of its kingdom, and when a fort changes hands its villages go with it, held by the new ruler until they grant them; whoever lost them keeps a claim. The Realms (from the Journal, on the map and in every settlement) shows who holds what, who has the gates, who claims it, and each lord with their kin and home. Tapping a place on the map tells you its holder. Greywall and Ashgate change hands only in the story until it ends.',
        'The lords ride out with their households: a banner with a gold edge on the map, larger than a patrol, and larger still the more land its lord holds. Tap one to see who they are and what they are doing: riding the bounds of their lands, on campaign, hunting Reavers, or riding home to refill their ranks. They are met like patrols, but attacking one costs more of their kingdom’s goodwill. Beat a lord and they are your prisoner: their family, or their crown, will offer a ransom in a few days. Accept it, hold them for a better moment (they may escape), or let them go for nothing, which earns renown and their goodwill. Lose to a lord and you are ransomed rather than robbed, and let go at their home.',
        'You answer to no crown until you choose to. On a capital’s notice board, take Service: 30 days as that kingdom’s mercenary at a weekly pay (renew it there), with its patrols and lords on your side; attacking its own breaks the contract. Serve 20 days, be counted a friend and earn 150 renown, and you may swear fealty to its ruler as a vassal: no pay, but land may be granted, and you owe 10 days of service a month (fighting its enemies, or staying at your fief) and must never fight its people. The Realm screen’s Allegiance tab shows where you stand and lets you leave: ask for release (free when you owe nothing and the realm is at peace), or defect (they will hunt you, and your fief is lost). Every change says first what you lose and what you keep. Your soldiers, money, mill and followers are always yours.',
        'A sworn vassal may be granted land: the crown gives what it holds and has to give (land taken in war, land of a lord held too long, land left by one who left the realm) to who did most to take it, then to landless lords, then to those with least. Your first grant is most likely a village; a fort wants more renown and service. A grant comes as a message: Accept or Decline. Take a fort for your realm and you choose: ask the crown for it, name a lord for it, hand it to the crown for influence, or keep it unasked (the ruler may let it stand, or cast you out). The Realm screen’s Fief tab shows each holding you hold: who runs it (the steward of a fort, the reeve of a village, or a veteran you make castellan), its garrison or militia, prosperity and unrest, its treasury and last week. It runs itself; each week one line says how each did. Its money is its own: put crowns in or draw them out at the holding. Heavy tax pays more and stirs unrest (over 80, nothing is paid); a strong garrison costs more; unpaid soldiers desert after two warnings.',
        'At war, kingdoms besiege each other’s forts. Their lords gather, encircle the fort (it and its villages shut their gates and markets), make ladders in a day and a ram in three, and storm it when the odds are good; a fort out of food, or facing hopeless odds, surrenders. The defending kingdom’s lords ride to relieve it. A fort under siege is ringed in red on the map. If yours is besieged you are told at once: ride back, or leave it to your steward or castellan. You can besiege too, from a fort’s own screen, at war with it (or, as an independent, at the cost of attacking that kingdom): its card shows the odds and how long starving it out would take; then each day assault, wait or lift. A fort taken is weak and restless for a month, and a kingdom holds what it took before it reaches for more.',
        'When you storm a fort you besiege, choose Storm the walls to fight it, or Simulate. On the walls, the only ways up are the ladders (one for each day of preparation, three at most) and the gate once a ram (after three days) has broken it: keep soldiers at the gate and it gives way. Your infantry go for the ladders and your archers stay behind them. Hold the courtyard, or rout the defenders, and the fort is yours; thrown back, you lose men but nothing else. If you are inside a fort when it is stormed, you defend its walls with part of its garrison beside you.',
        'The lords have needs (land, coin, men, safety for their lands, a name to make) and long memories: what you did to them, and half of what you did to their kin. The Realm screen’s Lords tab shows each one: what they hold, their kin, friends and rivals, what they want most, where they are, and what they think of you and why. Ask… a lord to join your siege, relieve your fort, ride with you for three days or back your claim: they agree, name a price (or a favour), say when they can come, or refuse, and tell you why: the crown you share, what you have done for them, how far it is from their lands and what threatens them, and whether they fear you. A refusal holds for a week. Lords quarrel among themselves too: friends who fought together back each other at court, rivals who wanted the same grant, feuds over a fief taken; one who thinks too little of their ruler grumbles at court, and a week later leaves for another crown, as you would. A lord who thinks well of you may send a petition (clear bandits from their lands, a loan, a ransom for their kin, your word at court): answer it on the Lords tab. As a sworn vassal you are summoned to your crown’s sieges: be there before it ends, or it is a call missed.',
        'You can lose land: a siege takes it (a castellan walks out of a surrender, but is taken with a fort stormed until you win it back); your liege takes a fief back if you miss a second call (after a warning at the first); leaving a crown costs your fiefs; or you hand one back yourself on the Fief tab. Your company, money, mill and followers are always yours. Land lost against your will leaves a claim, and the tab becomes Claims when you hold nothing: each claim, how it came about, who holds it now and what could press it. Retake it by siege, and if your liege backs the claim it is yours again with the villages you held. Ask your liege to press it in their war, or, at peace, buy it back from the crown that holds it. A claim on land your own crown holds becomes a grant offered to you; one held by a lord of your own crown is refused while you are sworn. A claim pays nothing.'
      ]
    },
    towns: {
      id: 'towns',
      order: 4,
      title: 'Towns and villages',
      body: [
        'Every place opens on its menu: hire, buy food, rest, trade, take contracts and talk to people. Stonebridge also has streets: Walk the streets to stroll around, tap a person to walk over and talk (or use the joystick and TALK), Town menu to get back, and the road on the left to leave.',
        'Every other place is a menu: hire soldiers, buy food, rest, trade, take contracts and talk to whoever is there. Forts show their garrison. A kingdom that is Hostile to you will not hire out soldiers, give you work, sell you a business, let you into its tournaments or world events, or take you in after a defeat; its markets and beds stay open. Whatever is refused is still shown, greyed out, with the reason on it and beneath.'
      ],
      controls: [
        ['Tap a person', 'Click a person', 'Walk over and talk'],
        ['Joystick', 'WASD / arrows', 'Walk'],
        ['TALK', 'Space / E / Enter', 'Talk to whoever is near']
      ]
    },
    battle: {
      id: 'battle',
      order: 5,
      title: 'Battle',
      body: [
        'When a band catches you, or you ride at one, choose: Attack fights the battle yourself; Auto-resolve rolls it from your strength; you can also pay a toll, threaten weaker bands, or try to slip away. Each button shows the odds.',
        'In battle you fight in person. Swings hit what is in front of you; a shield blocks hits from the front only. Your soldiers follow orders by group: Follow keeps them near you, Hold keeps them where they stand, Charge sends them at the nearest enemy.',
        'Soldiers fight as groups. On Follow they keep loose ranks around you, infantry ahead and archers behind. Footmen, Guards, Legionaries, Mercenaries and Sellswords raise their shields at a blow from the front, and a raised shield also covers the friend just to its left: hold Block beside a companion to protect them too. Spearmen and Legionaries stop a cavalry charge that comes at their spears. Archers only shoot when no tree or wall is in the way.',
        'Groups on both sides have morale. Heavy losses, being outnumbered, blows from the flank or behind and friends running nearby shake a group; veterans and having you close by steady it. A shaken group wavers (it hits a little lighter), then falls back, and at last routs: it runs off the field and stops fighting. Enemies who flee count as beaten but leave less to loot. Your soldiers who flee come back after the battle unhurt. Rally (R, or in Orders) steadies every soldier near you and turns back those running, once every 30 seconds. Nothing about it is luck: the same fight goes the same way. If you fall, your sergeants take over and the whole company charges. An enemy that falls back and is left alone gives up the field, and if nobody can close for long the enemy slips away, so a battle always ends.',
        'A battle can draw in others nearby. Road Reavers within earshot join their own kind; a kingdom’s patrol helps you only if that kingdom counts you a friend, and comes for you if it is Hostile. They ride in from the side of the field they come from: an hour away on the map is about ten seconds of battle. Those your company can already see are named before you fight; others are announced shortly before they arrive. If the battle ends first, they arrive too late. Enemies cut down by those who came to help are theirs, not yours. Auto-resolve counts the help that would arrive in good time.',
        'Only so many fight at once (Settings → Battle size, from 20 to 150); the rest wait in reserve and step in as others fall. Enemies may come in waves.',
        'Bigger battles need a quicker device. If a battle runs slowly, its result offers a smaller size once; it never changes by itself. In a battle of more than 80 at once, the fallen fade from the field after a while, there are no hit rings, and health bars show only over the badly hurt, so the field stays readable.',
        'Formations (Orders, for the infantry; you never need them): Loose is the default. Wall closes the infantry up shoulder to shoulder on Hold or Follow: slower, shields up whenever a foe is near in front, striking over them, and each shield covers the soldiers on both sides; good against archers and when outnumbered. Wedge makes a point on Follow or Charge: quicker, and the first blow on each new foe lands harder and shakes them, but nobody covers anyone. Defensive starts in a wall. Wading a ford breaks any formation.',
        'The ground matters. On hills, archers standing on a rise shoot a quarter further (yours start on the knoll and hold it), and so do enemy archers on theirs. In a ford the shallows slow everyone.',
        'Escort ambushes: when Reavers spring on a caravan you are escorting, its wagon is on the field behind you, and some of them burst from cover on your flank to burn it. Your soldiers go back for raiders at the wagon by themselves. If it burns, or you lose the fight, the caravan and the contract are lost, even if you win.',
        'Before you fight, choose a setup: Balanced (the default), Defensive, Aggressive, or Custom, where you drag each group’s flag inside the zone and pick its first order. Simulate settles the fight from your strength and explains the odds (your soldiers count half as much again for fighting in ranks, and numbers count twice over, so the stronger side usually wins; fighting it out yourself does a little better if you fight well, and usually costs fewer soldiers). The enemy keeps a loose line and goes for archers, the wounded, and a hero who strays from the company. Tick Skip this screen to go straight in with your setup next time (Settings → Before battles turns it back on). When a band ambushes you, there is less room to form up.',
        'On a large battlefield the view follows you. The small map at the top shows your company and the enemies your soldiers have seen (red; faded where they were last seen); tap it to look there for a moment. MAP (or hold Tab) opens the whole field with the battle held still: pick a group in Orders, then tap where it should go and hold. You never have to use it.',
        'On a large battlefield you can also zoom: pinch the field with two fingers (or use the mouse wheel) for anything from 0.75× to 1.5×, or press the zoom button (Z) to switch between 1× and 0.75×. One finger on the field does nothing, so a pinch never swings, moves you or sends anyone. Zoom only changes what you see: your company spots enemies and fights exactly as at 1×. Pinching in again at the widest zoom opens the whole field; spreading your fingers there closes it. The game remembers your zoom on this device.'
      ],
      controls: [
        ['Joystick', 'WASD / arrows', 'Move'],
        ['ATTACK', 'Space / left click', 'Swing'],
        ['Hold BLOCK', 'Shift / right click', 'Block (needs a shield)'],
        ['ORDERS → group', '1 / 2 / 3', 'Infantry / Archers / Cavalry'],
        ['ORDERS → order', 'F / H / C', 'Follow / Hold / Charge'],
        ['ORDERS → Rally', 'R', 'Steady the soldiers near you (every 30 s)'],
        ['Tap the small map', 'Click the small map', 'Look there for a moment'],
        ['MAP', 'Hold Tab, or M', 'Tactical overview: send a group to a spot'],
        ['Pinch, or the zoom button', 'Mouse wheel, or Z', 'Zoom the battle (large fields)'],
        ['Pause', 'Esc', 'Pause']
      ]
    },
    party: {
      id: 'party',
      order: 6,
      title: 'Your company',
      body: [
        'Everyone you hire takes a slot, eats a ration a day for every five people, and draws a weekly wage. Food follows the price of grain: a little cheaper among the farms, dearer up in the highlands. Hungry or unpaid soldiers lose morale; at very low morale they desert.',
        'Fallen soldiers are wounded or killed. The wounded sit out battles for about two days. Soldiers gain experience and can be upgraded for crowns in the Party screen; Leadership and renown raise how many you can lead.',
        'Every soldier has a name, a home and a service record: battles, kills, wounds and the wages they were actually paid. Party lists them by name (filter by who is fit, wounded or ready to upgrade); tap one for their card, where you can rename them or upgrade them on their own. By type groups them as before.',
        'Service shapes a soldier. Each earns one trait, once, at a milestone of their own record, never at random: Steadfast after 8 battles (their group holds together longer), Cautious after a second wound (slower to engage, lets runners go, takes less from each blow and falls less often) or Impulsive after felling 8 enemies (goes in early and hits harder, but takes more wounds). You are told when it happens; the trait shows on their row, their card and the roll of honour.',
        'Soldiers who fall, desert or retire are not forgotten: the Roll of honour in Party keeps who they were, where they came from, how long they served and what they did. A soldier’s card has Retire with honour (tap twice) to let a veteran go. After a fought battle, the result says who did what.',
        'Accounts (in a settlement, or ask at the tavern) shows your purse, the company chest and a ledger of every crown in and out. Wages are paid from the chest first, then your purse. Captors take a share of both. A quartermaster (40 crowns, 6 a week) keeps the next wages in the chest and buys food up to a reserve (5 days to start) whenever you reach a market, spending at most a weekly budget (automatic to start: a week’s food for the company and a quarter more, so it grows with you; or a fixed amount), and warns you on the road before food or wages run short. You can change those rules or let them go at any time.',
        'A surgeon (60 crowns in a town, 10 a week) tends the fallen after every battle, fought or simulated: about a third of those who would die are saved, one medicine each (15 crowns at any market; a few are saved even without), and wounds heal in a day and a half instead of two. The result screen names who was saved. Buy medicine on the Accounts screen, or let the quartermaster keep some in stock (4 to start). Captors take half of it.',
        'A blacksmith (50 crowns in a town, 8 a week) works wherever you are. They improve the weapon and armour you wear, at most twice each (a sword +1 hits 2 harder, armour +1 stops 1 or 2 more), and fit up to five soldiers with fine kit (+1 armour, +8 hit points, and they count for a little more when you simulate), for crowns and iron you carry: buy iron at a market. Forged gear sells for more, but never for what the plain piece costs to buy. Nothing wears out.',
        'Detachments (from a settlement’s menu, or Party on the map): send part of the company out under a captain, a veteran of tier 3 with 10 battles or your companion. Choose who goes and the order: hunt bands around where you are, or patrol a road between two places, for a number of days. They take food from your stores and pay from the chest, fight what they meet by the same rules as any party on the map, and report back. They turn back when their time is up, their food or pay runs out, they fall below the strength you set, they are beaten, or a courier you send reaches them; meeting you, they rejoin the company with everything that happened to them. Soldiers away still count toward your party size.',
        'A scout (45 crowns in a town, 8 a week) lets your company see half as far again, warns you of hostile parties the moment they are seen ("about 8 Reavers to the north-east, riding this way"), tells you as you set off how long the ride should take and which bands are known near the way, and gives you more ground to set up on when you attack a band. Their numbers are a scout’s guesses: close, not exact.',
        'A merchant (50 crowns, 8 a week; hire one in Accounts in a market town) trades a budget you give them whenever you reach a market, at the same prices as you, with their own goods riding in your wagons. They know only prices they have seen on your travels, so take them to a few markets first. Cautious (the default) wants a good margin and keeps some cash; Bold takes thinner margins with nearly all of it. Goods that wait too long are sold at cost, and after two weeks at a small loss, so the money keeps moving. They report what they bought and sold and why. Stop them, take money back, or recover everything (cash to your purse, goods to your cargo) at any time. Captors take a share of their budget too.',
        'You can buy a mill in a village (300 crowns) or a town (600) with a market, from the town screen; one at a time. Its card says what the village miller would make there at today’s prices. The miller grinds grain into flour and sells it in that market every payday on their own, through the same prices as you, paying for grain and the wage from the mill’s own money: put crowns in, or take them out, at the mill. They grind only while a sack of flour still pays for its sack of grain, so a busy week makes grain dearer and flour cheaper there and the next week is smaller; where grain is dear a mill may earn nothing. The owner of the place takes a tenth of the sales. Each week’s report, good or bad, and why, is on the card and in Accounts. A master miller (60 crowns, 12 a week) gets more flour from each sack. Price rules (expert) cap what they pay for grain or the least they take for flour. If the place changes hands you are told; if its owner turns Hostile to you they will seize the mill and its money in seven days unless you sell it (from anywhere, for 60% of what you paid) or mend relations.',
        'Troop tree shows every troop line as you discover it: troops you have met by name, troops you have hired or trained in full, with their upgrade costs. A troop at the end of its line is at max tier. Upgrade all ready upgrades everyone who has earned it, after showing you the total.',
        'Party also shows your hero: equip loot, and spend skill and attribute points as you level.'
      ]
    },
    trade: {
      id: 'trade',
      order: 7,
      title: 'Trade and contracts',
      body: [
        'Six goods are cheap where they are plentiful and dear where they are short. Caravans that arrive make a good cheaper; caravans the Reavers rob make it dearer. Market talk on the Trade screen says what moved prices. Cargo slows your march.',
        'Every town posts contracts: hunt a marked band, escort a caravan (it only rolls while you ride beside it), or deliver goods or a letter. One contract at a time; each shows its reward and time limit, and failing one costs renown. Finished work wins favour with the town’s kingdom.'
      ]
    },
    story: {
      id: 'story',
      order: 8,
      title: 'Story, reputation and news',
      body: [
        'Four quests lead to the fate of Greywall. The Journal lists them with the next step in gold, the company chronicle (your own story: who joined, who was promoted, notable battles, who fell, quests done), the happenings you know of and the regional news.',
        'Besides the story there are a few small errands, marked as such in the Journal and never needed: Elder Maren may want to feast a Stonebridge-born veteran; Sergeant Brun can teach you to keep full larders with a quartermaster, and later to fight a dug-in band to a plan; Caravan Master Oswin in Eastwatch will start you on a merchant’s first venture; and Captain Aldric has raiders on the border where a Crown watch will ride to your aid.',
        'Things happen in the world as it changes, and the news tells where: a food shortage where grain is dear, Reavers loose in a village’s fields (with a bounty), a militia asking to be drilled where a kingdom is at odds with its neighbours, a courier stuck with a letter, refugees near a war. In that settlement each has a card with one decision, to take part or not, and says what happens if no one helps: grain staying dear, farms plundered, or, if you were asked and rode on, a little reputation. Each lasts a few days and ends once; what your company had a hand in goes into its chronicle. The same thing does not come back to a region for a while, and none of it ever stands in the story’s way.',
        'The great towns (Stonebridge, Eastwatch, Hrothgard, Vessara and Merrow) each hold a tournament every two weeks, told in the news; entries stay open three days. Eight fighters on foot, three bouts: you fight each one yourself, alone, in tournament gear (your own stays in your pack and can never be lost there). Each round is harder. Entry costs a fee that rises with your renown. The champion wins crowns, renown and the host’s goodwill; the finalist less; falling in the first bout costs a little renown, never your company. Whoever beats you becomes your rival and may turn up in later tournaments, met only in a final. You can enter the same town again only after four weeks, and each win there is worth less than the last. A bout left unfinished counts as lost.',
        'Each kingdom sees you as Friendly, Neutral or Hostile. Helping it raises that; attacking its patrols or caravans lowers it. Friendly gives two extra party slots; Hostile means its patrols hunt you.',
        'Mara, a former imperial scout, may join you after the second quest. After the ending the March goes on: work, trade and the border’s quarrels continue.',
        'Beyond the March, three more companions wait, each in their own land: Sigrun in Hrothgard, Iacopo in Vessara and Livia in Tessaro. Talk to them; each joins after a small errand of their own. With you they take a party slot, eat, draw a weekly wage, fight beside you (wounded, never killed, when they fall), lend a skill while fit and can captain a patrol. Each has a loyalty shown on the Party sheet, with what they care about. It moves for reasons you can see: paid wages and victories raise it, missed wages and defeats lower it, and so does what you do: Sigrun hates paying Reavers to pass, Iacopo hates a late wage, Livia hates attacks on a kingdom’s patrols and caravans. Unhappy, they warn you and say why; if it goes on, they leave for good, but never without warning.'
      ]
    },
    saving: {
      id: 'saving',
      order: 9,
      title: 'Saving and settings',
      body: [
        'The game saves itself in this browser after battles and in settlements. Browsers can clear that storage, so use Save & export now and then: the file (or text) also moves your game to another device.',
        'Settings (⚙, or on the title screen) has text size, music and effects volume, battle size, health bars, reduced effects, and tips. Settings stay on this device and are not part of a save.',
        'Text size (Small, Normal, Large, Larger) makes the game’s text and buttons bigger at once, in menus, on the map and in battle. The page doesn’t pinch-zoom, because pinching belongs to the map and the battlefield, so this is the way to enlarge the text. It doesn’t enlarge the pictures, and it doesn’t follow your phone’s own font size. On a computer, the browser’s zoom (Ctrl + and Ctrl −) also works, up to 150%.'
      ]
    },
    credits: {
      id: 'credits',
      order: 10,
      title: 'Credits',
      body: [
        'Crownless: The Border March. Design, story and code by the game’s developer.',
        'Character and world sprites were made with AI using Sprite Studio, the developer’s own sprite tool. Sound effects and music are synthesized live in your browser; the map and interface are drawn in code.',
        'No third-party art, music, fonts or libraries are used, and the game loads nothing from other sites.'
      ]
    }
  };

  C.tips = {
    map: { id: 'map', on: 'map', help: 'map', title: 'The map', text: 'Tap a place to travel there; time passes as you ride. Elder Maren in Stonebridge has work for a stranger.' },
    town: { id: 'town', on: 'town', help: 'towns', title: 'Stonebridge', textTouch: 'Tap a person to walk over and talk. Town menu has hiring, food, the market and contracts. The road on the left leads out.', textKeys: 'Click a person to walk over and talk, or walk with WASD and press Space. Town menu has hiring, food, the market and contracts.' },
    settlement: { id: 'settlement', on: 'settlement', help: 'party', title: 'In a settlement', text: 'Hire soldiers, buy food, rest or trade. Everyone you hire eats and draws a weekly wage, so keep a few days’ food.' },
    encounter: { id: 'encounter', on: 'encounter', help: 'battle', title: 'An encounter', text: 'Attack to fight it yourself, or Auto-resolve to roll it from your strength. You can also pay, threaten or try to slip away — each button shows the odds.' },
    prepare: { id: 'prepare', on: 'prepare', help: 'battle', title: 'Prepare for battle', text: 'Balanced suits most fights: just press Fight. Simulate settles it from your strength and shows why. Defensive and Aggressive set different starts, and Custom lets you drag each group’s flag inside the green zone.' },
    battle: { id: 'battle', on: 'battle', help: 'battle', pause: true, title: 'Your first battle', textTouch: 'Joystick to move, ATTACK to swing, hold BLOCK to raise your shield (front only). ORDERS: pick a group, then Follow, Hold or Charge.', textKeys: 'WASD to move, Space or left click to swing, Shift or right click to block (front only). 1–3 pick a group; F, H, C order Follow, Hold, Charge. Esc pauses.' },
    reserves: { id: 'reserves', on: 'battle', when: 'reserves', help: 'battle', title: 'Reserves', text: 'Not everyone fits on the field at once. The rest wait in reserve and step in as others fall — see Reserves on the HUD.' },
    captured: { id: 'captured', on: 'result', when: 'captured', help: 'start', title: 'Captured', text: 'A lost battle costs some crowns and gear, never the game. You are let go near a settlement; rest, hire and try again.' },
    trade: { id: 'trade', on: 'trade', help: 'trade', title: 'The market', text: 'Goods are cheap where plentiful and dear where short: buy low here, sell somewhere else. Cargo slows you down.' },
    contracts: { id: 'contracts', on: 'contracts', help: 'trade', title: 'Contracts', text: 'One job at a time: hunt a band, escort a caravan or deliver. Each shows its reward and time limit; failing costs renown.' },
    character: { id: 'character', on: 'character', help: 'party', title: 'Party and gear', text: 'Equip what you find, spend skill and attribute points, and upgrade soldiers who have earned it.' },
    ransom: { id: 'ransom', on: 'ransom', help: 'lands', title: 'A ransom', text: 'A lord you beat is your prisoner. Accept the ransom, hold them for later (they may slip away), or let them go for nothing: renown, and a lord who remembers it.' },
    allegiance: { id: 'allegiance', on: 'contracts', when: 'atCapital', help: 'lands', title: 'Service and fealty', text: 'A capital’s board also offers Service: a month as the kingdom’s mercenary, paid weekly. Serve it well and you may swear fealty. Each card says first what will change and what stays yours.' },
    grant: { id: 'grant', on: 'grant', help: 'lands', title: 'A grant of land', text: 'Your liege offers you a holding. Accept it and it runs itself, with one line a week; the Realm screen’s Fief tab shows it. Decline and the crown grants it to someone else.' },
    siege: { id: 'siege', on: 'siegeAlarm', help: 'lands', title: 'Under siege', text: 'Your fort is besieged. Ride back to fight beside it, or leave it to the one who runs it: they hold while the food lasts and the odds are not hopeless.' },
    petition: { id: 'petition', on: 'realm', when: 'petition', help: 'lands', title: 'A petition', text: 'A lord asks you a favour, with a reward and a day to answer by. Accept or decline it at the top of the Lords tab: either way they will remember.' },
    realm: { id: 'realm', on: 'realm', help: 'lands', title: 'The Realms', text: 'Who holds every town, fort and village, and the lords of each kingdom. When a fort falls its villages go with it, and the old lord keeps a claim. Nothing here needs doing yet.' },
    journal: { id: 'journal', on: 'journal', help: 'story', title: 'The Journal', text: 'Your quests, with the next step in gold, your company’s chronicle, and the regional news.' },
    saves: { id: 'saves', on: 'saves', help: 'saving', title: 'Keep a copy', text: 'The game saves itself in this browser, but browsers can clear it. Export a copy now and then — it also moves your game to another device.' },
    points: { id: 'points', on: 'map', when: 'points', help: 'party', title: 'Points to spend', text: 'You have skill or attribute points to spend. Open Party: Leadership lets you lead more soldiers, One-Handed hits harder.' },
    lowFood: { id: 'lowFood', on: 'map', when: 'lowFood', help: 'party', title: 'Food is running low', text: 'Buy food in any town or village. Hungry soldiers lose morale and may desert.' },
    beyond: { id: 'beyond', on: 'map', when: 'awayFromHome', help: 'lands', title: 'Beyond the March', text: 'A new land, with its own kingdom, troops and prices. Its capital posts contracts and someone there has work for you. Zoom out to see the whole realm; Centre brings you back.' },
    wounded: { id: 'wounded', on: 'map', when: 'wounded', help: 'party', title: 'Wounded soldiers', text: 'The wounded sit out battles for about two days. Resting in a settlement passes the time safely.' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
