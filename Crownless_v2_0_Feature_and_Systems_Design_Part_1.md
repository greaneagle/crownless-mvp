# CROWNLESS — V2.0 FEATURE & SYSTEMS DESIGN — PART 1

**Working document:** Long-term design specification / feature sheet  
**Status:** Planning proposal, not an implementation promise  
**Edition:** 1.1 — 16 November 2026 (optional-depth design update)  
**Project:** Crownless — The Border March  
**Target:** Browser-first, single-player, top-down 2D warband RPG  
**Reference baseline:** [`greaneagle/crownless-mvp`](https://github.com/greaneagle/crownless-mvp), build **0.18.0**, commit `830af336c`, as inspected on 16 November 2026

> **One-sentence vision:** Start with nothing, raise a warband, become part of a living world, and gain—or lose—wealth, land, followers, political authority, and even a crown, while always retaining the freedom to travel and fight personally.
>
> **Foundational rule:** Crownless is **one continuous sandbox, not three separate games or progression stages**. Being a mercenary, landowner, vassal, claimant, monarch, or dispossessed exile changes the opportunities, obligations, relationships, and tools available to the player. It does **not** replace the character, end the campaign, disable field combat, or force the player into kingdom management.

---

## Contents

1. [Purpose, scope and design status](#1-purpose-scope-and-design-status)
2. [Player fantasy and foundational principles](#2-player-fantasy-and-foundational-principles)
3. [What already exists and what v2.0 adds](#3-what-already-exists-and-what-v20-adds)
4. [A unified character, company and political model](#4-a-unified-character-company-and-political-model)
5. [World time, battle time and fast-forward](#5-world-time-battle-time-and-fast-forward)
6. [Larger battlefields, camera, tactical view and minimap](#6-larger-battlefields-camera-tactical-view-and-minimap)
7. [Pre-battle planning and scalable tactical depth](#7-pre-battle-planning-and-scalable-tactical-depth)
8. [Improved combat, formations, AI and morale](#8-improved-combat-formations-ai-and-morale)
9. [Reinforcements, interception and dynamic battles](#9-reinforcements-interception-and-dynamic-battles)
10. [Individual soldiers and warband history](#10-individual-soldiers-and-warband-history)
11. [Companions, knights, officers and commanded armies](#11-companions-knights-officers-and-commanded-armies)
12. [Camp followers and optional delegation](#12-camp-followers-and-optional-delegation)
13. [Living world, travel, information and pursuit](#13-living-world-travel-information-and-pursuit)
14. [Property, businesses and regional economy](#14-property-businesses-and-regional-economy)
15. [Tournaments, social activity and renown](#15-tournaments-social-activity-and-renown)
16. [Fealty, titles, factions and political authority](#16-fealty-titles-factions-and-political-authority)
17. [Lordship, holdings, governance and loss of land](#17-lordship-holdings-governance-and-loss-of-land)

**Design rule added in edition 1.1:** [Optional depth, competent defaults and player-controlled complexity](#25-optional-depth-competent-defaults-and-player-controlled-complexity). This principle applies to every future system, not only battles.

**Continued in [Part 2](Crownless_v2_0_Feature_and_Systems_Design_Part_2.md):** Sections 18–29 (kingdoms, succession, wars, UX, modding, architecture, balance, roadmap, tests and design thesis).
---

## 1. Purpose, scope and design status

This document turns the discussed long-term ideas into a **usable feature sheet and implementation-planning reference** for Crownless. It describes not just *what* features might exist, but **how they could play, which systems they need, why they are compelling, what could go wrong, and how to control scope**.

It is intentionally ambitious. It is **not** a claim that every item must ship in the first v2.0 release. There is a large difference between a coherent long-term game design and a responsible release scope.

### 1.1 Status tags

| Tag | Meaning |
|---|---|
| **EXISTING** | Already implemented at least in an initial form in v0.18.0. |
| **V2 CORE** | Recommended for the first substantial post-MVP release. |
| **V2 EXPAND** | Part of the intended v2.x direction; can follow core systems incrementally. |
| **FUTURE** | Preserve architectural room, but do not schedule until foundational systems are proven. |
| **OPTIONAL** | Player can ignore it without losing access to the core game. |
| **DESIGN OPEN** | Needs experimentation or a policy choice before detailed implementation. |

**Numbers in this document are illustrative tuning candidates, not balancing commitments.** The aim is to be concrete enough for planning while leaving room for playtesting.

### 1.2 Hard separation: finish the current MVP first

The existing MVP still needs its planned story, faction reputation, end-state validation, device quality, and release polish. **Do not retroactively redefine that MVP to include all features in this document.** Once the first finished game is stable, the v2 direction can grow from a solid base rather than becoming a moving finish line.

### 1.3 Strategic scope statement

- **The game is a warband RPG first**: direct play, individual soldiers, travel, choices, fighting and consequences must stay enjoyable without political titles.
- **Political power is additive**: land and rank unlock governance and delegation, never replace personal adventures.
- **Power is reversible**: losing a battle, title, castle, loyalty or kingdom does not normally end the campaign.
- **The world continues**: armies, markets, nobles and rival factions behave whether or not the player holds office.
- **The player chooses complexity**: the default path must be useful and complete; quick presets allow a few meaningful choices; advanced tools provide detailed control without becoming obligatory. See §2.5 and §22.7.
- **2D is a deliberate identity**: depth comes from simulation, personality and interaction, not from 3D visuals or huge asset budgets.
- **Modding is a later multiplier**: build clean content boundaries now; expose safe, documented tools only after the official game is solid.

---

## 2. Player fantasy and foundational principles

### 2.1 The player fantasy

A new character arrives in a disputed borderland with little money, no soldiers and no inherited authority. They might take mercenary work, trade grain, escort merchants, win a tournament, or become notorious as a bandit hunter. Over time they accumulate people who remember them, enemies who resent them and opportunities that would not exist without their earlier actions.

Perhaps they swear loyalty to a king and receive a village. Perhaps they remain independent, buy a mill and lead a small professional company. Perhaps they become a lord, lose their castle to a siege, switch allegiance, fight to reclaim it, then eventually seize a throne. None of these paths are mandatory or final.

### 2.2 Five design pillars

1. **Personal combat with tactical command.** The player is one fighter in a larger battle and can also direct the larger formation.
2. **A warband of people, not counters.** Soldiers, companions, workers and nobles have identities, experiences and relationships.
3. **A world with consequences.** Raids, prices, allegiances, ownership, contracts and military movements interact.
4. **Reversible social power.** Titles and territory can be gained, disputed, delegated, taken away and regained.
5. **Approachable depth.** Players can choose simple direct action or increasingly sophisticated management; neither approach is treated as incorrect. Complexity is an invitation, not a toll to pay before having fun.

### 2.3 What Crownless should avoid

- A compulsory linear path: *adventurer → lord → king*.
- A kingdom screen that replaces the traveling and combat game.
- A permanent game-over simply because a castle falls or a crown is lost.
- Admin chores that require opening five menus every in-game day.
- An AI that cheats invisibly to simulate intelligence.
- More statistics than players can actually use to make decisions.
- Systems that create infinite money, unbeatable defensive armies or uncontrollable snowballing.
- Overly complicated AI or procedural simulation that makes the browser game slow or brittle.

### 2.4 Three example campaigns (not mandatory progression)

**The wandering captain.** Never owns a castle. Leads 14 named veterans, earns money through escorts and tournaments, hires a surgeon and merchant, turns down vassal offers, and remains free to move between kingdoms.

**The dispossessed lord.** Receives Greywall, appoints a castellan and leaves on campaign. A rival captures Greywall while the player is away. Income and local garrison are lost, but the player retains their personal character, surviving warband, relationships, claims and any holdings elsewhere. They recruit allies and retake the fort—or accept a different life.

**The deposed monarch.** Builds a kingdom and delegates armies. Vassals conspire, a rebellion succeeds, and the ruler is deposed. The player survives as a claimant with loyal companions and an independent party. They can negotiate asylum, take mercenary service, reclaim the throne or found something new.

These are stress tests of the design: **the same game continues through every transition**.

### 2.5 Optional depth, competent defaults and player-controlled complexity

**Priority: FOUNDATIONAL — a requirement for every system, including features added after v2.0.** Inspired by the legibility of small 2D strategy games such as *Island Empire*, but not limited to their mechanical depth, Crownless should have **simple presentation, deep interlocking systems, and optional interaction with most of that depth**. This is not a choice between an "easy game" and a "complex game": it is **one simulation with several levels of player attention**.

> **Core rule:** **Every system should be usable at its simplest level, rewarding at its deepest level, and safe to leave alone when the player wants to focus elsewhere.**

#### Three interaction depths, one rule set

| Depth | What the player does | What the game does | Design standard |
|---|---|---|---|
| **Default / hands-off** | Takes the obvious action or accepts a sensible default | Uses a competent policy, resolves routine details, reports important results | Works in ordinary conditions without prior research or mandatory configuration |
| **Guided / a few choices** | Picks a preset, goal, risk level or budget | Handles execution according to the chosen intent | Produces a recognizable difference in outcome with little extra UI |
| **Advanced / full control** | Edits specific orders, priorities, positions, allocations and exceptions | Executes those instructions within the same simulation rules | Rewards knowledge and attention when circumstances justify them |

These are **interaction depths, not difficulty modes, character stages or separate code paths**. A player can micromanage trading, use default combat tactics and fully delegate estate management in the **same save, during the same day**. Complexity preferences should be per-system where useful, not a single global "advanced gameplay" toggle.

#### System-by-system examples

| System | Default is genuinely enough | Light customization | Optional deep control |
|---|---|---|---|
| **Battle entry and combat** | Start a balanced formation and fight personally; or select **Simulate** | Choose defensive/aggressive stance and a retreat preference | Place groups, define targets, reserves, formations, flanking and timing |
| **Auto-resolve** | Estimate and resolve the engagement with standard doctrine and transparent risks | Choose conserve troops, protect cargo, or seek decisive victory | Set deployment doctrine, target priorities, pursuit/retreat thresholds and reserve use |
| **Travel** | Tap a destination; use safe reasonable routing | Choose fastest, safest or avoid enemy patrols | Route via waypoints, scouting, concealment and rendezvous plans |
| **Supplies** | Buy food as needed; clear warnings before starvation | Set reserve days and a shopping budget | Configure individual goods, source preferences, substitution and wagon load |
| **Trade** | Ignore trade goods entirely and still fund a warband through contracts and loot | Buy/sell obvious opportunities or enable a merchant with a safe spending cap | Compare regional prices, carry inventory, define margins, routes, exposure and risk |
| **Soldiers** | Recruit, upgrade when prompted and keep wounded soldiers recovering | Choose group equipment policy and promotion priorities | Review each soldier's service, traits and equipment; hand-pick officers and veterans |
| **Camp and followers** | Followers use sensible, conservative job rules and report exceptions | Set budgets, roles and a preferred risk level | Configure purchase permissions, materials, medical triage, staffing and task priorities |
| **Property** | Appoint or use a default manager; receive a brief net-income statement | Select stability, growth or defense policy | Adjust investment, production, reserve stock, labor and operating priorities |
| **Armies and liegemen** | Order "Defend Greywall" or "Support our western frontier" | Set urgency, risk tolerance and recall conditions | Specify armies, commanders, routes, supplies, rally points and permitted engagements |
| **Lordship / kingdom** | Delegate routine governance, receive important petitions and continue adventuring | Set broad tax/security/diplomatic priorities | Negotiate obligations, issue appointments, shape treaties and directly manage individual holdings |

**Important:** The default play loop must not require merchants, business ownership, diplomacy, detailed tactics or administrative menus. A player who simply recruits, equips, buys food, fights and travels should be able to enjoy a substantial campaign. Optional depth adds opportunities, versatility and personal expression—not a hidden compulsory tax.

#### Competent defaults are a design and AI requirement

1. **Useful without setup.** Basic formations protect ranged troops; soldiers don't blindly charge into obvious hazards; a quartermaster preserves critical food/wage reserves; a manager doesn't routinely bankrupt a profitable mill.
2. **Appropriate rather than perfect.** A cautious commander may miss a flank; a merchant may pass up a risky bargain. Good defaults make reasonable choices with limited information; they are not omniscient and cannot guarantee victories or profits.
3. **Same physics and accounting.** Defaults, manual actions, delegation and auto-resolve share resources, combat constraints, information limits and economic rules. Automation never creates unearned money, hidden troops or free movement.
4. **Manual attention is situationally valuable.** Advanced play should provide a meaningful edge in unusual terrain, major wars, difficult negotiations or rare market opportunities. It must **not** be required to correct persistently foolish AI in ordinary situations.
5. **No punitive complexity traps.** Don't hide the only viable strategy in a deep menu. Don't introduce needless decay, micro-taxes, durability chores or artificial penalties solely to make specialists indispensable.
6. **Trust, explainability and control.** Delegated behavior should offer an understandable reason and a compact accounting of what happened. The player can pause, cancel, override or revise orders subject to believable travel/communication delays.
7. **Failure remains possible and legible.** A delegated army can lose, a steward can misjudge a threat, and a merchant can take a loss. Players should receive plausible information and warnings where appropriate—not secretly guaranteed success.

#### Design for attention rather than requiring constant attention

Most playtime should go to **decisions the player cares about**. Group routine notifications into daily/weekly digests or settlement-entry reports, reserve interruptions for genuine danger or opportunities, and provide an "explain this" detail view for players who want to inspect the simulation. Fast-forward should stop for high-stakes alerts, not every sold sack of grain. The player should be able to set notification intensity and automation scope without making the world stop functioning.

A useful measurement is **time spent on voluntary decisions versus obligatory maintenance**. If a ruler must open six screens after each travel leg just to avoid catastrophe, the design fails. If a trader must inspect a spreadsheet before buying food, the design fails. If an expert can **choose** to spend twenty minutes preparing one decisive battle, the design succeeds.

#### Example of a genuine choice, not artificial busywork

A regular bandit encounter should be survivable with a balanced preset and ordinary soldiers. An expert might use a narrow pass to reduce casualties. The advantage comes from tactical understanding, not from the default formation being broken. Likewise, a simple trading player buys food and sells loot; a dedicated merchant can profit by studying market conditions, but ordinary warband upkeep must remain viable without speculative commerce.

### 2.6 Teach depth through context; reveal it when useful

- A **new captain** sees movement, recruitment, food, battles, contracts, and a few clear shortcuts. The sophisticated systems still operate in the world but don't occupy the HUD.
- A **new landowner** sees a compact estate summary and one suggested manager/default policy; accounting, garrison controls and tax details are one level deeper.
- A **new ruler** sees strategic objectives and important petitions; courts, vassal contracts, individual armies, and detailed budgets can be opened as needed.
- A **returning player** should be able to inspect a single "what happened" summary after several simulated days, without reconstructing hundreds of small transactions.
- A **mobile player** should have full core-game agency even when precise multigroup deployment or a dense financial ledger is cumbersome. Advanced controls can use zoomable overviews, drill-down panels and larger screens without becoming structurally mandatory.

**Design review question for every new system:** *Can a player safely ignore this menu for ten ordinary minutes? If not, is the forced interaction genuinely central to the fantasy—or just maintenance?* A reasonable automatic fallback should be the default answer.

---

## 3. What already exists and what v2.0 adds

At the reviewed **v0.18.0** baseline Crownless already has a browser-based HTML5 Canvas runtime, world travel and settlements, named factions, data-defined troops/items, infantry/archer/cavalry roles, battles, local markets and trade goods, player and troop XP, contracts, an item economy, character equipment, campaign saves and import/export. A headless campaign simulation and automated regression suite exist. Gate C was accepted, while Gate D's story/politics remained in progress.

The actual repo is still based on ordered JavaScript content and runtime files under `data/` and `js/`, using `window.Crownless`, with no bundler or runtime backend.

| Area | v0.18.0 foundation | v2 direction |
|---|---|---|
| Combat | Small fixed-view battle arenas, simple group orders | Large scrollable terrain, camera, minimap, deployment, deeper AI |
| Warband | Per-troop ID, tier and XP, wounds | Named careers, history, personal traits and record of service |
| World | Traveling parties, patrols, caravans and bandit contact | Tracking, active sieges, nearby reinforcements, more meaningful encounters |
| Economy | Trading, food, wages, equipment | Employees, business property, regional production and governance |
| Companions | Planned named MVP companion | Officers, knights, governors, emissaries and autonomous commanders |
| Politics | Planned MVP reputation / limited fort ownership | Landed status, fealty, local diplomacy, kingdoms, revolts and deposition |
| Time | Accelerated overworld; fixed battle campaign-time cost | Unified campaign clock, slower strategic progress during live battles, optional fast-forward |
| Narrative | Planned branching regional quest line | Persistent relationships, emergent stories, chronicles, dynamic political events |
| Extensibility | Data modules and content validation | Mod-ready schemas, namespaced content, eventual world-pack importer |

**Compatibility principle:** Where possible, extend current systems incrementally. Do not rewrite the engine merely because v2 has broader ambitions.

---

## 4. A unified character, company and political model

**Priority: V2 CORE (data model); V2 EXPAND (political scope).**

This is the most important conceptual architecture decision in the document.

### 4.1 Separate the person from the things they currently control

The player controls a **persistent person**. Around that person are independent but connected concepts:

| Concept | What it means | Can be lost independently? |
|---|---|---|
| Character | Identity, attributes, skills, injuries, personal relationships | Normally persists; defeat is not deletion |
| Personal warband | Soldiers directly traveling with the character | Yes; soldiers can die or desert |
| Company / household | Companions, camp followers, officers and organizational resources | Yes; members can leave or be reassigned |
| Property | Businesses, workshops, houses, mills, land | Yes; can be sold, seized or damaged |
| Holdings | Villages, towns, castles, estates with administrative control | Yes; can be occupied or transferred |
| Allegiance | Oath, contract or relationship with a ruler or faction | Yes; can be changed, revoked or broken |
| Titles | Legal or political rank and privileges | Yes; can be granted, inherited, disputed or removed |
| Army commands | Temporary authority over multiple military parties | Yes; delegation and orders change |
| House | Family identity, relatives, claims, connections | Usually persistent, even if dispossessed |
| Kingdom | An organization with land, institutions, subjects and rulers | Can change ruler, fragment or disappear |

Crucially, **owning a kingdom is not a boolean on the player character**. The player may hold the ruler office for a realm, then lose that office without deleting the character or personal party.

### 4.2 Two independent axes of power

- **Military capacity:** troops immediately under command, accessible allied forces, supplies, tactical ability and commander trust.
- **Political authority:** legal rights to issue orders, appoint officials, collect revenue, negotiate treaties and judge disputes.

A powerful mercenary can have a large army but no title. A weak king may have a crown but few troops willing to follow orders. Both situations should be playable.

### 4.3 Roles are permissions, not modes

Illustrative rights, derived from actual contracts and relationships:

- Any free character may travel, recruit where permitted, trade, fight and enter tournaments.
- A **captain** may hire officers and delegate eligible military duties.
- An **estate owner** may appoint a manager and receive business income.
- A **landed lord** may appoint castellans, manage taxes and petition a liege.
- A **royal marshal** may command certain kingdom armies even without owning land.
- A **king** may appoint ministers, negotiate binding realm-wide treaties, grant titles and call royal levies—subject to law, resources and noble compliance.

Rights should be computed from offices, treaties, ownership, laws, reputation and trust. They should never be scattered through code as `if (player.isKing)` checks.

### 4.4 Reversibility is an acceptance condition

Every political operation should have a defined inverse or loss path: appointment → dismissal; possession → capture; allegiance → renunciation; treaty → expiration/breach; kingship → deposition; garrison → casualties/capture. After the transition the player must still be able to continue personally.

**Benefits:** One coherent sandbox, emergent stories, fewer duplicated UI systems, strong modding foundation.  
**Costs:** More complicated ownership and access rules, save migration, AI autonomy, and difficult edge cases.  
**Mitigation:** Build explicit entities and permissions early; add tests for losing every right and recovering afterward.

---

## 5. World time, battle time and fast-forward

**Priority: V2 CORE.** This is a system-level prerequisite for dynamic reinforcements and delegated armies.

### 5.1 There are three distinct measurements of time

1. **Real elapsed seconds:** how long the human player spends at the keyboard or touchscreen.
2. **Campaign time:** the authoritative calendar used for travel, wages, contracts, sieges, recovery, production and diplomacy.
3. **Presentation rate:** how fast campaign time advances relative to real seconds in a given activity.

The world uses **one canonical campaign clock**. The presentation rate varies; the clock itself does not change type when the player enters battle.

### 5.2 Proposed battle slowdown

User intent: **a five-minute real-time battlefield fight should advance the overworld only as far as roughly 20–30 seconds of normal overworld travel playback**. A starting tuning ratio is **1:12**.

```text
battle_real_seconds = 300
battle_to_world_playback_ratio = 1 / 12
world_playback_equivalent_seconds = 300 / 12 = 25
campaign_time_delta = world_playback_equivalent_seconds
                      × normal_world_campaign_time_per_real_second
```

This avoids the confusion of equating 25 seconds of overworld *presentation* with 25 seconds of the in-fiction day. If the world map is accelerated, 25 seconds of its normal movement may represent meaningful campaign minutes or hours.

**Design target:** nearby parties can move and plausibly arrive during battle; distant parties cannot cross half a continent just because the player fought for five real minutes.

### 5.3 Suggested simulation rules

- On the world map, use the existing accelerated travel time rate.
- During live combat, advance the campaign clock continuously at a much lower rate, tentatively `normalTravelRate / 12`.
- During pre-battle deployment, **pause strategic time** or spend a small fixed preparation cost; never punish a player for reading tactical information.
- During pause menus and application backgrounding, advance no campaign time.
- During fast-forward, increase the canonical campaign clock in bounded steps while processing events in deterministic order.
- After battle, apply only explicitly specified post-battle travel/care/reorganization time, **not the old fixed six-hour battle charge on top of time already accrued**.
- Off-screen battles advance as abstract simulation events; they do not need full real-time combat duration unless relevant to a joinable encounter.

### 5.4 How nearby reinforcements use time

Each strategic party has a position, path, speed and estimated time to reach the battle. The battle's campaign clock ticks at the reduced rate. As the simulation advances, parties may enter a reinforcement radius, decide whether to intervene, and join from a battlefield edge. The UI shows their approach when they are detected.

A five-minute combat may equate to 25 seconds of regular overworld play. A friendly patrol whose travel normally takes 15 seconds of world playback could arrive about three minutes into that battle (assuming unchanged travel speeds and uninterrupted movement).

### 5.5 Fast-forward when managing holdings or armies

- Time controls might offer **Normal / Fast / Very fast / Pause**, subject to game balance.
- Fast-forward is **voluntary** and available by context; ownership of a castle does not force it.
- The game stops or slows for critical events: siege, invasion, battle against a player-held army, serious illness, rebellion, diplomatic ultimatum or companion death.
- Players may set **notification policies**: pause for everything, pause only for critical matters, or deliver routine digests.
- Travel should still be possible during accelerated time, but decisions and input must stay predictable.
- Fast-forward should never bypass payroll, economics, sieges, faction reactions or AI orders.

### 5.6 Exploits and failure modes

**Risk: Battle duration farming.** Players could prolong safe battles to make trade income or a friendly army arrive. **Mitigation:** cap relevant assistance windows, handle a battle as a contested instance, and keep strategic clock progression proportionate to real engagement rather than menu/idle time.

**Risk: Speed exploits.** Players may change speeds to skip imminent danger or reverse events. **Mitigation:** all event processing uses canonical campaign timestamps and deterministic transitions; display interruption warnings.

**Risk: Duplicate advancement.** Battle result logic could add six hours after already simulating time. **Mitigation:** a single clock authority and exact-event tests across manual battle, auto-resolve, retreat, capture and resumed saves.

**Risk: AI cost.** Simulating an entire region every animation frame is excessive. **Mitigation:** event-based strategic steps, local high-detail simulation, coarse distant updates, bounded catch-up on load.

### 5.7 Minimum viable acceptance

A 300-second battle advances campaign time by the configured equivalent of approximately 25 normal map seconds, allows an appropriately nearby patrol to arrive, charges wages/supplies exactly once, and never advances while paused. Results are consistent after reload and after auto-resolve.

---

## 6. Larger battlefields, camera, tactical view and minimap

**Priority: V2 CORE.**

### 6.1 Intended experience

The current 960×540 Canvas viewport should become **a window into a larger combat world**. Units move across terrain beyond the visible screen. The camera generally follows the hero, while tactical controls let the player understand the whole engagement.

Proposed initial arenas: roughly **2–4 times the current width and height**; actual sizes should be validated on mid-range phones. Maps should remain authored and readable before considering procedural generation.

### 6.2 Camera behavior

- Follow the hero with gentle damping, keeping them near the center unless the camera hits a map edge.
- Use world coordinates for all units, projectiles, obstacles and commands; calculate screen coordinates from camera position.
- Allow a brief camera focus on a selected allied group, followed by a smooth return to the hero.
- Keep HUD/buttons screen-anchored; never shift the joystick or Attack button as the camera moves.
- Optional camera shake must be mild and independently disableable.
- Respect pixel-art rendering: avoid blurry fractional scaling where practical.

### 6.3 Two ways to inspect the battle

**Minimap:** Always-available small overlay showing the hero, allied groups, objectives, terrain boundaries and **only detected enemies**. Tap/click to focus or ping; avoid automatically exposing unseen opponents.

**Tactical overview / quick zoom-out:** A button or hotkey temporarily expands the view to the wider battlefield. It might slow or pause the action in an accessibility-friendly mode. Advanced players can issue group orders from this view; casual players can use it only to orient themselves.

**Suggested default:** Press-and-hold overview on desktop, and a large toggleable tactical-map button on mobile. Test which is practical with two-thumb controls.

### 6.4 Terrain and information

Use elevation-like tactical zones only if they meaningfully affect play; literal 3D topography isn't required. Trees can block arrows; walls channel movement; roads accelerate cavalry; mud slows charges; narrow bridges reward defense. Terrain should be visible in the minimap without turning it into visual clutter.

### 6.5 What is good

- Positioning and flanking become meaningful.
- Infantry and archers have defensible locations rather than standing in a single arena.
- Scouts, cavalry and reinforcements gain practical relevance.
- Larger maps create variety using the same simple 2D art.
- Supports future siege approaches and complex orders.

### 6.6 What is difficult

- Camera motion can make touch combat disorienting or nauseating.
- Tiny minimap symbols are hard to use on mobile.
- AI pathfinding around large obstacles becomes expensive.
- Longer travel inside battles can become tedious.
- Enemies firing from offscreen can feel unfair.

### 6.7 Mitigations and acceptance

- Show threat indicators at viewport edges; place objectives at reasonable travel distances.
- Offer camera follow strength, tactical view behavior and icon-size settings.
- Use low-cost spatial grids, obstacle nav data and efficient visible-region rendering.
- Test maps for dead ends, lost allies, inaccessible reinforcement spawns and combat stalls.
- A player should be able to complete an entire battle using only direct movement and default group orders, with no compulsory tactical view.

---

## 7. Pre-battle planning and scalable tactical depth

**Priority: V2 CORE.** The central requirement is **simple by default, sophisticated by choice**.

### 7.1 Battle preparation screen

Before most planned engagements, show a short overview of forces and terrain with three or four presets:

| Preset | Initial placement | Initial orders | Intended player |
|---|---|---|---|
| **Balanced** | Infantry front, archers behind, cavalry on flank | Infantry guard/advance; archers hold; cavalry await opening | Default |
| **Defensive** | Infantry shields chokepoint, archers cover | Hold; engage close threats | Cautious players |
| **Aggressive** | Infantry forward, cavalry ready to flank | Advance/charge, archers support | Quick fights |
| **Custom** | Player positions available groups in legal deployment zone | Individual group orders, waypoints, target priorities | Tactical enthusiasts |

Players who don't care about tactics can press **Fight** immediately—or **Simulate** and receive the outcome, casualties and reasons. The game remembers the last-used preset if the player opts in. Do not make players reopen the preparation screen to repeat an unchanged default for routine encounters; a fast-entry preference should be available.

### 7.2 Advanced deployment

- Place or drag group icons inside an **allowed deployment zone**, not arbitrary enemy territory.
- Set each group's start order: Follow, Hold, Advance, Charge, Skirmish or Guard (additional orders after testing).
- Choose a broad stance: aggressive, balanced, defensive, avoid casualties.
- Set target priorities: nearest threat, cavalry, archers, vulnerable flank, protect hero, protect supply wagon.
- Assign reserves and choose reinforcement entry when applicable.
- Use formations: loose, line, compact/shield wall, wedge (later).
- See clear warnings if a selected position is blocked, outside the zone or inconsistent with a group's role.

### 7.3 Tactical control while fighting

- Keep current fast group shortcuts for infantry/archer/cavalry.
- Add optional selecting of subgroups/companies by leader as army size grows.
- Commands should describe **intent**, not require precision clicking on tiny moving targets.
- Group orders persist until changed, impossible or overridden by survival behavior.
- A basic **smart orders** setting could let AI automatically avoid suicidal movement while respecting the player’s general plan.

### 7.4 Ambush and surprise

An ambush should not provide unlimited preparation. A surprise encounter may begin with a constrained deployment zone or a short countdown. Conversely, a scouting advantage can reveal enemy strength or grant extra preparation information.

### 7.5 Benefits, costs and guardrails

**Benefits:** Tactical agency; replayable encounters; choice of complexity; terrain matters; distinct unit roles.  
**Costs:** New UI complexity; balance between manual and automated play; easier to trivialize AI through perfect formations.  
**Mitigation:** Give presets competent behavior; make advanced preparation a situational advantage rather than a requirement; test mouse and touch independently. Keep manual battles, one-click fights and auto-resolve bound to consistent simulation rules and consequences.

### 7.6 Acceptance example

A player can choose Balanced and start within two clicks. An expert can move infantry behind a wall, put archers on high ground, delay cavalry, and issue a new target order when enemy reinforcements arrive. Both approaches can win a fairly balanced fight.

---

## 8. Improved combat, formations, AI and morale

**Priority: V2 CORE for group AI; V2 EXPAND for extensive formations.**

### 8.1 Tactical AI responsibilities

Each unit needs to understand its assigned role, group order, immediate danger and nearby allies. Avoid a single global behavior that makes all soldiers charge the closest enemy.

**Infantry:** Preserve a formation, screen archers, defend a gap, engage enemies crossing a protected line, retreat or reform when shattered.  
**Archers:** Maintain range, prefer clear shots, avoid wasting arrows on walls, relocate when threatened, obey hold/retreat orders.  
**Cavalry:** Build momentum, choose an approach lane, charge vulnerable targets, ride through, regroup, avoid repeatedly running into dense braced spearmen.  
**Enemy commanders:** Make choices based on faction doctrine, morale, perceived player formation and objective, not omniscient knowledge.

### 8.2 Simple formation states

A company can use `forming → advancing → engaged → regrouping → retreating`, with role-specific transitions. Formations are **soft constraints**, not perfect rigid blocks: soldiers may break ranks to survive or pursue an opponent, then return if possible.

### 8.3 Morale and cohesion

Potential inputs: casualties, leader presence, flank attacks, fatigue, nearby routs, elite veterans, terrain disadvantage, supply quality and recent victories. Units or groups may **hold**, **waver**, **fall back**, **rout** or **rally**. Avoid excessively random routing that makes player planning irrelevant.

A commander may spend a limited order/rally action to recover nearby troop cohesion; veterans should feel more dependable without becoming invulnerable.

### 8.4 Unit specialization and counterplay

- Braced spearmen counter fast cavalry but are vulnerable to flanking.
- Shield infantry protects archers but cannot chase everything.
- Cavalry excels at pursuit and flank pressure, not grinding through dense formations.
- Archers require line of sight and benefit from terrain.
- Light troops move quickly but suffer in direct, sustained melee.

### 8.5 AI fairness rules

- Opponents react only to information they plausibly have.
- Difficulty affects planning quality, morale discipline and risk judgment more than raw hidden damage multipliers.
- Orders may fail for understandable reasons: fear, blocked path, bad discipline, lack of awareness, wounded commander.
- Display messages when an order cannot be carried out, rather than silently ignoring it.

### 8.6 Good / bad / mitigation

**Good:** Player tactics matter; armies look coherent; meaningful combined arms; strong replay value.  
**Bad:** CPU cost; difficult behavior debugging; frustrating autonomy; possible stalemates.  
**Mitigation:** Hierarchical AI (commander → group → soldier), deterministic decision tests, cheap spatial searches, simple fallback behaviors, scenario-based balance tests and debug visualizations.

### 8.7 Advanced ideas to defer

Detailed facing of individual soldiers, full spear-brace animations, dynamic ammunition logistics, mounted player combat, complex command hierarchies and multi-layer sieges should not block the first working version of the expanded battle system.

---
## 9. Reinforcements, interception and dynamic battles

**Priority: V2 CORE.** Depends on sections 5–8.

### 9.1 Strategic contact should matter during tactical combat

When a battle starts, the game creates an **active conflict** associated with a strategic map location and a list of participants. Nearby parties continue limited strategic movement at the battle's reduced campaign-time rate. They may intervene if they reach the conflict and have reason to fight.

A passing patrol might help a friendly player. Bandits might join other bandits. A neutral caravan might flee, request escort or wait for the battle to end. A lord may refuse to risk his troops for someone he dislikes. Reinforcement behavior depends on faction ties, commander motives, numbers and the fight's apparent outcome.

### 9.2 Eligibility and intervention rules

A party can join when all relevant checks pass:

1. It exists and is not already involved in a different battle or captured.
2. It can plausibly reach the conflict before the battle closes.
3. It knows about the fight through proximity, scouts, sound or intelligence.
4. Its relationship to participants and current orders permit intervention.
5. It can deploy through a valid reinforcement entry area.
6. Its troop and unit counts respect performance and active-unit limits.

A party might also **watch**, **withdraw**, **raid the abandoned baggage**, **shadow survivors** or **arrive too late**. Not every nearby unit should automatically join.

### 9.3 Presentation and tactical response

- Show an approaching-banner indicator with faction, direction, approximate strength and estimated arrival *if detected*.
- Reserve actual spawn points at battlefield edges; never spawn troops in the center of an occupied formation.
- Allow reinforcing troops to enter as additional waves if the active-unit cap is reached.
- Permit retreat or repositioning in response.
- After victory, resolve surviving group relationships and ownership of any captured persons, supplies or territory.

### 9.4 More interesting enemy pursuits

A bandit party could pursue the player until it loses sight, search a nearby road junction, or choose an easier target. A rival lord might deliberately shadow the player's army, hoping to intercept it while weakened. A friendly patrol might accompany the player for part of a journey or provide a safe corridor.

### 9.5 Critical technical invariant: no double battles

An encounter target involved in a live player battle must be **reserved/locked** in strategic simulation until that battle ends. It cannot be killed by a different off-screen patrol during the player's fight or payout processing. When the result commits, apply casualties and outcomes exactly once, then resume normal world AI.

This matters because the current code's battle-result path advances strategic time. Dynamic intervention must be built so this ordering cannot void the player's contract or duplicate losses.

### 9.6 Benefits, risks and acceptance

**Benefits:** Emergent stories; meaningful scout and reputation mechanics; tactical uncertainty; battles feel connected to the strategic map.  
**Risks:** Unfair surprise attacks, performance spikes, battle stalling while parties approach, conflicting battle resolutions.  
**Mitigations:** Limited reinforcement radius, advance warning, deterministic event processing, active-party caps and clear battle ownership.

**Acceptance:** A nearby friendly patrol can arrive at a deterministic time and assist; a distant one cannot; the same patrol cannot be simulated as losing another battle elsewhere; victory and contract progress apply once.

---

## 10. Individual soldiers and warband history

**Priority: V2 CORE.** Potentially one of Crownless's most distinctive features.

### 10.1 Soldiers should be individual characters without becoming a micromanagement burden

Every recruited soldier receives a unique persistent ID and generated name. They preserve their origin, service, career history and outcome across battles, promotions, capture and possible transfer to different commands.

The current per-soldier IDs, experience and injury timers are a strong starting point. Extend them rather than replacing the roster with separate character objects for every combat frame.

### 10.2 Suggested soldier profile

| Field | Description |
|---|---|
| `id` | Permanent unique identifier, never reused within a world save |
| `name` | Generated personal name based on culture and optional nickname |
| `originSettlementId` | Where recruited; may change diplomatic dialogue or home ties |
| `originFactionId` | Initial cultural/political affiliation, separate from current employer |
| `recruitedAt` | Campaign timestamp and employer/commander |
| `troopTypeId` | Current class or progression tier |
| `experience` / `level` | Personal experience and advancement |
| `battlesJoined` | Number of battles in which actually deployed or served in reserves |
| `victories` | Battles won while present |
| `kills` | Confirmed combat kills; distinguish from assists and downings |
| `knockouts` | Enemies incapacitated where no confirmed death occurred |
| `assists` | Optional supporting contribution |
| `injuriesSuffered` | Lifetime nonfatal wounds, including serious injuries |
| `timesCaptured` | Captivity count |
| `wagesEarned` | Cumulative pay actually received, not just payroll owed |
| `lootShareEarned` | Optional distributed rewards |
| `morale` / `loyalty` | Personal attachment to company/commander, if justified |
| `traits` | Small, mostly understandable set of quirks or veteran distinctions |
| `serviceEvents` | Bounded meaningful history: promotions, injuries, decisive battles |
| `status` | Active, wounded, detached, captured, retired, dead, deserted |

The profile should indicate **what a statistic actually means**. For example, an incapacitated enemy is not necessarily killed, and “battles” could mean deployed battles rather than campaigns where the soldier was left in reserve. Be consistent.

### 10.3 Example profile

> **Edric of Oakford — Veteran Footman**  
> Recruited in Oakford, Year 1, Day 12 · Served 57 days  
> 23 battles · 17 confirmed kills · 3 knockouts · 5 assists  
> 2 serious wounds · 186 XP · 74 crowns paid in wages  
> Service notes: “Held the north road at Greywall.” “Promoted after the Eastwatch escort.”

This kind of data gives the player an emotional reason to protect experienced soldiers and remember who helped build the company.

### 10.4 Traits and character development

Start small. Possible traits: *Steadfast* (+cohesion under pressure), *Cautious* (reduced pursuit), *Impulsive* (more aggressive), *Roadwise* (scouting), *Loyal* (resists desertion). Traits should have **visible effects and trade-offs**, not a hidden wall of modifiers. Soldiers may occasionally gain a distinction through a genuine milestone; avoid random trait spam.

### 10.5 Death, retirement, desertion and legacy

A dead or retired veteran should not silently disappear. Keep a compact **company roll of honor**, with name, origin, service duration and circumstances. Players can filter the current roster by role, name, experience, wound status and tenure.

If a soldier deserts, their historical record can remain, and they may occasionally appear again as a recruit, bandit or member of another company—an optional later feature, not a prerequisite.

### 10.6 Economics and provenance

Track cumulative wages by actual payroll transactions. Do not treat “wages earned” as a derived estimate, since partial pay, bonuses and missed payroll can occur. Keep counters integer and saturating if needed. The source settlement is historical and should not change just because a kingdom captures it.

### 10.7 Benefits and costs

**Benefits:** Emergent personal stories; attachment to units; meaningful protection of veterans; rich post-battle feedback; foundation for companions and family.  
**Costs:** Larger saves, more UI, data migration, potentially hundreds of low-value records, and difficulty attributing real-time kills fairly.  
**Mitigation:** Store compact counters and a bounded set of important events; aggregate old fallen records when necessary; use a UI with summaries and optional details. Avoid mandatory individual gear management for every common soldier.

### 10.8 Acceptance

Recruit a soldier, fight three battles, wound and promote them, pay wages, save and reload: origin, name, battles, kills, injury count and earned wages remain correct. If the soldier dies, the roll of honor preserves essential history without retaining full live-combat state.

---

## 11. Companions, knights, officers and commanded armies

**Priority: V2 CORE for reusable characters/officers; V2 EXPAND for autonomous commands.**

### 11.1 Distinguish roles, not separate artificial character species

- **Common soldier:** Can gain experience and an individual history; generally commanded as part of a unit.
- **Companion:** Named, distinctive, persistent person who may fight, advise, handle a specialized task or hold a relationship with the player.
- **Officer:** A role given to a person who manages a group, camp function, garrison or detached party.
- **Knight/noble:** A character with an appropriate title, reputation, obligations or household; may serve or oppose the player.
- **Commander:** A person currently entrusted with leading an army or company; could be a noble or a skilled commoner if the political rules permit.

A character can have multiple roles. A trusted companion may become a knight, govern a castle, command a separate army, betray the player, lose a title and return to the player's traveling company.

### 11.2 Recruitment, loyalty and motives

Companions may join for pay, admiration, ideology, family connection, rescue, vengeance or ambition. Avoid a single magical “loyalty” stat deciding everything: model a small set of interpretable factors such as relationship, promised rewards, political alignment, ambition, treatment of troops, fear and personal honor.

A character can like the player personally yet refuse an order that violates a sworn oath. Others may be loyal to a faction rather than an individual ruler. These differences create interesting choices without requiring hundreds of written dialogues.

### 11.3 Delegating military command

When a character receives a detached command, the player gives an **order package**:

- Objective: patrol road, escort caravan, pursue raiders, defend fortress, reinforce ally, recruit troops, train reserve, capture settlement, avoid battle.
- Constraints: allowed losses, aggression, spending limit, acceptable risk, territory they may enter, supplies reserve, deadline.
- Resources: allocated soldiers, money, equipment, horses, food and additional officers.
- Autonomy: require approval for large battles, routine independent action, or fully delegated execution.

Orders should have understandable states: *assigned → traveling → executing → completed / failed / interrupted*. Commanders periodically report progress and important incidents.

### 11.4 Noble fealty and military followership

A noble's oath is a political relationship, not mind control. They may be obliged to provide troops for a campaign, but compliance depends on law, mutual obligation, risk, loyalty and military feasibility. A king has more formal authority; a landed lord can still call on personal clients and allies.

### 11.5 What is good and bad

**Good:** Meaningful personnel choices; actual delegation; emergent loyalty conflicts; more personal kingdom politics.  
**Bad:** AI commanded armies may feel useless or overpowered; moving soldiers between parties may create duplication; companion complexity may eclipse common soldiers.  
**Mitigation:** Shared army mechanics for player and AI; explicit roster transfers; clear reports; no invisible money creation; small number of meaningful personality factors at first.

### 11.6 Acceptance

The player appoints a veteran to command a patrol, gives them 12 soldiers and 80 crowns, then travels independently. The patrol can fight or retreat according to orders, consumes supplies, and returns with accurate casualties, expense and experience. Reassigning command transfers the same soldiers back with their histories intact.

---

## 12. Camp followers and optional delegation

**Priority: V2 CORE for a few followers; V2 EXPAND for wider professions.**

The camp should become a traveling community as the warband grows. Camp followers provide services, convenience and personality—not an obligatory minigame.

### 12.1 Acquisition and capacity

Followers become available through towns, contracts, reputation, rescued travelers or recommendations. A small warband might reasonably employ one useful assistant; a large company might support several. Capacity can depend on camp supplies, payroll and organizational ability rather than an arbitrary rank gate.

### 12.2 Candidate follower professions

| Role | Gameplay effect | Trade-off / cost | Suggested priority |
|---|---|---|---|
| **Merchant** | Buys low, sells high in towns using a dedicated budget | Can make poor trades; uses cargo, time and wages | V2 CORE |
| **Surgeon** | Better survival and wound recovery, triage priorities | High pay; supplies; cannot eliminate casualties | V2 CORE |
| **Quartermaster** | Plans food/wages, warns of shortage, buys necessities within rules | Service fee; may overbuy if budget is loose | V2 CORE |
| **Blacksmith/armorer** | Maintains gear, upgrades selected equipment or grants a small condition-based armor benefit | Materials, wages, workshop requirements | V2 EXPAND |
| **Cook** | Improves morale, food efficiency or recovery when supplied | Needs food variety, fuel or higher rations | V2 EXPAND |
| **Scout/pathfinder** | Better detection, pursuit warning, safer route recommendations | Wages; intelligence can be inaccurate | V2 EXPAND |
| **Chronicler/herald** | Records milestones, spreads renown, writes notices, improves reputation reach | Minor expense, little combat utility | FUTURE |
| **Camp steward** | Automates routine staffing and camp organization | Administrative cost and oversight | FUTURE |

### 12.3 Detailed example: autonomous merchant

The player employs a merchant, assigns **200 crowns**, allows at most **70% of the budget to be invested**, selects a **cautious** strategy and forbids selling reserved military supplies.

When entering a market settlement, the merchant may:

1. Evaluate available prices relative to known average/previous buying prices.
2. Sell only owned trade stock if expected sale proceeds exceed acquisition cost after trading fees.
3. Buy goods meeting expected-margin and cargo requirements.
4. Respect remaining budget, wages reserve and protected inventory.
5. Report: *“Sold 4 salt for 68 crowns, bought 3 timber for 27; cash balance 241.”*
6. Continue to carry inventory until a profitable destination appears—or report that no safe trade was available.

Trading itself remains optional: the player can simply **buy food, sell loot and ignore commodity speculation**. The follower should begin with a conservative preset and a protected essentials reserve; expert thresholds and routing appear only in an advanced view. The merchant must **never know the exact price in an undiscovered settlement** unless the world has a plausible price-report system. Better merchants can estimate more accurately, but profits are not guaranteed.

**Critical anti-exploit:** The merchant buys and sells through the same pricing and inventory rules as the player, including scarcity and transaction effects. No phantom stock or infinite arbitrage loop. The merchant's budget is reserved, not additional money granted by the game.

### 12.4 Detailed example: blacksmith

The blacksmith can perform basic repair/maintenance, improve armor condition or provide carefully limited equipment quality bonuses to a few assigned soldiers. **Do not introduce mandatory durability degradation merely to justify this role.** A v2 implementation could simply offer paid equipment upgrades or repair after severe damage if durability is already a desired system.

A useful choice is whether to maintain cheap gear across the entire company or focus resources on a small elite guard. A powerful blanket armor bonus risks making blacksmiths mandatory; cap or target their effects.

### 12.5 Followers are vulnerable people

They can demand pay, become wounded, leave after prolonged neglect, be captured during caravan raids or require protection when traveling. But avoid punishing the player with random follower disappearance without warning or counterplay.

### 12.6 Benefits, risks, mitigation

**Good:** A living camp, meaningful delegation, reduced late-game micromanagement, interesting economic choices.  
**Bad:** Automation may outperform manual play, create invisible mistakes, add constant notifications or make money too easy.  
**Mitigation:** Opt-in tasks, explicit spending caps, activity logs, per-follower salaries, sensible defaults and undo/stop controls before orders execute.

### 12.7 Acceptance

The player can hire a merchant, set a budget and trade rules, travel between two settlements, inspect exactly what was bought and sold and why, stop trading at any time, recover the remaining funds, and verify that the balance survives save/reload.

---

## 13. Living world, travel, information and pursuit

**Priority: V2 CORE for pursuit and timely reinforcements; V2 EXPAND for richer behavior.**

### 13.1 The map should communicate intentions

A world feels alive when parties have **goals**, not simply random positions. Patrols guard roads, merchants follow trade routes, bandits seek weak targets, lords pursue military objectives, and fleeing forces seek safety.

Give parties small but persistent plans: destination, reason, target, risk tolerance, last-known enemy position, supply status, and current relationship to the player.

### 13.2 Pursuit and detection

- Vision is limited by terrain, scouts, weather if implemented, and party size.
- Parties remember a last-seen location for a reasonable duration.
- Pursuers can give up, search likely roads, or choose to intercept rather than endlessly follow.
- The player can hide in forests, use fast roads, change direction or sacrifice baggage to escape.
- Better scouts can warn of threats before contact; poor intelligence may report approximate numbers.
- A visibly superior enemy can cause panic or discourage smaller pursuers.

Avoid making AI pathfinding clairvoyant. Unknown locations must remain unknown, even in simulation.

### 13.3 Nearby parties participating in conflicts

Covered in section 9, but the world-layer responsibility is broader: a passing neutral army could ignore a fight, a rival could exploit it, or a distant party could arrive too late and attack survivors. The strategic map should record and resolve these intentions even if no live combat occurs.

### 13.4 Dynamic world events

Examples: caravan shortages, local bandit infestations, harvest failures, a village militia request, a merchant's bankruptcy, a tournament announcement, a border violation, an intercepted courier, a lord's feud or a fortress under siege.

**Design test:** Every event should change at least one state and present at least one interesting choice or observable consequence. Avoid a news feed of flavor text disconnected from gameplay.

### 13.5 Travel quality-of-life

- Estimated travel time, supply consumption and risk indicators before departure.
- Optional route preferences: fastest, safest, favor roads, avoid hostile territory.
- Auto-pause on hostile approach or major events.
- Current destination and travel state persist in a resumable campaign or restore predictably.
- Travel reports summarize wages, market changes, bandit losses, births/deaths if later enabled, and political events that occurred during accelerated time.

### 13.6 Benefits and drawbacks

**Good:** Every trip has context; scouting matters; local politics becomes visible; players make memorable stories.  
**Bad:** The map can become chaotic, unpredictable or computationally expensive; bad encounters can trap weak players.  
**Mitigation:** Limit active simulation density, give factions clear goals, cap event spam, use weighted risk and provide escape options.

---

## 14. Property, businesses and regional economy

**Priority: V2 EXPAND.** Ownership should not require becoming a lord.

### 14.1 Property categories

Distinguish **private property** from **feudal holdings**. A landless mercenary might buy a small inn or workshop without receiving a hereditary title. A lord may administer a village without personally owning every shop within it.

Candidate assets:

- **Inn:** Pays for supplies and staff; earns income from travelers, food, rooms and events.
- **Mill:** Buys grain or receives a share of harvest, turns it into flour, and sells through local markets.
- **Smithy:** Consumes fuel/metal, creates tools or equipment and can improve gear supply.
- **Farm or orchard:** Produces food subject to seasonal or simple periodic yields.
- **Warehouse:** Stores trade goods, reduces logistical pressure and supports merchant automation.
- **Town house:** Provides a safe lodging point, local contacts or social prestige; not necessarily an income machine.

### 14.2 Business economy: neither passive infinite money nor second job

A business earns **revenue minus input costs, wages, maintenance, taxes and disruptions**. Profit depends on demand, route access, regional conditions and management skill. It should be possible to have an unprofitable month.

Illustrative formula:

```text
net_period_profit = sales_revenue
                  - raw_material_cost
                  - wages
                  - maintenance
                  - local_tax
                  - extraordinary_losses
```

The owner may inspect detailed records, but the default screen should summarize *profit trend, stock, risks and next action*. Default management must keep a viable business operational without daily clicks, while deeper control may improve returns or reduce risk when markets or wars change.

### 14.3 Managers and automation

A player can appoint a steward or business manager with a budget and policy: conservative, balanced, growth, liquidate stock, prioritize military supplies. The manager's competence affects efficiency and reliability but should never bypass actual regional inventory and costs.

### 14.4 Ownership under war and political change

If the town changes hands, a private business does not necessarily vanish. Possible outcomes are continued operation under a new tax regime, temporary occupation, confiscation, damage, forced sale or contested ownership. Which occurs depends on laws and captor behavior.

**Important:** Losing a feudal title and losing private business assets are different events. That distinction makes dispossession richer and prevents the entire game from reducing to one ownership flag.

### 14.5 Value and risks

**Good:** Meaningful noncombat wealth paths; roleplay as trader/landowner; supply-chain stories; alternatives to grinding battles.  
**Bad:** Economic spreadsheets can overwhelm the action game; passive profits may trivialize military upkeep; ownership can snowball.  
**Mitigation:** Limit first release to 2–3 business types, keep inputs simple, use diminishing returns and local demand, allow hiring managers, stress-test no-risk ROI exploits.

### 14.6 Acceptance

A player buys a mill without becoming a noble, appoints a manager, sees legitimate production and expense entries, survives a town ownership change, and can sell, abandon or reclaim the property according to local law.

---

## 15. Tournaments, social activity and renown

**Priority: V2 EXPAND.**

### 15.1 Purpose

Tournaments diversify the player's path to renown and money, provide reasons to visit towns, and turn combat skill into a social opportunity rather than only a battlefield mechanic.

### 15.2 Possible tournament types

- **Foot melee duel:** Compact 1v1 arena; low implementation cost using existing sword/block mechanics.
- **Small team melee:** Player with two or three allies; introduces tournament tactics.
- **Archery contest:** Useful only when player ranged-combat controls are mature.
- **Mounted contest/joust:** Attractive later feature, but expensive if full mounted player combat is not ready.
- **Regional championship:** Multi-round event with greater reputation and political rewards.

### 15.3 Social consequences

- Noble spectators may offer contracts, political introductions or rivalry.
- Losing to a rival might create a later challenge.
- A named soldier could win a small contest and gain a distinction.
- Tournament entry may be restricted by local law, reputation or ongoing war.

### 15.4 Costs and exploit controls

Entry fees, event schedules, injury risk and diminishing rewards prevent endlessly replaying risk-free money generators. Let some novice events remain accessible to poor players, so tournaments aren't purely an elite activity.

**Benefits:** Diversified pacing, personal stories, a use for skill outside war, relationship hooks.  
**Drawbacks:** Extra arena/battle balance, possible repetitive grind, hard-to-justify tournament frequency during sieges.  
**Mitigation:** Start with a single duel tournament; add types only if they are mechanically distinct.

---

## 16. Fealty, titles, factions and political authority

**Priority: V2 CORE for identity, relationships and allegiance; V2 EXPAND for full politics.**

### 16.1 Rank is a relationship with institutions

Titles are meaningful because other people and institutions recognize them. A character can claim to be king and still lack a recognized kingdom; a widely supported rebel may wield more practical power than the legal monarch.

Track both **de jure claims** (recognized rights) and **de facto control** (who actually occupies or governs the territory). A castle may legally belong to one lord while another army occupies it.

### 16.2 Allegiance choices

The player may be:

1. **Independent:** owes no formal military oath; can trade, take contracts, own property and hire soldiers.
2. **Mercenary under contract:** serves a faction for a limited term or payment without permanent fealty.
3. **Sworn vassal:** accepts legal obligations and potential land rights within a kingdom.
4. **Rebellious vassal / claimant:** claims rights while defying the current ruler.
5. **Sovereign:** leads an independent polity, however small or weak.
6. **Deposed/exiled:** has lost recognized office or territory, but retains the character and any surviving social ties.

These are **descriptions of current relationships, not hard-coded game modes**. Complex cases, such as a mercenary contracted to one kingdom while owning property in another, must be legal if the world's rules allow them.

### 16.3 Switching allegiance

The player can seek release from an oath, defect, be expelled, accept another ruler's offer or establish independence. Consequences should be plausible rather than universally punitive:

- Legal release: modest political cost, perhaps loss of granted titles or obligations.
- Defection during war: severe reputation and trust damage with former allies; possible pursuit.
- Joining another faction: potential protection, new contracts, military access and fresh enemies.
- Independence: autonomy, but no guaranteed diplomatic recognition.

The player must understand **what happens to granted land, personal businesses, soldiers, held offices and relationships** before confirming a major switch.

### 16.4 Political rights and restrictions

A lord can petition a king, propose marriages, make local agreements, support another noble, seek favors or negotiate privately with outsiders. Whether a foreign alliance is **legally binding** depends on kingdom law and delegated authority. Secret treaties can still exist, but their discovery should matter.

A king can usually declare wars, propose peace, appoint nobles, grant fiefs, call royal forces and negotiate interstate alliances—while still facing opposition, limited authority or disobedience.

### 16.5 Benefits, complexity and first implementation

**Good:** Genuine freedom and consequences, faction identity, support for defections and claimants, many emergent campaigns.  
**Bad:** Hard permission logic, diplomacy combinatorics, save-state risk, hard-to-explain political consequences.  
**Mitigation:** Implement a small set of explicit oath/treaty/claim objects, a permissions query, and a preview of major actions before adding elaborate court politics.

**Acceptance:** An independent captain accepts a mercenary contract, becomes a vassal, receives a castle, leaves the realm under negotiated terms, retains personal soldiers, and sees only the expected titles and obligations change.

---

## 17. Lordship, holdings, governance and loss of land

**Priority: V2 EXPAND.** This is the bridge between the travel RPG and kingdom politics.

### 17.1 The holder, ruler, owner and occupier can differ

A location could be under the sovereignty of Kingdom A, granted as a fief to Lord B, occupied by Army C, and contain a privately owned mill belonging to Merchant D. Treating these as one `ownerFaction` field would make dispossession, occupation and private property difficult.

Proposed concepts:

- **Sovereign realm:** recognized polity claiming ultimate authority.
- **Legal holder:** person/house granted the title or fief.
- **Controller/occupier:** faction currently controlling the gates and garrison.
- **Administrator:** castellan, mayor, reeve or steward managing daily activity.
- **Private owners:** people owning individual businesses and buildings.

### 17.2 Castle and village management

A lord can set broad policy rather than manage every villager:

- Garrison target size and budget.
- Local patrol and security priorities.
- Food reserve and defensive preparedness.
- Tax stance: light, normal or heavy, with prosperity/loyalty consequences.
- Construction/repair queue (limited, meaningful upgrades rather than huge city-builders).
- Appointment of steward or castellan.
- Permission to recruit local militia or host caravans.
- Diplomacy or petitions related to neighboring holders.

Each policy should create a trade-off that could matter in field gameplay. A heavily taxed village may pay more now but lose prosperity or rebel; neglecting garrison supplies might be disastrous during siege. **Default lordship:** appoint or auto-select a competent steward, use a balanced policy, and receive only important security, loyalty and treasury notices. Detailed taxes, garrison targets and development queues remain available to interested players.

### 17.3 Losing a castle should be painful but playable

Illustrative event sequence:

1. The player is granted Greywall and names a castellan.
2. Enemy forces lay siege while the player campaigns elsewhere.
3. The player is warned and may ride back, send relief, order negotiation or leave the defense to the castellan.
4. The siege succeeds: control flips, local revenue stops, garrison is killed/captured/dispersed, the castellan may escape or be taken prisoner.
5. The player **still has their character and personal warband**. Their legal claim may survive, expire, be revoked or be reassigned according to politics.
6. The player can recruit, seek allies, negotiate, defect, declare independence or attempt to retake the location.

If Greywall was their only holding, the player simply has no estate to manage. The governance interface should become a small historical/claims view rather than displaying an empty list of mandatory chores.

### 17.4 Peaceful dispossession and disputes

A liege might revoke a fief, a marriage contract might transfer a title, a court might rule against a claim, or the player might willingly surrender a village for a treaty. These events can be more interesting than conquest alone.

The design should allow **claims** to persist after a change in control. A dispossessed lord can have an intelligible reason to fight for restoration.

### 17.5 Benefits and downsides

**Good:** High personal stakes, real consequences, meaningful return to captain gameplay, strong emergent drama.  
**Bad:** Potentially upsetting losses; difficult UI; severe snowballing of wealthy landowners; AI tax/defense tuning.  
**Mitigation:** Give warnings and recovery options, preserve portable assets, avoid unwinnable loss spirals, make holdings optional rather than required for progression.

### 17.6 Acceptance

A player-owned castle is captured in the player's absence. Garrison, income, control and legal claim update correctly; the player remains free to travel and fight, can switch allegiance, and can retake the same fortress without a quest-specific reset.

---

---

**Continue:** [Part 2 — Kingdoms, succession, systems architecture and roadmap](Crownless_v2_0_Feature_and_Systems_Design_Part_2.md).
