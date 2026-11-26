# Crownless — Phase 12, "The Living World" (preliminary roadmap for 7.0.0)

_Written 2026-11-26 at build 5.0.0, beside the Phase 11 plan ([`PHASE-11-PLAN.md`](PHASE-11-PLAN.md)). **Preliminary only.** It sets the scope, the reasons, the dependencies, the boundaries and the questions; it has **no tasks, no numbers and no implementation decisions**. It is re-evaluated against the finished 6.0.0, starting with a baseline task (P12-00), before any Phase 12 task is specified. Nothing here predicts what Phase 11 will measure._

## 1. The aim

Make the whole sandbox entertaining, rewarding, varied, connected and worth returning to, so that each of these is a real career, alone or mixed: **independent adventurer, mercenary, merchant, business owner, military commander, courtier, landed noble, ruler, or a casual mixture.** Every system keeps the three levels (Basic: good defaults and competent delegation; Guided: presets and priorities; Expert: detail and optimisation), chosen independently per system and changeable at any time. Five-minute sessions and long evenings are both satisfying. Offline play, portable saves, the code-drawn art and the dependency-light runtime are kept; no payments, accounts, ads or store work.

## 2. What already exists (at 5.0.0; re-checked at 6.0.0)

| Area | Existing foundations (module) | Gap the owner has named |
|---|---|---|
| A Recruitment and manpower | Recruiting by settlement and realm (`party.js`, `rights.js`), the company limit (P9-B3), women's lines (P10-09), garrisons and households (`fiefs.js`, `lords.js`), armies (`armies.js`) | Recruitment is effectively unlimited; a rich player rebuilds a destroyed army in one town |
| B Trading and economy | Markets, scarcity, cargo, caravans' price effects (`trade.js`, `parties.js`), the merchant follower (`merchant.js`), the economy report | The owner finds trading weak |
| C Businesses | The mill: miller, books, the owner's due, seizure, breakdowns (`business.js`) | One kind of business |
| D Progression | Phase 11's budget and requirements; XP from fights and quests | Non-combat careers progress slowly or not at all |
| E Contracts | Bandit hunts, escorts, deliveries, envoy errands, lords' petitions (`contracts.js`, `nobles.js`) | Repetitive; the owner's main way to play |
| F Events and mini-quests | World events (`happenings.js`), errands, the quest interpreter (`story.js`), town hubs | Few kinds; little variety across a big world |
| G Company and companions | Named soldiers, records, traits, the roll of honour, chronicle, four companions, officers and detachments | Attachment is mostly records; companions say little |
| H Politics | Allegiance, holdings, nobles' needs and opinions, petitions, claims, grants, houses, diplomacy, factions, rebellion, founding, deposition | Rich but opaque; power mostly through conquest |
| I Relationships | Opinions with reasons (`nobles.js`), houses' regard | People feel like numbers |
| J Romance | Marriage with agency, dowries, alliances, shared claims, spouses, separation (`houses.js`) | No courtship; marriage needs land |
| K Fiefs and realms | Fief administration, castellans, policies, treasuries, offices, laws | Delegation works but reports and alerts are thin |
| L Tournament society | Phase 11's formats, rivals, renown | No social side |
| M Regional identity | Seven cultures in art and troops, eight walkable towns, regional news | Regions feel alike to play |
| N Lore and legacy | The chronicle (80 lines), the roll of honour, news | Little authored history; milestones scroll away |
| O Returning | Autosave, the Journal | No recap when you come back |
| P System links | Many links exist (raids and prosperity, wars and trade, ownership and rights) | Not mapped; inherited tuning (rare risings, war frequency, runaway realms) open since P10-T |

## 3. The areas (scope and intended experience)

Each area: **intended experience**, **scope to investigate**, **links**, **not in scope**.

**A. Recruitment and manpower.** *A settlement's men are a resource that recovers; losing an army hurts but never ends a campaign.* Availability by settlement type and prosperity, recent recruiting, raids, war, casualties, security, reputation, relationships and policies; separate from the company limit; the AI's lords, garrisons and armies under the same rules; mercenaries and volunteers; wounded recovery; veterans' value (Phase 11's combat makes them matter). Shown in plain words with the expected recovery. Never permanent exhaustion; an accessible rebuilding path after defeat; no AI collapse. *Not:* a population simulation or uniform hard limits.

**B. Trading and the economy.** *A merchant can make a living from routes and judgement, without a spreadsheet.* Net profit after travel, food, wages, risk, cargo and spread, measured first; regional routes, market information, supply and demand, changing conditions; Trade skill effects; a competent delegated merchant; no same-market flipping or one endless route, without removing honest profit; links to war, caravans, shortages, prosperity, businesses and diplomacy.

**C. Businesses and tycoon play.** *Owning property is worthwhile progress with good default management.* Improve the mill's loop; investigate a coherent small set of new enterprises (candidates: an inn, a smithy, weaving, a warehouse, stables; not all); Guided priorities, Expert optimisation; portfolios if they earn their place; no unlimited passive growth, no constant artificial crises.

**D. General progression.** *Every career advances through its own activity.* Income, expenses, XP, renown, reputation, skill growth and thresholds for merchants, adventurers, owners and politicians; short, medium and long goals without forced war or grinding. Phase 11's equipment progression kept unless measurements show a conflict.

**E. Contracts and the mercenary career.** *A captain can live well on contracts alone, and they stay interesting.* Variety (protection, rescue, ransom, scouting, investigation, missing persons, stolen cargo, supply, noble commissions, wartime assignments) built on the existing kinds; occasional branches, alternative solutions, negotiation and surprises, with simple work still on offer; contracts from real world conditions (raids, shortages, wars, captured nobles, lost caravans); difficulty chosen, not always fitted to the company; active-contract limits and compatible concurrent work; rewards by time, danger, cost, urgency and reputation.

**F. Events and mini-quests.** *The road surprises you now and then, never constantly.* Frequency, distribution, cooldowns, discoverability and simultaneous limits for the one world; simulation-driven events, roadside and town encounters, short authored adventures (candidates: family disputes, stranded travellers, lost letters, odd merchants, village emergencies, veterans asking for help, local mysteries, absurd bureaucracy) with dynamic participants; optional, with consequences for helping, refusing or failing; the main story protected.

**G. Company and companions.** *You care about particular soldiers and companions.* Service records and achievements more visible; occasional personal events from real histories (origins, wounds, service, promotions, home regions), not a personality simulation; companion conversations, motives, loyalty, requests; delegation, officers, detachments and clearer reports; veterans' value tied to Phase 11's combat and Area A's manpower.

**H. Politics and other paths to power.** *A respected merchant, mercenary or courtier has real chances without conquering castles.* The existing architecture reviewed in play; progress by relationships, diplomacy, money, service, reputation, negotiation and alliances, with war as one path; what nobles want and why requests succeed or fail, shown; legitimate constraints kept; wealth alone can't buy unlimited power.

**I. Personal relationships.** *Important people are individuals who remember you.* Friendship, rivalry, trust, motives, memories, favours and introductions on the existing opinions; good relationships open recruitment, information, work, invitations, help and support for claims; rivals have consequences; affection, faction standing, family interest and obligation kept distinct; no trivial gift farming; never forced.

**J. Romance and courtship** (the one desired new subsystem, modest). *An optional courtship that ends in a marriage both families and the partner chose.* Introductions through good relationships (a noble's adult relative), visits, conversations, letters, favours, suitable gifts, short quests; the partner's own preferences and the right to refuse; family approval influences, never guarantees; a small set of eligible adults (some civilian, not commanders); credible chances for unlanded merchants and mercenaries; integrated with houses, claims, alliances and spouses. *Not:* a dating simulation, repetitive gifts, timers, obligations, childbirth, childhood or generational succession.

**K. Fiefs, businesses and realm delegation.** *Land runs well while you adventure, and tells you what matters.* Administration, prosperity, taxes, garrisons, managers, officers, budgets, laws, treasuries; competent defaults; Guided policies; Expert detail; concise reports and real alerts; links to economy, manpower, security, local relationships and obligations; you can always continue after losing land or a crown.

**L. Tournament society.** *A tournament is also a social occasion, if you want it.* Nobles, merchants, rivals, invitations, rumours, employers, introductions and courtship chances at the lists, on Phase 11's formats; fighting stays enjoyable without any of it.

**M. Regional identity and exploration.** *Each region plays differently and gives reasons to visit.* The six kingdoms and free cities deepened (culture, economy, architecture, politics, military, traditions, settlement personalities, stories, customs) with the art kit and town hubs; reasons to go somewhere new; markers, dialogue, quests and encounters reused; no map clutter or collectible chores; no large map expansion.

**N. Lore, history, whimsy and legacy.** *The world has a past, and your campaign becomes part of it.* Authored history, traditions, old conflicts and families with emergent history; warmth, dry humour, eccentric characters and occasional absurdity in a Discworld-like spirit, without undermining loss or war; the chronicle, roll of honour, regional news and personal records improved; major milestones (founding the company, losing a companion, a great tournament win, marriage, a first business or holding, founding a realm, deposition) kept for the whole campaign; routine history summarised; bounded save size.

**O. Returning.** *Coming back after a week takes a minute, not a log.* An optional, dismissible recap: where you are, the company, money, food, contracts, quests and deadlines, businesses, political requests, opportunities; optional personal objectives; clearer notifications; **the world never advances while you are away**, no daily obligations, no absence penalties.

**P. System links and long-term balance.** *Systems feed each other in ways that make sense and never trap you.* Map the links that exist; prioritise those with real play value (raids → prosperity → recruitment → protection work; war → trade disruption → supply work; wealth → access; tournament wins → renown, rivals, introductions; friendships → grants and claims; marriage → houses; ownership changes → taxes, rights, security; veterans' deaths → capability, morale, history; powerful realms → reactions); no circular loops, runaways, duplicate rewards or unrecoverable cascades; the inherited tuning (risings, war frequency, kingdom survival, runaway realms) re-measured on 6.0.0's world; success stays enjoyable.

**Q. Acceptance.** Representative campaigns for each career, including ones that ignore trade, romance, politics or manual fighting, and ones that delegate; recovery from major setbacks; ease of returning; measured profits, payback, contract variety, recruitment recovery, political progress, relationships, delegation, events, world health and save continuity; the owner's play and, if practical, outside players. Automated tests can't say whether players enjoy coming back; people can.

## 4. Dependencies on Phase 11

| Phase 12 needs | From Phase 11 |
|---|---|
| Veterans worth keeping (A, G) | Troops by weapons and styles (P11-10, P11-11) |
| Combat contracts with variety (E) | The rhythm, archery, mounted combat, special fields (P11-05 to P11-08, P11-18) |
| Fair auto-resolve for non-fighting careers (B, C, H) | P11-20 |
| Tournament society (L) | Formats and styles (P11-19) |
| Progression for non-combat careers (D) | The budget and the room left in it (P11-03) |
| Regional reasons to travel (M) | Regional arms and masters (P11-16, P11-17) as one model to extend |
| The world's long-term balance (P) | P11-20's world check and the 6.0.0 night run |

## 5. Phase boundary matrix

| Topic | Phase 11 (combat) | Phase 12 (the living world) |
|---|---|---|
| Recruitment | Troop identities, fine kit, equipment by line | Availability, manpower, recovery, mercenary supply |
| Economy | Prices of arms, loot, training fees, tournament prizes, replacement and healing costs (kept viable) | Trade routes, markets, scarcity, merchants, the rebalance |
| Businesses | — | The mill and new enterprises |
| Progression | Combat skills, attributes, requirements, the level budget | Non-combat progression, income and renown thresholds |
| Contracts | Battles inside existing contracts work under the new rules | New kinds, branches, generation from world conditions, limits |
| Quests | Combat training quests and the practice yard | Mini-quests, authored adventures, events |
| Companions | Their gear, profiles, mounts, styles | Conversations, motives, requests, personal events |
| Politics | Battles of lords and armies; siege balance | Paths to power, explanations, factions, the inherited tuning |
| Relationships, romance | — | Friendship, rivalry, courtship, marriage for the unlanded |
| Tournaments | Formats, rules, kits, styles, rewards, anti-farm | Nobles, invitations, introductions, courtship at the lists |
| Regions | Regional arms and masters | Culture, economy, traditions, stories |
| History | The battle report | Chronicle, milestones, lore, whimsy |
| Returning | — | The recap and notifications |
| World balance | Regressions caused by combat changes | Rebellions, war frequency, survival, concentration |

## 6. Open questions for after 6.0.0

1. How profitable is trading **after** Phase 11's economy changes, measured with travel, food, wages and risk? (B)
2. How fast do companies rebuild after defeat today, and what would a manpower pool change for the AI's armies? (A, P)
3. Which business kinds fit the existing market goods and the mill's code with the least new machinery? (C)
4. Which political actions does the player actually use in the bots and the owner's play, and which are invisible? (H)
5. How should romance appear in the Journal and the Realm screen without becoming a chore? Which adult relatives exist in the 26 people of the realms, and are more needed? (J)
6. What does a returning player most need to see first? (O; from the owner's own returns)
7. Do Phase 11's veterans and styles make soldiers memorable enough that personal events are needed, or does visibility suffice? (G)
8. Which system links already exist in code, and which produce loops or runaways in the long runs? (P)
9. Does Phase 11's progression budget leave room for the non-combat careers, or must Phase 12 adjust it? (D)
10. Should the free regional edition (the original Border March) be a playable slice of the one world, and does any Phase 12 design make that harder? (product direction; no packaging work)

## 7. Exclusions

Multiplayer; a large geographical expansion; a full population simulation; extensive magic; detailed crafting; complete settlement construction; childbirth and ageing; numerous independent minigames; commercial payments, accounts, ads, subscriptions or store integration.

## 8. How Phase 12 will be planned

1. **P12-00, a baseline** on 6.0.0: the economy, progression, contracts, politics, relationships, events and world health measured as P11-00 measured combat; the owner's play of a few careers; the night run.
2. The areas above turned into tasks by evidence, combining or splitting as needed, each with a Brief, in NEXT-TASKS's format.
3. Romance (J) is planned as one modest subsystem on houses and marriage, after relationships (I).
4. The inherited political tuning (P) is measured first, so later tasks don't build on a drifting world.
