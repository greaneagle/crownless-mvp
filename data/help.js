/* Crownless content: help. Plain classic script; no modules, no fetch.
 * help_topics (P10-07: `stage`, captain, vassal, lord or ruler: How to Play opens at yours): the How to Play screen (GDD §11 "initial mappings are documented in Help"), in order.
 *   Each topic has paragraphs and, optionally, controls: [[touch, keyboard/mouse, action], …].
 * tips: first-time tips (Gate E tutorial). Each shows once per device, the first time its moment comes.
 *   P10-07: guide: true makes it a step of the beginner guide (numbered in this table's order, and
 *   skippable all at once); the rest are hints for the deeper systems.
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
      stage: 'captain',
      order: 1,
      title: 'Getting started',
      body: [
        'You are a wanderer in the Sundered Realm, where six crowns claim the pieces of an empire that is gone. Earn a name with your sword, hire soldiers, and decide who holds the fort two of them are quarrelling over — or whether it belongs to either.',
        'Choose your kingdom at a new game: you begin in its start town, and the story is told from there. Any kingdom will do; the story keeps its shape, its choices and its three endings, cast from the people and places around you. Begun in Valedorn, it is the story of the Border March, between Stonebridge and Eastwatch, over Greywall.',
        'Then choose who you were before the road: your origin. Each of the five begins with a short quest of its own, a few steps that teach hiring, riding out, a first fight or a first trade, and ends with a small edge: the unhorsed traveller gets a horse back, the impoverished noble their grandfather’s axe, the farmhand three men of the village, the scout a little more agility, the peddler a merchant’s thanks. Every origin ends in about the same place.',
        'Then the common quest: your start town’s elder has work for a stranger. After it the story can be followed or left: the Journal says where it goes on, and the world goes on without it. The Journal always says what to do next.',
        'Nothing ends the game. Lose a battle and you are captured, lose some crowns and gear, and are let go near a settlement.',
        'The whole realm is yours to roam. The story is one road through it, taken up or left as you please; everywhere else you make your own way.'
      ]
    },
    map: {
      id: 'map',
      stage: 'captain',
      order: 2,
      title: 'The map',
      body: [
        'Tap a town, village, fort, camp or band to travel there. Time passes as you ride: your soldiers eat, wages come due, wounds heal, and the world moves.',
        'Roads are fastest. Hills, forests and marsh slow you, mountains most of all (a road through them is a pass), and a river is slow to wade except at a ford or a bridge; heavy cargo slows you too. Patrols and caravans keep the peace and the trade going; Road Reavers prey on both, and on you if you look weak.',
        'Time runs at Normal speed, an hour a second; the ▶ button beside the zoom switches to Fast (▶▶), four hours a second, and back (also in Settings). Wait lets time pass where you stand: choose days and hours, the screen darkens while the world goes on, and lightens when the time is up. Anyone who reaches you meanwhile cuts the wait short, and you face them. The panel at the top left shows the day, your crowns, soldiers, food, morale and current quest.',
        'You see only so far, and so do they: less at night, further from hills, hardly into a forest. You see the parties near you; where you last saw one, a faded mark with a ? stays for a day (a contract target’s stays until you find it). A small company is harder to spot than a big one, and in a forest you can Hide (H) until you set off. A band that loses sight of you rides to where it last saw you, searches there for a few hours, then gives up.',
        'Drag the map to look around and pinch (or + and −) to zoom; zoom all the way out to see the whole realm, with the March in its middle. Only a tap sets off, so dragging or pinching never sends you anywhere. While zoomed in, the view follows your company; Centre brings it back after you have looked away, and arrows at the edge point to you and to your contract or quest targets. Zoom changes only what you see: journeys take the same time and bands find you the same way at any zoom. The game remembers your zoom on this device.'
      ],
      controls: [
        ['Tap the map', 'Click the map', 'Travel there'],
        ['Drag the map', 'Drag, or arrow keys', 'Look around'],
        ['Pinch, or + −', 'Mouse wheel, or + −', 'Zoom in and out'],
        ['Centre button', 'C', 'Back to your company'],
        ['Wait button', 'Space', 'Wait for a while / stop travelling'],
        ['▶ button', '▶ button', 'Map speed: Normal or Fast'],
        ['Hide button (in a forest)', 'H', 'Hide until you set off'],
        ['⚙ button', '⚙ button', 'Settings']
      ]
    },
    lands: {
      id: 'lands',
      stage: 'vassal',
      order: 3,
      title: 'The lands',
      body: [
        'The Border March, where the story is told, lies in the middle of the realm. Valedorn holds its west and the shires beyond; Aurelian its east and the old imperial provinces beyond that.',
        'North, over the mountains, are the highland clans of Hrothmark: heavy, slow infantry and axemen. The road from Greywall climbs to them through a pass. South, on the marshy coast, the merchant towns of the Vessaro League field crossbowmen and fast light horse. In the south-east the Free City of Merrow answers to no crown: it hires out sell-swords and has the best market in the land.',
        'Far to the east, past Castra Nova and Merrow, lies the coast. The Kingdom of Ostrand holds its northern cliffs with shieldmen and cliff bowmen; the Saltreach League its salt flats with pikes and crossbows; the two are at war. Between them the Free Port of Gullhaven trades with everyone. Above the coast the Gullspine fells are wild country, and their raiders come down to the roads.',
        'Every kingdom has its own troops to hire, and every town posts contracts. Each capital has someone with work for a stranger. Prices differ by land: timber is cheap in the north and wine on the coast, so a company that carries goods between them can do well.',
        'Each land has Reaver lairs of its own, and the news says where trouble is: “the roads of the northern highlands are not safe”. From the far west to Gullhaven is about three and a half days’ ride.',
        'Kingdoms are at peace, in tension or at war with each other. At peace their patrols pass each other by, though a border incident can sour things; in tension or at war they fight wherever they meet, and enough fighting turns tension into war. Wars end when both sides are worn out, and long quiet cools tension back to peace. The story’s two kingdoms stay in tension over their fort until the story settles it (Valedorn and Aurelian over Greywall, begun in Valedorn). The news tells you when things change.',
        'Every town, fort and village of a kingdom is a holding, held by one of its lords or by its ruler: a king, a queen or, in Aurelia, the First Magistrate. A lord may hold a fort and a village, a village alone, or nothing at all (their kin and household knights). Each village answers to its seat, the nearest fort or town of its kingdom, and when a fort changes hands its villages go with it, held by the new ruler until they grant them; whoever lost them keeps a claim. The Realms (from the Journal, on the map and in every settlement) shows who holds what, who has the gates, who claims it, and each lord with their kin and home. Tapping a place on the map tells you its holder. The story’s two forts (Greywall and Ashgate, begun in Valedorn) change hands only in the story until it ends.',
        'The lords ride out with their households: a banner with a gold edge on the map, larger than a patrol, and larger still the more land its lord holds. Tap one to see who they are and what they are doing: riding the bounds of their lands, on campaign, hunting Reavers, or riding home to refill their ranks. They are met like patrols, but attacking one costs more of their kingdom’s goodwill. Beat a lord and they are your prisoner: their family, or their crown, will offer a ransom in a few days. Accept it, hold them for a better moment (they may escape), or let them go for nothing, which earns renown and their goodwill. Lose to a lord and you are ransomed rather than robbed, and let go at their home.',
        'You answer to no crown until you choose to. On a capital’s notice board, take Service: 30 days as that kingdom’s mercenary at a weekly pay (renew it there), with its patrols and lords on your side; attacking its own breaks the contract. Serve 20 days, be counted a friend and earn 150 renown, and you may swear fealty to its ruler as a vassal: no pay, but land may be granted, and you owe 10 days of service a month (fighting its enemies, or staying at your fief) and must never fight its people. The Realm screen’s Allegiance tab shows where you stand and lets you leave: ask for release (free when you owe nothing and the realm is at peace), or defect (they will hunt you, and your fief is lost). Every change says first what you lose and what you keep. Your soldiers, money, mill and followers are always yours.',
        'Every realm has a treasury of its own. It takes a tenth of every fief’s tax (its law may say more or less), the whole tax of its ruler’s own land, and the ransoms paid to it; it pays its mercenaries, the garrisons of the ruler’s forts, its lords’ ransoms when their kin can’t, and its officers. A realm with an empty treasury hires no company and can’t ransom its lords, and its garrisons go unpaid. Each realm’s card on the Realms screen shows its treasury and whether it is rising or falling, its laws (the Vessaro League is a league: its council of lords decides war, and goes to war only when its lords think ill of the other ruler), and its three officers: a marshal who leads its sieges, a steward who brings in a little more of the crown’s due, and a chancellor. A lord passed over for an office remembers it.',
        'Lords who think ill enough of their ruler, and well of one another, form a faction around a claimant: the ruler’s kin if one is among them, else the strongest. The court hears of it first as whispers, then from your companion or a lord who trusts you. The ruler may concede land, a lower share or an office, send a mediator, win one of them over, arrest the claimant (they may rise at once) or prepare for war. Then the faction makes its demands: met, it breaks up; refused, it rises as a realm of its own and every lord of the realm chooses a side. Sworn to that realm, you are summoned by both: choose on the Realms screen’s Allegiance tab. A peace ends it in a compromise; take all the rebels’ forts and the crown wins; leave the crown no fort and the claimant rules. If it is your own realm and you lose, you are deposed, but keep your company, companions, businesses and a claim to the crown, and an old enemy may offer you refuge.',
        'Realms make treaties: peace, a truce after a war, nonaggression, alliances, passage, trade and tribute, each with its end day. A pact of nonaggression or an alliance keeps border clashes short of war, unless one side’s rulers think ill enough of the other to break it. An ally joins its friend’s defensive war if it can afford one, and weighs an offensive one. A broken treaty costs the breaker trust with every court, and a realm that trusts another too little won’t sign with it. Realms seek a truce when a war goes badly or their treasury runs low, an alliance against a neighbour much stronger than they are, and trade when they are rich. As a vassal, your realm may ask you to carry its offer to another court as its envoy (a sealed letter on its capital’s board): the offer is better heard for it. The Diplomacy tab on the Realms screen shows it all.',
        'A sworn vassal may be granted land: the crown gives what it holds and has to give (land taken in war, land of a lord held too long, land left by one who left the realm) to who did most to take it, then to landless lords, then to those with least. Your first grant is most likely a village; a fort wants more renown and service. A grant comes as a message: Accept or Decline. Take a fort for your realm and you choose: ask the crown for it, name a lord for it, hand it to the crown for influence, or keep it unasked (the ruler may let it stand, or cast you out). The Realm screen’s Fief tab shows each holding you hold: who runs it (the steward of a fort, the reeve of a village, or a veteran you make castellan), its garrison or militia, prosperity and unrest, its treasury and last week. It runs itself; each week one line says how each did. Its money is its own: put crowns in or draw them out at the holding. Heavy tax pays more and stirs unrest (over 80, nothing is paid); a strong garrison costs more; unpaid soldiers desert after two warnings.',
        'At war, kingdoms besiege each other’s forts. Their lords gather, encircle the fort (it and its villages shut their gates and markets), make ladders in a day and a ram in three, and storm it when the odds are good; a fort out of food, or facing hopeless odds, surrenders. The defending kingdom’s lords ride to relieve it. A fort under siege is ringed in red on the map. If yours is besieged you are told at once: ride back, or leave it to your steward or castellan. You can besiege too, from a fort’s own screen, at war with it (or, as an independent, at the cost of attacking that kingdom): its card shows the odds and how long starving it out would take; then each day assault, wait or lift. A fort taken is weak and restless for a month, and a kingdom holds what it took before it reaches for more.',
        'When you storm a fort you besiege, choose Storm the walls to fight it, or Simulate. On the walls, the only ways up are the ladders (one for each day of preparation, three at most) and the gate once a ram (after three days) has broken it: keep soldiers at the gate and it gives way. A ladder takes two at a time, climbing is slow, and nobody can strike from a ladder: the rest wait at its foot. You meet the part of the garrison on the stretch of wall you strike, as one army with its reserves behind it. Your infantry go for the ladders and your archers stay behind them. Hold the courtyard, or rout the defenders, and the fort is yours; thrown back, you lose men but nothing else. If you are inside a fort when it is stormed, you defend its walls with most of its garrison beside you, fighting for itself.',
        'The lords have needs (land, coin, men, safety for their lands, a name to make) and long memories: what you did to them, and half of what you did to their kin. The Realm screen’s Lords tab shows each one: what they hold, their kin, friends and rivals, what they want most, where they are, and what they think of you and why. Ask… a lord to join your siege, relieve your fort, ride with you for three days or back your claim: they agree, name a price (or a favour), say when they can come, or refuse, and tell you why: the crown you share, what you have done for them, how far it is from their lands and what threatens them, and whether they fear you. A refusal holds for a week. Lords quarrel among themselves too: friends who fought together back each other at court, rivals who wanted the same grant, feuds over a fief taken; one who thinks too little of their ruler grumbles at court, and a week later leaves for another crown, as you would. Lords help each other too: a lord short of men asks a friend or kinsman for some; a landless one asks the crown to press a claim, and rides unsummoned to a siege that could win land; a lord held by another crown is ransomed by their kin, from their fiefs, and remembers who held them. A lord who thinks well of you may send a petition (clear bandits from their lands, a loan, a ransom for their kin, your word at court, or an escort for their own caravan): answer it on the Lords tab. As a sworn vassal you are summoned to your crown’s sieges: be there before it ends, or it is a call missed.',
        'You can lose land: a siege takes it (a castellan walks out of a surrender, but is taken with a fort stormed until you win it back); your liege takes a fief back if you miss a second call (after a warning at the first); leaving a crown costs your fiefs; or you hand one back yourself on the Fief tab. Your company, money, mill and followers are always yours. Land lost against your will leaves a claim, and the tab becomes Claims when you hold nothing: each claim, how it came about, who holds it now and what could press it. Retake it by siege, and if your liege backs the claim it is yours again with the villages you held. Ask your liege to press it in their war, or, at peace, buy it back from the crown that holds it, or serve that crown for it: win four battles against its enemies within 30 days, never touching its people, and it is handed back. A claim on land your own crown holds becomes a grant offered to you; one held by a lord of your own crown is refused while you are sworn. A claim pays nothing.'
      ]
    },
    towns: {
      id: 'towns',
      stage: 'captain',
      order: 4,
      title: 'Towns and villages',
      body: [
        'Every place opens on its menu: hire, buy food, rest, trade, take contracts and talk to people. Every capital and free city also has streets of its own: Walk the streets to stroll around, tap a person to walk over and talk (or use the joystick and TALK), Town menu to get back, and walk to "To the road" to leave. In each you will find an innkeeper, a merchant, a recruiter and someone who speaks for the town.',
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
      stage: 'captain',
      order: 5,
      title: 'Battle',
      body: [
        'When a band catches you, or you ride at one, choose: Attack fights the battle yourself; Auto-resolve rolls it from your strength; you can also pay a toll, threaten weaker bands, or try to slip away. Each button shows the odds.',
        'In battle you fight in person. Swings hit what is in front of you; a shield blocks hits from the front only. Your soldiers follow orders by group: Follow keeps them near you, Hold keeps them where they stand, Charge sends them at the nearest enemy.',
        'Soldiers fight as groups. On Follow they keep loose ranks around you, infantry ahead and archers behind. Footmen, Guards, Legionaries, Mercenaries and Sellswords raise their shields at a blow from the front, and a raised shield also covers the friend just to its left: hold Block beside a companion to protect them too. Spearmen and Legionaries stop a cavalry charge that comes at their spears. Archers only shoot when no tree or wall is in the way.',
        'Groups on both sides have morale. Heavy losses, being outnumbered, blows from the flank or behind and friends running nearby shake a group; veterans and having you close by steady it. A shaken group wavers (it hits a little lighter), then falls back, and at last routs: it runs off the field and stops fighting. Enemies who flee count as beaten but leave less to loot. Your soldiers who flee come back after the battle unhurt. Rally (R, or in Orders) steadies every soldier near you and turns back those running, once every 30 seconds. Nothing about it is luck: the same fight goes the same way. If you fall, your sergeants take over and the whole company charges. An enemy that falls back and is left alone gives up the field, and if nobody can close for long the enemy slips away, so a battle always ends.',
        'A battle can draw in others nearby. Road Reavers within earshot join their own kind; a kingdom’s patrol helps you only if that kingdom counts you a friend, and comes for you if it is Hostile. They ride in from the side of the field they come from: an hour away on the map is about ten seconds of battle. Those your company can already see are named before you fight; others are announced shortly before they arrive. If the battle ends first, they arrive too late. Enemies cut down by those who came to help are theirs, not yours. Auto-resolve counts the help that would arrive in good time.',
        'Only so many fight at once (Settings → Battle size, from 20 to 200); the rest wait in reserve and step in as others fall. A band or a lord you meet on the map fights as one army: the field is shared by the two sides’ numbers (300 against 200 at a size of 100 fight 60 against 40, never fewer than 10 a side), and both send in their reserves from behind their own line as men fall, keeping their share. Prepare says how it is shared. A party that rides in joins its side’s reserve. A lair or a story fight still comes in waves.',
        'Your company fights in divisions: by default one for the infantry, one for the archers and one for the cavalry, and a second of a kind once you have more than 30 of it. Command them as deeply as you like; none of it is needed to win a fair fight. 1, no orders: the Auto setup on the Prepare screen picks a plan from the odds (forward when you are much the stronger, a shield wall that holds when you are the weaker). 2, orders: ORDERS (or 1–6, F, H, C) gives each division Follow, Hold or Charge, and a formation: loose, shield wall, wedge, line, column or square (a square holds off horse from every side, but moves slowly). 3, on the Prepare screen open Divisions: a captain for each (a veteran of tier 3 with 10 battles, or a companion) steadies it and speeds it a little; choose its formation and facing, move a troop type to another division (a single soldier from their card on the Party screen), rename it, and keep up to three plans of your own. 4, on the tactical map (MAP): pick a division, then Move, Charge, Fall back or Face and tap the field; set it for now, in 5 or 10 seconds, or for when your archers next loose, and several go off together. An enemy army plans the same way.',
        'Bigger battles need a quicker device. If a battle runs slowly, its result offers a smaller size once; it never changes by itself. In a battle of more than 80 at once, the fallen fade from the field after a while, there are no hit rings, and health bars show only over the badly hurt, so the field stays readable.',
        'Formations and what each order is doing: see Orders and formations.',
        'The ground matters. On hills, archers standing on a rise shoot a quarter further (yours start on the knoll and hold it), and so do enemy archers on theirs. In a ford the shallows slow everyone.',
        'Escort ambushes: when Reavers spring on a caravan you are escorting, its wagon is on the field behind you, and some of them burst from cover on your flank to burn it. Your soldiers go back for raiders at the wagon by themselves. If it burns, or you lose the fight, the caravan and the contract are lost, even if you win.',
        'Before you fight, choose a setup: Balanced (the default), Defensive, Aggressive, or Custom, where you drag each group’s flag inside the zone and pick its first order. Simulate settles the fight from your strength and explains the odds (your soldiers count half as much again for fighting in ranks, and numbers count twice over, so the stronger side usually wins; fighting it out yourself does a little better if you fight well, and usually costs fewer soldiers). The enemy keeps a loose line and goes for archers, the wounded, and a hero who strays from the company. Tick Skip this screen to go straight in with your setup next time (Settings → Before battles turns it back on). When a band ambushes you, there is less room to form up.',
        'On a large battlefield the view follows you. The small map at the top shows your company and the enemies your soldiers have seen (red; faded where they were last seen); tap it to look there for a moment. MAP (or hold Tab) opens the whole field with the battle held still: pick a group in Orders, then tap where it should go and hold. You never have to use it.',
        'On a large battlefield you can also zoom: pinch the field with two fingers (or use the mouse wheel) for anything from 0.75× to 1.5×, or press the zoom button (Z) to switch between 1× and 0.75×. One finger on the field does nothing, so a pinch never swings, moves you or sends anyone. Zoom only changes what you see: your company spots enemies and fights exactly as at 1×. Pinching in again at the widest zoom opens the whole field; spreading your fingers there closes it. The game remembers your zoom on this device.'
      ],
      controls: [
        ['Joystick', 'WASD / arrows', 'Move'],
        ['ATTACK', 'Space / left click', 'Swing'],
        ['Hold BLOCK', 'Shift / right click', 'Block (a shield, or a two-handed weapon or spear)'],
        ['The badge on ATTACK (or a swipe)', 'Q', 'Bring your second weapon to hand (if you carry one)'],
        ['ORDERS → Dismount', 'X', 'Get off your horse (no getting back on)'],
        ['ORDERS → group', '1 / 2 / 3', 'Infantry / Archers / Cavalry'],
        ['ORDERS → order', 'F / H / C', 'Follow / Hold / Charge'],
        ['ORDERS → Rally', 'R', 'Steady the soldiers near you (every 30 s)'],
        ['Tap the small map', 'Click the small map', 'Look there for a moment'],
        ['MAP', 'Hold Tab, or M', 'Tactical overview: send a group to a spot'],
        ['Pinch, or the zoom button', 'Mouse wheel, or Z', 'Zoom the battle (large fields)'],
        ['Pause', 'Esc', 'Pause']
      ]
    },
    orders: {
      id: 'orders',
      stage: 'captain',
      order: 5.2,
      title: 'Orders and formations',
      body: [
        'You never need formations: loose ranks are the default and Auto chooses for you. Choose one in ORDERS for the selected division, or on the Prepare screen.',
        'A formed division keeps its places. On Hold each soldier fights only what comes close to their place and steps back into it; on Follow they keep their places beside you and break off only for a foe that close. Charge leaves the places and goes for the enemy. Loose soldiers on Hold go for anything near them.',
        'Each formation has a strength and a weakness. Loose: spread out, so arrows find fewer of you, but nobody covers anyone. Shield wall: shoulder to shoulder on Hold or Follow, shields up whenever a foe is in front, every shield covering the ones beside it and taking part of their blows, so a wall holds far longer than one shield; slow, and weak on its flanks. Line: a wide front that meets one foe a place, so a sword cannot catch several of you at once; weak on its flanks. Wedge: a point on Follow or Charge, quicker, and its first blow into a formed line breaks the ranks it strikes for a few seconds. Column: narrow and quick on the march, it keeps its shape among trees, but is weak from the side. Square: a ring facing every way that stops horse from any side, and has no flank; very slow.',
        'Flanks: a blow from the side or behind a formed division lands harder and shakes it more than one from the front. Turn a division to face (on the tactical map) where the danger comes from.',
        'Ranks: ORDERS shows how much of a formed division is in its places. Below half, the ranks are broken and the formation helps nobody until they close up again; its flag over it is frayed. A division of fewer than four stays loose. Wading a ford breaks every formation, and thick trees every one but a column.',
        'Every order shows what it is doing: in ORDERS beside the division’s name, and by the mark on its flag over it on the field and on the small map: a square holding, a ring following, an arrow moving, a double arrow charging, a cross engaged, an hourglass waiting for its time, a tick done, and ! when it can’t, with the reason in ORDERS.',
        'Long weapons, spears and pikes, do best in a held line: their points keep shorter blades at bay. In a loose scrum a sword, catching several at once, does better.'
      ]
    },
    fighting: {
      id: 'fighting',
      stage: 'captain',
      order: 5.5,
      title: 'Fighting',
      body: [
        'Every weapon has its own rhythm: a windup (it rises), a short strike (only then does it hurt), and a recovery. A sword is quick and middling in reach; an axe and a mace are shorter and slower; a greatsword or greataxe reaches further and hits harder, but takes longer to recover; a spear reaches furthest and strikes narrowly. Your reach, your speed with it and your walking pace are your own, from your weapon and your armour.',
        'A swing that hits nobody takes longer to recover. Holding Attack still works against weak foes, but against a patient one it gives them openings: step out of reach while they wind up, and strike while they recover.',
        'A blow strikes the nearest in front of you; a sword can catch up to three, the second and third a little less, an axe or mace one, a greatsword three.',
        'A blow that lands while someone is winding up can interrupt them, if it is heavy enough for them: a mace or greataxe interrupts almost anyone, a sword only the unarmoured, and two-handed fighters are hard to shake. Nobody can be interrupted twice in quick succession, and repeated hits push less each time.',
        'A shield stops blows from the front, but every blow it stops wears it down; enough of them break the guard and lower it for a moment. Axes press hardest. The Shield skill lets it take more, recover sooner and cover a little wider. Shield troops raise theirs a moment after they see a blow coming, quicker the better they are, and never while they are swinging themselves.',
        'What you wear and wield is your load (Party shows it, against what your Strength carries easily). Light costs nothing; medium slows you a little; heavy makes you slower to walk, to get going and to recover after a blow; too heavy, much slower. Agility lessens all of it. Armour still protects, and mail steadies you against blows that would interrupt you. A mace hits through some of the armour. Your pack never counts, nor your horse.',
        'With a two-handed weapon or a spear and no shield, Block raises the weapon: it takes part of a frontal blow, in a narrower arc. Each weapon is trained by its skill (One-Handed, Two-Handed or Polearm): more damage and a slightly quicker recovery a point.',
        'You will hear and read what happened: a miss, a blow out of reach, a block, a broken guard, an interruption. A glint on a weapon tip warns you of a blow being wound up at you.'
      ],
      // P11-09: by stage, as a fighter meets each.
      sections: [
        { title: 'Your first fight', body: ['Move with the joystick (WASD), tap ATTACK (Space or the left button) to strike, and hold BLOCK (Shift or the right button) to raise your shield. Strike when they have missed, not before; a glint on a weapon means it is coming at you.'] },
        { title: 'Your second weapon', body: ['Carry a second weapon from the Party screen, and choose which one a battle starts with. In battle, the small badge on ATTACK’s edge shows it: tap it, or press Q, to bring it to hand (Settings can make it a swipe across ATTACK). It takes a moment and never comes mid-swing; a two-handed weapon slings your shield on your back.'] },
        { title: 'Bows', body: ['Hold ATTACK to draw and let go to loose; the ring under a foe shows your target (Settings: assisted aim, or the mouse pointer, or a finger on the field). See Bows and crossbows.'] },
        { title: 'Horses', body: ['A battle horse carries you in where the field allows. It turns at its own rate and gathers speed: turn early, keep moving, and keep away from braced spears. Dismount in Orders (X). See On horseback.'] },
      ]
    },
    archery: {
      id: 'archery',
      stage: 'captain',
      order: 5.6,
      title: 'Bows and crossbows',
      body: [
        'With a bow in hand, hold ATTACK to draw and let go to loose; a quick tap looses as soon as the bow is drawn. A ring round you fills as you draw. You walk at half pace while drawing, and your shield is slung on your back.',
        'The game picks the target for you: the nearest foe in front of you with a clear shot, or the one you last shot, shown by a ring of marks under them, and it aims ahead of anyone moving. On a computer you can aim with the mouse pointer instead (Settings); on a phone, a setting lets you drag a finger on the field to aim while the other thumb moves.',
        'A shot flies true to its range and then weakens, and falls at the end of its flight: a shortbow is quick and short, a longbow far and slow to draw, and poor in heavy armour. A crossbow loads itself while you stand still, then a press looses it: slow, but flat, fast, and it goes through some armour. Strength loads it faster; Archery draws a bow faster, aims truer and hits harder.',
        'You have a quiver for each battle (a Full Quiver in your quiver slot adds to it), filled again after: arrows are never bought. Your count is beside your health. When it runs out you draw your other weapon, or fight with your fists if you carry none. Switching weapons loses a draw or a crossbow’s reload.'
      ]
    },
    horseback: {
      id: 'horseback',
      stage: 'captain',
      order: 5.7,
      title: 'On horseback',
      body: [
        'With a horse trained for battle in your horse slot (a Rouncey, a Courser or a Destrier; a Nag only carries you on the road), you ride into battle where the field allows: not onto walls, into a courtyard or in the lists. Prepare says whether you will ride, and lets you choose to fight on foot.',
        'The stick steers: the horse turns toward it at its own rate and gathers speed while you hold a direction; let go and it slows. At a gallop you ride through foot soldiers, and a blow lands harder; a lance does its damage only from a moving horse. Braced spears and squares stop a charge and hurt the horse and rider.',
        'Each horse is different: the Courser is the fastest and frailest, the Destrier the heaviest, slowest to turn and hardest to bring down. Half of every blow that lands on you falls on your horse; if it goes down you are thrown and fight on foot (it is fine after the battle). Dismount (Orders, or X) puts you on foot for the rest of the battle: there is no getting back on.',
        'Some weapons don’t suit the saddle: a greatsword and a shortbow work less well, a greataxe, a pike, a longbow and a crossbow not at all (you fight on foot with them). A gallop throws a bow’s aim. Riding turns and gathers the horse faster and eases those penalties, and the better horses need it.'
      ]
    },
    party: {
      id: 'party',
      stage: 'captain',
      order: 6,
      title: 'Your company',
      body: [
        'Everyone you hire takes a slot, eats a ration a day for every five people, and draws a weekly wage. Food follows the price of grain: a little cheaper among the farms, dearer up in the highlands. Hungry or unpaid soldiers lose morale; at very low morale they desert.',
        'Fallen soldiers are wounded or killed. The wounded sit out battles for about two days. Soldiers gain experience and can be upgraded for crowns in the Party screen; Leadership and renown raise how many you can lead.',
        'How many you can lead, up to 200: 8, and 5 for each point of Leadership, 1 for every 20 renown, 10 for each companion who rides with you as an officer, 15 for each fort or town you hold and 5 for each village, and 2 while a kingdom counts you Friendly. The Party screen shows the sum. A bigger company costs more in wages and food, every week, and earns more: a contract’s band or ambush is matched to your company, and a big company is offered bigger work for bigger pay; a kingdom pays its mercenaries their soldiers’ wages and a tenth more. A recruiter hires five at once once you have the room. With more than 20 soldiers the Party screen groups them by troop: tap a group to see who is in it. Beyond the Border March the bands, patrols and caravans are bigger, and every lord rides with a household of dozens.',
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
    character: {
      id: 'character',
      stage: 'captain',
      order: 6.4,
      title: 'Your character',
      body: [
        'Experience comes from battles and contracts. Each level gives a skill point, and each even level an attribute point as well; Party shows what you have to spend. Levels come quickly to 10 and more slowly after, up to 20: a long campaign gets there.',
        'Attributes start at 5 and your origin adds 1 to one of them. Strength gives health (5 a point) and is what heavy weapons, heavy armour and crossbows need. Agility will give a quicker recovery after each blow and less slowing in armour (from 5.5.0 and 5.6.0). Intelligence adds experience; Charisma opens some of what people in the story ask of you.',
        'Skills start at 0, with 1 from your origin. One-Handed adds 3% damage a point; Two-Handed, Polearm, Shield, Archery and Riding will each make their weapons and horses work better as the coming updates arrive (Party says from which). Leadership leads more soldiers, Tactics improves simulated battles, Pathfinding speeds travel and Trade lowers prices.',
        'Some gear needs a little Strength or skill before you can use it: the better weapons, shields and armour of the towns and the rarest pieces. Party and the armoury say what a piece needs, what you have and how to get there. Ordinary gear needs nothing, and you can spend your points however you like without losing a usable weapon, shield or horse. What counts is your own: points, your origin, the story and training, never a ring or a companion’s help.'
      ]
    },
    gear: {
      id: 'gear',
      stage: 'captain',
      order: 6.5,
      title: 'Your gear',
      body: [
        'You can carry two weapons: equip one as your weapon and another as your second weapon (Carry second, in Party). A battle starts with the one you choose on the sheet; SWITCH (Q) brings the other to hand in a moment, and neither is ready again any sooner for it. A weapon that needs both hands, or a bow, slings your shield on your back until you switch back.',
        'Party and the armoury say in words what a piece of gear means for you: what it can’t do, what it needs, what it does less well, and anything you might not expect. You can still buy a piece you can’t use yet, after a second tap.',
        'Look for “Made here” at town armouries and open the gear notes on a soldier’s card to find the local arms.',
        'A piece you don’t yet meet the needs of is never taken from you: it stays on you or in your pack, and in battle it stays with the baggage. A weapon you can’t wield yet gives way to your other one, or to your fists if neither will do, and the battle says so.'
      ]
    },
    masters: {
      id: 'masters', stage: 'captain', order: 6.7, title: 'Masters at arms',
      body: [
        'The armoury names the master for a specialist weapon. When you are ready, listen for word at the inn or in the Journal.',
        'Speak to the master, pay for the lesson and try the drill. Rest a day after a failed attempt. You can try again on the same fee.',
        'Choose Practice in a town with a yard to spar, shoot or ride. Practising costs nothing. A master can also return the points you spent for a fee.'
      ]
    },
    trade: {
      id: 'trade',
      stage: 'captain',
      order: 7,
      title: 'Trade and contracts',
      body: [
        'Six goods are cheap where they are plentiful and dear where they are short. Caravans that arrive make a good cheaper; caravans the Reavers rob make it dearer. Market talk on the Trade screen says what moved prices. Cargo slows your march.',
        'Every town posts contracts: hunt a marked band, escort a caravan (it only rolls while you ride beside it), or deliver goods or a letter. One contract at a time; each shows its reward and time limit, and failing one costs renown. Finished work wins favour with the town’s kingdom.'
      ]
    },
    story: {
      id: 'story',
      stage: 'captain',
      order: 8,
      title: 'Story, reputation and news',
      body: [
        'Four quests lead to the fate of the story’s fort (Greywall, begun in Valedorn). The Journal lists them with the next step in gold, the company chronicle (your own story: who joined, who was promoted, notable battles, who fell, quests done), the happenings you know of and the regional news.',
        'Besides the story there are a few small errands, marked as such in the Journal and never needed: your start town’s elder may want to feast a veteran born there; its recruiter can teach you to keep full larders with a quartermaster, and later to fight a dug-in band to a plan; the rival town’s caravan master will start you on a merchant’s first venture; and your kingdom’s envoy has raiders on the border where a watch of its own will ride to your aid.',
        'Things happen in the world as it changes, and the news tells where: a food shortage where grain is dear, Reavers loose in a village’s fields (with a bounty), a militia asking to be drilled where a kingdom is at odds with its neighbours, a courier stuck with a letter, refugees near a war. In that settlement each has a card with one decision, to take part or not, and says what happens if no one helps: grain staying dear, farms plundered, or, if you were asked and rode on, a little reputation. Each lasts a few days and ends once; what your company had a hand in goes into its chronicle. The same thing does not come back to a region for a while, and none of it ever stands in the story’s way.',
        'The great towns (Stonebridge, Eastwatch, Hrothgard, Vessara and Merrow) each hold a tournament every two weeks, told in the news; entries stay open three days. Eight fighters on foot, three bouts: you fight each one yourself, alone, in tournament gear (your own stays in your pack and can never be lost there). Each round is harder. Entry costs a fee that rises with your renown. The champion wins crowns, renown and the host’s goodwill; the finalist less; falling in the first bout costs a little renown, never your company. Whoever beats you becomes your rival and may turn up in later tournaments, met only in a final. You can enter the same town again only after four weeks, and each win there is worth less than the last. A bout left unfinished counts as lost.',
        'Each kingdom sees you as Friendly, Neutral or Hostile. Helping it raises that; attacking its patrols or caravans lowers it. Friendly gives two extra party slots; Hostile means its patrols hunt you.',
        'Mara, a former imperial scout, may join you after the second quest. After the ending the March goes on: work, trade and the border’s quarrels continue.',
        'Beyond the March, three more companions wait, each in their own land: Sigrun in Hrothgard, Iacopo in Vessara and Livia in Tessaro. Talk to them; each joins after a small errand of their own. With you they take a party slot, eat, draw a weekly wage, fight beside you (wounded, never killed, when they fall), lend a skill while fit and can captain a patrol. Each has a loyalty shown on the Party sheet, with what they care about. It moves for reasons you can see: paid wages and victories raise it, missed wages and defeats lower it, and so does what you do: Sigrun hates paying Reavers to pass, Iacopo hates a late wage, Livia hates attacks on a kingdom’s patrols and caravans. Unhappy, they warn you and say why; if it goes on, they leave for good, but never without warning.'
      ]
    },
    saving: {
      id: 'saving',
      stage: 'captain',
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
        'Everything you see is drawn in code, made for this game: the soldiers, towns, battles, the map and the interface. Sound effects and music are synthesized live in your browser.',
        'No third-party art, music, fonts or libraries are used, and the game loads nothing from other sites.'
      ]
    },
    rule: {
      id: 'rule',
      stage: 'ruler',
      order: 11,
      title: 'Your realm',
      body: [
        'Hold a fort of your own and you may found a realm there. A fort comes as a grant from your liege, or, with no crown behind you, by retaking one you claim: then it is yours, held of no realm, recognised by nobody, and any realm may besiege it. With 600 renown and 40 soldiers, declare a realm from it on the Realms screen, Your realm tab. Your holdings go with you; the crown you held them of keeps a claim on each, and has 7 days to accept your realm or go to war. Other realms recognise it or not, by their trust and what their rulers think of you; one that doesn’t may besiege your forts as if at war.',
        'You rule as you ride. Your three officers run the realm by a policy each, set in a line: the steward the taxes on your land (grow, hold or hoard), the marshal its sieges (defend, peace, or expand toward a realm), the chancellor its treaties (accept peace, alliances too, or nothing). Only what needs you comes as a message: a treaty offer and what your chancellor did with it, a lord asking to swear to you, your seat besieged.',
        'Make treaties of your own on the same tab: a truce or peace with a realm at war with you, an alliance against a common enemy, trade or a pact with one at peace. Their ruler answers at once, by their trust in you and what they think of you. You may break a treaty too, but every court hears of it and trusts you less. The old crown answers your realm before it besieges it; land you hold is yours to grant, never your court’s.',
        'Lords who think ill of their own ruler and well of you ask to swear to you: accept and they are your vassals, with their fiefs left behind. You grant them land and summon them to a siege as any ruler does, and they answer by what they think of you. Lords of other realms may found realms of their own too: one with land, men and a grudge against their ruler.'
      ]
    },
    armies: {
      id: 'armies',
      stage: 'lord',
      order: 12,
      title: 'Armies',
      body: [
        'A realm at war raises an army: its marshal calls up to six lords, and each answers by what they think of the ruler. They gather at the realm’s fort nearest the target, and march when half have come, or after a week. On the map an army is one banner with its size. Each lord keeps their own men, and their own losses.',
        'The marshal chooses what it does: besiege a fort, relieve one of its own, raid a village (its prosperity falls, the raiders take a week of its tax, and its lord remembers), chase an enemy army, defend, or fall back. Two armies that meet fight it out. The beaten one falls back, or breaks up if it lost half its strength, and some of its lords are taken. Only an army can take a capital; then the ruler moves to their next holding, and a realm that holds nothing is gone.',
        'An army eats. In its own land it fills its stores; in enemy land it forages, and the villages it passes suffer; with nothing to forage and no food left, its men desert, from the furthest first. It costs its realm a crown a soldier a week, and an unpaid army breaks up after a week. After a month in the field it goes home.',
        'As a vassal you are summoned: the Allegiance tab shows the army, with a button to ride to its banner. Near its banner you ride with it, and its battles are yours: both armies’ lords ride into the field. As a ruler, raise your own army on the Your realm tab: your lords ride with you, and you give the orders: besiege or raid a place, ride with you, or go home.'
      ]
    },
    houses: {
      id: 'houses',
      stage: 'lord',
      order: 13,
      title: 'Houses',
      body: [
        'Every lord belongs to a house: their parents, children and siblings, under the eldest’s name. A house keeps its name and its people even when it loses all its land. Lords think of a house as of its people, and also remember what was done to the house itself. Once you hold land you found a house of your own, in your name; rename it at the top of the Lords tab.',
        'A marriage joins two houses. Propose one from the Lords tab (Ask…, then Propose marriage): the one you ask answers by what they think of you and your house, what the match is worth to their house, and the dowry you offer. They give their reasons. Married, you share each other’s claims, and the two houses are allies: each answers the other’s call more readily. Your spouse may ride with you or run one of your holdings, and may refuse. After 90 days either of you may end the marriage, and the houses become rivals. Lords marry among themselves too.',
        'Lords can die: now and then of wounds after a lost battle (you never do). Their land and office pass by their realm’s law: to the eldest child, to the kin the lords think best of, or to the council’s choice. A close second keeps a claim, and may raise a faction. With no heir, the crown takes the land and grants it. A claim outlives the one who held it: it passes to the heir or the house, and a claimant may petition their liege to restore what the crown holds.'
      ]
    }
  };

  C.tips = {
    // P10-07: the beginner guide, in its order (guide: true); then the hints.
    settlement: { id: 'settlement', guide: true, on: 'settlement', help: 'party', title: 'Towns and villages', text: 'Its people are under Talk to: they have work, news and the story. In a town, Walk the streets to meet them face to face. Hiring, food and the market are on this menu too.' },
    town: { id: 'town', guide: true, on: 'town', help: 'towns', title: 'In the streets', textTouch: 'Tap a person to talk. The town menu sometimes offers Practice. Walk to "To the road" to leave.', textKeys: 'Click a person to talk, or walk with WASD and press Space. The town menu sometimes offers Practice.' },
    hire: { id: 'hire', guide: true, on: 'settlement', when: 'canHire', help: 'party', title: 'Hiring', text: 'Hire soldiers with the Hire buttons: each costs crowns now, then eats and draws a small weekly wage. Two or three will do to start; Party shows who you have.' },
    map: { id: 'map', guide: true, on: 'map', help: 'map', title: 'The map', text: 'Tap a place to travel there; time passes as you ride. Your Journal says where your work is.' },
    lowFood: { id: 'lowFood', guide: true, on: 'map', when: 'lowFood', help: 'party', title: 'Food', text: 'Your company eats every day, a ration for five. Buy food in any town or village (Buy food on its menu): hungry soldiers lose morale and may desert.' },
    encounter: { id: 'encounter', guide: true, on: 'encounter', help: 'battle', title: 'An encounter', text: 'Attack to fight it yourself, or Auto-resolve to roll it from your strength. You can also pay, threaten or try to slip away — each button shows the odds.' },
    battle: { id: 'battle', guide: true, on: 'battle', help: 'battle', pause: true, title: 'Your first battle', textTouch: 'Joystick to move, ATTACK to swing, hold BLOCK to raise your shield (front only). ORDERS: pick a group, then Follow, Hold or Charge.', textKeys: 'WASD to move, Space or left click to swing, Shift or right click to block (front only). 1–3 pick a group; F, H, C order Follow, Hold, Charge. Esc pauses.' },
    save: { id: 'save', guide: true, on: 'map', when: 'secondDay', help: 'saving', title: 'Saving', text: 'The game saves itself in this browser as you play. Browsers can clear it, so keep a copy now and then: Settings, then Save & export (it also moves your game to another device).' },
    prepare: { id: 'prepare', on: 'prepare', help: 'battle', title: 'Prepare for battle', text: 'Balanced suits most fights: just press Fight. Simulate settles it from your strength and shows why. Defensive and Aggressive set different starts, and Custom lets you drag each group’s flag inside the green zone.' },
    reserves: { id: 'reserves', on: 'battle', when: 'reserves', help: 'battle', title: 'Reserves', text: 'Not everyone fits on the field at once. The rest wait in reserve and step in as others fall — see Reserves on the HUD.' },
    captured: { id: 'captured', on: 'result', when: 'captured', help: 'start', title: 'Captured', text: 'A lost battle costs some crowns and gear, never the game. You are let go near a settlement; rest, hire and try again.' },
    trade: { id: 'trade', on: 'trade', help: 'trade', title: 'The market', text: 'Goods are cheap where plentiful and dear where short: buy low here, sell somewhere else. Cargo slows you down.' },
    contracts: { id: 'contracts', on: 'contracts', help: 'trade', title: 'Contracts', text: 'One job at a time: hunt a band, escort a caravan or deliver. Each shows its reward and time limit; failing costs renown.' },
    draw: { id: 'draw', on: 'battle', when: 'bowInHand', help: 'archery', title: 'Drawing a bow', textTouch: 'Hold ATTACK to draw, let go to loose. The game picks the target (the ring under them); a tap looses as soon as you have drawn.', textKeys: 'Hold Space or the left button to draw, let go to loose. The game picks the target (the ring under them), or aim with the mouse pointer.' },
    whiff: { id: 'whiff', on: 'battle', when: 'whiff', help: 'fighting', title: 'A miss costs time', text: 'A swing that hits nobody takes longer to recover. Step in until they are in reach, or wait for their own swing to miss and strike while they recover.' },
    shieldPressure: { id: 'shieldPressure', on: 'battle', when: 'shieldPressure', help: 'fighting', title: 'Shields give way', text: 'Every blow a shield stops wears it down; enough of them break the guard and lower it for a moment. Axes press hardest. Strike while it is down.' },
    switch: { id: 'switch', on: 'battle', when: 'secondWeapon', help: 'fighting', title: 'Your second weapon', textTouch: 'Tap the badge on ATTACK (it shows your other weapon) to bring that weapon to hand. It takes a moment, never mid-swing. Settings can make it a swipe.', textKeys: 'Q brings your other weapon to hand. It takes a moment, and never mid-swing; a bow’s draw is lost.' },
    riders: { id: 'riders', on: 'battle', when: 'riders', help: 'horseback', title: 'Riders turn slowly', text: 'A horse gathers speed and turns wide. Step aside as a rider comes and strike as it passes; spears held still stop a charge. On horseback, keep moving and turn early.' },
    character: { id: 'character', on: 'character', help: 'party', title: 'Party and gear', text: 'Equip what you find, spend skill and attribute points, and upgrade soldiers who have earned it.' },
    ransom: { id: 'ransom', on: 'ransom', help: 'lands', title: 'A ransom', text: 'A lord you beat is your prisoner. Accept the ransom, hold them for later (they may slip away), or let them go for nothing: renown, and a lord who remembers it.' },
    allegiance: { id: 'allegiance', on: 'contracts', when: 'atCapital', help: 'lands', title: 'Service and fealty', text: 'A capital’s board also offers Service: a month as the kingdom’s mercenary, paid weekly. Serve it well and you may swear fealty. Each card says first what will change and what stays yours.' },
    grant: { id: 'grant', on: 'grant', help: 'lands', title: 'A grant of land', text: 'Your liege offers you a holding. Accept it and it runs itself, with one line a week; the Realm screen’s Fief tab shows it. Decline and the crown grants it to someone else.' },
    siege: { id: 'siege', on: 'siegeAlarm', help: 'lands', title: 'Under siege', text: 'Your fort is besieged. Ride back to fight beside it, or leave it to the one who runs it: they hold while the food lasts and the odds are not hopeless.' },
    petition: { id: 'petition', on: 'realm', when: 'petition', help: 'lands', title: 'A petition', text: 'A lord asks you a favour, with a reward and a day to answer by. Accept or decline it at the top of the Lords tab: either way they will remember.' },
    realm: { id: 'realm', on: 'realm', help: 'lands', title: 'The Realms', text: 'Who holds every town, fort and village, and the lords of each kingdom. When a fort falls its villages go with it, and the old lord keeps a claim. Each realm’s card also shows its treasury, its laws and its officers: a realm with an empty treasury can’t hire you.' },
    diplomacy: { id: 'diplomacy', on: 'realm', when: 'diplomacyTab', help: 'lands', title: 'Diplomacy', text: 'Each pair of realms: at peace, in tension or at war, the treaties between them with their end days, and how far each trusts the other’s word. Realms that break treaties find fewer partners. As a vassal you are bound by your realm’s treaties.' },
    rule: { id: 'rule', on: 'realm', when: 'ruleTab', help: 'rule', title: 'Your realm', text: 'Hold a fort, win 600 renown and gather 40 soldiers, and you may declare a realm there. Once you rule, your officers run it by a policy each: set them here and keep riding. Lords who ask to swear to you wait here too.' },
    journal: { id: 'journal', on: 'journal', help: 'story', title: 'The Journal', text: 'Your quests, with the next step in gold, your company’s chronicle, and the regional news.' },
    saves: { id: 'saves', on: 'saves', help: 'saving', title: 'Keep a copy', text: 'The game saves itself in this browser, but browsers can clear it. Export a copy now and then — it also moves your game to another device.' },
    speed: { id: 'speed', on: 'map', when: 'originDone', help: 'map', title: 'Map speed', text: 'Time on the map runs at Normal speed, an hour a second. The ▶ button beside the zoom makes it Fast, four hours a second, and tapping it again slows it back. Wait lets whole days pass at once.' },
    points: { id: 'points', on: 'map', when: 'points', help: 'party', title: 'Points to spend', text: 'You have skill or attribute points to spend. Open Party: Leadership lets you lead more soldiers, One-Handed hits harder, and Party says what each does and what your points would unlock.' },
    beyond: { id: 'beyond', on: 'map', when: 'awayFromHome', help: 'lands', title: 'Beyond the March', text: 'A new land, with its own kingdom, troops and prices. Its capital posts contracts and someone there has work for you. Zoom out to see the whole realm; Centre brings you back.' },
    wounded: { id: 'wounded', on: 'map', when: 'wounded', help: 'party', title: 'Wounded soldiers', text: 'The wounded sit out battles for about two days. Resting in a settlement passes the time safely.' },
    fief: { id: 'fief', on: 'realm', when: 'fiefTab', help: 'lands', title: 'Your fief', text: 'What you hold, how it is doing and what it pays: prosperity, its garrison and its policies. It runs itself, with a line a week; set its policies here.' },
    army: { id: 'army', on: 'map', when: 'summoned', help: 'armies', title: 'Summoned to the army', text: 'Your liege calls you to ride with the army. Its banner is on the map: ride to it, and near it its battles are yours. The Allegiance tab shows where it gathers.' },
    houses: { id: 'houses', on: 'realm', when: 'lordsTab', help: 'houses', title: 'Lords and houses', text: 'Every lord belongs to a house, and lords remember what was done to their kin. Ask… opens what you can do with a lord: a marriage joins two houses.' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
