# Crownless — Release Notes

## v5.12.0 — The storybook look: Stonebridge (P11-12b) · 2026-11-27

The vertical slice of the new look the owner approved: every person in the game is redrawn after the approved character design, and Stonebridge's streets after the approved concept. **For the owner's eyes first:** the rest of the towns, the battlefields, the map and the screens wait until the owner accepts this slice. Nothing in play has changed: the same battles, the same rules, the same streets.

### Changed
- **People everywhere** (streets, battles, the map's parties, the creator, the gallery): full-bodied storybook figures with soft round heads, little faces of their own (eyes, brows, noses, mouths, beards), side views with one eye and no ear, separate arms, hands, legs and boots, and the clothes, armour, helmets, weapons and shields they really carry, in every facing and every move: walking, swinging, thrusting, guarding, drawing a bow, winding a crossbow, staggering, falling, and on horseback.
- **Horses** are redrawn to match, a little larger, the rider in the saddle.
- **Portraits** are the same people as the figures: Hilde in her dialogue looks like Hilde in the street.
- **Stonebridge:** a warm meadow, the Grey Ford Inn with its timber frame, tiled roof, front gable, awning and sign, the slate muster hall with its banner and shields, a thatched cottage, the elder's house and its round tower, a well with its winch, the market stall, a plaza of single cobbles, rounded trees; people at a friendlier size, names on the buildings and over the heads, by day, dusk and night.
- **Stonebridge's HUD** is compact: a smaller status box and buttons, a quieter joystick and a small TALK button, so the town stays in view on a phone.

### For testing
- **Debug → "Old figures"** shows the 5.11 people for side-by-side comparison. **Debug → Art gallery** opens on the slice: Stonebridge's people enlarged in four facings and every pose, their portraits, and riders with every weapon.

### Under the hood
- `js/art/figures.js` rewritten inside its contract (the hand, the weapon tip and the glint unchanged); `js/art/story.js` (new) the storybook kit; `js/art/classic.js` the 5.11 figures for comparison.
- `tests/storybook.test.js` (no ear in profile; every part in every facing and pose, mounted too; one set of features; street and portrait one person; every town's layout fingerprinted at 5.11). The parity guard and the golden battles unchanged and passing.

## v5.11.1 — The storybook look: the baseline (P11-12a) · 2026-11-27

The first step of the graphics, UI and performance milestone the owner approved (P11-12, decision D-P11m): the warm, simple storybook look of the approved Stonebridge concept and the character workshop v0.7, built into the game's own renderer in five steps. This one measures the game as it is, so every later step can be compared. Nothing you see or play has changed.

### New (for testing)
- **Debug → "Benchmark: P11-12 scenarios"** (and "at 0.75×"): the battle benchmark for a mixed field, every realm's troops, a mounted hero, an archer hero, a cavalry-heavy and an archer-heavy field and a siege, at 40, 100, 150 and 200 at once (about 15 minutes); frame-time percentiles, simulation and drawing per frame, the bake cache. For the owner's phone.

### Under the hood
- `scripts/bench-browser.js --scenarios … --zoom 1,0.75`: the same headless; `scripts/screens-storybook.js <label>`: before-and-after screenshots of the real game (local, git-ignored).
- `tests/sharpness-parity.test.js`: the same seeded battles end exactly alike at Sharp, Balanced and Fast and at both zooms, drawn through the art: the guard for the whole overhaul.
- The plan: `docs/NEXT-TASKS.md` P11-12a–e, `docs/PHASE-11-PLAN.md` D-P11m, `docs/STORYBOOK-INTEGRATION.md` (the handoff, the native contracts, the gaps); the baseline in `docs/PHASE-11-VALIDATION.md`.

## v5.11.0 — Troops by their weapons (P11-11) · 2026-11-27

Every soldier now fights with the weapon you see in their hands.

### Changed
- **A troop's reach and shot are its weapon's:** Valedorn's longbowmen outrange shortbows, the League's crossbows fly fastest and punch through armour, maces and axes are a little shorter than swords, spears and pikes reach furthest.
- **Spears and pikes brace against horse by their weapon;** the Legionaries and Pavisiers still brace behind their shields. Pikemen now parry with the pike.
- **Veterans are better equipped rather than just tougher:** tier 3 troops have a little less HP and more armour (and, since 5.10, a better way of fighting).
- **Fine kit** from your blacksmith is a better weapon and a step of armour: more damage and armour, a little less HP than before.
- **Lords fight in their realm's best kit, as veterans,** with less raw toughness.
- **Companions** reach as far as their weapon, and block only with a shield.
- **The soldier's card and the troop tree** now say what each troop carries, wears and how it fights: "Sword and shield, mail. In battle: fights patiently, guards well…".

### Under the hood
- `data/troops.js`: every troop names its `weapon`; reach, shots and braces from `data/weapons.js` (a family's `brace`). Packs: a troop's weapon is checked (one without gets one from its look, with a warning). `docs/WORLD-FORMAT.md`.
- `scripts/realm-lab.js`: each realm's lines against each other. Found: spears, pikes and axes win alone and lose in packs, for formations and combined arms (P11-13, P11-14).
- `tests/troops.test.js` (+8). Golden battles recorded again.

## v5.10.0 — Fighters who think (P11-10) · 2026-11-27

Enemies, your soldiers and tournament fighters no longer all fight the same way. The first task of milestone M3, "The armies of the realms".

### New
- **Fighting styles:** a looter brawls (wild, slow to guard); a trained soldier keeps its guard; a veteran waits, guards well and strikes when you miss; a spearman keeps you at the end of its spear; a heavy fighter waits for an opening, then hits hard; archers keep their distance and step back from anyone who closes; riders hunt archers, stay clear of spears facing them, and ride out to charge again when they get stuck.
- **Everyone plays by your rules:** they see only what you see (a swing wound up, a stumble, a lowered shield) and react a moment later, never at once. Holding Attack still beats a brawler; against a veteran it gets you hurt. Step out of reach, let them miss, and strike while they recover.
- **Tournament fighters** each have a way of fighting: the first comes straight at you, the second hides behind a shield, the finalist waits for your mistake. Your rival always fights the same way.
- **The soldier's card and the troop tree** say how each troop fights ("In battle: fights patiently, guards well…").

### Changed
- The semi-final's fighter is a little less tough (the shield-wall makes up for it).
- Big battles at a size of 100 between equal-ish armies are no longer lost far more often than Simulate says.

### Under the hood
- `data/styles.js` (`fighting_styles`, a pack table, checked; a troop's or a round's `style`), `js/styles.js` (`CL.styles`: `melee`, `archer`, `riderTarget`, `rideOut`, `detailed`, `reaction`, `guardUse`). The full style within 360 px of you and in every duel. `duel-lab.js --ai`.
- `tests/ai-styles.test.js` (11). Golden battles recorded again. Measured in `docs/PHASE-11-VALIDATION.md` "Fighting styles".

## v5.9.0 — Controls, feedback and teaching (P11-09) · 2026-11-27

The controls for swords, bows and horses made whole, on the phone and the PC. With this, milestone M2, "Bow and horse", is ready to play.

### New
- **Switching weapons on the phone:** a small badge on ATTACK's top edge shows your other weapon; tap it to bring that weapon to hand. Settings can make it a **swipe across ATTACK** instead. On a computer, Q. Asked for mid-swing, the switch comes as soon as the swing is done.
- **ATTACK and BLOCK show what's in your hands:** a sword, an axe, a bow, a lance, your fists; BLOCK your shield, or the weapon you guard with (greyed out with neither).
- **Hints when they matter:** after your first fight's controls card, one short card the first time each comes up: a swing that misses, a shield giving way, drawing a bow, and now **your second weapon** and **riders**. Each shows once and pauses nothing.
- **How to Play → Fighting** now goes by stage: your first fight, your second weapon, bows, horses.
- **Settings:** Switch weapon (the badge or a swipe), **Assisted aim** (on: the game picks a bow's target; off: you shoot where you face) and **the glint** on a weapon wound up at you (on).

### Fixed
- **Nothing stays held by mistake:** a pause, a card, Help, Settings, the tactical map, the battle ending, a weapon switch, the page going to the background or the phone turned upright now let go of ATTACK, BLOCK, the keys and the stick. A drawn bow is let down, not loosed.
- **Two thumbs:** lifting your thumb off the stick no longer lets go of ATTACK held by the other (it loosed a drawn bow). With a thumb on the stick, a tap on MAP, ORDERS, Pause, zoom or the switch badge now works (it did nothing).
- **With Reduced effects, and in battles of more than 80,** you still see your own fight's cues (a miss, a block, a broken guard, a stagger), and the glint stays, as a still mark.
- **Sieges defended on the walls** were lost almost every time once your hero no longer cut down attackers by the dozen. Now a soldier on a ladder is off balance: no guard, and blows land far harder. Defending is won about as often as Simulate promises, or a little more; storming is a little harder than it was.
- **The escort's wagon** burned in a second, before your soldiers could turn back for it. It now holds out long enough for them: saved in about half the fights when they mind it.

### Under the hood
- `js/input.js` `releaseAttack`, `releaseHeld`, `tapOnRelease`; hold buttons count their pointers; `CL.gear.switchWeapon` keeps a switch asked for mid-swing (`loadout.wanted`). `js/combat.js` `CLIMB`; `CL.objective.WAGON.hp` 120. Settings `switchControl`, `aimAssist`, `glint`. Tips `switch`, `riders`; help topics' `sections`. Icons `lance` and `fist`.
- `tests/browser/controls.spec.js` (new, 19); `tests/tips.test.js` (+2), `assault.test.js` (+1), `art-battle.test.js` (+1). Golden battles recorded again (the assault). To confirm on the next long run: the siege parity, the battle extras and the whole battle parity (`docs/PENDING-CHECKS.md`).

## v5.8.0 — Fighting from the saddle (P11-08) · 2026-11-27

You can ride into battle. With M2's last task (P11-09) still to come, this is the horse half of milestone M2, "Bow and horse".

### New
- **Ride into battle** on a horse trained for it: the **Rouncey** (light, Riding 1), the **Courser** (the fastest and frailest, Riding 3) or the new **Destrier** (a warhorse: the heaviest, slowest to turn, hardest to bring down, the hardest charge; Strength 7 and Riding 3). A **Nag** only carries you on the road.
- **Steering a horse:** it turns toward the stick at its own rate and gathers speed while you hold a direction; let go and it slows. At a gallop you ride through foot soldiers and your blow lands harder. Braced spears and squares stop the charge, and the horse rears and is hurt.
- **The War Lance:** its damage comes from the horse's momentum, next to nothing standing still.
- **Your horse can be hurt:** half of every blow that lands on you falls on it; if it goes down you are thrown and fight on foot. It is fine after the battle.
- **Dismount** in the Orders panel (or X): on foot for the rest of the battle, no getting back on.
- **Where you can't ride:** the walls, a courtyard and the lists; Prepare says whether you will ride, with a choice to fight on foot (remembered), and warns that a company on foot can't keep up with a gallop.
- **From the saddle:** a sword, axe, mace, spear or lance works; a greatsword and a shortbow less well; a greataxe, pike, longbow or crossbow not at all (you fight on foot with them). A gallop throws a bow's aim.
- **Riding** now works: a horse turns and gathers speed faster, and a weapon's or bow's penalty from the saddle is smaller. How to Play → **On horseback**.

### Measured
- Mounted styles are viable and distinct: a lance knight beats foot soldiers and an archer and loses to a rider; a horse archer beats archers and riders and loses to shielded foot. Riding circles round a foe never cuts anyone down (spears and riders kill the circler; otherwise the stall rule ends it).
- **Riding ahead of a company on foot is costly:** with the hero on a rouncey, the outnumbered skirmish is lost every time (on foot 58%): the hero gallops in alone. For P11-13 (orders that hold) and P11-20.

### Fixed (the night run of 5.7.0)
- **Armour steadied too much:** mailed soldiers were all but impossible for a sword to interrupt while they still interrupted you, and a company that fought a lot lost far more often. Armour's steadiness is now gentler (mail +0.5, leather +0.25, a gambeson +0.1) and a sword interrupts a little harder.
- **High ground** let archers shoot further but their arrows still weakened and fell at the usual range: now the flight is longer too.
- **An arrow** a shield stops wears it down a quarter as much as a sword's blow.
- **Still open, for the next task:** a siege defended on the walls is lost far too often, the escort's wagon is never saved, and the bots earn less (`docs/PENDING-CHECKS.md`).
- The screenshot baselines are recorded (and no longer break on a new version number).

### Under the hood
- Horse items' `mount` (battle, speed, accel, turn, hp, charge), checked; each family's `mounted` use; maps' `mounts: false` (the lists, the courtyard, the walls). `CL.gear.rideState`; `js/combat.js` `mountHero`, `rideHero`, `saddleBlow`, `unhorse`, `dismount`. Companions don't ride yet (P11-11).
- `tests/mounted.test.js` (10), `tests/browser/mounted.spec.js` (2); the rider and circler pilots; `duel-lab.js --mounted`.

## v5.7.0 — Bows and crossbows in your hands (P11-07) · 2026-11-27

You can fight as an archer. Every shot now flies by its range, and nothing passes through a target however fast it flies.

### New
- **Bows for the hero.** Hold ATTACK to draw (a ring round you fills), let go to loose; a tap looses as soon as the bow is drawn. You walk at half pace while drawing. New in the armouries: the **Shortbow** (every town), the **Hunting Longbow** and the **Light Crossbow** (the bigger towns), and a **Full Quiver** (more arrows); the bows turn up as loot too.
- **The game aims for you:** the nearest foe in front with a clear shot (or the one you last shot), shown by a ring of marks under them, and it leads anyone moving. On a computer you can aim with the mouse instead (Settings, on by default); on a phone a setting (off by default) lets a finger on the field aim while the other thumb moves. "Too far" and "No clear shot" say why a shot has nothing to go to.
- **A crossbow** loads itself while you stand still, then a press looses it: slow, but flat, fast and piercing. **Strength** loads it faster; **Archery** draws a bow faster, aims truer and hits harder. A longbow draws slower in mail.
- **A quiver each battle:** your count is beside your health ("Arrows 24"), filled again after every battle (arrows are never bought). When it runs out, your other weapon comes to hand, or your fists ("Out of arrows: drawing your Arming Sword"). A switch loses a draw or a reload.
- **How to Play → Bows and crossbows**, and a hint the first time you hold a bow.

### Changed
- **Every shot flies by its range:** full damage to its effective range, then weaker, and it falls at the end of its flight. Shots are swept along their path each step, so no speed passes through anyone; terrain stops them along the way too. Soldiers' arrows follow the same rule (the golden battles are recorded again).

### Under the hood
- `data/weapons.js`: the bows' and crossbow's `maxRange`, `draw` and `ammo` (bounded for packs: range 60–600, speed 120–900, draw 0.2–4 s). `js/combat.js`: `loose`, the swept `updateArrows` through a grid, `aimTarget`, `lead`, `heroShoot`, the quiver. `js/gear.js` `ammoOf`.
- The **archer** pilot (`tests/helpers/pilots.js`); `duel-lab.js --ranged`; `bench-battle.js --archers` (two in five shooting: 3.30 ms a frame at 200).
- `tests/archery.test.js` (10), `tests/browser/archery.spec.js` (2).

## v5.6.0 — Armour, weight and movement (P11-06) · 2026-11-26

What you carry now weighs on you. Heavy armour still protects, but it costs pace and tempo, so light and heavy are both ways to fight.

### New
- **Your load.** Party shows what you wear and wield against what your Strength carries easily, in words and a bar: light, medium, heavy (slower) or too heavy (much slower). A carried second weapon and a slung shield count; your pack and your horse never do.
- **What the load does:** light costs nothing; medium slows you a little; heavy and too heavy slow your walk, your start (a moment to reach full pace) and your recovery after a blow. You can always walk.
- **Strength** now also raises what you carry easily; **Agility** lessens everything a heavy load costs.
- **Armour steadies you:** mail (and less so leather and a gambeson) makes you harder to interrupt, troops too.
- **Maces hit through armour:** a mace's blow ignores a share of the target's armour, as a crossbow's bolt will.
- **The gear check says so:** "Your gear is heavy (18 of 14): you move and recover slower", on the sheet, and in the armoury when a piece would tip you into it.
- Every origin starts light.

### Under the hood
- `data/character.js` `encumbrance`: the capacity (12, +1.2 a point of Strength above 5), the four bands, Agility's 6% a point, a speed floor of 60%, armour's poise. `CL.profile.loadOf`, `capacityOf`, `encumbrance`; the hero's profile carries `load`, `capacity`, `band`, `ramp` and `drawFactor` (for 5.7.0's bows). Companions' gear is a load too.
- `pierce` on the families (the mace 30%, the crossbow 30%); `mitigate(raw, armour, pierce)`.
- `duel-lab.js --styles`: five foot styles. Item weights are checked (0 to 20).
- **Golden battles recorded again** (troops' poise and the mace's pierce change them).

## v5.5.0 — Melee rhythm and defence (P11-05) · 2026-11-26

How you fight now matters. Every weapon has its own rhythm, a miss costs time, shields can be worn down, and the hero fights on the same body rules as everyone else. This is milestone M1, "The weapon in your hand", for the owner to play.

### New
- **Each weapon fights differently.** A sword is quick and catches up to three in front of you; an axe and a mace are shorter and slower, the axe wears shields down and the mace interrupts; a greatsword reaches further, sweeps wide and recovers slowly; a greataxe hits hardest and slowest; a spear reaches furthest with a narrow thrust.
- **New weapons:** the **Ash Spear** (in every town, a shield allowed), the **Greatsword** and the **Greataxe** (in the bigger towns; Strength 7 and Two-Handed 1). The greatsword can also turn up as loot.
- **A miss costs time:** a swing at nobody recovers longer, so a held Attack gives a patient foe openings. "Missed" or "Out of reach" says so.
- **Interruptions within limits:** a heavy blow that lands in someone's windup interrupts it, but nobody can be interrupted twice in quick succession, and repeated hits push less each time.
- **Shields wear down.** Every blocked blow presses a shield; enough break the guard and lower it for a moment ("Your guard is broken!"). The **Shield** skill now works: more before it breaks, quicker recovery, a little wider.
- **Weapon guard:** with a two-handed weapon or a spear and no shield, Block raises the weapon and takes part of a frontal blow.
- **Honest soldiers:** shield troops raise their shields a moment after they see a blow coming (quicker the better they are), and never while recovering from their own swing.
- **You are one of them (D-P11d):** your reach and attack rate are your weapon's, your walking pace your own (Agility helps; mail slows a little, until 5.6.0 weighs your load). One-Handed, Two-Handed and Polearm train their weapons: more damage and a slightly quicker recovery.
- **Feedback:** a glint on a weapon tip wound up at you, a dust arc for a miss, a split arc for a broken guard, marks for a stagger, and sounds for each. How to Play → **Fighting**; two hints the first time you miss and break a guard.
- **Timed parry, an experiment** (Settings, off by default; D-P11j): Block raised just before a blow lands turns it aside and opens the attacker. It stays only if the owner likes it.

### Changed
- **Battles play differently** (on purpose): the golden battles are recorded again. Measured (40 seeds): fought by a button-masher, 6 to 21 points over the stated odds (the outnumbered company +6, was +16); a fighter who strikes into openings beats footmen, huscarls and legionaries without a scratch and wins the lists; the masher wins the first two rounds and loses the final.
- One-Handed now trains only swords, axes and maces.

### Under the hood
- `data/weapons.js`: each melee family's windup, active and recovery, `miss`, `maxTargets`, `stagger`, `poise`, `shieldPressure`, `knockback`, `moveDuringAttack`, `guard`, `skill` and `skillRecovery`; one cooldown for the hero and everyone. `data/character.js` `body`: the hero's pace. The bounds are checked for packs too.
- `js/combat.js`: the whiff, targets nearest first, stagger, knockback, shield pressure, the weapon guard and the parry. `js/groups.js`: the guard's reaction. The tap buffer is measured to when you're next ready.
- `tests/melee.test.js` (13). The simulation at 200 fighters: 3.47 ms a frame (P11-00 3.19, +9%).

## v5.4.0 — The equipment you see (P11-04) · 2026-11-26

The hero now looks like what they carry, everywhere. Nothing about how battles play changed.

### New
- **The hero in their gear.** The weapon in hand, the shield in hand or **slung on the back** (a two-handed weapon or a bow), the helmet or a bare head, the armour, gloves and boots: in battle, the portrait, Party, the creator (in your origin's starting kit), the town's streets and your company on the world map. A switch in battle shows the other weapon at once.
- **Companions** wear the gear you give them; **tournament fighters**, you too, fight in the lists' loaner kit (its helm and gambeson now show).
- **Item icons**, drawn in code, beside every piece of gear in Party, the armoury, the blacksmith and Prepare: a weapon by its kind, body armour by its class, named in words for screen readers.
- **New parts** for what Phase 11 brings: a mace head, the greatsword with both hands on its grip, the slung shield, the recurve bow and the arbalest's windlass, and the bascinet. **Debug → Art gallery → Arms and armour** shows them all.

### Under the hood
- Every item has a `look` (`data/items.js`), checked by slot and against its family; a pack's piece without one gets a default. `G.fig.heroFrom` replaces `heroFor`.
- **Mounted is a state** (`u.mounted`, `CL.units.mounted`), set from the troop: cavalry rides exactly as before.
- **Caches:** a look's key carries the kit's signature; a big battle of every realm with switches stays under 3,000 baked pictures (2,006 measured). Drawing at 40 fighters 0.9 ms a frame (P11-00: 0.8–0.9).
- A troop's look is checked against its weapon family, not its shot's speed or reach.
- Fixed: 5.3.0's typecheck error in `js/gear.js` (a finding's `stat`).
- **Golden battles unchanged.**

## v5.3.0 — The progression budget and equipment requirements (P11-03) · 2026-11-26

Levels go to 20, two new skills join, and the better gear needs a little Strength or skill to use. Ordinary gear needs nothing, and battles fight as before with it.

### New
- **Level 20.** Levels 1–10 come as before (level 10 around day 50); after 10 each level costs 550 XP more than the last, so level 15 comes around day 135–145 and level 20 in a long campaign (around day 280–325, measured). A skill point each level and an attribute point each even one, as before: 19 and 10 by the cap.
- **Two-Handed and Polearm**, two new skills (D-P11c). Every combat skill now says what it does, and from which update it starts working (Two-Handed, Polearm and Shield from 5.5.0, Archery 5.7.0, Riding 5.8.0).
- **Agility and Strength have their jobs.** Strength: health, and what heavy weapons, armour and crossbows need. Agility: a quicker recovery and less slowing in armour, from 5.5.0 and 5.6.0. The creator and Party say so.
- **Requirements.** The War Mace needs Strength 6; the Knight's Sword One-Handed 3; the Iron-Rimmed Heater Shield 2; the Bascinet Strength 6; the Mail Hauberk Strength 7. Party, the armoury, the blacksmith and Prepare say what a piece needs, what you have and how to get there ("Spend 3 skill points on it", or "More points come as you level"), with a lock mark as well as words.
- **Kept, never taken.** A piece you can't use yet stays on you or in your pack; in battle it stays with the baggage. A weapon you can't wield gives way to your other one, or to your fists, and the battle says so.
- **What your points would unlock.** Party names the gear you have that your points to spend would let you use, and so does a level-up after a battle.
- **Party → What each attribute and skill does**, and **How to Play → Your character**.

### Under the hood
- `data/character.js`: the ten skills' and the four attributes' words, and `budget { cap: 20, middle: 10, late: 15 }`. `character.baseSkill` and `baseAttribute` (what requirements read: points, origin, story, training; never an item's, a companion's or the retinue's bonus) beside the effective `skill`. `character.retrain` gives back every point spent, for P11-17's masters; `spent` records them.
- **Requirements** on items (`req { str?, agi?, skills?, training? }`) or as a family's default (greatsword, greataxe, pike, lance, longbow, composite bow and crossbow, for the weapons to come), held to the rule of `docs/PHASE-11-PLAN.md` §7.3 by `CL.gear.ruleProblems`: at load, for packs and for worlds. Village and kit gear needs nothing; a town's at most what level 10 reaches with half its points; a rare piece level 15's.
- **The save** gains `character.spent`, `character.training` and the two skills by defaults (no schema step).
- **Golden battles unchanged.**

## v5.2.0 — Carried and wielded (P11-02) · 2026-11-26

You can carry two weapons, and the game tells you in words what your gear means. Battles fight as before unless you carry a second weapon.

### New
- **A second weapon.** In Party, **Carry second** puts a weapon in the new second-weapon slot.
  - Choose which weapon a battle starts with, or **Swap weapons**.
  - In battle, **SWITCH** (Q) brings the other to hand in 0.4 s: no blow or block meanwhile, and not while you swing.
  - Each weapon keeps its own cooldown, so switching never makes one ready sooner.
- **The gear check.** Party, the armoury, Prepare and the tournament card say what a kit means, each with a mark as well as words:
  - a weapon that needs both hands, or a bow, slings your shield on your back (it doesn't protect or block until you switch back);
  - you carry no weapon;
  - the lists' loaner kit.
- **Compare.** A weapon in your pack or the armoury says how it differs from yours: damage, reach, speed in a word, one hand or two.
- **Buying with a warning.** A piece the check says you couldn't use can still be bought, after a second tap that names why. Nothing the game sells does so yet: requirements come in 5.3.0.
- **How to Play → Your gear.**

### Changed
- **A new slot for a quiver** (empty until bows come, P11-07). It shows on the sheet only once something is in it.
- Taking off your weapon makes your second weapon the first.

### Under the hood
- `js/gear.js`: the loadouts, the one gear check (`check`, `checkItem`, `checkAll`, `bestLoadout`, `battleLoadout`) and the switch in battle. Its words are in `data/gear_text.js`: fixed codes, each line short enough for two lines at 812×375.
- **The save** gains `equipment.weapon2`, `equipment.ammo` and `loadout` by defaults (no schema step).
- **One place for each item:** a seeded run of 2,000 operations (equipping, swapping, buying, selling, forging, battles' loot and capture, tournament bouts, export and import) accounts for every item after each one. It found that an imported save refused a second weapon; fixed.
- **The retired world chooser is gone** ("Which world?", its kept choice in the browser); a save of another world is kept untouched, as before.
- **Golden battles unchanged.** Correction to 5.1.0's notes: there are nine golden battles, not ten.

## v5.1.0 — One combat profile for every fighter (P11-01) · 2026-11-26

Nothing a player can see or feel changed: every battle plays exactly as in 5.0.1. Each fighter now has one **combat profile** that says what their weapon does. Every later Phase 11 weapon and rule is a change to it.

### Under the hood
- **Weapon families** (`data/weapons.js`): sword, axe, mace, greatsword, greataxe, spear, pike, lance, shortbow, longbow, composite bow, crossbow, unarmed. For now each melee family keeps 5.0.0's timing.
  - Every weapon item names its family.
  - Every troop names its weapon, the one its look carries. Its own damage, reach and shot still apply.
- **One profile** (`js/profile.js`) is read by the combat, the AI, the shields, the art's poses and the auto-resolve: timing, cooldowns, the cone of a blow, how many it strikes, the strike range. The hero, Mara, the retinue, a lord in person and a tournament's fighter are all built through it.
- **Golden battles** (`tests/golden-battles.test.js`): nine seeded battles are compared frame by frame with 5.0.1 and are identical. They include the benchmark's, the five parity scenarios, a tournament bout, a lord's battle with the companions, and an assault.
- **Packs** may add weapon families and give a weapon a `combat` block of overrides; the checks keep them in range (`docs/WORLD-FORMAT.md`).

## v5.0.1 — The Phase 11 baseline (P11-00) · 2026-11-26

The first step of Phase 11, "The Art of War". Nothing in play changed. The tools that measure how much timing, equipment and command matter are built, and 5.0.0's numbers are recorded in `docs/PHASE-11-VALIDATION.md`.

### Changed
- **Debug → Battle benchmark** now also reports:
  - the frame time's p50, p95 and p99;
  - the frames that missed 60 fps and 30 fps;
  - the simulation and the drawing at p95;
  - the bake cache's size and hit rate, and the looks built;
  - the memory in use (Chrome only).

### Under the hood
- **Pilots** (`tests/helpers/pilots.js`) fly the hero three ways through the player's own controls: the masher (today's bot), the timer and the turtle.
- **The duel lab** (`npm run duel-lab`): the hero against one fighter, per pilot, weapon, armour set, opponent and tournament round.
- **The tactics lab** (`npm run tactics-lab`): equal armies on Charge, on Auto, or under a scripted plan, with the hero fighting or staying back.
- **The XP pace** (`npm run progression`): the day each level comes, by bot style.
- **The headless browser benchmark** (`npm run bench:browser`): each Sharpness on the desktop and phone profiles. `npm run bench` gains percentiles and the heap.

### Found
- **A shield stops every frontal blow.** A shielded opponent (footman, huscarl, mercenary) is never beaten one on one by holding Attack, waiting for an opening or blocking. A new character can't win a tournament bout that way.
- **Most weapons fight the same.** Four of the five take a looter in the same three blows. Armour only makes a lost fight last a few seconds longer.
- **Command already pays.** With equal armies, a held shield wall, archers behind and cavalry sent in on the first volley win every time with the hero kept back. Charging wins about a third of the time. Auto is uneven: it wins 78% on open ground but 13% on the hills.
- **Levels come fast.** The bots reach level 10, the cap, in about two months of game time.

### Open
- **The owner's 5.0.0 session on the phone** (H-00): P10-T's seven items, then a contract, a lair and a tournament fought both ways, and the questionnaire.
- **For the next night run** (`docs/PENDING-CHECKS.md`): the siege parity and the XP pace over 360 days on three seeds, beside the checks already waiting.

## v5.0.0 — Ways In (P10-T) · 2026-11-26

The end of Phase 10. You choose a kingdom and one of five origins; each origin's opening quest teaches the basics and leads into the same common quest; then the world is open, drawn entirely in code. The evidence is in `docs/PHASE-10-VALIDATION.md`.

### Changed
- **Lords die of their wounds more often:** a lord beaten in battle dies 12% of the time (6% before). A year of the world sees about three to eight deaths, and their heirs inherit.
- **A realm's last fort holds:** a siege of it needs three times its defence to begin (twice before). No realm loses all its land in its first months.
- **A mediator eases a faction less:** its members think 2 better of their ruler (5 before).
- **Defending a fort's walls:** 95% of the garrison fights beside you on the stretch of wall under attack (90% before). A fought defence was 12 points under its odds; now it is about 5 over.

### Under the hood
- **Old failures fixed:** `landed`, the Phase 7, 8 and 9 exits and Prototypes D and F pass. Three tests' setups were brought to the one world's bigger armies (no rule changed for them).
- **The 42 campaigns** (`gate-d-campaigns`, 7 a kingdom) reach every ending; the story bot plays a kept packet as a player would.
- **The origins' balance** confirmed over all five from every kingdom.
- **The scenario matrix** gains SC-45 to SC-52, the new starts and the art.
- **Packs:** the sample pack's engine range is now `>=3.13.0 <6.0.0`.

### Open
- Risings stay rare (about one in three years of the world alone): AI rulers meet most factions' demands.
- Waiting on the owner's phone: every scene in the new art, the battle benchmark and the map stress test.
- For the next night run (`docs/PENDING-CHECKS.md`): the visual baselines, `battle-parity` and the long runs.

## v4.15.0 — The old graphics removed (P10-G6) · 2026-11-26

The last step of the code-drawn art (D-P10k). Every sprite is gone, and everything the game shows is drawn in code. The game looks and plays as in 4.14.0.

### Changed
- **No image files:** the 170 sprite images, their manifest, the sprite loader and the manifest script are deleted. The game ships only its three home-screen icons, and a script draws those with the art kit.
- **The Graphics Demo is retired:** its map, city and battle are the game now. **Debug → Art gallery** stays, in its own small viewer.
- **How to Play → Credits** says the art is drawn in code.
- **Packs:** a map's obstacle `look` and decor kind must be names. Sprite tiles are refused by the content checks.

### Under the hood
- **The asset guard:** `tests/assets.test.js` fails if:
  - any image ships but the icons (the screenshot baselines are test data);
  - code or data names an image, a sprite id or a sprite tile;
  - the page reaches another site.
- **The browser check:** a walk through the menus, the party sheet, the Realm screen, a town, a conversation, the map and a battle must request no image.
- **Retired:**
  - the `crownless-art` skill and the Sprite Studio, ComfyUI and LiliPixel instructions;
  - `npm run assets`;
  - the old tile-id fallback in the battle renderer.
- **Documents:**
  - `docs/ASSETS.md` is rewritten (everything is code);
  - the README, `docs/V1-DOCUMENTATION.md` and `docs/WORLD-FORMAT.md` describe looks and specs instead of sprites;
  - `docs/GRAPHICS-DEMO.md` is marked as the history of the decision.

## v4.14.0 — The UI and portraits in the new art (P10-G5) · 2026-11-26

The fifth step toward the code-drawn art (D-P10k). The screens' pictures are now drawn by the art kit, like the map, the towns and the battles.

### New
- **Portraits with faces:**
  - **Soldiers:** each soldier's own face (skin, face shape, hair, a beard or a woman's hair) in their troop's clothes and your company's colours, in the soldiers' list and on their card.
  - **You:** the hero, in your cloak's colour, armour and helm, on the party sheet.
  - **Companions:** each in their own look, on the party sheet.
  - **Lords and rulers:** on the Realm screen's Lords tab, a ruler with a crown.
  - **Whoever you talk to:** beside their name in every conversation: the innkeeper, the elder, a companion.
- **The hero in the creator** is drawn by the kit and changes at once with the cloak and with presentation.
- **Troops' small figures:**
  - on the hiring buttons (the settlement menu and the recruiter);
  - in the troop tree;
  - on each soldier's card.
- **House arms:**
  - every lord's house has a shield of its own on its realm's colour, and no two houses of a realm share one;
  - they show beside each lord on the Realm screen, and on your house's card;
  - a lord's party on the map and a lord fighting in person fly their house's banner, with a gold edge.
- **Icons:** the stats on the party sheet and in the company summary, and the trade goods (once emoji), are small drawn icons: gold, one outline, one light.
- **The battle HUD and the Prepare panel** have the same frame as the other panels: navy, a double gold border and cream lettering.
- **The home-screen icon** is the kit's hero beside their banner.

### Under the hood
- **`js/art/ui.js`:** portraits, small figures, house arms and the icons. Images are drawn at the screen's resolution and cached.
- **`scripts/make-icons.js`:** draws the home-screen icons with the kit in headless Chromium.
- **Gone:**
  - the 16×16 portrait drawing;
  - the hero sprite and its cloak recolouring (`js/assets.js` now loads nothing);
  - the pixel icon masks and every `image-rendering: pixelated` rule in `style.css`.
- A lord's battle leader carries their house (`leader.house`).

## v4.13.0 — The world map in the new art (P10-G4) · 2026-11-26

The fourth step toward the code-drawn art (D-P10k): the world map is drawn by it. What it shows, and when, is as before.

### New
- **The land as a miniature:**
  - grass with soft variation and fields round the villages;
  - the sea with its sand and shallows;
  - marsh pools and reeds, hills as mounds, mountains as shaded peaks with snow;
  - forests of grouped trees on a darker floor;
  - rivers with banks, stepping-stone fords and stone bridges;
  - roads that curve.
- **Places you recognise at a glance:**
  - walled towns, bigger for a capital, with their towers;
  - castles with a keep and towers on a rise;
  - villages in their culture's style, from Hrothmark's long halls to the south's terracotta;
  - harbours with a pier and a boat;
  - bandit camps with a tent and a fire, cold once cleared.
- **Banners and sieges:** every place flies the banner of the realm it belongs to, with a pennant beside it when another holds its gates. A besieged place has the besiegers' camp round it: tents, a ram and a ladder.
- **Parties as little bands of their own troops:**
  - patrols on foot under their banner, lords mounted under a gold plume, armies under a bigger banner;
  - caravans as covered wagons, bandits under a dark banner, your own detachments in gold.

  A ring under each says friend (blue), neutral (cream) or foe (red). They face the way they go, and one you saw but can't see now is a faded banner.
- **Your company:** you, up to two of your soldiers and your banner, walking as you travel.
- **Unchanged:** the fog of sight, night, the labels, count badges, quest rings, edge markers and every tap.

### Under the hood
- **The map module:** `js/art/worldmap.js` draws the terrain into the renderer's cached layer (one per zoom step, as before), and the settlements, sites, parties, siege camps and your company. Each miniature is drawn once per kind, culture, side, facing, step and scale and then stamped. With 200 parties and the lords on the map, drawing costs 8–20% more than before zoomed out and the same zoomed in.
- **Gone:** the map's old shapes and the hero's map sprite. Only the creator's and the party sheet's hero sprite is left, for P10-G5.

## v4.12.0 — Towns in the new art (P10-G3) · 2026-11-25

The third step toward the code-drawn art (D-P10k): all eight walkable towns are drawn by it. Their layouts, their people and where everything stands are as before.

### New
- **Every town in its own style**, from the art kit's buildings:
  - Stonebridge's timber-framed inn, slate muster hall and the elder's tower.
  - Eastwatch's whitewashed forum and basilica.
  - Hrothgard's dark timber halls under shingle and turf.
  - Vessara and Calder's terracotta guild halls.
  - Merrow's and Gullhaven's harbour sheds and piers.
  - Harrowgate's stone keep on the cliffs.

  Each town keeps its own colours, and its landmark has a tower or a great hall.
- **Signs, awnings and shields say what a building is** before you read its name: a tankard for the inn, crossed spears for the barracks, a key for the guilds. Names show only when you are near.
- **The townsfolk** are drawn by what they do (innkeepers in aprons, merchants in brimmed hats, guards with spears and shields, officials in fine cloaks), and the women as women. The story's envoys and caravan masters, the retainer and Mara appear in their own looks.
- **Life:** chimneys smoke, banners move, a child runs round the well, gulls wheel over the harbours and hens peck in the northern towns. At dusk and at night (the campaign's own hour), the windows and doorways glow.

### Under the hood
- **The town module:** `js/art/town.js` draws the streets. A building is drawn inside its old footprint from a spec: its kind, the town's colours and its realm's culture, or its own `spec` (a landmark). The ground and the buildings are drawn once and stamped, so a town draws in under a millisecond.
- **The town data:** `data/town_hubs.js` names kit looks and decor (planks, earth banks, flowers, ferns, fences) instead of tile ids; the townsfolk's sprite frames are gone, and the women are marked.
- **The story's people:** in `data/factions.js` and `data/dialogue.js` they have a role, or a companion's look, instead of frames.
- **What sprites are left:** only the hero on the world map and in the creator and party sheet, until P10-G4 and P10-G5.

## v4.11.0 — Battles in the new art (P10-G2) · 2026-11-25

The second of the six steps toward the code-drawn art (D-P10k): every battle is now drawn by it. Towns and the map keep their current look until their own steps.

### New
- **Every soldier drawn by the art kit,** from their troop's kit and in their side's colours: your company under your realm's colours (or your own banner, a free company's gold) and the foe in theirs.
  - The hero in their cloak, Mara and the retinue in their own looks.
  - A lord fighting in person under a gold plume with a pennant, and tournament fighters in their own colours.
  - Women soldiers as their lines are.
- **You can see what every soldier is doing,** straight from the battle:
  - the blade rises in the windup, sweeps through and recovers; a spear or pike levels and thrusts;
  - a shield comes across the body on a block;
  - a bow is drawn while the archer reloads, a crossbow wound back over its slower load;
  - a struck soldier flashes and recoils; the fallen lie still and fade.
  - Horses always show in profile, with their legs moving.
  - Blue rings under your soldiers, red under theirs, gold under you.
- **Every battlefield in the new art:** the meadows, forests, the ford, the hills, the courtyard and the lists (now fenced). The assault has its stone curtain wall, the gate, the ladders at the gaps and the ram shed while it works. The escort's wagon burns when lost.
- **The minimap, the tactical overview and the Prepare screen** show a small painted map of the field.
- **Calm effects:** a small burst for a hit, a pale arc for a block, a puff where an arrow lands, the rally's ring. Arrows and bolts have heads and fletching. Reduced effects keeps only the rally.
- **Big battles stay smooth:** a soldier standing or walking is drawn once and then stamped, and in a battle of more than 80 at once their blows are too. With 200 on the field, drawing costs about what the old sprites did.

### Under the hood
- **The battle module:** `js/art/battle.js` draws the ground, the obstacles, every unit, the fallen, arrows, effects and the minimap's field from the battle's state, and never changes it.
- **Kit looks in the maps:** battle maps and the generated arenas name kit looks (`tree`, `bush`, `rock`, `wall`, `fence`, `crate`, `wagon`; decor `flowers`, `ferns`, `leaves`, `stones`, `fence`) instead of tile ids. The arenas' random draws are unchanged, so every map is laid out as before. A pack's map with old tile ids is drawn with the nearest look.
- **Sprites gone from battles:** the soldiers' sprite sets and the companions' `frames`. Only the towns' and the map's sprites are left, until their steps.

## v4.10.0 — The art kit in the game (P10-G1) · 2026-11-25

The first of six steps that re-draw the whole game in code and retire the sprites (the owner's decision after playing the graphics demo, D-P10k). This step builds the foundation; the scenes keep their current look until their own steps.

### New
- **Sharper on every screen:** the game now draws at the screen's real pixels instead of a small picture scaled up. A **Sharpness** setting chooses how fine:
  - **Sharp:** every pixel of the screen.
  - **Balanced:** nearly as crisp and lighter on a phone; the default.
  - **Fast:** the classic picture, for slow devices.
  The sprites still to be replaced keep their pixel look until their step.
- **Every troop has a look:** what the new art draws it wearing and carrying, in its realm's colours and its culture's shapes. Examples: the League's crossbows, pikes, pavises and sallets; the Hrothmark round shields and spangenhelms; Aurelian crests and heater shields; Ostrand's grey and Saltreach's ochre. The companions have theirs, and the hero follows the creator's cloak and presentation.
- **Art gallery** (Debug panel): every realm's troops at battle size and enlarged, turning and cycling poses; the hero, the companions and townsfolk; buildings by culture; nature and props. Nothing in your campaign changes.

### Under the hood
- **The art modules:** the demo's kit moved into the game as `js/art/kit.js` and `js/art/figures.js`.
- **Looks in data:** a `look` on every troop in `data/troops.js` and on each companion. The vocabulary is `CL.content.LOOK`. The content checks hold a look to the kit's parts and to the troop: a shield only with `shield`, a long weapon for a long reach, a bow or crossbow by the shot, a mount for cavalry.
- **Packs:** a pack's troop may give its own look. With none, it is drawn from what it does. The sample pack's troops have theirs.
- **Cultures:** each culture's device, shield and town materials (`CULTURES`). A realm's colours come from `data/factions.js`.
- **The style guide:** `docs/ART-STYLE.md`.
- **Sharpness:** the Debug panel's "Sharp canvas" test is gone; the setting replaces it.

## v4.9.0 — Women soldiers and soldiers' portraits (P10-09) · 2026-11-25

### New
- **Women soldiers,** in two realms and one band (the owner: "don't overdo it"):
  - **Hrothmark's shieldmaidens:** Shieldmaiden, Shield-sister, Hearth Maiden, a quicker shield line.
  - **The Vessaro League's town women:** Popolana, then the crossbow as Balestriera and Arbalestriera.
  - **The western outlaws** ride with up to two Outlaw Huntresses, forest archers.
- **Mixed into the normal recruits:** hire a Clansman or a Militia and, about one time in seven (15%, in data), a woman of the line answers instead. The draw is the campaign's own seeded roll, so the same seed gives the same recruits.
- **Their own progression and names:** a woman upgrades only within her own line, and is named from her culture's women's names.
- **Soldiers' portraits:** a small face for every soldier, a man's or a woman's: one of three skins and two face shapes, five hair colours, and a beard or a hair style. Chosen once from the soldier's id and kept in the save. They show, framed, in the soldiers' list and on each soldier's card. Placeholders until the graphics pass; battle sprites stay the role's.

### Under the hood
- `women: { troop, share }` on a line's first recruit; `CL.soldiers.answers`, `portraitFor`; a `recruits` random stream. The checks hold a woman's line to itself and a line's women's troop to its faction; a pack's troop may say `gender`.

## v4.8.0 — UI toward the references, and the fog of sight (P10-08) · 2026-11-25

### New
- **A new look,** after the art references: deep navy panels with a thin double gold border, cream serif headings in small capitals, gold-rimmed rounded buttons, tabs whose active one stands up in banner red, gold pixel icons, themed inputs and scrollbars.
- **The dialogue box:** the speaker's own name, what they are beneath it in italics, and each answer a framed row, a gold » on the one you point at.
- **The party sheet:** a framed portrait, your name, level and origin, a bar to the next level, and your numbers with icons (health, damage, armour, travel, company, renown, crowns).
- **The town menu's numbers** carry the same icons. The title screen says what the game is now.
- **Seeing further:** Pathfinding (+4% a point), Mara riding with you (+15%) and a horse (+10%) widen the company's sight, with the scout follower's ×1.5; every fort and town you hold watches 10 and 8 map units round it, and each of your patrols 8. Night, high ground and forest scale them all. The numbers are the world's (`sight` in `data/world_map.js`).
- **The fog of sight:** what none of your eyes reach is drawn a little darker, with a soft edge to what they do; it shrinks at night. Reduced effects turns it off.
- **Story bands are named on the map** ("Horse Thieves", "Reaver Ambush"), not "Quest: Reavers".

### Fixed
- The elder no longer thanks a plain-start farmhand, traveller or noble for an opening they never played.

### Open
- Soldiers' portraits (P10-09) and the battle HUD and Prepare panel beyond the new frame; news that tells of parties beyond your sight; the visual baselines, made on Linux (`npm run test:visual:docker`).

## v4.7.0 — Onboarding and hints (P10-07) · 2026-11-25

### New
- **A beginner guide,** whatever your origin: a town and its people, the streets, hiring (if you have nobody yet), the map, food, an encounter and auto-resolve, the first battle's controls, and saving. Each step shows once, when it is needed, marked "guide". Got it passes one step; **Skip the guide** passes them all.
- **Hints for everything deeper,** each once: the market, contracts, the Realm screen, your fief, sieges, being summoned to an army, lords and houses, your realm.
- **One setting** in Settings, "Guide and hints", turns both off or on; **Show hints again** brings both back.
- **How to Play by stage:** as a captain, a vassal, a lord, a ruler. Yours comes first, marked (you), with the rest a tap away.

### Under the hood
- `guide: true` on a tip makes it a guide step; `CL.tips.skipGuide`, `guideSteps`, `stage`. New moments: `canHire`, `secondDay`, `summoned`, `lordsTab`, `fiefTab`. Help topics take a `stage`.

## v4.6.0 — Origins: the scout and the peddler (P10-06) · 2026-11-25

### New
- **The scout's opening, Eyes on the Road:** your town's recruiter wants outlaws on the border road counted. Hire two, ride to the border village and ask what they have seen, then break the road watchers or scare them off, and report back. The edge: +1 Agility.
- **The peddler's opening, A Pack and a Profit:** your town's merchant has a deal. Take 25 crowns toward it, hire two guards, buy grain in your village, sell it in the town, and collect the rest. It teaches the market. The edge: a merchant's thanks, a little more money.
- **All five origins now have an opening quest** that ends in the common quest, within the same band. The balance check over all five, from every kingdom, is one table in `tests/slow/origins.test.js`.

### Under the hood
- A new effect `attribute` (+1 to one of the hero's attributes); the merchant is a street role; a town person's opening dialogue comes before their own.
- The story bot buys and sells for a `trade` step.

## v4.5.0 — Origins: the frame and the first three (P10-05) · 2026-11-25

### New
- **Origins replace the backgrounds.** At a new game you choose who you were before the road: the unhorsed traveller, the impoverished noble, the farmhand, the scout or the peddler. Each keeps the old +1 attribute and +1 skill.
- **Three opening quests,** each three or four steps that teach the basics (talking, hiring, riding out, a first fight, the Prepare screen or auto-resolve), cast from the kingdom you chose:
  - **Thrown at the Gate** (the traveller): your start town's innkeeper, two hires, the horse thieves on the road, back to the inn. You get your horse back.
  - **A Debt of Honour** (the noble): Old Tam, your family's last retainer, gives you the strongbox; hire three, free your brother from the moneylender's men, bring him home. Tam gives you your grandfather's axe.
  - **Smoke over the village** (the farmhand): you begin in your village with three of its men, the realm's own levies; break the raiders, tell the headman, ride to the town. The men are your edge: soldiers without a fee.
- Each ends by starting the common quest (Q1), with the speed hint; the scout and the peddler begin with the common quest until 4.6.0. A band can be beaten or cowed.
- **The same place at the end:** every opening ends within one band set in data (gold 30–130, 2–3 soldiers, worn gear worth 40–90, level 1–2, renown 3–12). Played from every kingdom, the three end within about 20 crowns' worth of each other.
- The new-game screen: the origins as short cards, the chosen one's story, start and edge below.

### Under the hood
- `data/origins.js` (`origins`, `origin_rules`) replaces `C.backgrounds`; `character.origin` replaces `background`, and the story's condition is `origin`. New effects: `equip`, and `recruit: '@crown'` (a realm's first recruit). The innkeeper is a street role.
- A `plain` start (bots, scripts, `CL.game.plainStart` in the browser tests): the start town and the common quest, the GDD's bare start. Every slow bot keeps it, so their numbers do not move.
- The story bot's `focus`: a new player's way through one quest. `tests/origins.test.js`; `tests/slow/origins.test.js` plays every origin from every kingdom.

## v4.4.0 — Choose your kingdom, and the story from anywhere (P10-04) · 2026-11-25

### New
- **Choose your kingdom** at a new game: Valedorn, Aurelia, Hrothmark, the Vessaro League, Ostrand or Saltreach (not a free city). You begin in its start town (`start` in `data/factions.js`), and the choice is kept in the save.
- **The main story from any kingdom.** It keeps its four quests, its choices and its three endings. Its people and places are cast from the map around you: your town's elder and recruiter, your realm's envoy, the realm next to yours with its envoy and caravan master, your village for the grain wagon, the fort the two realms quarrel over. Begun in Valedorn it is the Border March's story, as before. Twelve new characters: each realm's envoy and caravan master.
- **The story's locks follow the cast.** Its two forts change hands only in the story until it ends, and its two realms stay in tension until then (begun on the coast, Ostrand and Saltreach no longer start at war). The gentler land of the story (smaller bands) is where its places are.
- **Q1 is the common quest.** A new game begins with it, so the journal points at your town's elder from the first minute. It keeps its ending, the charter fragment, and then the Journal says where the story goes on, and that it can be left.
- **In the streets:** your town's elder and recruiter speak the story in person; your realm's envoy and Mara (and in the rival's town its envoy and caravan master) stand in each capital's square.
- Help: "Getting started" tells of choosing a kingdom and the story from anywhere.

### Under the hood
- The story is written by role: `'@role'` in conditions, effects, matches, bands and places, `{cast:role}` and `{cast:role.field}` in text, a band of a realm's `column` or `host` (js/story.js). `CL.story.castFor`, `startRealms`, `resolve`, `person`; `CL.town.peopleOf`. Dialogues renamed by role (`story_elder`, `story_recruiter`, `crown_agent`, `rival_agent`, `story_parley`); the endings and choices are `crown` and `rival`, not realm ids.
- `npm run simulate:story -- --every` plays the seeds in each kingdom in turn; `gate-d-campaigns` plays 7 campaigns in each of the six (42).
- `story: true` on forts and relations is gone (the cast decides). No schema step; old saves are not kept.

## v4.3.1 — The night run, and what it found (P10-00) · 2026-11-25

### New
- **The long run.** `npm run long-run [years]` plays the world alone for 30 years (the owner: "100 years doesn't make sense"), with every realm's ruler the AI's. Every day it checks every invariant, and four of its own: no negative money anywhere, no holding changing hands back and forth in a day, no endless loop of events, and no realm with more than half the land. Each year it reports the day's time, the save's size, the realms, wars, people and forts. `--trace` prints each new problem as it first happens.
- `tests/slow/long-run.test.js`: ten years of it in the slow suite.

### Fixed
- **A crash after a realm lost its last holding:** its patrols looked for a holding to ride to and found none. A realm that holds nothing now has no patrols until it holds land again.
- **A lord could stay counted in an army he had left.** When his household was broken, he rode out again from home before the army's next muster. The army now lets go of anyone whose party is not riding with it.
- **A lord who founded a realm could keep holding a village for the realm he left** (a village whose seat stayed behind). He now gives it up to the old crown, and keeps a claim on it.
- **A rising that lost all its land was left half-ended.** It has now lost the civil war: it ends as the crown's win, and its lords go home.
- **Runaway realms.** Over years one realm could take nearly all the land, mostly by forts surrendering to it. A realm controlling more than a quarter of the land is now overstretched: its sieges need more strength to begin, and no garrison surrenders to it for hopeless odds, only for hunger. The same rule holds for you.
- Two browser tests that sometimes failed: a beaten lord could die of his wounds before the ransom test began, and the tournament test could tap ATTACK after the bout had ended.

### Faster
- **The world runs about three times faster** than in 4.2.0 (twice as fast as 4.1.0). Every terrain lookup rebuilt every road, and the coast's roads made that much costlier. The roads are now kept, and far roads are skipped. The terrain is the same at every point.

### Under the hood
- `battle-parity` plays 30 seeds a scenario (was 40) and `gate-d-campaigns` 40 campaigns (was 60): the night run a little shorter.
- `CL.sieges.stretch` and `gatherNeed`; `CL.armies.needed` takes the realm.
- No schema step.

## v4.3.0 — Walkable towns: every capital and free city (P10-03) · 2026-11-25

### New
- **Every capital and free city has streets.** Walk the streets from the town menu in Eastwatch, Hrothgard, Vessara, Merrow, Gullhaven, Harrowgate and Calder, as in Stonebridge. Villages and forts keep their menu.
- **No two are alike.** Eastwatch is a walled forum of white stone round a fountain. Hrothgard climbs a snowy hill to the jarl's hall. Vessara is a harbour with a quay and jetties. Merrow sits on both banks of a river, joined by a bridge. Gullhaven's road runs down to the sea, and its portwarden works on the jetty. Harrowgate stands walled on a sea cliff. Calder is one long street of salt stalls beside the pans.
- **Each town's own people:** an innkeeper, a merchant, a recruiter and an elder or official, named in the town's own tongue, with their own words about the place.
- Each town builds in its own colours: red tiles in the empire, turf roofs in the north, slate on the cliffs, pale salt walls on the flats.

### Changed
- The streets tip and the help speak of every town, not only Stonebridge.
- The gate out of town can be on any side, and "To the road" points the way.

### Under the hood
- `data/town_hubs.js`: each townsperson has a `role`, and `CL.town.cast(settlement, role)` finds them, for the story to cast (P10-04). Content checks: every hub has an innkeeper, a merchant, a recruiter and an elder or official.
- Scenes may colour their buildings (`colors`), streets (`ground.road`) and square (`plaza.color`). An obstacle with no look is an unseen wall, for the sea and the river.
- `tests/town-hubs.test.js`: every town reachable from its gate to every person and back out, nobody under the joystick, TALK or the top bar, no scenery inside other scenery, the layouts different from each other, and every town walked by tapping.
- No schema step.

## v4.2.0 — One world: the coast joins the realm (P10-02) · 2026-11-24

### New
- **The coast is part of the realm.** The Sundered Coast, a separate world since 3.14.0, now lies in the far east, past Castra Nova and Merrow. The Kingdom of Ostrand holds the northern cliffs and the Saltreach League the salt flats, and they start at war with each other. The Free Port of Gullhaven trades between them. Two roads lead there: Castra Nova to Brindle, and Merrow to Marlow.
- **The Gullspine fells:** wild hills and mountains above the coast, with two raider lairs of their own.
- Each coast realm has two more lords than before: Arne Skarde and Leif Hask in Ostrand, Nella Vento and Dario Ferro in Saltreach. Each realm now has a ruler and five lords, as the others do.
- Gullhaven's traders ride on to Merrow. Gullhaven, Harrowgate and Calder hold tournaments.

### Changed
- One world: a new game no longer asks which world to play.
- The map is 350 by 200 (was 200 by 200). From the far west to Gullhaven is about three and a half days' ride.
- The coast's forts hold 22 men, as every fort does (was 20).
- **Old saves are refused.** A save from before 4.2.0 is kept safe and untouched, and a new campaign begins (the owner's rule: no old saves).

### Fixed
- A lord let go by an army, or forming up again after captivity, at home with thin ranks, now refills and rests at once. Before, it was marked "riding home" until its next step.

### Under the hood
- The world has an `edition` (2). Saves record `worldEdition`, and a save of another edition is refused and kept, as a save of another world is. Schema v1 and v2 saves are refused too.
- `CL.lords.sendHome`. `data/worlds/` keeps the loader for packs and later worlds, with a note and no world in it.
- The old-save tests are gone (D-P10g), and `tests/old-saves.test.js` checks that every old fixture save is refused and kept. `tests/fixtures/saves-4.2/` holds two saves of this build, test data for the browser's Continue and import cases (`node scripts/make-save-fixtures.js --current`).
- No schema step.

## v4.1.0 — Map speed and the Wait screen (P10-01) · 2026-11-24

### New
- **Map speed.** The map now runs at Normal speed, an hour a second, so a new player can follow what happens. The ▶ button beside the map's zoom switches to Fast (▶▶), four hours a second, as before, and back. Settings has the same choice. It is kept on the device, not in the save.
- **The Wait screen.** Wait (or Space) asks how long: days and hours, or a quick pick from 6 hours to 7 days, up to 30 days. The screen darkens, the world goes on as it would (parties, armies, sieges, markets, food, wages, wounds, news), and it lightens again: "3 days have passed."
- **A wait cut short.** A band or lord that reaches you stops the wait there. The screen clears and the encounter opens, saying how long you had waited.
- **A hint** about map speed after your first contract.

### Changed
- The Wait button no longer toggles open-ended waiting; it opens the Wait screen.

### Known
- The first-time map tip covers the ▶ button (and the − button) until it is closed.

### Under the hood
- `CL.settings.MAP_SPEEDS` and the `mapSpeed` setting; `CL.world.rate()` replaces `HOURS_PER_SECOND`; `CL.world.beginWait`, `waitNow`, `span` and `WAIT`; `CL.ui.openWait`, `setFade`, `toggleSpeed`.
- The Node test loader (`loadGame({ mapSpeed })`) and the browser helper run the map Fast, so the bots and the fixed-step tests are unchanged.
- No save schema step.
- **Tests:** 920 fast tests (new `map-speed`, 7 cases); lint clean but the 2 old warnings; typecheck clean. Browser full suite: 239 passed, 9 skipped (new `world-map` cases for the speed button, a wait and a wait cut short). Slow: none run (nothing they exercise changed).

## v4.0.0 — Kingdoms and Houses: tuning and acceptance (P9-T) · 2026-11-24

Phase 9 is complete in code. Its evidence, the tuning and the checks waiting on the phone are in `docs/PHASE-9-VALIDATION.md`.

### New
- **Your own treaties.** When you rule, the Your realm tab has a card for each realm: offer a truce or peace when at war, an alliance against a common enemy, or trade or a pact at peace. Their ruler answers at once, by their trust in you and what they think of you. You may break a treaty, but every court hears of it.
- **Simulate in big battles.** Its odds now sharpen with a battle's size: in a battle of 40 or more a side, a steady edge decides more surely than in a skirmish. Small fights are as before. The same rule for every field battle, yours and the lords'; assaults on the walls are unchanged.

### Changed
- A lord beaten in battle dies of wounds 6% of the time (was 3%).
- A war lasts at least 20 days, and ends by exhaustion after 40 fallen (was 12 days and 12 fallen, which one clash of armies reached).
- A faction keeps a member taken prisoner. A mediator calms it less (+5, was +10).
- A rising fights the crown it rose against first.
- The sample pack and the Sundered Coast accept every build before 5.0.0.

### Fixed
- After a reload, a realm you founded got a made-up second ruler with no home, which could crash the game when a lord rode out.
- Your court granted your own land away, your seat included. It no longer grants yours, nor any realm's seat.
- The old crown besieged your new realm while its 7 days to answer ran, and could take your seat before answering.
- A civil war could end in a truce by exhaustion, whatever the rebellion's state.
- A lord who changed realm stayed one day in his old realm's army.
- A lord who died stayed married.

### Known
- Wars are on 9–18% of days in a year of the world alone (the aim is 20–50%). Risings are rarer than aimed (one in three years), and deaths of lords vary from 0 to 5 a year.
- A realm can lose its last fort (Aurelia on one seed of three).
- The Sundered Coast has one war a year.
- Not tried on a phone: ruling, your treaties, the bigger battles' odds (`docs/PHASE-9-VALIDATION.md`, "Waiting on the owner's play").
- The 20-year and 100-year runs and the whole slow suite are for P10-00.

### Under the hood
- `CL.founding.offers`, `propose` and `renounce`; `CL.armies.leave`; `CL.autoresolve.BIG` and `oddsPower` (`winChance(pa, pb, walls)`).
- `tests/slow/phase9-exit.test.js`, design §18.9 as a scripted campaign with two reloads. Prototype G's `ruler` style (`node scripts/prototype-g.js 12 3 ruler`). `node scripts/landed.js 360 --seed <n>` plays one seed, so seeds run side by side; it now counts the days at war and the treaties per pair.
- The test loader keeps a loaded save's parties (a reload in a test used to drop them).
- No save schema step.
- **Tests:** 913 fast tests (911 of 912 together, the cross-device export passing alone; new cases in `founding`, `houses`, `armies`, `rebellion` and `packs`); lint clean but the 2 old warnings; typecheck clean. Browser: the full suite 231 passed, 21 skipped, and 4 failed in `packs.spec.js` (the engine ranges, fixed: then 4 of 4); `realm.spec.js` 12 of 12 with a new treaties case. Slow: `phase9-exit`, `campaign-bots`, `second-world`, `world-sim` and `test-world` pass; `landed` fails (Aurelia's last fort, seed 2). Not run: `battle-parity` and the whole slow suite (P10-00).

## v3.14.0 — Creator tools and a second world (P9-08) · 2026-11-24

### New
- **The Sundered Coast**, a second world: the Kingdom of Ostrand on the northern cliffs, the Saltreach League on the salt flats, and the Free Port of Gullhaven between them. Its own cultures, troops (three a realm) and eight lords. A sandbox: no story, and the two realms start at war.
- **Which world?** A new game asks which world to play, the Sundered Realm (with the story) or the Sundered Coast. Choosing the coast reloads the page straight back into the creator.
- **Saves know their world.** A save of the coast, opened while the Sundered Realm is chosen, opens the coast instead. The save is untouched.
- **The pack checker:** `npm run check-pack <folder or file>` checks packs and whole worlds with the game's own checks and messages, and exits with code 1 when anything is wrong.
- **The map preview:** `tools/preview.html` draws a world's or a pack's map (places, roads, rivers, regions, sites) and lists what the checks found.
- "Getting started" has a line on worlds. `docs/WORLD-FORMAT.md` has "Making a world".

### Known
- The coast's realms start at war, but the war ends in a truce within about 11 days and rarely returns in 180 days (the shared world pacing). Left for P9-T.
- The second world was played in the desktop pane at phone size, not on a phone.
- The coast's troops, banners and Gullhaven use today's art (requests in `docs/ASSETS.md`, rows 15–20).

### Under the hood
- `js/worlds.js`: the worlds this build has, the one chosen (`crownless_world`), put in place at load before anything reads the content. A world is `data/worlds/<id>.js` in the world format (`kind: "world"`): the tables it gives replace the game's whole; `merge` changes the shared ones (`CL.content.compose`).
- `CL.packs.checkWorld`: the checks for a whole world; `parse` takes either kind. A pack's id may not be any official world's.
- `quests`, `dialogue` and `town_hubs` may be empty. A sandbox world (`sandbox: true`) begins after its story (`ending: 'sandbox'`).
- The bots take a world: `landed` and `prototype-g` (`--world <id>`, or `{ world }`), `newCampaign(seed, background, { world })`; `loadGame({ world })` in the tests.
- No save schema step: `worldId` was already recorded.
- **Tests:** 905 fast tests (1 new in `packs.test.js` for the checker, 2 new in `world-package.test.js` for the coast); browser `startup.spec.js` and `packs.spec.js` 16 of 16 (2 new); slow suite 18 of 22. The 3 new coast tests in `slow/second-world.test.js` pass. The 4 failures were already failing at the P9-06 checkpoint: landed seed 3, the Phase 8 exit, Prototype D and Prototype F.

## v3.13.0 — Content packs (P9-07) · 2026-11-24

### New
- **Content packs.** A pack adds to the world: places, troops and more. It is a JSON file and holds data only: nothing in it is ever run. Import one in Settings → Content packs, turn it on, and start a new game or reload.
- **Precise errors.** A pack with a problem is refused, and each problem says which file, which entry and what is wrong ("bad.json › sample:cairn_spear: … unknown upgrade sample:nobody"). A pack is checked for size (2 MB at most), code, paths, references and the game's own rules before it is kept.
- **Saves and packs.** A new save records the packs it began with. Opened with one of them off, it is refused and left as it was: "This save needs the pack sample (version 1.0.0)". Turn the pack on and reload, and it opens.
- **The sample pack** (`packs/sample/sample.json`): Highcairn, a village of Valedorn west of Westholt, which recruits a new line of three (Cairn Herder, Cairn Spear, Cairn Warden).
- A village or town may now recruit troops of its own, beside its realm's (`recruits` on a settlement).

### Known
- Packs were tried in the desktop pane at phone size, not on a phone.
- A save refused for a missing pack is kept as it was, but if you start a new game before turning the pack back on, the old save is only in the incompatible slot, with no button to bring it back.
- The official world still loads from `data/*.js`; the JSON export is checked against it, not used in its place.

### Under the hood
- `docs/WORLD-FORMAT.md`: the manifest, the tables, `merge` and the checks. `node scripts/export-world.js` writes the official world in the format; a test loads it and compares it with `data/*.js` table by table.
- Ids are namespaced: `sundered_realm:stonebridge` reads as `stonebridge`; a pack's entries are `<pack>:<name>`. The id checks for budgets, story flags and quest tags take a colon.
- `js/packs.js`; packs in IndexedDB (database `crownless`, store `packs`), the ones turned on in `crownless_packs_on`. With none on, the game starts as before, without waiting.
- No save schema step: `packs` is optional.
- **Tests:** 902 fast tests (6 new in `packs.test.js`, with a table of 27 bad packs); the full browser suite 231 passed, 9 skipped (4 new in `packs.spec.js`); slow `test-world` passes.


## v3.12.0 — Houses, marriage and claims (P9-06) · 2026-11-23

### New
- **Houses.** Every lord belongs to one: parents, children and siblings under the eldest's name. A house keeps its name and people even with no land. Lords think of a house as of its people, and also remember what was done to the house itself.
- **Your house,** founded when you first hold land, in your name. Rename it at the top of the Lords tab.
- **Marriage.** On the Lords tab, Ask… a lord, then Propose marriage, with or without a dowry. They answer for reasons you can read: what they think of you and your house, what the match is worth to their house, the dowry. Married, you share each other's claims and the houses are allies. Your spouse may ride with you or run one of your holdings, and may refuse. After 90 days either of you may end it, and the houses become rivals. Lords marry among themselves too.
- **Deaths.** Now and then a lord beaten in battle dies of wounds (3%). You never die. The dead stay in the Lords tab with the day they died.
- **Succession** by the realm's law: the eldest child, the kin the lords think best of, or the council's choice. The heir takes the land and the office; a ruler's heir the crown. A close second keeps a claim and may raise a faction. With no heir, the crown takes the land and grants it.
- **Claims through houses.** A claim passes to the heir, or the house, when its holder dies. A claimant may petition their liege to restore what the crown holds (the Lords tab, for you).
- Debug: **Lord dies** (the nearest) and **Marry me**.

### Known
- Marriages are few: one or two a year in a world.
- No heir was seen in play: every lord near the owner's save holds no land.
- On one test seed Valedorn loses every fort in 90 days. Without the houses' rules the same seed keeps them, so the order of events changed; the armies (3.11.0) take the forts.
- Three slow tests (the Phase 8 exit, Prototypes D and F) fail since 3.11.0's armies.

### Under the hood
- Save version 30: `houses`, `nextHouseId`; `spouse`, `married` and `status: 'dead'` on people.
- `npm run landed` reports marriages, deaths, heirs by law, contested successions and restorations.
- **Tests:** 896 fast tests (7 new in `houses.test.js`); the full browser suite 227 passed, 9 skipped; the slow suite 15 of 19.

## v3.11.0 — Armies and campaigns (P9-05) · 2026-11-23

### New
- **Armies.** A realm at war raises an army: its marshal calls up to six lords, and each answers by what they think of the ruler. They gather at the realm's fort nearest the target and march when half have come, or after a week. On the map an army is one banner with its size; each lord keeps their own men and losses.
- **What armies do.** Besiege a fort (the siege of P8-06a, laid by the army), relieve one of their own, raid a village (its prosperity falls, the raiders take a week of its tax, and its lord remembers), chase an enemy army, defend, or fall back.
- **Supply and cost.** An army eats: it fills its stores in its own land, forages in enemy land (the villages suffer), and starves when there is nothing left (its men desert, the furthest first). It costs its realm a crown a soldier a week; unpaid for a week, it breaks up. After a month in the field it goes home.
- **Battles of armies.** Two armies that meet fight it out. The beaten one falls back, or breaks up if it lost half its strength, and some of its lords are taken.
- **Capitals can fall,** to an army only, with a garrison and stores half again a fort's. The ruler moves to their next holding; a realm that holds nothing is gone, and its lords seek service elsewhere.
- **You in an army.** Summoned, the Allegiance tab shows the army and **Ride to its banner**: you keep beside it until you ride elsewhere, and its battles are yours (both armies' lords ride into the field). As a ruler, **Raise an army** on the Your realm tab and give its orders: besiege or raid a place, ride with you, or go home.
- Debug: **Raise an army here** (the chosen holding's realm) and **Four armies** (the phone test: four armies on the map at once in the map stress test).

### Known
- Armies often go home with nothing they can do: too weak for the forts in reach. In five worlds of 180 days, no capital fell. For P9-T.
- Some news names a realm founded in play "unknown", and some siege lines say "the The …".

### Under the hood
- Save version 29: `armies`, `nextArmyId`, `armyRest`, `armyCall`; a raid's effects on the holding.
- `npm run landed` reports armies raised, their sieges, battles and raids, why they broke up, capitals taken and realms gone. `node scripts/bench-map.js --armies` times the map with four armies.
- Fixed on the way: a realm founded in play gave its lords troops of no kind (3.9.0); two type errors (3.8.0, 3.10.0).
- **Tests:** 889 fast tests pass; the browser specs for sieges, the map, nobles and allegiance (32 of 32); the slow landed, campaign-bots and world-sim tests (world-sim's day times failed once while other tests ran, and passed alone).

## v3.10.0 — Rebellion and deposition (P9-04) · 2026-11-23

### New
- **Factions.** Lords who think ill enough of their ruler, and well of one another, gather around a claimant: the ruler's kin if one is among them, else the strongest. Grievances alone make them; there is no dice roll.
- **Warnings,** a week apart: whispers in the news, your companion's word, a lord who trusts you. Rulers hear them too.
- **The ruler's answers:** concede land, a lower share or an office; send a mediator both sides trust; win one of them over; arrest the claimant (they may rise at once); or prepare for war. If you rule, the Your realm tab offers them, and the demands after.
- **The rising.** Demands refused, the faction becomes a realm of its own at war with the crown, its lords' land and garrisons with it, and the other lords choose a side. Sworn to that realm, you are summoned by both: choose on the Allegiance tab.
- **Three ends:** a peace is a compromise (the claimant pardoned); take all the rebels' forts and the crown wins (their fiefs revoked); leave the crown no fort and the claimant rules. Then 90 quiet days in that realm.
- **Deposed,** you keep your company, companions, businesses and a claim to the crown, and an old enemy who thinks well of you may offer refuge.
- Debug: **Faction now** and **Rise now** for the chosen holding's realm.

### Known
- In a year of the world alone, factions form (five or six) but every ruler sends a mediator and they break up: no rising yet. The rules for a faction are looser than planned (a grudge of −10 rather than −30), and still need tuning. For P9-T.
- A rising's leader is styled as its ruler ("King Hamon").

### Under the hood
- Save version 28: `rebellions`.
- `npm run landed` reports factions, how they were answered, risings, how they ended, and days of civil war per realm.
- **Tests:** 878 fast tests pass; the full browser suite (221 passed, 21 skipped); the slow suite 18 of 19 (Prototype D fails, as it did in 3.9.0).

## v3.9.0 — Founding a kingdom (P9-03) · 2026-11-23

### New
- **Found a realm of your own.** Hold a fort, win 600 renown and gather 40 soldiers, and declare a realm there from the Realms screen's new **Your realm** tab. It flies its own banner, with its land's troops and culture and a crown's laws. Your holdings go with you; the crown you held them of keeps a claim on each, and has 7 days to accept your realm or go to war.
- **Land of your own.** With no crown behind you, a fort you claim and retake is yours, held of no realm. Nobody recognises it, and any realm may besiege it.
- **Recognition.** Other realms recognise a new realm or not, by their trust and what their rulers think of its founder; one that doesn't may besiege its forts as if at war (but not fight it on the road). Peace counts as recognition.
- **Vassals.** Lords who think ill of their own ruler and well of you ask to swear to you; accept or decline on the Your realm tab. Grant them land and summon them to a siege: they answer by what they think of you.
- **Rule as you ride.** Your steward, marshal and chancellor each follow a policy you set in a line: taxes on your land, which sieges your realm plans, which treaty offers it accepts. Only a treaty offer, a lord asking to swear, or your seat besieged come to you, as a message.
- **Lords found realms too:** one with land, men and a grudge against their ruler. At most one new realm in the world in 180 days.
- A **Your realm** help topic and a first-time tip; Debug: **Declare my realm here**.

### Known
- In 180-day runs of the world alone, no lord founded a realm: the grudge they need is still rare. For P9-T.
- You can't make treaty offers of your own yet, and your officers' offices stay vacant until a vassal holds land.

### Under the hood
- Every realm is looked up through `CL.realm` (a grep test), so a realm founded in play is one everywhere a data realm is.
- Save version 27: `realms`, `nextRealmId` and `rule`. A save is read with its own founded realms.
- **Tests:** 870 fast Node tests, all passing. Slow `landed`, `campaign-bots`, `test-world` and `phase8-exit`, passing (the Phase 8 exit, failing since 3.7.0 when the crown began granting two villages on the way, hands them back first); the others not run. Browser `realm` and `world-map`, passing at both sizes; the full suite not run.

## v3.8.0 — Diplomacy and treaties (P9-02) · 2026-11-23

### New
- **Treaties.** Realms make peace (sometimes with a weekly tribute), truces, pacts of nonaggression, alliances, treaties of passage and of trade, each with its end day. A war that wears out leaves a 30-day truce, now a treaty.
- **A pact holds.** A border that heats to the brink stays short of war while a pact of nonaggression or an alliance stands, unless one side's rulers think ill enough of the other to break it.
- **Allies.** An attacked realm's allies march if they can afford a war. Asked to join an attack, an ally weighs it and may say no.
- **Trust.** Each realm trusts the others' word more for every month a treaty is kept, and much less when one is broken: the injured realm most, every other court a little. A realm that trusts another too little won't sign with it.
- **The realms' offers.** Once a week a realm may make an offer: a truce when a war goes badly or its treasury runs low, peace with tribute when beaten, an alliance against a neighbour twice its strength, trade when rich and at peace. The news tells of treaties made and broken.
- **The Diplomacy tab** on the Realms screen: each pair of realms, their state, their treaties with end days, and their trust. A first-time tip explains it.
- **The envoy.** As a vassal, your realm's offer may wait on its capital's board for three days: carry it to the other court for 60 crowns and +5 standing, and it is better heard. Left there, it goes without you.
- Debug: **Offer a treaty now** for the chosen holding's realm.

### Known
- Treaties of passage and of trade have no effect yet beyond trust: there are no tolls or borders for them to lift.
- Pacts are rarely broken: rulers seldom think that ill of each other. For P9-T.

### Under the hood
- Save version 26: `treaties`, `nextTreatyId`, `trust` and `offers`. Older saves load, each truce still running becoming a truce treaty.
- `npm run landed` reports treaties made by kind, kept to their end and broken, allies declining, days at war per pair, and days each realm is at peace with all.
- **Tests:** 861 fast Node tests, all passing. Slow `landed` and `world-sim`, passing; the others not run. Browser `realm`, `settlement` and `allegiance`, passing at both sizes (the allegiance spec's service line, out of date since 3.7.0, updated); the full suite not run.

## v3.7.0 — Realms as organisations (P9-01) · 2026-11-23

### New
- **Every realm has a treasury.** It takes the crown's due from every fief, the whole tax of its ruler's own land and the ransoms paid to it. It pays its mercenaries, the garrisons of the ruler's land, its lords' ransoms when their kin can't, and its officers. Nothing comes from nowhere any more.
- **A realm with an empty treasury** hires no company (the offer says why), pays its mercenaries short, can't ransom its lords, and its own garrisons go unpaid and desert.
- **Laws.** Each realm has laws: a crown or a league, the crown's share of the tax, how an heir is chosen, how many fiefs a lord may hold, and who makes war. The Vessaro League is a league: its council of lords decides war, and goes to war only when its lords think ill of the other ruler.
- **Offices.** Every realm has a marshal (named first for its sieges), a steward (a little more of the crown's due) and a chancellor, chosen by the ruler from the lords with land. A lord passed over remembers it. A captive's office falls vacant and is filled within three days.
- **The Realms screen:** each realm's card shows its treasury and whether it is rising or falling, its laws in a line, and its officers.
- Debug: **Realm treasury +1000** and **−1000** for the chosen holding's realm.

### Changed
- A mercenary's pay comes from the realm's treasury, and the service offer says how much is in it.
- The ruler's own land is the crown's: its tax goes to the treasury and its costs come from it. The treasuries of the ruler's holdings are the ruler's own purse, untouched.

### Known
- The Vessaro League rarely goes to war now: its lords seldom think badly enough of another ruler. Treasuries grow over 180 days of peace (from about 800 crowns to about 5,000). Both are for P9-T.
- You can't be given an office yet (P9-03).

### Under the hood
- Save version 25: `crowns`. Older saves load, each realm starting with four weeks of its income.
- `npm run landed` reports each realm's treasury at the start, its lowest and the end; the books are checked every day with the other invariants.
- **Tests:** 853 fast Node tests, all passing. Slow `landed`, `campaign-bots`, `world-sim` and `phase7-exit`, passing; the others not run. Browser `realm`, passing at both sizes; the full suite not run.

## v3.6.0 — The lords' loose ends (P9-L1) · 2026-11-23

### New
- **Lords ransom their own.** A lord held by another crown is bought back by their kin (or, after a month, their ruler) from the treasuries of their fiefs, and remembers who held them. After two months unpaid, the captors let them go.
- **Lords lend each other men.** A lord whose ranks are thin asks a kinsman or a friend, who answers as lords answer you; kin of one crown usually help.
- **Land-hungry lords.** A landless lord asks the crown to press their claim, and rides unsummoned to a siege that could win them land. A claim the crown presses leads its next siege.
- **A new petition:** a lord short of coin with a market may ask you to escort their own caravan to a town of their realm, for half again a board escort's pay.
- **Serve for it:** on the Claims tab, at peace, instead of buying a lost fort back: win four battles against the holding crown's enemies within 30 days, without touching its people, and it is handed back.

### Fixed
- Accepting a lord's petition to pay a ransom for their kin no longer fails.

### Under the hood
- No save change: the new fields are optional and kept in saves.
- `npm run landed` reports the loose ends: ransoms, men lent, claims pressed and sieges joined.
- **Tests:** 845 fast Node tests, all passing. Slow `landed` and `prototype-f`, passing; the others not run. Browser `nobles` and `claims`, passing at both sizes; the full suite not run.

## v3.5.0 — The walls at the world's scale (P9-B5) · 2026-11-22

### Changed
- **Storming a fort is as hard as its odds again.** Since 3.3.0 garrisons are three times bigger, but they came down from the wall 8 at a time, so a company could take a fort it had little chance against. Now the assault is fought as one army a side, with reserves, as battles on the map have been since 3.2.0.
- **You meet the part of the garrison on the stretch of wall you strike** (a little over half; the rest hold the other walls). **Defending,** most of the garrison fights beside you, and those who don't fit on the field come in as others fall.
- **Ladders:** a ladder takes two at a time, climbing is slow and breaks ranks, and nobody can strike from a ladder. The rest wait at its foot.
- **A battle where neither side will close now ends,** even with reserves still waiting: the whole army withdraws.
- Debug: the practice assaults come as one army; new **Siege assault 100**.

### Known
- At a battle size of 40, storming is still much easier than its odds and defending a little harder. At the default of 150 they are about right.

### Under the hood
- No save change.
- `node scripts/parity.js --siege` measures the walls at the world's scale (a company of 48 against a garrison of 66) at a battle size of 150; `--size 40` for another size.
- **Tests:** 839 fast Node tests, all passing. The slow files this reaches (battle-parity with the siege test, battle-extras, campaign-bots), all passing; the other slow files were not run. 228 browser tests: 206 passing in the full run, 21 skipped by design, and one (the slow-battle offer, which reads this machine's frame rate) failing under the suite's load but passing alone.

## v3.4.0 — Command in layers (P9-B4) · 2026-11-22

### New
- **Divisions.** Your company fights in up to six divisions: infantry, archers, cavalry, and a second of each. A type of more than 30 splits in two by default. On the Prepare screen you can move a troop type to another division and rename a division; on a soldier's card on the Party screen, move one soldier. A company that changes nothing fights as before.
- **New formations:** a **line** (wide, two deep), a **column** (narrow, quicker on the march) and a **square** (a ring that braces against riders from every side, slow). Foot may take all six, archers loose, line and column, horse loose, wedge, line and column.
- **Auto, the new default setup.** It chooses from the odds: Aggressive when you are much the stronger, Defensive with a shield wall when you are much the weaker, Balanced between. Archers on a rise stay there, and the horse go to the open flank.
- **The enemy plans too,** when it is an army of more than 20 met on the map: much the weaker, it holds and waits; otherwise it comes on. Either way it forms up in blocks.
- **Orders by division:** the Orders panel has a button for each division in the battle (keys 1 to 6), and only the formations that division may take.
- **Captains and plans of your own.** On Prepare, a folded Divisions section: each division's captain (a veteran of tier 3 with 10 battles, or a companion), formation, facing and name, and three plans you can save and use again. A captain steadies their division and quickens it a little. Every division's flag can be dragged.
- **Live command on the tactical map:** choose a division, then Move, Charge, Fall back or Face, and when: now, in 5 or 10 seconds, or on your archers' next volley. Orders given together go off together.
- Debug: Reset divisions.

### Known
- Big battles at 40 and 100 are still won far more often than Simulate's odds say (+29 to +37).
- **Storming a fort is too easy since 3.3.0.** The garrisons grew three times, but they still come down from the walls 8 at a time, so a company can beat a far bigger garrison. The assault needs re-fitting for armies.

### Under the hood
- No schema step: an optional `divisions` field in the campaign, and `prepPlans` in the device's settings.
- The extras measurement sets the wedge per division again (it had been fighting in loose ranks).
- **Tests:** 835 fast Node tests, all passing. The whole slow suite: 18 of 19 passing; the siege test fails as above (since 3.3.0). 226 browser tests: 205 passing after fixes to the text-size checks (a closed fold is no longer counted, the Divisions fold is checked open, and the formation row wraps), 21 skipped by design (the visual snapshots, and checks for the other device).

## v3.3.0 — A bigger company (P9-B3) · 2026-11-22

### New
- **Lead up to 200.** How many you can lead: 8, and 5 for each point of Leadership, 1 for every 20 renown, 10 for each companion riding with you as an officer, 15 for each fort or town you hold and 5 for each village, and 2 while a kingdom counts you Friendly. The Party screen shows the sum.
- **Hire five at once** from a recruiter, once you have the room.
- **A big company on the Party screen:** with more than 20 soldiers, they are grouped by troop with counts (wounded, ready to upgrade); tap a group to see who is in it.
- **Detachments** from a big company: choose five more of a troop at a time.
- **A bigger world to match:** every lord rides with a household three times the size (36 to about 80), and every fort's garrison is three times the size at the same cost to its holder. Beyond the Border March, bands, patrols and caravans are two and a half times the size. The March itself is as it was.
- The quartermaster's fixed weekly budget may go up to 10,000 crowns.
- **A bigger company earns more.** Contracts are matched to your company as before, but past 20 in it the boards offer bigger bands and ambushes, for bigger pay. A kingdom pays its mercenaries their soldiers' wages and a tenth more (it was 3 crowns a soldier).

### Changed
- A kingdom's last fort is stormed only at better odds (85%, from 75%), so no kingdom is left without one.

### Under the hood
- No save change. Older saves' garrisons grow to the new size within weeks.
- The world package has `armies` (households, garrisons, beyondHome), validated with the rest.
- The test bots play as careful captains past 20 soldiers (three weeks of wages in hand, a mill before growing further). They reach 85–95 soldiers by day 180 and over 100 within a year.
- **Tests:** 828 fast Node tests; the slow files this reaches (the campaign bots, world-sim, landed, the Phase 7 and Phase 8 exits, Prototypes D and F), all passing after fixes; 199 browser tests with 9 skipped, all passing.

## v3.2.0 — Proportional battles, reserves on both sides (P9-B2) · 2026-11-22

### New
- **A band or a lord you meet on the map fights as one army,** no longer in waves of 8. The field is shared by the two sides' numbers: 300 against 200 at a battle size of 100 fight 60 against 40, never fewer than 10 a side. If everyone fits, everyone fights.
- **Both sides send in their reserves** as men fall or flee, keeping their share: in groups (bigger in bigger battles), from behind their own line. The messages come at most every few seconds.
- **A party that rides in** joins its side's reserve, first in line, and the field is shared again by the new numbers. As many as there is room for ride straight in.
- **The Prepare screen** says how the field is shared: "You: 150, 60 on the field. Them: 100, 40."
- Lairs, story fights, the tournament and the walls' assault still come in waves.

### Changed
- **The enemy's loose line** is looser and kept whatever the numbers. As one army, the old line made an even fight hopeless, and the old swarming made an outnumbered one easy. Fought battles are again a little better than Simulate's odds (5–15 points on average, `npm run parity`).

### Known
- In big battles a company with many archers wins far more often than Simulate's odds say. Against 11 at once the wedge now does worse than loose ranks. Both are for the command task (P9-B4) and Phase 9's tuning.

### Under the hood
- No save change.
- `npm run parity -- --big` measures big battles at sizes 40 and 100.
- **Tests:** 821 fast Node tests; the whole slow suite (18 tests, the checkpoint: two fixed and run again); 195 browser tests with 9 skipped. In the full run, the phone's battle-zoom pinch failed once under load (a known flake) and passed alone.

## v3.1.1 — The phone's battle size · 2026-11-22

### Changed
- **Battles start at 150 at once** on phones and computers. On the owner's phone every size from 40 to 150 ran at 60 frames a second (Debug → Battle benchmark).
- **The battle size goes up to 200** (Settings → Battle size). The large fields grow to fit (4.2 screens across at 200), and the benchmark measures 200 too, as does Debug → Stress 200.

### Under the hood
- No save change.
- **Tests:** 814 fast Node tests; the battle size's own browser specs at both sizes.

## v3.1.0 — Battle size, measured and raised (P9-B1) · 2026-11-22

Phase 9, "Kingdoms & Houses", begins with battles at a bigger scale.

### New
- **Battle size from 20 to 150 at once** (Settings → Battle size, in steps of 10). Until you choose, a device starts at its default: for now 100 on a computer and 60 on a phone, until the owner's phone benchmark sets the phone's. A size you chose is kept.
- **A slow battle offers a smaller size:** if a battle runs under 30 frames a second, its result screen offers a smaller battle size once. It never changes by itself.
- **Big battles have room:** more of your company starts on the field (up to 74 of yours at 150), a big company forms a wide line, and the large fields grow in battles of over 80 (up to 3.75 screens across at 150). A company no bigger than before forms up exactly as before.
- **Big battles stay readable:** above 80 at once there are no hit rings, health bars show only over the badly hurt, and the fallen fade from the field after 20 seconds.
- **Debug → Battle benchmark:** the same open-field battle at 40, 60, 80, 100, 120 and 150, 30 seconds each, reporting each size's frame rate, slowest frame and simulation and drawing time, and the largest size at 30 fps or better. Also Stress 100 and Stress 150.

### Under the hood
- No save change. The battle size stays a device setting.
- **Faster battles:** at 150 the simulation costs about half what it did (finding the nearest opponent without sorting everyone; one grid for morale, group states and sight, with the same answers). Arrows are drawn in one stroke a side.
- `npm run bench` runs the benchmark's battle at the same sizes in Node.
- **Tests:** 814 fast Node tests; the slow files this reaches (`battle-parity`, `battle-extras`); 193 browser tests with 9 skipped (the visual baselines, Linux only, and those for one device only). In the full run, the phone's ford battle failed once on its timed walking under load; it passed 8 times out of 8 alone.

## v3.0.0 — The Landed World (P8-T) · 2026-11-21

Phase 8 is complete: holdings and the people of the realms, permissions, lords on the map, allegiance, fiefs, sieges and the assault battle, named nobles, and losing and retaking land. This release tunes it and checks the phase's exit; the evidence is in `docs/PHASE-8-VALIDATION.md`.

### Changed
- **A fort pays for itself** on the defaults: about +10 crowns a week (it lost 19 before). A village still makes about +22. The lords' forts live by the same rules.
- **A sworn vassal's first land comes sooner:** the crown gives one of its own villages after 30 days of service (from 60).
- **A kingdom's last fort holds out for its relief:** its besiegers wait for the ram and better odds before they storm it, and it surrenders only when the food runs out. Over 180 days on six seeds, every kingdom keeps a fort.
- When you ask the crown for a fort you took, you come first for its grant even if the crown had already put it up.

### Under the hood
- No save change.
- **The Phase 8 exit** runs as a slow test: 120 days in one save, reloaded halfway: serve and swear, win a fort, lose it while away, go landless, change crowns and retake it.
- **Prototype G** has a fourth style, the landed player, and counts the decisions that interrupt the map (about one in 120 days for a landed player).
- **`npm run landed`** also reports how many landless lords won land, how many landed lords lost it all, and the most of a kingdom's land one lord holds.
- **Tests:** 806 fast and 17 slow Node tests (the whole slow suite, the checkpoint), 187 browser tests (9 skipped: the visual baselines, Linux only, and those for one device only).

## v2.32.0 — Losing and retaking land (P8-08) · 2026-11-21

### New
- **Losing land is clear.** A fort taken in a siege, a fief your liege takes back, land lost by leaving a crown, or a fief you hand back yourself: each tells you who holds it now and whether you keep a claim. Your company, money, mill and followers are always yours.
- **Your castellan** walks out of a surrender, but is taken prisoner if the fort is stormed, and freed when you win it back.
- **Your liege can take a fief back.** Miss a call while holding their land and you are warned; miss a second and they take a fief back (a village first). The third still casts you out. If your standing with them falls toward Hostile, you are warned first.
- **Hand a fief back** from the Fief tab (Give it back, then a word of what it means).
- **Claims.** Holding nothing, the Fief tab becomes Claims: each place you have a claim to, how you lost it, who holds it now, and what could press it. No chores. A claim pays nothing, but your policies there are kept with it.
- **Press a claim:** retake it by siege (if your liege backs the claim it is yours again at once, with the villages you held); ask your liege to press it in their war (their next siege goes for it); or, at peace, buy it back from the crown that holds it. A claim on your own crown's land becomes a grant offered to you.
- **Debug → Nobles: Prototype D start:** you hold Westholt Castle and Ashby for Valedorn, with a warband of 12 and a mill, and Hrothmark's lords gather against Westholt. Play the loss and the return.

### Under the hood
- No save version change: a few optional fields (a claim's kept policies, a liege pressing it, a castellan held with a fort, the warnings given).
- **Prototype D**, the dispossessed lord, runs as a slow test: lose the fort while away, lose the office, live 15 days landless, serve and swear to another crown, and retake the same fort, with no land or soldiers doubled.
- **Tests:** 806 fast Node tests; the slow files losing land reaches (the campaign bots, the test world, the landed run, and Prototypes D and F); 187 browser tests (9 skipped: the visual baselines, Linux only, and those for one device only).

## v2.31.0 — Named nobles (P8-07) · 2026-11-21

### New
- **The lords want things, and remember.** Each has needs (land, coin, men, safety for their lands, a name to make), motives from their character (guards their lands, hungry for glory, loyal to the crown, owes it nothing, minds the coin), and opinions of you, their ruler and each other, built from what was done to them, and half of what was done to their kin. Tap a lord on the map to see what they want most.
- **The Lords tab** (the Realms screen) shows every lord: what they hold, their kin, friends and rivals, what they want most, where they are, and what they think of you and why.
- **Ask a lord** (Ask… on the Lords tab) to join your siege, relieve your fort, ride with you for three days, or back your claim at court. They agree, name a price (or a favour), say when they can come, or refuse, and tell you why: the crown you share, what you did for them, how far it is from their lands and what threatens them, whether they fear you. A refusal holds for a week; ask again once you've given them a reason.
- **Lords quarrel among themselves.** Those who fought a siege together become friends and back each other at court; those passed over for a grant become rivals; a lord whose fort was taken has a feud with the taker, and their realm goes for it first at war. Feuding lords won't ride together.
- **Lords change sides by your rules.** One who thinks too little of their ruler grumbles at court (the news tells it), and a week later leaves for another crown: released at peace, or defecting at war with a claim kept to the land they lose. A lord who keeps refusing their ruler's summons loses a fief to someone else.
- **The ruler's summons.** Every lord called to a siege answers by the same reasons, and some refuse. As a sworn vassal you are summoned too: be at the siege before it ends, or it is a call missed.
- **Petitions.** A lord who thinks well enough of you may ask a favour: clear the bandits about their lands, a loan, a kinsman's ransom, your word for their claim or a grant. Answer it at the top of the Lords tab.

### Changed
- The crown's grants weigh opinions: its goodwill to each candidate, and their friends and rivals at court (and your backing and influence for you).
- A lord who takes a fort decides what to do with it by their character.
- Your siege's card shows the lords who answered you, in camp or on the road.
- Defecting tells you how many of that realm's lords who think well of you will think less of you.

### Under the hood
- Save version 24. Saves from 2.30.0 load; the deeds they kept (lords you freed, ransomed or held) become those lords' opinions of you.
- `npm run landed` also reports land gained and lost, who grumbled and who left each realm, summonses refused, revocations, friendships, rivalries and feuds, and the riding lords per realm.
- Debug → Nobles: Lord likes me, Lord grumbles, Lord leaves realm, Petition now, Nobles: a week.
- No new art: the Lords tab is text.
- **Tests:** 797 fast Node tests; the slow files nobles reach (the campaign bots, the landed run with its new checks, the world simulation, the world-event bots and the new Prototype F); 183 browser tests (9 skipped: the visual baselines, Linux only, and those for one device only).

## v2.30.0 — Storming the walls (P8-06b) · 2026-11-21

### New
- **Fight your assault on the walls.** Your siege's card now offers Storm the walls (fought) beside Simulate. The battle is on the fort's wall: the only ways up are the ladders (one for each day of preparation, three at most) and the gate. Keep soldiers at the gate once you have a ram (after three days) and it gives way. The defenders hold the wall and shoot from the walkway. Rout them, or hold the courtyard, and the fort is yours.
- **Thrown back, not captured.** A lost assault costs you soldiers, but nothing is seized and nobody takes you.
- **Defend the walls.** If you are inside a fort when its besiegers storm it, you fight on its walls, with part of its garrison beside you. Hold, and the siege is lifted.
- On the walls your infantry go for the ladders and your archers stay behind them. Defending, your archers take the walkway and your infantry the gate.

### Under the hood
- No save change.
- Fought assaults come out a few points better than Simulate's odds, as other fights do: 9 points over when attacking and 15 when defending (`node scripts/parity.js --siege`, 40 seeds).
- Debug → Battle size & stress test: Siege assault 30 and Siege defence 30, practice fights on the walls that report the frame rate.
- **Tests:** 777 fast and 14 slow Node tests, 179 browser tests (21 skipped: the visual baselines, Linux only, and those for one device only).

## v2.29.0 — Sieges (P8-06a) · 2026-11-21

### New
- **Kingdoms at war besiege each other's forts.** Their lords gather, then encircle the fort: it and its villages shut their gates and markets. They make ladders in a day and a ram in three, and storm the fort when the odds are good. A fort out of food, or facing hopeless odds, surrenders. The defending kingdom's lords ride to relieve it. A fort under siege is ringed in red on the map, and the news tells of every siege begun, lifted, relieved and won.
- **Your fort besieged** brings an urgent message: ride back, or leave it to its steward or castellan. A scout who sees the lords gathering warns you a day earlier. If it falls, its money and control are lost, but you keep a claim, your company and your oath.
- **Besiege a fort yourself,** from its own screen, when your kingdom is at war with it, or as an independent at the cost of attacking that kingdom (−25). Its card shows the garrison, what its walls are worth, the odds of storming it, and how long starving it out would take. Then each day: assault, wait, or lift. If you ride away, the siege ends. Take it and you make the conqueror's choice.
- **A fort taken is weak:** half a garrison, broken walls and unrest for a month.

### Changed
- **Wars leave a truce:** after a war ends, the same two kingdoms can't go to war again for 30 days.

### Under the hood
- Save version 23. Saves from 2.28.0 load with no sieges, each fort with its food.
- **`npm run landed`** plays 180 days of the world alone, after the story's ending, and reports wars, sieges, forts per kingdom, grants and the lords' land. It's also a slow test: forts change hands, and no kingdom loses them all.
- Debug → Lords: siege the chosen fort (its enemies go to war and gather), and a day for every siege.
- **Tests:** 771 fast Node tests and the slow files sieges reach (the 60-campaign story check, the world simulation, the new landed run, the campaign and world-event bots), 177 browser tests (21 skipped: the visual baselines, Linux only, and those for one device only).

## v2.28.0 — Fiefs and castellans (P8-05) · 2026-11-21

### New
- **Every town, fort and village now pays and costs.** Each week its lands pay tax by their prosperity, its garrison or militia is paid, a tenth goes to the crown, and the garrison is topped up from the realm's recruits. The kingdoms' lords live by the same rules, so a lord with rich land fields a fuller household.
- **The crown grants land.** What it takes in war, what it takes from a lord held too long, and what a vassal leaves behind, it grants within a few days. First choice goes to whoever did most to take it, then landless lords, then those with fewest fiefs, then service and renown. As a sworn vassal you compete with the lords: your first grant is most likely a village, and a fort wants more renown and service. A grant comes as a message: Accept or Decline.
- **The conqueror's choice.** Take a fort for your realm and choose: ask the crown for it (the default), name a lord for it (they'll remember), hand it to the crown (influence with the ruler), or keep it unasked (the ruler may let it stand, or cast you out).
- **Your fiefs run themselves.** The Realm screen's new Fief tab shows each one: who runs it, its garrison or militia, prosperity and unrest, its treasury and last week. One line a week sums them all. Put crowns in or draw them out at the holding.
- **For those who want more:** set the garrison (light, normal, strong), the tax (light, normal, heavy) and repairs, and make a veteran castellan in place of the steward. Heavy tax pays about 40% more but stirs unrest; over 80 the lands pay nothing. Unpaid soldiers desert after two warnings.

### Under the hood
- Save version 22. Saves from 2.27.0 load, every holding starting balanced.
- Debug → Lords: take the chosen fort for your realm (with the conqueror's choice), the crown's grants now, the fiefs' week now, empty your fiefs' treasuries.
- The test bots answer ransom offers, grants and the conqueror's choice; a new "landed" bot style serves, swears and keeps a fief.
- **Tests:** 761 fast and 12 slow Node tests (one slow test's time limit broken only when run beside the others), 173 browser tests (21 skipped: the visual baselines, Linux only, and those for one device only).

## v2.27.0 — Service and fealty (P8-04) · 2026-11-21

### New
- **Take service with a kingdom.** A capital's notice board now offers Service: 30 days as that kingdom's mercenary, paid every week by renown and the size of your company. Its patrols and lords take your side in a fight. Attacking its own soldiers breaks the contract. Renew it at the capital.
- **Swear fealty.** Serve a kingdom 20 days (or have stood with it at Greywall), be counted a friend, and earn 150 renown, and you may kneel to its ruler as a vassal. There is no pay, but land may be granted later. You owe 10 days of service a month (fighting its enemies, or staying at a fief of yours), and you must never fight its people. Three months short and you are cast out.
- **Leaving.** The Realm screen's new Allegiance tab shows where you stand. Ask for release: it's free when you owe nothing and the realm is at peace, costs 15 standing if you owe service, and is refused while the realm is at war. Or defect: you lose 40 standing, any fief (keeping a claim to it), and the realm's lords hunt you for 10 days. Leaving a contract early costs 10 standing. Seven days between oaths.
- **Every change says first what it will do:** what you lose, what you keep, and what may follow. Your soldiers, money, mill and followers are never part of it.

### Under the hood
- Save version 21. Saves from 2.26.0 load, independent as before.
- Debug → Lords: serve or swear to the chosen holding's realm whatever the requirements, have that holding granted to you, and +10 days of service.
- **Tests:** 747 fast Node tests and the slow `campaign-bots` file (the whole slow suite runs at the next checkpoint, P8-05), 169 browser tests (21 skipped: the visual baselines, Linux only, and those for one device only).

## v2.26.0 — Lords on the map (P8-01) · 2026-11-20

### New
- **The lords ride.** Twenty-two lords and ladies of the four kingdoms travel the map with their households: a gold-edged banner with their name. The more land a lord holds, the more soldiers ride with them, and the more of them are veterans.
- **Tap a lord** to see who they are and what they are doing: riding the bounds of their lands, on campaign along the borders, riding with a kinsman, hunting Reavers, riding against a rival realm's soldiers, or going home to refill their ranks.
- **Meet them like patrols.** Attacking a lord who isn't after you costs more of their kingdom's goodwill (25, against 15 for a patrol). In battle the lord fights in person, stronger than their soldiers, with their name over their head. Lords help their own kingdom's side in a fight, as patrols do.
- **Prisoners and ransoms.** Beat a lord and they are your prisoner. In two to four days their family, or their crown, offers a ransom: 100 crowns and 25 for every soldier they led. Accept it, Hold them for a later offer (they may escape), or Release them for nothing, for renown and their goodwill. If you are beaten while holding prisoners, they get free.
- **Beaten by a lord,** you are ransomed rather than robbed: they take some of your money but nothing from your pack, and let you go at their home.
- Lords beaten by another kingdom are held for a while and come home. The news tells of lords beaten, captured and ransomed.

### Under the hood
- Save version 20. Saves from 2.25.0 load, and the lords ride out from their homes.
- Debug → Lords: a lord near you, capture one, a ransom offer now, a lord held off-screen. Debug → Map stress 80 now runs 80 parties with every lord on top.
- **Tests:** 738 fast and 12 slow Node tests, 165 browser tests (21 skipped: the visual baselines, Linux only, and those for one device only).

## v2.25.0 — Who may do what (P8-03) · 2026-11-20

### Changed
- **When a kingdom that counts you Hostile won't hire to you, its recruits are still shown,** greyed out, with the reason on them and beneath ("The Valedorn Crown won't let you recruit here: they count you Hostile"). The contract board says the same. Before, the recruit buttons just disappeared.

### Under the hood
- Every right is now decided in one place (`CL.rights`), from your standing, who holds and controls a place, allegiance, war and peace, and the story. Each one has a reason in words. The later Phase 8 tasks (allegiance, fiefs, sieges, ransoms) add their actions to it. Nothing you could or couldn't do has changed.
- Debug → Holdings → Your rights there lists what you may do at a place, and why not, in the log.
- **Tests:** 726 fast and 12 slow Node tests, 159 browser tests (21 skipped: the visual baselines, Linux only, and those for one device only).

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
