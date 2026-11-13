# CROWNLESS — MVP GAME DESIGN DOCUMENT
**Version:** 1.0 (MVP cut)  
**Date:** 12 November 2026  
**Working title:** Crownless  
**Platforms:** Landscape mobile (Android first, iOS export target) and desktop/mobile web  
**Engine recommendation:** Godot 4.x, with web-export validation early  
**Team:** Solo developer with AI assistance  
**Business model:** Free, no ads or purchases  

> **Legend:** **[C] Confirmed** by the creator's five design rounds; **[M] MVP proposal** for the first public version; **[L] Later** / deliberately outside this MVP. All numbers are starting tuning values, not validated balance or performance guarantees.

---

## 1. The game in one page

**Pitch:** You are an unknown wanderer in a small borderland where two kingdoms contest the inheritance of a fallen empire. Travel on a strategic map, take contracts, recruit and upgrade soldiers, fight real-time top-down battles alongside them, trade supplies, and choose a side—or refuse both. A short handcrafted storyline branches based on your decision, and the local sandbox continues afterward.

**Genre:** [C] Single-player, low-fantasy medieval action RPG with army command, dynamic world parties, branching story and sandbox freedom.  
**Visuals:** [C] Top-down Game Boy Advance-inspired pixel art, four-direction characters and more animation frames for combat. Original assets only.  
**Controls:** [C] Landscape touchscreen: left joystick, attack, block, orders; web: keyboard/mouse.  
**Session goal:** [M] A satisfying short contract or encounter in 10–20 minutes, with save/resume between them.

### Four core promises
1. **I can fight:** Responsive sword-and-shield action with readable hit feedback.
2. **I lead a party:** Recruit, upgrade and command infantry, archers and a small cavalry contingent.
3. **My actions matter:** Gold, soldiers, faction relations and quest decisions persist; battle defeat means capture, not game over.
4. **The region is alive:** Bandits, caravans and rival patrols move and create opportunities while the player explores.

### The critical scope cut
The MVP proves the **wanderer → captain** fantasy. Becoming a king, conquering an entire continent and administering a realm are [L], not MVP acceptance criteria. The MVP *does* finish a small campaign and remain playable as a sandbox. No feature should require creating assets or UI for the unreleased five-to-six-kingdom world.

---

## 2. Deliverables and hard limits

| Category | MVP commitment [M] | Not required [L] |
|---|---|---|
| Map | One compact region, 10 settlements | Full 40–60-settlement continent |
| Factions | Two playable political sides, one bandit group | Six complete kingdoms |
| Troops | 15 distinct troop definitions: 6 per faction + 3 neutral | Large elite troop trees and dozens of variants |
| Battles | 2D top-down; 20–40 *active* troops as initial optimization target; up to ~60 in a battle via waves | 60–120 simultaneous units; full 120-total encounters |
| Player combat | Walk, face, melee swing, shield block, damage, knockout | Combo trees, parry mastery, dismemberment |
| Ranged | AI archer projectiles | Player bow combat in MVP |
| Cavalry | One AI cavalry role per faction with simple charges | Full player horseback, lances, mounted archery |
| Command | Select infantry / archers / cavalry; follow, hold, charge | Formation editor, complex tactical map |
| Sieges | Fort ownership changes through story/world events; optional short gate battle after core release | Four-stage siege (field/walls/courtyard/keep) |
| Narrative | 4 handcrafted story quests, 2 substantive routes, 3 repeatable contract templates | Many companions' stories and a continent-wide plot |
| NPC companions | One named recruitable companion with autonomous combat | Broad roster, detailed approval/romance systems |
| Economy | Food, wages, loot, local prices for 6 trade goods | Workshops, taxes, full production chains |
| Politics | Friendly/Neutral/Hostile reputation; limited territory changes | Player kingdom, fief appointments, succession, deep diplomacy |
| Exploration | Strategic world map; 1 small explorable town hub; other locations menu-driven | Every settlement fully walkable |
| Saving | Local autosave/manual save, manual export/import | Accounts or cloud synchronization |

**Hard rules:** [C] Single player, no monetization, no day/night or seasons, subtle folklore only, no religious mechanics. **[M]** No multiplayer, online accounts, real-time backend, crafting, gear durability, workshop ownership or open-ended faction-building at launch.

**Scope safety:** Every proposed new feature must replace an equal or larger one, or move to a future release. Reusable modular graphics and data-driven definitions are mandatory.

---

## 3. World: The Border March (working name)

**Setting [C]:** An old empire has fragmented. Two culturally different powers claim legitimacy. The supernatural is a source of rumors and abandoned ruins, never a combat magic system.

**MVP factions [M]:**
- **Valedorn Crown** — Western knightly and highland border culture. Better melee infantry and armored riders. Royal color blue. Its commander claims hereditary rights to the imperial border forts.
- **Aurelian Remnant** — Former imperial province with Byzantine-like organization and an eastern-frontier/Slavic influence. Better spear formations and archers. Royal color red. Its governor argues that imperial law still governs the marches.
- **Road Reavers** — Neutral hostile bandits, not a diplomatic kingdom. Their raids disrupt caravans.

Later, Norse, Steppe, desert and other cultures receive full kingdoms. Here, a single rare neutral mounted troop can hint at outside cultures without requiring them to be simulated.

**Exactly 10 locations [M]:**
1. **Stonebridge** — Valedorn market town, fully explorable small hub.
2. **Eastwatch** — Aurelian market town, menu-based; described as a river port/trade stop.
3. **Greywall Fort** — Valedorn fortress, ownership may switch in story.
4. **Ashgate Fort** — Aurelian fortress, ownership may switch in story.
5. **Oakford** — Valedorn village.
6. **Highmere** — Valedorn village.
7. **Brackenfield** — Valedorn village.
8. **Dunmarsh** — Aurelian village.
9. **Redfield** — Aurelian village.
10. **Saltmere** — Aurelian village.

Two towns, two forts, six villages. No separate port systems; Eastwatch's river trade identity gives maritime flavor without boats, naval travel or port UI.

**Regions:** One connected map with grass plains, a forest belt, hills, river and two roads. Two battlefield palettes use grass and forest; a fort/courtyard map provides a third environment. No procedural generation required.

**Movement [M]:** Click/tap a destination; party travels on a strategic map. Time advances during travel and wait actions, not through a visual day/night cycle. Basic speed model: `Speed = BaseSpeed × TerrainFactor × PartyLoadFactor`, where `BaseSpeed=4 map-units/hour`, road=1.2, grass=1.0, forest=0.75, heavy party modifier between 0.7 and 1.0. Fine-tune after map size is known. Visible hostile parties pursue within detection range; retreat can succeed by speed comparison.

---

## 4. Story: “The Last Charter”

**Premise [M]:** A disputed imperial charter may decide which realm legitimately holds Greywall Fort. Each side claims to defend ordinary people; both use dubious agents. The hero begins outside Stonebridge with a poor background and a choice of work. There is no forced childhood tragedy, secret bloodline or chosen-one plot.

### Four story quests

**Q1 — A Stranger's Wage (onboarding, 10–15 min).** The player chooses between escorting a grain wagon, clearing nearby bandits or helping a recruiter. Introduces movement, settlement menu, first battle, money and recruitment. All choices lead to learning of the disputed charter; no branch locks later story.

**Q2 — The Broken Seal (investigation).** Locate a courier's lost packet after a caravan ambush. Resolve the encounter by fighting, paying a bandit informant or negotiating if sufficiently strong. The recovered packet exposes contradictory claims about Greywall. Choose whether to show it to Valedorn, Aurelian, or keep it. The choice modifies reputation and available dialogue, not all future access.

**Q3 — Two Banners (commitment).** Both claimants offer a short mercenary contract. Support one, sell information to the other, or refuse both and protect the road. The world spawns a linked patrol battle or caravan defense. One named story NPC's survival depends on whether the player intervenes (visible, understandable consequence).

**Q4 — The Greywall Verdict (climax).** One deciding field battle near Greywall, followed by a short negotiation scene. Outcome uses quest flags plus combat result: **Valedorn victory**, **Aurelian victory**, or **compromise/independent road peace** if the player refused full allegiance and met an optional evidence condition. Set fort ownership and faction status, show a brief ending panel, return to sandbox.

**Branching contract:** At least 2 meaningfully different resolutions and 3 ending summaries. No dialogue tree requires dozens of variants: use conditional lines, shared scenes and 3–5 quest flags. No time limit on the main quests; if a faction loses a party, the necessary quest can continue via alternate NPC at its town. The player can ignore the narrative indefinitely.

**Repeatable work:**
- **Bandit hunt:** defeat a spawned bandit party; gold/renown.
- **Escort:** follow a caravan to an existing settlement; gold and friendly reputation.
- **Delivery:** bring goods or a message between settlements; gold or discounts.

Templates vary target and reward but do not create procedural dialogue complexity. A post-story status bulletin periodically announces patrol defeats, caravan losses and renewed tensions; the sandbox remains fully usable.

---

## 5. Character creation and progression

**Confirmed [C]:** Name, appearance, gender, starting background. Attributes: Strength, Agility, Intelligence, Charisma; Warband-like specializations. Player begins poor regardless of background.

**MVP character creator [M]:** Name, gender presentation, 4 hairstyles, 4 color variations, one of 3 backgrounds: **Farmhand** (+1 STR, +1 One-Handed), **Scout** (+1 AGI, +1 Pathfinding), **Peddler** (+1 CHA, +1 Trade). Starting purse 60 crowns, a worn sword, basic clothing and 3 days of food. Background affects a line or two of dialogue, not three separate campaigns.

**Starting stats:** STR 5 / AGI 5 / INT 5 / CHA 5; background provides bonus. Health = `60 + 5×STR`. Player level 1. MVP cap level 10. Each level: +1 skill point; every 2 levels: +1 attribute point. XP required to reach next level from level `L`: `round(100 × L^1.35)`.

**Only 8 MVP skills:** One-Handed (melee damage), Shield (block recovery), Archery (mostly companions/AI), Riding (reserve for cavalry-oriented updates), Leadership (party capacity), Tactics (auto-resolve advantage), Pathfinding (world travel), Trade (transaction discount). INT modestly influences XP or companion skill bonuses but does not require a separate science tree. Later add surgery, engineering, polearms, persuasion and other specialized skills.

**Player party cap:** `min(20, 8 + 2×Leadership + floor(Renown/40) + faction_bonus)`; faction_bonus 0 or 2 for Friendly status. This implements the confirmed leadership/renown/reputation basis at MVP scale. Troops share party slots; companion consumes one slot. Start with 8 available slots. The full game can increase this cap substantially.

**Equipment [C]:** Helmet, chest, boots, gloves, weapon, shield and horse slots. **MVP:** All slots exist in the inventory data and UI; horse can be equipped for a passive campaign travel bonus, while direct mounted hero combat is [L]. One active melee weapon; a second weapon slot is [L]. No durability.

---

## 6. Real-time combat specification

**Perspective:** Top-down, four facing directions: N/E/S/W. **Visual base:** [M] 16×16 tiles; 16×24 or 16×32 character sprites; nearest-neighbor scaling; up to 6–8 frames per attack; 4–6 per walking direction.

**Player movement:** Mobile left joystick; web WASD. Facing is last meaningful movement vector. Attack button/left click/Space performs one frontal swing; Block button/right click/Shift raises shield. Input is accepted during idle; optional 100 ms buffer during late recovery. No stamina meter in MVP.

**Proposed attack timing (one-handed sword):** Windup 0.16 s → active 0.12 s → recovery 0.24 s, total 0.52 s. A single target may be hit once per swing. Attack hit shape: frontal 90° arc, radius 24 px from hand origin. If weapon sprite and hit geometry don't align, prioritize readability over strict realism. Spearmen and cavalry AI can use narrower thrust arcs.

**Manual block:** Shield equipped. Hold block to cover a frontal 120° arc; movement speed ×0.65 while guarding; blocks one incoming frontal melee hit for 0 HP damage. No shield break, directional parry minigame or invulnerability dodge. Attacks from behind or outside the arc bypass block. Block input cannot interrupt an active swing, reducing spam.

**Proposed physical damage:**
```
Raw = WeaponDamage × (1 + 0.03 × WeaponSkill) × AttackModifier
Damage = max(1, round(Raw × 100 / (100 + 4 × TargetArmor)))
```
`AttackModifier=1` for standard swings, 1.2 for a simple cavalry charge (AI only). Friendly fire off. Health 0 causes incapacitation; blood is optional and default restrained. Baseline sword damage 14, recruit armor 2, shield infantry armor 5. These values must be playtested, not treated as canon.

**Ranged AI:** Archers use direct arrows, a straight-line projectile with collision against terrain and enemy targets. Attack range ~110 px; cooldown 1.6 s; projectile speed ~180 px/s; default 60% accuracy at mid-range, reduced by target movement. No sophisticated ballistics, ammo resupply or player ranged weapon HUD in MVP.

**Win/lose:** Victory when all active enemies are defeated/routed and no reserves remain. A knocked-out player may still win if their soldiers finish battle. If defeated, the hero is captured, loses approximately 20% of carried crowns and some non-essential loot, and is released near a settlement after a short time skip. Quest-critical items and one starter weapon are protected. No permadeath or game-over screen.

---

## 7. Troops, orders and casualties

**Troop definitions: 15 total [M]**

| Faction | Branch/role | Tier | Notes |
|---|---|---:|---|
| Valedorn | Levy | 1 | Recruit |
| Valedorn | Footman | 2 | Shield infantry |
| Valedorn | Guard | 3 | Defensive elite |
| Valedorn | Hunter | 2 | Archer |
| Valedorn | Longbowman | 3 | Elite archer |
| Valedorn | Rider | 3 | AI cavalry |
| Aurelian | Recruit | 1 | Recruit |
| Aurelian | Spearman | 2 | Reach infantry |
| Aurelian | Legionary | 3 | Armored infantry |
| Aurelian | Skirmisher | 2 | Archer |
| Aurelian | Marksman | 3 | Elite archer |
| Aurelian | Horse Scout | 3 | AI cavalry |
| Neutral | Looter | 1 | Weak bandit |
| Neutral | Reaver | 2 | Armed bandit |
| Neutral | Mercenary | 2 | Hireable mixed fighter |

**Trees:** Levy → Footman → Guard; Levy → Hunter → Longbowman; Footman → Rider (expensive, mounted upgrade). Recruit → Spearman → Legionary; Recruit → Skirmisher → Marksman; Spearman → Horse Scout. Each upgrade consumes unit XP and gold. Troop stats come from data, not separate unit scripts.

**Example tier baselines:** T1: HP 45, Damage 7, Armor 1, wage 3/week; T2: HP 60, Damage 10, Armor 3, wage 6/week; T3: HP 80, Damage 14, Armor 6, wage 12/week. Archers trade defense for range; cavalry gain speed and cost. Upgrade prices T1→T2: 25 crowns; T2→T3: 60 crowns. Soldier XP gained on victory plus participation; fallen wounded soldiers may still earn a reduced amount.

**Three group commands [C]:** Infantry, Archers, Cavalry; each can **Follow**, **Hold**, or **Charge**. Mobile: tap Orders → choose group → select command. Web: number 1–3 selects group, F/H/C issues command (remappable). Unit sets without cavalry show cavalry as unavailable. No drag positioning, rally banners, shield wall editor or individual troop control in MVP.

**AI [M]:** State machine `Following / Holding / Searching / Attacking / Blocking / Fleeing / Down`. Select the closest reachable enemy consistent with current order; keep distance if archer, close into reach if melee. Unit steering uses basic obstacle avoidance and separation. Update targets at staggered ~0.4-second intervals rather than every frame. Cavalry accelerate toward target, pass through, and turn for another run, without requiring nuanced jousting physics.

**Casualties:** [C] Some killed, others wounded. On unit defeat: initial roll 35% dead, 65% wounded. Survivors recover after 2 campaign days while with the party. Wounded troops do not fight, but count toward party capacity and wages. No surgeon system in MVP. Enemy captures and troop release may be abstracted in battle results.

**Scaling:** Initially profile 20 active units, then 30, then 40. If a battle has 60 total troops, reserve stacks enter as others fall. Large 60–120-total Warband-like battles remain the expansion target, not the MVP's technical promise. AI and rendering use pooling, spatial searches and data models suitable for later scaling.

**Auto-resolve:**
```
Power = Σ(Count × TierPower × HealthFactor) × (1 + 0.03 × LeaderTactics)
TierPower = {T1: 1, T2: 1.7, T3: 2.5}
WinChance(A) = clamp(PowerA/(PowerA+PowerB), 0.1, 0.9)
```
Then apply seeded attrition and wounded/dead rolls. Never give guaranteed zero-casualty victories to auto-resolve. Equivalent enemy strengths should be riskier than crushingly favorable matchups; test with simulation batches. For consistency, story-critical battles can disable auto-resolve only with a clearly stated reason and alternate accessible encounter.

---

## 8. Encounters and settlements

**Encounter options [C]:** Attack, Negotiate, Retreat, Auto-resolve. **MVP negotiation:** Bandits may demand payment; friendly patrols offer dialogue; enemy patrols can accept a bribe or force battle. **Retreat:** success chance based on speed difference, `clamp(0.5 + 0.1×(SpeedPlayer−SpeedEnemy), 0.15, 0.85)`; success returns to the map with temporary pursuit cooldown. Failure triggers battle. For quest encounters, add specific options as needed.

**Stonebridge explorable hub:** One small top-down town scene containing market stall, tavern, recruiter and exit. NPCs stand in place or pace on short loops; interaction opens dialogue menus. **Other settlements:** World-map icon → menu (Recruit, Trade, Rest/Wait, Contracts, Leave), with fort garrison info as appropriate. This retains the hybrid travel model without designing ten unique interior maps.

**Battle scenes:** (1) grass field, (2) forest clearing, (3) Greywall courtyard/fort approach. They share the same 16×16 modular tile palette, collision system and spawn anchors. The third map is for story climax and optional future siege tests, not a multi-stage siege system.

**World map party agents [M]:** Player party; two faction patrols each; one caravan per faction; up to three bandit parties active. Patrols follow waypoints and react to hostile parties; caravans travel town-to-town; bandits seek caravans and weak parties. Offscreen fights resolve using auto-resolve. Avoid a full economy or individual civilian simulation. World state advances during travel and waiting.

**Territory:** Two forts have owner IDs. One story quest can change Greywall's owner. The player can see territorial changes, but cannot yet collect taxes, appoint lords, besiege any settlement freely, or found a kingdom. This is an intentional step toward later conquest systems.

---

## 9. Economy and inventory

**Currency:** Crowns. **Player income [M]:** loot and sale of gear, handcrafted and repeatable quests, escort contracts, regional trading, occasional arena challenge (reuse battle map; optional late MVP). **Deferred [L]:** workshops, rent, taxes, ransom negotiations for named lords, raids for profit and full tournaments. These remain confirmed long-term ambitions but are not baseline MVP systems.

**Six trade goods [M]:** Grain, Salt, Wool, Iron, Cloth, Tools. Each town has fixed starting abundance and updates through caravan arrivals or bandit losses. Goods use icons, quantities and cargo weight; no production chains.

**Market formula:**
```
LocalBuyPrice = round(BasePrice × Scarcity × (1 - 0.01×TradeSkill))
LocalSellPrice = round(LocalBuyPrice × 0.75)
Scarcity ∈ [0.8, 1.4]
```
Merchant “buy” means the player's cost; “sell” means the player's revenue. Initial example base prices: Grain 10, Salt 18, Wool 14, Iron 28, Cloth 32, Tools 40. Caravan deliveries adjust scarcity by ±0.05–0.1; restock slowly moves it back to baseline. No buy/sell exploit at the same town. All inventory transactions are atomic and save-safe.

**Food and wages [C]:** Only upkeep systems. One ration feeds 5 people for one day (round up: `DailyRations = ceil(PartySize / 5)`). One ration costs 8 crowns initially. Wages deducted every 7 campaign days; remaining gold shown in Party panel. With no food, army morale declines and occasional troops desert; no disease or fatigue. Food is bought through settlement menus.

**Equipment [M]:** Approximately 30 item definitions *including* weapons, helmets, armor, shields, boots, gloves, horses, goods and food, not 30 items plus trade goods. NPC troop gear is visually modular; it does not need each item to be independently lootable. Loot uses small weighted tables tied to encounter tier; quest items protected from sale.

---

## 10. Reputation, renown, companion and ongoing sandbox

**Reputation [C]:** Three visible states per faction: Friendly / Neutral / Hostile. Store hidden score `[-100, 100]`. Proposed thresholds: hostile below -25, friendly above +24, otherwise neutral. Helping a faction +10; attacking its patrol −15; major story decision ±25. No per-lord numeric relationships in MVP.

**Renown:** Wins, difficult contracts and story quests increase renown. Affects party cap and a few dialogue checks. Recommended rewards: bandit win +2, patrol win +6, major story resolution +15. Track independently from faction reputation.

**One named companion [M]:** **Mara**, a former imperial scout. Recruitable after Q2 for a modest cost or through a short trust dialogue. She fights autonomously, equips a weapon and armor, and contributes +1 Pathfinding while conscious. Her one unique narrative consequence concerns whether she survives the Q3 caravan/patrol incident; avoid a separate elaborate loyalty system. Named NPC flags are separate from faction relationship scores.

**Sandbox after ending:** Bandit hunts, escort/delivery work, army improvements, trade goods, moving patrols and recurring small frontier clashes continue. Greywall owner and faction relationships remain changed. At a fixed interval, generate one regional news line from recent simulated events. No infinite new handcrafted story chapters promised in MVP.

---

## 11. UI and control map

**Main MVP screens [M]:** (1) Title/Continue/New, (2) Character Creation, (3) World Map, (4) Encounter, (5) Battle + Orders overlay, (6) Settlement menu / small town hub, (7) Party/Upgrade/Inventory combined panel, (8) Character/Skills, (9) Trade, (10) Quest Journal, (11) Battle Results/Loot, (12) Settings/Save/Import/Export. Combining panels is intentional; each should be easy to navigate at phone size.

**Battle touch layout:** left 35% joystick zone; right lower corner Attack (largest), Block (second-largest); Orders above; Pause upper right; HP and equipped item upper left. Touch targets at least ~48 device-independent pixels; support safe areas and flexible layout across landscape aspect ratios. Prefer a clearly readable UI font rather than tiny authentic GBA text.

**World touch layout:** tap location to move; tap party to inspect; bottom strip displays gold, food days, army count and current quest; prominent Pause/Party/Journal buttons. Web: WASD to move in battle, mouse left attack, right block, 1–3 group selection, F/H/C orders, Esc pause; world map mouse click movement, space to pause where appropriate. Allow key rebinding later; initial mappings are documented in Help.

**Feedback:** Color plus faction emblem (not color alone), hits flash briefly, ally/enemy HP bars optional for low-clutter mode, warnings for food and wages, confirmation for irreversible story choices, clear capture and casualty summaries. Separate Music/SFX volumes; toggle screen shake/reduced particles.

---

## 12. Visual, animation and audio toolkit

**Art bible [M]:** 16×16 terrain grid; 16×24/32 humans; 32×32 horses; top-down 3/4 GBA-era appearance, four clear orientations and consistent proportions. Shared base body with modular equipment layers; two faction palettes plus neutral. No real Pokémon sprites, tiles, trademarks, or assets.

**Required animated actions:** 4-direction idle (2–3 frames), walk (4–6), melee swing (6–8), guard (2), hurt (2–3), fall/down (4–6), archer fire (5–7), horse trot/charge (4–6). Keep sprite-sheet frames, anchor/pivot offsets, collision metadata and animation timing in source files. Avoid generating one giant image and assuming it functions as a usable sprite atlas without cutting and testing it.

**Art inventory target, approximate:** 2 body bases, 15 unit definitions assembled from shared animation rigs, 1 named companion appearance, 2 hero palette sets, 1 horse base with 2 variants, 3 modular terrain sets, 10 world-map settlement icons made from ~5 base icons, 6–8 buildings/structures, 15–20 props, 30 item icons, ~20 UI/icon components, 8–12 effects/markers, 2 faction flags. These are logical assets, not individual frames. Always prioritize the combat prototype assets before polishing the world.

**Sound target:** 12–18 reusable SFX (swing, impact, block, bow, arrow, step, horse, hit, down, coin, select, notification, win, loss, capture) and 3 music loops (menu, world/town, battle). Audio can use suitably licensed placeholders until final polishing.

---

## 13. Tech architecture and data

**Engine [M]:** Godot 4.x + GDScript, 2D scenes and data Resources/JSON. Validate current web export and mobile browser limitations before committing to export plugins. Shared gameplay systems across mobile and web. No account services, online multiplayer, or live backend.

**Scene flow:** Boot → Menu → WorldMap → {Encounter → Battle → Results, Settlement → TownHub/Trade/Party} → WorldMap. Main global services: `GameState`, `ContentDB`, `CampaignSimulation`, `SaveService`, `InputRouter`, `AudioManager` and `QuestTracker`.

**Model/view split:** Units have stat/AI data independent of their sprites; world parties are data and only become combat entities when a battle starts. Faction ownership, prices and quests use IDs, not display names. Use a fixed simulation tick for combat and a coarser world update while traveling. Pool arrows/particles and stagger expensive AI decisions.

**Illustrative troop JSON:**
```json
{
  "id": "val_footman",
  "faction": "valedorn",
  "tier": 2,
  "role": "infantry",
  "stats": {"hp": 60, "damage": 10, "armor": 3, "speed": 75},
  "wage_weekly": 6,
  "upgrade_to": ["val_guard", "val_rider"],
  "sprite_key": "human_blue_shield"
}
```

**Core files:** `factions.json`, `settlements.json`, `troops.json`, `items.json`, `quests.json`, `dialogue.json`, `markets.json`, `battle_maps.json`. Keep one authoritative source per ID and validate references on load. Event-driven updates notify quest flags when battles, trades and conversations resolve.

**Save model [C]:** Local plus manual export/import, cross-platform portable. Save version, game version, timestamp, player stats/equipment, party rosters and wounded timers, map position, world parties, settlement owners, faction reputation, market scarcity, gold/food, quests, flags and RNG seed. Autosave after battle and when entering a settlement; manual save from safe menus. The web version must explicitly warn that browser storage can be cleared and offer a visible Export button. Validate imported schema/version, reject unknown IDs and malformed payloads without overwriting valid saves. Preserve a backup when supported. Cloud not required.

**Performance targets [M]:** Aim 60 fps in small battles, >=30 fps in worst supported encounter *after actual device tests*. Start with 20 units active, increase only after profiling; battle wave cap configurable. Avoid per-frame all-pairs searches; use proximity grid, simple steering and staggered targeting. Web test must include actual mobile browser and a mid-range Android handset, not only desktop editor.

---

## 14. Build plan: sequence and gates

**Gate A — Combat fun test:** One grass arena, one player sprite, three enemy soldiers. Movement, 4-way sword attack, block, health, hit feedback, KO, touch and keyboard controls. **Pass:** no unfair hit directions; readable input; smooth on a phone.

**Gate B — Party battle vertical slice:** Recruit three to five soldiers, use infantry and archer commands, fight 10–20 enemies, process wounded/dead, collect loot, return to map. **Pass:** soldiers obey orders; battles resolve; no duplicate loot or trapped units.

**Gate C — Campaign loop:** Small 2-town region, travel, encounter, trading, food/wages, progression, two factions moving patrols, save/load. **Pass:** player can complete a contract, buy food, recruit, fight, level and reload with all state intact.

**Gate D — Full regional content:** Expand to 10 settlements, 15 troop types, 3 battle maps, 4 story quests, 3 repeatable contracts, companion, reputation and ending flags. **Pass:** each ending is reachable, no quest soft-lock, sandbox continues.

**Gate E — Public-release quality:** UX on landscape phones and web; export/import cross-platform; performance scaling, audio, tutorial, device QA, original/licensed art. **Pass:** complete core loop with no critical data loss or unavoidable progression blocker.

**Priority:** A → B → C → D → E. Avoid scheduling by calendar before a first combat prototype establishes production speed. A solo developer should expect scope surprises and use completion gates instead of optimistic dates.

---

## 15. Definition of done — testable MVP acceptance

- [ ] Character creation with three backgrounds, saveable appearance/name/stats.
- [ ] Top-down 4-direction movement and satisfying attack/block on touchscreen and web.
- [ ] Two factions, 10 settlements, 15 troop definitions, a traversable strategic map.
- [ ] Battle encounter offers Attack / Negotiate / Retreat / Auto-resolve when applicable.
- [ ] Recruit, equip, upgrade and command troops in separate groups.
- [ ] Wounded/dead soldiers, player capture and permanent campaign consequences work.
- [ ] At least 20 active troops perform acceptably on a target test phone; scaling documented.
- [ ] Moving faction patrols, bandits and caravans create actual encounters.
- [ ] 6 regional trade goods, loot and sales, food/wages, character and party progression work.
- [ ] Four story quests, at least two major political routes and three ending summaries are fully completable.
- [ ] Faction reputation and one fort's ownership can change and persist.
- [ ] Story completion returns to an ongoing sandbox with repeatable contracts.
- [ ] Local save survives restart and manual exported save imports on both supported builds.
- [ ] UI is readable across representative landscape phone sizes; no mandatory online account.
- [ ] No critical soft-locks, save corruption or repeatable infinite-money exploit in basic QA.

### Required edge-case tests
Hero captured with zero surviving troops; all food consumed during travel; no gold for wages; player joins a hostile encounter; quest courier's party removed offscreen; a fort changes owner before Q4; companion wounded at story trigger; user loses browser storage; import invalid or future-version save; battle ends during reinforcement spawn; low-end phone has 30+ units; user rotates device; application pauses mid-battle; tap commands overlap the attack button.

---

## 16. What is preserved for the full game, but deliberately postponed

**[L] World:** Additional four kingdoms, 40–60 settlements, Norse/Steppe/desert culture-specific troops, more explorable towns and special folklore locations.  
**[L] Combat:** 60–120-total-soldier battles at reliable scale, full player mounted melee, lances and mounted archery, advanced formation positioning, full multi-stage sieges.  
**[L] RPG and economy:** Multiple named story companions, larger skill tree, full tournaments, ransom negotiations, workshops, tax revenue, garrisons and town prosperity management.  
**[L] Political sandbox:** Becoming vassal or king, owning/awarding fiefs, diplomacy, rebellions, independent conquest, succession and new regional threats.  
**[L] Story:** Additional claimant arcs, large-scale endings and multiple campaign regions.  

**Important:** These deferred features are part of the creator's confirmed long-term vision, not abandoned. This MVP is designed so that content is added through data and modular scenes rather than requiring a complete rewrite.

---

## 17. Decisions to verify during prototyping

1. Is the 16×24 character large enough to read attack arcs and shields on a phone? If not, increase to 24×32 without changing the art direction.
2. Is manual facing based on movement comfortable, or should the player face the most recent nearby target while holding attack? Keep simple directional attacks as the default.
3. Is 20–40 active units practical on the minimum test phone/browser? Reduce visual density or stagger reinforcements before simplifying AI behavior.
4. Does the Orders UI require a short tactical pause for usability? Test against real touch controls.
5. Should the optional Greywall gate encounter become a launch requirement? Only if field battles and saves are already stable.
6. Can Godot web save import/export be made reliable on the chosen hosting platform and mobile browser set? Prototype this in Gate C, not during release week.

## 18. One-sentence MVP success criterion

**A new player can start with nothing, recruit a handful of soldiers, earn their first victory, make a consequential faction choice, finish a short regional campaign, and continue freely—on either a phone or a web browser—without the game feeling unfinished.**
