/* Crownless content: help. Plain classic script; no modules, no fetch.
 * help_topics: the How to Play screen (GDD §11 "initial mappings are documented in Help"), in order.
 *   Each topic has paragraphs and, optionally, controls: [[touch, keyboard/mouse, action], …].
 * tips: first-time tips (Gate E tutorial). Each shows once per device, the first time its moment comes:
 *   on: the screen (map, town, settlement, encounter, battle, trade, contracts, character, journal,
 *       saves, result), and optionally when: a situation js/tips.js knows (lowFood, points, wounded,
 *       reserves, captured). text, or textTouch + textKeys when the controls differ.
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
        'You are a wanderer on the Border March, where two crowns claim an empire that is gone. Earn a name with your sword, hire soldiers, and decide who Greywall belongs to — or whether it belongs to either.',
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
        'Roads are fastest, forests slowest; heavy cargo slows you too. Patrols and caravans keep the peace and the trade going; Road Reavers prey on both, and on you if you look weak.',
        'Wait lets time pass where you stand. The panel at the top left shows the day, your crowns, soldiers, food, morale and current quest.'
      ],
      controls: [
        ['Tap the map', 'Click the map', 'Travel there'],
        ['Wait button', 'Space', 'Wait / stop travelling'],
        ['⚙ button', '⚙ button', 'Settings']
      ]
    },
    towns: {
      id: 'towns',
      order: 3,
      title: 'Towns and villages',
      body: [
        'Every place opens on its menu: hire, buy food, rest, trade, take contracts and talk to people. Stonebridge also has streets: Walk the streets to stroll around, tap a person to walk over and talk (or use the joystick and TALK), Town menu to get back, and the road on the left to leave.',
        'Every other place is a menu: hire soldiers, buy food, rest, trade, take contracts and talk to whoever is there. Forts show their garrison. A kingdom that is Hostile to you will not hire out soldiers or work.'
      ],
      controls: [
        ['Tap a person', 'Click a person', 'Walk over and talk'],
        ['Joystick', 'WASD / arrows', 'Walk'],
        ['TALK', 'Space / E / Enter', 'Talk to whoever is near']
      ]
    },
    battle: {
      id: 'battle',
      order: 4,
      title: 'Battle',
      body: [
        'When a band catches you, or you ride at one, choose: Attack fights the battle yourself; Auto-resolve rolls it from your strength; you can also pay a toll, threaten weaker bands, or try to slip away. Each button shows the odds.',
        'In battle you fight in person. Swings hit what is in front of you; a shield blocks hits from the front only. Your soldiers follow orders by group: Follow keeps them near you, Hold keeps them where they stand, Charge sends them at the nearest enemy.',
        'Soldiers fight as groups. On Follow they keep loose ranks around you, infantry ahead and archers behind. Footmen, Guards, Legionaries, Mercenaries and Sellswords raise their shields at a blow from the front, and a raised shield also covers the friend just to its left: hold Block beside a companion to protect them too. Spearmen and Legionaries stop a cavalry charge that comes at their spears. Archers only shoot when no tree or wall is in the way.',
        'Groups on both sides have morale. Heavy losses, being outnumbered, blows from the flank or behind and friends running nearby shake a group; veterans and having you close by steady it. A shaken group wavers (it hits a little lighter), then falls back, and at last routs: it runs off the field and stops fighting. Enemies who flee count as beaten but leave less to loot. Your soldiers who flee come back after the battle unhurt. Rally (R, or in Orders) steadies every soldier near you and turns back those running, once every 30 seconds. Nothing about it is luck: the same fight goes the same way.',
        'A battle can draw in others nearby. Road Reavers within earshot join their own kind; a kingdom’s patrol helps you only if that kingdom counts you a friend, and comes for you if it is Hostile. They ride in from the side of the field they come from: an hour away on the map is about ten seconds of battle. Those your company can already see are named before you fight; others are announced shortly before they arrive. If the battle ends first, they arrive too late. Enemies cut down by those who came to help are theirs, not yours. Auto-resolve counts the help that would arrive in good time.',
        'Only so many fight at once (Settings → Battle size); the rest wait in reserve and step in as others fall. Enemies may come in waves.',
        'Before you fight, choose a setup: Balanced (the default), Defensive, Aggressive, or Custom, where you drag each group’s flag inside the zone and pick its first order. Simulate settles the fight from your strength and explains the odds. Tick Skip this screen to go straight in with your setup next time (Settings → Before battles turns it back on). When a band ambushes you, there is less room to form up.',
        'On a large battlefield the view follows you. The small map at the top shows your company and the enemies your soldiers have seen (red; faded where they were last seen); tap it to look there for a moment. MAP (or hold Tab) opens the whole field with the battle held still: pick a group in Orders, then tap where it should go and hold. You never have to use it.'
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
        ['Pause', 'Esc', 'Pause']
      ]
    },
    party: {
      id: 'party',
      order: 5,
      title: 'Your company',
      body: [
        'Everyone you hire takes a slot, eats a ration a day for every five people, and draws a weekly wage. Hungry or unpaid soldiers lose morale; at very low morale they desert.',
        'Fallen soldiers are wounded or killed. The wounded sit out battles for about two days. Soldiers gain experience and can be upgraded for crowns in the Party screen; Leadership and renown raise how many you can lead.',
        'Every soldier has a name, a home and a service record: battles, kills, wounds and the wages they were actually paid. Party lists them by name (filter by who is fit, wounded or ready to upgrade); tap one for their card, where you can rename them or upgrade them on their own. By type groups them as before.',
        'Soldiers who fall, desert or retire are not forgotten: the Roll of honour in Party keeps who they were, where they came from, how long they served and what they did. A soldier’s card has Retire with honour (tap twice) to let a veteran go. After a fought battle, the result says who did what.',
        'Accounts (in a settlement, or ask at the tavern) shows your purse, the company chest and a ledger of every crown in and out. Wages are paid from the chest first, then your purse. Captors take a share of both. A quartermaster (40 crowns, 6 a week) keeps the next wages in the chest and buys food up to a reserve (5 days to start) whenever you reach a market, spending at most a weekly budget (60 to start), and warns you on the road before food or wages run short. You can change those rules or let them go at any time.',
        'A merchant (50 crowns, 8 a week; hire one in Accounts in a market town) trades a budget you give them whenever you reach a market, at the same prices as you, with their own goods riding in your wagons. They know only prices they have seen on your travels, so take them to a few markets first. Cautious (the default) wants a good margin and keeps some cash; Bold takes thinner margins with all of it. They report what they bought and sold and why. Stop them, take money back, or recover everything (cash to your purse, goods to your cargo) at any time. Captors take a share of their budget too.',
        'Troop tree shows every troop line as you discover it: troops you have met by name, troops you have hired or trained in full, with their upgrade costs. A troop at the end of its line is at max tier. Upgrade all ready upgrades everyone who has earned it, after showing you the total.',
        'Party also shows your hero: equip loot, and spend skill and attribute points as you level.'
      ]
    },
    trade: {
      id: 'trade',
      order: 6,
      title: 'Trade and contracts',
      body: [
        'Six goods are cheap where they are plentiful and dear where they are short. Caravans that arrive make a good cheaper; caravans the Reavers rob make it dearer. Market talk on the Trade screen says what moved prices. Cargo slows your march.',
        'Stonebridge and Eastwatch post contracts: hunt a marked band, escort a caravan (it only rolls while you ride beside it), or deliver goods or a letter. One contract at a time; each shows its reward and time limit, and failing one costs renown. Finished work wins favour with the town’s kingdom.'
      ]
    },
    story: {
      id: 'story',
      order: 7,
      title: 'Story, reputation and news',
      body: [
        'Four quests lead to the fate of Greywall. The Journal lists them with the next step in gold, the company chronicle (your own story: who joined, who was promoted, notable battles, who fell, quests done) and the regional news.',
        'Besides the story there are a few small errands, marked as such in the Journal and never needed: Elder Maren may want to feast a Stonebridge-born veteran; Sergeant Brun can teach you to keep full larders with a quartermaster, and later to fight a dug-in band to a plan; Caravan Master Oswin in Eastwatch will start you on a merchant’s first venture; and Captain Aldric has raiders on the border where a Crown watch will ride to your aid.',
        'Each kingdom sees you as Friendly, Neutral or Hostile. Helping it raises that; attacking its patrols or caravans lowers it. Friendly gives two extra party slots; Hostile means its patrols hunt you.',
        'Mara, a former imperial scout, may join you after the second quest. After the ending the March goes on: work, trade and the border’s quarrels continue.'
      ]
    },
    saving: {
      id: 'saving',
      order: 8,
      title: 'Saving and settings',
      body: [
        'The game saves itself in this browser after battles and in settlements. Browsers can clear that storage, so use Save & export now and then: the file (or text) also moves your game to another device.',
        'Settings (⚙, or on the title screen) has music and effects volume, battle size, health bars, reduced effects, and tips. Settings stay on this device and are not part of a save.'
      ]
    },
    credits: {
      id: 'credits',
      order: 9,
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
    journal: { id: 'journal', on: 'journal', help: 'story', title: 'The Journal', text: 'Your quests, with the next step in gold, your company’s chronicle, and the regional news.' },
    saves: { id: 'saves', on: 'saves', help: 'saving', title: 'Keep a copy', text: 'The game saves itself in this browser, but browsers can clear it. Export a copy now and then — it also moves your game to another device.' },
    points: { id: 'points', on: 'map', when: 'points', help: 'party', title: 'Points to spend', text: 'You have skill or attribute points to spend. Open Party: Leadership lets you lead more soldiers, One-Handed hits harder.' },
    lowFood: { id: 'lowFood', on: 'map', when: 'lowFood', help: 'party', title: 'Food is running low', text: 'Buy food in any town or village. Hungry soldiers lose morale and may desert.' },
    wounded: { id: 'wounded', on: 'map', when: 'wounded', help: 'party', title: 'Wounded soldiers', text: 'The wounded sit out battles for about two days. Resting in a settlement passes the time safely.' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
