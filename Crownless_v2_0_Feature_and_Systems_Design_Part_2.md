# CROWNLESS — V2.0 FEATURE & SYSTEMS DESIGN — PART 2

**Working document:** Long-term design specification / feature sheet  
**Status:** Planning proposal, not an implementation promise  
**Edition:** 1.1 — 16 November 2026 (optional-depth design update)  
**Project:** Crownless — The Border March  
**Target:** Browser-first, single-player, top-down 2D warband RPG  
**Reference baseline:** [greaneagle/crownless-mvp](https://github.com/greaneagle/crownless-mvp), build **0.18.0**, commit `830af336c`, inspected 16 November 2026.

This is **Part 2 of 2**. Begin with [Part 1 — Foundations, battles, soldiers, followers, economy and lordship](Crownless_v2_0_Feature_and_Systems_Design_Part_1.md) for the core design principles, including **optional depth and competent defaults**. The section numbering continues from Part 1.

---

## Contents

18. [Kingdoms, diplomacy, nobles, rebellion and deposition](#18-kingdoms-diplomacy-nobles-rebellion-and-deposition)
19. [Houses, marriage, lineage and succession](#19-houses-marriage-lineage-and-succession)
20. [War, sieges, armies and strategic campaigns](#20-war-sieges-armies-and-strategic-campaigns)
21. [Quests, stories, emergent events and chronicles](#21-quests-stories-emergent-events-and-chronicles)
22. [Player experience, interface and accessibility](#22-player-experience-interface-and-accessibility)
23. [Future worlds and modding readiness](#23-future-worlds-and-modding-readiness)
24. [Proposed game-state and technical architecture](#24-proposed-game-state-and-technical-architecture)
25. [Balance, fairness, anti-exploit and performance](#25-balance-fairness-anti-exploit-and-performance)
26. [Priorities, dependencies and proposed delivery roadmap](#26-priorities-dependencies-and-proposed-delivery-roadmap)
27. [Test scenarios and acceptance criteria](#27-test-scenarios-and-acceptance-criteria)
28. [Open decisions and design experiments](#28-open-decisions-and-design-experiments)
29. [Final design thesis](#29-final-design-thesis)

---

## 18. Kingdoms, diplomacy, nobles, rebellion and deposition

**Priority: V2 EXPAND; advanced political simulation FUTURE.** The king and ruling lord share the **same underlying systems**; the crown simply broadens jurisdiction, permissions and the network of subordinates.

### 18.1 The kingdom as an organization

A kingdom has a ruler, laws, recognized territory, treasury, treaties, offices, vassals, claimants, armed forces, grievances and external relationships. The ruler's personal wealth and the realm treasury are **separate accounts**.

A monarch who needs 2,000 crowns for a war cannot simply draw them from thin air; funds come from taxes, obligations, loans, spoils or the royal household. The monarch is answerable to the same economy used by landed nobles and commoners.

### 18.2 Ruler powers as extensions of lord powers

| Action | Landed lord | Sovereign ruler |
|---|---|---|
| Command own warband | Yes | Yes |
| Command personally loyal forces | Yes | Yes |
| Order subordinate forces | Officers, household and obligated vassals | Royal officers and kingdom vassals, with compliance checks |
| Manage property and castles | Own assigned holdings | Crown lands plus personal holdings; may delegate |
| Petition / negotiate | Liege, peers and neighbors | Other sovereigns, peers and internal estates |
| Make local agreements | Within permitted authority | May negotiate realm-wide treaties |
| Grant land/titles | Only if legally empowered | Usually yes, within law and political constraints |
| Declare war/peace | Usually cannot bind the realm unilaterally | Generally can initiate, possibly constrained by council or law |
| Be displaced | Lose land or office | Be deposed, forced into regency or lose kingdom |

There is no automatic transformation of the interface into a “kingdom game.” The same character can leave court and ride into battle. **Default kingship:** choose broad objectives, delegate ordinary policy and campaigns, and let time advance until something important demands attention. Advanced rulers may edit treaties, holdings and army orders individually; the simulation uses the same underlying world and AI in either case.

### 18.3 Diplomacy and alliances

Potential diplomatic relationships include:

- Peace, war, truce, nonaggression, alliance, military access, trade privileges and tributary agreements.
- Personal oaths, hostage agreements, marriage ties, promised land and mutual aid.
- Local noble pacts that can coexist or conflict with realm policy.
- Secret arrangements, with discovery and reputation consequences.

For a first implementation, use a **small treaty vocabulary** with explicit start/end dates, obligations and breach conditions. Avoid a universal “alliance = +50 relations” shortcut that ignores practical military commitments.

### 18.4 Political actors need motives and limits

A noble might prioritize protecting their holdings, expanding their house, satisfying old feuds, advancing a claim, improving wealth or preserving the kingdom. Give each a few stable motives and current needs, rather than random preference changes every day.

When ordered to support a campaign, a noble evaluates: obligations, relationship, threat to home territory, expected losses, resources and personal ambitions. The result can be **obey, negotiate, delay, refuse or defect**, with a reason the player can understand.

### 18.5 Rebellions and civil war

Rebellion should develop from accumulating grievances, fear, opportunity, ideological conflict or a disputed succession rather than appearing through an unexplained random roll.

Possible sequence:

1. Several lords become dissatisfied over taxes, unfair appointments or revoked titles.
2. A claimant or prominent noble seeks allies.
3. The ruler receives warnings through court, spies, companions or public rumors.
4. The ruler can negotiate concessions, appoint mediators, improve treatment, divide conspirators or prepare militarily.
5. Rebels may issue demands, declare independence or start a civil war.
6. Holdings and armies change allegiance based on commanders, garrisons, support and outcomes.
7. The player can win, compromise, abdicate, flee, be imprisoned or lose the crown.

**Important:** Different kingdoms can have different laws and distributions of power. A highly centralized realm and a loose league of dukes should feel different even while using the same diplomacy and loyalty engine.

### 18.6 Deposition is not a game-over screen

If the player is deposed, the simulation must determine separately:

- Is the player alive, wounded, imprisoned or at liberty?
- Which soldiers are personally loyal versus sworn to the crown?
- Which companions stay, leave or switch sides?
- Which private businesses and households remain theirs?
- Do they retain a legal claim to the throne?
- Does a foreign ruler offer exile, mercenary service or restoration support?

The former king may immediately return to **personal campaigning**. They might choose to retake the throne, carve out a new territory or ignore politics entirely.

### 18.7 Dynamic faction politics without forced historical scripting

The AI may propose alliances, negotiate peace, petition for land, be offended by refusals, support rivals and respond to military conditions. Outcomes should derive from the same rules whether or not the player is sovereign.

A nearby kingdom could invade because its border is weak, not merely because a quest demands it. A loyal noble could rebel if pushed too far, while a former enemy might become an ally under new leadership.

### 18.8 Benefits and dangers

**Good:** Extraordinary narrative potential; real consequences for power; unique campaigns; repeatable intrigue; rich modding compatibility.  
**Bad:** Very high design/AI/UI complexity; hard-to-read obligations; runaway cascades of rebellion; unrealistic or unfair political behavior.  
**Mitigation:** Begin with two realms, a handful of named nobles, one legal structure and a limited treaty system. Expose reasons for every major AI choice and keep the consequences inspectable.

### 18.9 Minimum acceptance

A player ruler can command a vassal army, negotiate a treaty, appoint a castellan and issue a land grant. A disloyal noble can decline an order, create a faction and rebel. If the player loses the war and is deposed, the same save continues with the player as a free claimant or captive, not as a new character or different campaign mode.

---

## 19. Houses, marriage, lineage and succession

**Priority: V2 EXPAND for houses/marriage; FUTURE for multi-generational succession.**

### 19.1 What a house represents

A **house** is a persistent social and political entity. It may have a name, heraldry, members, recognized heads, alliances, rivalries, wealth, ancestral claims and holdings. A house may exist without land and survive after losing its kingdom.

Personal relationships and house relationships should not be identical: one noble could respect the player personally while their house remains hostile over a land dispute.

### 19.2 Marriage and partnerships

Marriage can connect houses, alter claims, bring dowries, produce heirs when enabled, establish political alliances or create competing loyalties. It should not reduce partners to tradable bonuses. The player should be able to negotiate, accept, refuse or leave such arrangements, with understandable consequences and clear character agency.

Possible mechanics:

- Reputation and relationship requirements.
- Negotiated property/claims and dowry arrangements appropriate to world law.
- Shared political obligations or diplomatic expectations.
- Partner as a named person with goals, talents and relationships, potentially an active companion or administrator.
- Marriage or partnership recognition varying by setting, with the implementation designed for flexible character presentation.

### 19.3 Time-scale clarification

Lineage is not inherently incompatible with fast travel or tactical battles. The player can choose to accelerate the campaign while delegating wars and estate administration. But **children growing to adulthood still require substantial in-fiction years** if biological aging is modeled conventionally.

That is a design choice, not a technical blocker. Options include:

1. **Founding-house model (recommended early):** Marriage, relatives, adult siblings, cousins, heirs, inheritance rights and house rivalries are playable immediately. Birth-to-adulthood simulation is optional.
2. **Long-campaign model:** Allow optional years of fast-forward with rich world simulation, births, aging, succession and major historical events.
3. **Scenario-start model:** A mod/world can begin with preexisting adult heirs, allowing house politics in a short campaign.

No player should be forced to wait years to enjoy ordinary campaigning or to own land.

### 19.4 Succession and playable heirs

A future system could define inheritance laws, succession candidates, regencies, contested claims and optional continuation as an heir after death or retirement. This would extend the same persistent-world principle, but should be considered an **expansion**, not necessary for the first playable political system.

Permanent character death, aging and heir control need explicit difficulty/gameplay settings. They must never silently invalidate a long-running save.

### 19.5 What is good and bad

**Good:** Long-term goals; diplomacy with personal stakes; rich stories across different worlds; useful path for time acceleration.  
**Bad:** Very expensive character/relationship content; combinatorial inheritance bugs; possible forced time skips; risks of making marriage purely transactional.  
**Mitigation:** Start with houses and adult relatives, then marriage, and introduce full generational mechanics only after proven demand and a stable multi-year simulation.

### 19.6 Acceptance for early house system

Two houses can form a marriage alliance with explicitly tracked obligations; their members have separate opinions; one family can lose all holdings while retaining its members and name; a claimant can petition for restoration. No biological generation system is required for this acceptance test.

---

## 20. War, sieges, armies and strategic campaigns

**Priority: V2 EXPAND; comprehensive siege simulation FUTURE.**

### 20.1 The army and the party are different organizational sizes, not different movement engines

A personal warband travels with the hero. A larger **army** may comprise several parties under one strategic commander. A king or lord can personally lead the army or give orders to another commander. Army cohesion depends on food, morale, authority, relationships and commander competence.

### 20.2 Army creation and delegation

- Call obligated forces, invite allied lords or hire mercenaries.
- Set rally points and expected assembly times.
- Separate own troops from pledged forces so losses, wages and allegiance remain attributable.
- Define strategic objectives and allowed losses.
- Delegate a marshal or other commander.
- Track delayed arrivals, desertion, supply failures and disobedience.

A king cannot instantly summon every noble across the world. Lords may need time to gather retinues, travel and decide whether they will obey.

### 20.3 Strategic maneuvers

- Patrol, raid, pursue, besiege, relieve siege, escort supply, defend border, regroup.
- Supply lines and food reserves constrain long expeditions.
- Roads and terrain affect speed, detection and interception.
- A defeated army may retreat, break apart, surrender or attempt a fighting withdrawal.
- Nearby armies can join field battles under the time and reinforcement rules already defined.

### 20.4 Siege phases

Start with a manageable siege model:

1. **Encirclement:** Attackers block normal travel/trade; defenders draw on food and garrison supplies.
2. **Preparation:** Build ladders or simple siege assets, negotiate surrender, wait for relief, or attempt a risky storm.
3. **Assault:** Fight on a special map with gates, walls and fallback positions as the engine permits.
4. **Resolution:** Transfer physical control, calculate losses, capture or release prisoners, record property damage and update claims.

An early version can abstract preparation and play a single courtyard/approach battle. Multiple simultaneous walls, destructible siege towers and full siege machinery are future polish, not prerequisites for meaningful territorial capture.

### 20.5 Player intervention

The player can arrive to relieve a siege, join the defenders, slip through enemy lines, negotiate or allow their appointed castellan to continue. A powerful ruler may fast-forward while a trusted marshal conducts the siege. A reckless noble may assault early and squander troops.

### 20.6 Surrender, capture and ransom

Defeat should not always mean death. Armies may surrender under overwhelming odds; captives can be held, exchanged, ransomed or released. The existing capture mechanic becomes one instance of a broader status model. Excessively punishing captivity should be avoidable through escape, negotiation or help from allies.

### 20.7 Anti-snowball design

A wealthy kingdom should not inevitably steamroll every opponent. Large forces are expensive, slow and politically difficult to coordinate. Garrisons consume wages. Far-flung campaigns strain supplies. Disloyal lords can refuse summons, and conquered settlements may resist occupation.

These constraints are important for both challenge and plausibility. Avoid artificial rubber-banding where new enemies spawn free armies purely because the player succeeded.

### 20.8 Good, bad, mitigation

**Good:** Meaningful land ownership; army-scale decisions; reversals; heroic personal intervention.  
**Bad:** Large computational burden, siege UI complexity, attrition grind, AI pathfinding and balance problems.  
**Mitigation:** Shared strategic party rules, event-based sieges, autoresolve parity, incremental scale increases, and a single playable siege sequence before building more.

---

## 21. Quests, stories, emergent events and chronicles

**Priority: V2 CORE for clean event support; V2 EXPAND for emergent narrative.**

### 21.1 Handwritten and systemic stories should cooperate

The existing MVP plan contains **The Last Charter**, four story quests and multiple endings. Preserve handcrafted narrative as a strong starting experience. Then allow world conditions to generate meaningful optional events: family disputes, sieges, succession claims, border raids, veteran promotions and diplomatic betrayals.

The player should always be able to ignore the main story temporarily and continue the sandbox.

### 21.2 Quest/event building blocks

An extensible interpreter should support:

- **Triggers:** arrival, battle result, person met, item acquired, holding lost, treaty signed, character wounded, faction relation changed.
- **Conditions:** reputation thresholds, quest flags, ownership claims, current liege, active companions, known facts, time limits.
- **Actions:** pay money, spawn or move a party, transfer property, change an oath, grant a title, modify a relationship, start a battle, announce news.
- **Choices:** with visible consequences when reasonably knowable.
- **Fallbacks:** if a courier dies, a castle changes hands, a companion is imprisoned or a quest giver defects.
- **Termination:** completed, failed, abandoned, obsolete, replaced by alternative objective.

Use stable object IDs, explicit state transitions and idempotent event actions. A dialogue event should never pay its reward twice after save/load.

### 21.3 Emergent story examples

**The veteran's return:** A soldier recruited in Oakford becomes an acclaimed knight. When the player visits Oakford, locals remember their service; the knight may be invited to lead its militia.

**The claimant's bargain:** After losing a castle, the player can ask a rival king for restoration help in exchange for future allegiance. The promise becomes a real contract with a deadline and political consequences.

**The loyal fool:** A companion refuses to abandon a besieged fortress and needs rescue. Their choice depends on their personality and oath, not a predetermined quest outcome.

**A merchant's gamble:** A camp merchant invests heavily in salt based on rumors, but a reopened road lowers its price. The player can hold stock, sell at a loss or investigate the trade shift.

### 21.4 Chronicle and regional news

Maintain two levels of history:

1. **Personal Chronicle:** recruited soldiers, significant battles, promotions, marriages, changes in allegiance, lost/recovered castles, founding of a house.
2. **World Chronicle:** rulers crowned/deposed, wars declared/ended, major sieges, towns changing control, notable deaths, treaties, rebellions.

A concise in-game chronicle helps the player understand the consequences of acceleration and long campaigns. Store event summaries and stable entity IDs, not enormous logs of every AI decision.

### 21.5 Benefits and risks

**Good:** Endless stories from reusable rules; emotional attachment; excellent modding foundation; observable world consequences.  
**Bad:** Inconsistent narrative outcomes, circular event chains, quest softlocks and overwhelming event spam.  
**Mitigation:** Explicit events, condition auditing, alternate paths, capped notification channels, replay tests, and deterministic seeds for event generation.

---

## 22. Player experience, interface and accessibility

**Priority: V2 CORE for controls and accessibility; V2 EXPAND for deep management UX.**

### 22.1 One interface with contextual options

Do **not** build separate “adventurer,” “lord” and “king” menu trees. Show actions appropriate to the player's current relationships, holdings and powers. The campaign map, inventory, personal warband and direct combat controls remain present throughout.

Recommended top-level concepts:

- **Travel / World:** Movement, parties, locations, alerts.
- **Warband:** Soldiers, companions, camp followers, supplies and formations.
- **Character:** Skills, equipment, personal history, relationships.
- **Orders:** Active military and delegated organizational tasks.
- **Holdings:** Personal property, land, garrisons and businesses (only appears when relevant).
- **Diplomacy:** Oaths, treaties, petitions, claims and obligations (contextually expanded).
- **Chronicle:** History, renown, rumors, unfinished promises and news.

### 22.2 Complexity layers

The full default/guided/advanced contract is defined in §2.5; this section specifies how that contract appears in the actual interface. **Do not ask for setup simply because a system has settings.** Every screen needs a primary action, a compact summary and a clearly labeled route to detail.

| System | Simple interaction | Advanced interaction |
|---|---|---|
| Battles | Balanced/Defensive/Aggressive preset | Move groups, choose targets, formations and reinforcements |
| Trade | Sell loot; let merchant operate | Per-item spending, target margins, region preferences |
| Camp | Auto-buy supplies via quartermaster | Minimum reserves, wages policy, inventory permissions |
| Lordship | Appoint steward; choose a policy | Budgets, garrisons, construction, local taxes |
| Armies | “Defend Greywall” | Rally point, allowable casualties, supply plan, autonomy |
| Kingdom | Strategic goals and recommended policies | Specific treaties, grants, taxes, appointments and wars |
| Time | Normal speed, pause on important events | Fast-forward rules and per-event interruption settings |

The key is that **advanced menus are opt-in depth, not hidden prerequisites for competent play**.

### 22.3 Browser and mobile presentation

- Keep the Canvas game scalable with a responsive HUD and preserved aspect ratio.
- Support an explicit fullscreen button where browsers allow it; retain a regular browser mode.
- Consider installable PWA behavior later for standalone mobile presentation; do not assume iPhone Safari supports every desktop fullscreen API.
- Use large, touch-friendly minimap and tactical-map controls.
- Preserve keyboard shortcuts for fast play without making them mandatory.
- Avoid tiny text in troop biographies and finance tables; support list summaries and drill-down details.
- Keep menus usable in landscape with safe-area insets and short sessions.

### 22.4 Accessibility and clarity

- Let players resize UI text and enlarge tactical icons.
- Never rely only on red/green for allegiance, threat or profit: include symbols and text.
- Give alternatives to hold-to-act input on touch.
- Allow camera smoothing and screen shake to be disabled.
- Provide pause and readable event logs; allow major decisions to be made without real-time pressure.
- Review viewport zoom restrictions (`user-scalable=no` is present in the current HTML) when adding accessibility settings.
- Autosave at safe intervals and before irreversible political actions; make exporting saves straightforward.

### 22.5 Political decision preview

For major irreversible-looking choices, explicitly preview the **known** consequences:

> *Leave the Valedorn Crown?*  
> You will lose authority over Greywall under your current oath. Your personal warband and private possessions remain yours. Lord Edric may refuse to accompany you. Some nobles will regard this as betrayal.

Not all consequences need be guaranteed or known, but the player should understand what they are risking.

### 22.6 Avoid management fatigue

Bundle routine administrative reports into periodic summaries. Support trustworthy defaults and delegation. Make interruptions proportionate to stakes. A monarch should be able to spend half an hour adventuring without receiving twenty trivial farm notifications.

### 22.7 Interaction-depth contract and discoverability

Each new system must ship with **three documented experiences**, even if the first version's advanced panel is deliberately modest:

1. **Zero-configuration path.** What can a player do immediately, and what happens if they never open the detailed settings? This should be useful and not routinely self-destructive.
2. **One-decision path.** Which single intent-based choice changes behavior? Examples: "Defend", "Trade cautiously", "Keep two weeks of food", "Prioritize village prosperity".
3. **Expert path.** What additional levers exist, what information is available, and how do manual choices differ from a preset while respecting exactly the same underlying economy and rules?

**UI rules:** Keep advanced panels collapsed; provide touch-sized controls, legible explanations, reversible drafts before confirmation, and consistent presets. Persist user-selected policies per system, with a safe "restore recommended defaults" action. When advanced input becomes invalid after a save migration or an ownership change, revert *that policy* safely and notify the player rather than destroying the campaign.

**Explanations:** Every automated major choice should be inspectable at the right level of detail. A delegated merchant report might say "Profit: 24 crowns; avoided buying iron because cargo was full." A general might report "Retreated after casualties exceeded 25%." A lord might report "Raised garrison pay during siege; treasury down 70 crowns." Don't dump the underlying AI weights on the player unless they explicitly request diagnostics.

**Interruptions:** Differentiate an information digest, a decision waiting for attention, and an urgent threat. A player who is fighting personally shouldn't be interrupted by minor estate production; a king fast-forwarding time should be interrupted by a siege or revolt. Players can adjust interruption preferences, but safety-critical warnings still need to be visible.

**Player trust tests:** A default tactical plan should be broadly competent in ordinary encounters; auto-resolve should use visible assumptions; default quartermaster rules should protect essentials; default estate governance should not create routine avoidable insolvency. Advanced control should provide **meaningful agency**, not grant a hidden bonus just for opening the panel.

---

## 23. Future worlds and modding readiness

**Priority: Architectural preparation during v2; public creator tools FUTURE after a complete official game.**

### 23.1 Product vision

Long term, **Crownless is the reusable RPG platform** and **The Border March is its first official world**. Additional official worlds and community-created settings can reuse combat, world simulation, diplomacy, characters, economy, dialogue and UI.

Different worlds might emphasize historical frontier politics, low fantasy, original dark fantasy or unusual political systems. The engine should not assume every world has the same faction names, cultures, troop trees or monarchical laws.

### 23.2 Content boundaries to preserve now

- World manifest: ID, title, author, version, engine compatibility, supported features, required packs.
- Factions and their laws/starting relationships.
- World map, settlements, routes, climate/terrain tags, battle maps and spawn points.
- Units, troops, upgrades, equipment and visual assets.
- Named characters, companion templates, houses, titles and offices.
- Businesses, economic goods, production inputs and market rules.
- Quests, dialogue, event conditions and effects.
- Starting scenarios, victory conditions (if any), default settings and campaign prompts.
- Localization text and UI labels.

### 23.3 Example eventual world package

```text
my-world/
  manifest.json
  factions.json
  kingdoms.json
  settlements.json
  characters.json
  houses.json
  troop_trees.json
  items.json
  economy.json
  battle_maps.json
  quests.json
  dialogue.json
  rules.json
  assets/
    world.png
    units/
    portraits/
    tiles/
```

This is a **future candidate format**, not an instruction to convert all existing `data/*.js` immediately.

### 23.4 Declarative rather than executable mods

The default community format should use **validated JSON-like data and bounded event actions**, not execute arbitrary user-provided JavaScript. This makes mods safer, easier to audit and more compatible with browser security restrictions.

A later advanced API for code mods would require a much more demanding trust and sandbox design and is not part of the recommended initial modding release.

### 23.5 Namespaces and IDs

Use stable IDs such as `border_march:stonebridge` or `ashen_kingdoms:house_merrow` rather than relying on global short names. Resolve all references at content-load time and report precise errors. Keep saved campaigns tied to their world ID, content version, enabled packs and migration history.

### 23.6 Import and safety

An eventual ZIP importer must validate paths (including traversal attempts), file count, decompressed size, supported MIME types, embedded assets and reference graphs. Store imported packs locally, likely in IndexedDB rather than cramming large sprites into localStorage. Never claim arbitrary third-party mods are safe unless they are actually verified.

### 23.7 Compatibility and removal

A save from a modded world should not silently load against a different pack and replace unknown soldiers with defaults. Provide understandable errors, backup/export tools, and migration hooks where possible. Disabling a pack with live dependencies may need a deliberate incompatibility warning.

### 23.8 Copyright and distribution

General-purpose modding does not automatically make third-party franchise adaptations lawful. Community fan mods can still infringe copyright even when distributed free. The developer should not officially distribute or endorse unlicensed assets/characters/world adaptations as a core business strategy. If a future site hosts mods, establish a takedown and content policy and encourage original, public-domain or licensed creations.

### 23.9 Benefits and risks

**Good:** Strong replayability, community creativity, official new worlds with less engine work, lasting product identity.  
**Bad:** Validation complexity, support burden, compatibility problems, unsafe content imports, moderation/legal exposure.  
**Mitigation:** Finish one excellent official world first; use content schemas and tests now; build creators' tools and distribution only after the gameplay and save contracts stabilize.

---
## 24. Proposed game-state and technical architecture

**Priority: V2 CORE infrastructure.** Preserve the browser/Canvas engine and existing content-first design, but make the interactions between systems explicit.

### 24.1 Guiding architecture

The world simulation should own authoritative campaign state. The combat engine should calculate a tactical battle from a well-defined snapshot and return a result that is applied **exactly once**. UI, rendering and camera controls should present those states without secretly changing economic or political data.

A plausible logical split is:

```text
Crownless (browser, HTML5 Canvas, classic JS modules)
│
├── Content & Rules
│   ├── ContentDB, validations, IDs, scenario/world manifests
│   ├── Troops, items, factions, houses, titles, dialogue and quests
│   └── Laws, economy parameters, AI doctrine and battle presets
│
├── Campaign Domain
│   ├── Character & personal warband
│   ├── People: soldiers, companions, nobles, followers
│   ├── World: locations, ownership, parties, travel and visibility
│   ├── Politics: offices, claims, oaths, treaties and relations
│   ├── Economy: markets, property, businesses and treasury accounts
│   ├── Orders: army commands, staffing, delegated work
│   ├── Events: quests, reports, chronicles, notifications
│   └── Clock: authoritative campaign time and strategic event scheduler
│
├── Tactical Battle Domain
│   ├── Battle snapshots and participating companies
│   ├── Unit combat, formations, AI and obstacles
│   ├── Camera, tactical overview and minimap data
│   └── Reinforcement and battle-result contracts
│
├── Application / Persistence
│   ├── Save migrations, validation and pre-change recovery
│   ├── Import/export, world compatibility metadata
│   ├── Headless simulation and test APIs
│   └── Diagnostics, event tracing and crash recovery
│
└── Presentation
    ├── HTML menus, overlays, responsive touch controls
    ├── Canvas world/battle rendering
    └── Accessibility, audio and settings
```

This describes **responsibilities**, not a demand to create one file for each box or introduce a framework. Existing modules can be evolved incrementally.

### 24.2 Stable entities and relationships

A potential data schema sketch (not an implementation-ready migration):

```json
{
  "schemaVersion": 3,
  "worldId": "border_march",
  "contentVersion": "2.0.0",
  "clock": { "campaignHours": 184.5 },
  "playerCharacterId": "person:1",
  "people": {
    "person:1": { "name": "The Player", "alive": true },
    "person:52": {
      "name": "Edric of Oakford",
      "originSettlementId": "border_march:oakford",
      "companyId": "company:player",
      "roles": ["soldier"],
      "status": "active",
      "kills": 17,
      "battlesJoined": 23,
      "injuriesSuffered": 2,
      "wagesEarned": 74
    }
  },
  "organizations": {
    "realm:valedorn": { "rulerPersonId": "person:1" },
    "company:player": { "commanderPersonId": "person:1" }
  },
  "holdings": {
    "holding:greywall": {
      "settlementId": "border_march:greywall",
      "sovereignRealmId": "realm:valedorn",
      "legalHolderPersonId": "person:1",
      "occupyingRealmId": "realm:aurelian",
      "administratorPersonId": "person:89"
    }
  },
  "relations": [],
  "treaties": [],
  "orders": [],
  "events": []
}
```

**Why these fields matter:** The player is legally Greywall's lord while Aurelian troops occupy the fortress. That cannot be represented reliably as a single `ownerFaction` value. A later reconquest should change occupation and possibly title rights without recreating the player or soldier IDs.

### 24.3 Event-driven changes and idempotence

Use a domain event vocabulary such as:

```text
SoldierRecruited
SoldierPromoted
SoldierWounded
SoldierKilled
BattleStarted
ReinforcementsArrived
BattleResolved
FactionRelationChanged
AllegianceSworn
AllegianceBroken
HoldingBesieged
HoldingCaptured
TitleGranted
TitleRevoked
PropertyPurchased
CommanderAppointed
OrderCompleted
TreatySigned
TreatyBroken
RulerDeposed
QuestFlagChanged
```

Events should be emitted once per state transition, with unique event IDs. Systems that listen to the event can update soldier history, chronicles, quests, renown, notifications or faction relationships without embedding all those concerns in one battle handler.

**Do not immediately build a huge generic event-sourcing framework.** Start with a small dispatcher and clear transaction boundaries where they prevent real duplication bugs.

### 24.4 State ownership and safe command processing

Prefer a command flow:

```text
Player / AI decision
    ↓
Validate permissions, resources, references and game mode
    ↓
Apply one authoritative state transition
    ↓
Emit events / record results
    ↓
Save at a safe checkpoint and refresh UI
```

An order should validate its budget, actual soldiers, current commander and target. A castle transfer should be atomic with corresponding income, garrison and claim changes where appropriate. User-facing buttons should not directly patch unrelated state fragments.

### 24.5 Tactical-battle snapshot and reconciliation

When battle begins, capture a stable set of participants, identities, troops, equipment, strategic location and relevant rules. The battle can own transient unit coordinates and combat animations, while the strategic layer controls the campaign clock and eligible outside reinforcements.

When battle ends, commit casualties, surviving troops, loot, injuries, experience, relationships and captured commanders through one result path. Mark the encounter result ID as resolved and **reject duplicates on reload or accidental repeated callbacks**. Release involved world parties back to the strategic simulation only after reconciliation.

### 24.6 Camera and map coordinate system

Use explicit coordinate transforms:

```text
screenX = (worldX - cameraX) * zoom + viewportCenterX
screenY = (worldY - cameraY) * zoom + viewportCenterY

worldX = (screenX - viewportCenterX) / zoom + cameraX
worldY = (screenY - viewportCenterY) / zoom + cameraY
```

Tactical input, mouse targeting and minimap pings must be translated consistently. The world should never be simulated in arbitrary screen-space pixels merely because the camera moved.

### 24.7 Save design

- Introduce new schema versions through explicit migrations, ideally with fixtures covering historical 0.x saves.
- Require **structural validation** of mandatory fields before accepting imported saves; don't accept a partial `{ "version": 2 }` campaign as a valid complete world.
- Use a **last-known-good** backup and never overwrite it with unverified prior contents.
- Check that every write succeeded before declaring a restore/import successful or deleting recovery data.
- Autosave periodically during map travel and at appropriate lifecycle events, not only on town arrival.
- Preserve world/mod ID, data version, active events, battle status and completed operations.
- For large world data, consider IndexedDB and compressed snapshots, while still keeping convenient manual import/export.
- Use a safe upgrade path for existing players; preserve a pre-migration export whenever practical.

### 24.8 Randomness, simulation and reproducibility

Use an explicit seed or family of named RNG streams for world parties, battle outcomes, loot, market events and political decisions. This makes failures replayable and helps avoid unrelated changes reshuffling every event. UI animations need not affect economic RNG.

The existing headless campaign bot is a valuable foundation. Extend it to simulate political transitions, businesses, delegates, raids and sieges across many seeds.

### 24.9 Testing levels

1. **Pure function tests:** formulas, prices, permissions, path cost, morale transitions.
2. **Domain tests:** recruit, transfer, pay, appoint, revoke, capture, swear oath, resolve treaty.
3. **System integration:** world movement during battle, reinforcements, property income, delegated orders.
4. **Multi-seed campaign simulation:** long-running economies and political stability.
5. **Browser end-to-end:** actual buttons, camera, touch controls, save/import, overlays and game loop.
6. **Physical device QA:** Android Chrome, iPhone Safari, landscape viewport sizes, performance and storage interruptions.

### 24.10 Migration and codebase strategy

- Keep current modules operational while extracting narrow interfaces and domain actions.
- Avoid a framework rewrite, backend dependency or full TypeScript conversion as prerequisites for v2.
- Migrate content gradually to validated declarative schemas when the data contract is stable.
- Introduce logical camera, event and ownership systems **before** features that depend on them.
- Keep CI green after each deliverable; retain reproducible balance simulations.

**Benefits:** Reuse, mod readiness, fewer save/battle races, testability.  
**Costs:** Upfront schema work and migration complexity.  
**Mitigation:** One vertical slice at a time with backward-compatibility fixtures.

---

## 25. Balance, fairness, anti-exploit and performance

**Priority: Cross-cutting requirement.** A deep sandbox can fail through exploit loops even if every individual feature works.

### 25.1 Economy invariants

- Every money transfer has a source and destination; no profitable repeated buy/sell within a single unchanged market.
- Personal treasury, company treasury, business capital and kingdom treasury remain distinct.
- Employees spend from assigned budgets, not from unbounded shared funds.
- Business output is constrained by inputs, demand and production time.
- Taxes shift resources rather than generating unlimited wealth without effects.
- Wages, supplies and upkeep follow units when soldiers move to detached armies.
- Repeated fast-forward never bypasses costs or duplicates monthly income.

### 25.2 Military invariants

- Each soldier is in at most one active roster/army/garrison at a time.
- A battle can be resolved and rewarded only once.
- A party cannot fight in two simultaneous conflicts.
- Reinforcement entry respects travel time and visibility.
- Deployment does not bypass terrain or place units inside walls.
- Auto-resolve and live combat have broadly understandable balance, even if the player can outperform AI personally.
- Defeat can have serious consequences without creating unavoidable permanent softlocks.

### 25.3 Politics invariants

- A title holder and an occupying army may differ, but each has unambiguous rights.
- A person cannot have contradictory mutually exclusive offices unless the world law explicitly permits it.
- A revoked oath updates obligations, army access and diplomatic consequences consistently.
- Rebellion and deposition cannot duplicate holdings or delete personal soldiers.
- Claims may persist after dispossession, but claims alone don't produce tax income or garrison control.
- Diplomacy and political influence cannot be spammed infinitely without cost, commitment or cooldown.

### 25.4 Character and history invariants

- Unique IDs never collide, including across imports, splitting armies and migration.
- A soldier's cumulative battle count doesn't increment twice when a reinforcement wave enters.
- Wages earned means paid wages, not unpaid amounts promised.
- A dead character cannot silently command an active army unless there's an explicit succession/replacement transition.
- Record history compactly so 1,000 former soldiers do not destroy mobile save performance.

### 25.5 AI fairness and player trust

AI should be able to make mistakes, but those mistakes must follow understandable priorities. Political decisions should give reasons, visible context or rumors. Avoid making loyalty change by hidden random spikes. Allow the player to learn the world's rules.

### 25.6 Performance budgets

Set actual numerical budgets after profiling representative devices. Candidate goals:

- Maintain responsive touch/keyboard input and stable frame pacing during a battle at the chosen active-unit cap.
- Increase active units incrementally; use reserve waves for larger army counts rather than attempting hundreds of simultaneously pathfinding agents immediately.
- Update expensive AI groups at lower frequencies when appropriate; keep movement/combat smooth.
- Draw only visible map regions and sprites; avoid per-frame sorting of every world entity across the entire region.
- Use coarse strategic simulation for distant factions and event queues for long fast-forward intervals.
- Save asynchronously when possible, but never falsely confirm a failed write; keep a reliable safe-state path on browser suspend.

### 25.7 A small risk register

| Risk | Likelihood | Impact | Mitigation / early experiment |
|---|---|---|---|
| Scope never reaches a release | High | Critical | Freeze a small v2 CORE; schedule expansions independently |
| Battles overwhelm mobile CPUs | Medium–High | High | Camera slice and 30–40-unit profiling before scaling further |
| Political AI feels random | High | High | Explainable motives and limited treaty/rule set |
| Autosave becomes unreliable with larger state | Medium | Critical | Validated migrations, write checks, backups, load tests |
| Delegation creates infinite money or free troops | Medium | High | Unified budgets, same economics for human/AI, simulations |
| Huge soldier histories slow saves/UI | Medium | Medium | Bounded histories, archival roll, lazy drill-down |
| Kingdom success becomes irreversible snowball | Medium | High | Logistics, loyalty, rebellion, supply, resource constraints |
| Losing land feels punitive and hopeless | Medium | High | Clear warnings, claims, escape routes and recovery choices |
| Time scaling breaks reinforcement logic | Medium | High | One canonical clock, deterministic battle/world integration tests |
| Modding creates compatibility/support burden | High (when public) | High | Stable schemas, sandboxed data, release after core game is mature |

---

## 26. Priorities, dependencies and proposed delivery roadmap

This is a **recommended sequence**, not a commitment to dates or an assertion that all features fit into a single release called “2.0.” Keep a future-oriented vision and a sharply constrained current milestone.

### 26.1 First finish v1 / the existing MVP

From the reviewed v0.18.0 baseline, the current plan still includes faction reputation, the quest/dialogue interpreter, the four-quest regional campaign with endings, Mara, additional contract types, regional news, acceptance tests and release quality. Complete these and stabilize saving and real-device usability before absorbing the larger vision.

**Exit condition:** A new player can finish and continue the existing Border March campaign without critical softlocks or data loss, and the result feels like a small but complete game.

### 26.2 Proposed V2.0 CORE — “The Living Warband”

The first post-MVP release should improve the core activity players perform every session, with a narrow set of related additions:

| Order | Deliverable | Main dependencies | Acceptance / value |
|---|---|---|---|
| 1 | **Game-state and save safety hardening** | Existing persistence | Verified complete saves; safe imports/restores; reliable autosaving |
| 2 | **World-space camera and expanded arenas** | Rendering/input refactor | Larger maps, smooth camera, consistent clicks/joystick |
| 3 | **Minimap and tactical overview** | Camera and world-space rendering | Understand positions without lost units |
| 4 | **Battle preparation presets and simple deployment** | Group/formation data | Fight quickly or set basic positions |
| 5 | **Improved AI, basic group cohesion and counterplay** | Deployment, navigation | Infantry/archers/cavalry act differently and follow useful orders |
| 6 | **One canonical battle/world time interface** | Campaign clock refactor | No double time; reliable pause and movement |
| 7 | **Nearby battle reinforcement prototype** | Time integration + world parties | Nearby patrol joins; distant party cannot |
| 8 | **Named soldiers and lifetime records** | Existing soldier IDs + event logging | Names, origins, kills, wounds, wages, career history persist |
| 9 | **Company chronicle and veteran preservation** | Named soldier history | Losses, victories and promotions become memorable |
| 10 | **A first delegated follower: merchant or quartermaster** | Budget/account transfers | Optional useful automation with no economic exploit |
| 11 | **Battle, save, mobile and economy acceptance suite** | All above | Deployable release with validated gameplay |

**Why this first?** It enhances the *warband* part of Crownless, which remains central whether the player is independent or a king. It also establishes the technical foundations for a bigger world and multiple commanders. **Cross-cutting release requirement:** Every new feature in the table must ship with a reliable default path and its own clear opt-in depth; the advanced interface must never block basic play.

**Tempting features to exclude from the first v2.0 cut:** Full kingdom creation, marriage/children, multiple business industries, multi-stage siege destruction, full mounted player combat, procedural continents and public mod distribution. They are important to the vision but would delay a strong first expansion.

### 26.3 Proposed V2.1–V2.2 — “The Living Company & World”

- More camp followers: surgeon, blacksmith, scout, quartermaster.
- Officer appointments, detached patrols, budgeted delegation and reports.
- Better pursuit, information gathering, regional events and quest hooks.
- Tournaments and social relationships, at least one mechanically distinct format.
- First business ownership (inn or mill) with a trusted manager.
- Additional tactical formations, battle objectives and terrain interactions.

**Exit condition:** An independent player can build an enduring company with meaningful noncombat roles, delegate work, earn through trade or property, and encounter dynamic world consequences without needing a title.

### 26.4 Proposed V2.3+ — “The Landed World”

- Holdings with separate legal titles, control, occupation and administration.
- Appoint castellans, set local policies, fund garrisons, receive real revenue.
- Fealty and allegiance switching with distinct personal and faction property.
- Command armies and accept vassal obligations.
- Limited siege and reconquest.
- A small named-noble political simulation with transparent loyalty and petitions.

**Exit condition:** A player can acquire a holding, lose it, return to a landless captain's life, change allegiance and retake it—all in one save and without losing personal campaign continuity.

### 26.5 Proposed V2.x / later — “Kingdoms and Houses”

- Player-founded or captured kingdom with delegated royal authority.
- Formal diplomacy, treaties, vassal grants, realm laws and royal treasuries.
- Noble ambitions, rebellions, claimants, deposition and restoration.
- Houses, marriages, rivals and claims.
- Optional long-campaign succession and generational continuation.
- Large army/siege scaling, multiple official worlds and eventual public mod tools.

These belong in the **long-term product architecture** now but need not block the first complete v2 release.

### 26.6 System dependency map

```text
Current finished MVP (save + faction reputation + quests + mobile quality)
    │
    ├── Camera / world-space coords ──→ Larger maps ──→ Tactical map ──→ Advanced deployment
    │                                              └──→ Better formations and AI
    │
    ├── Canonical campaign clock ──→ Battle/world time scaling ──→ Reinforcements
    │                                                    └──────→ Delegation / fast-forward
    │
    ├── Persistent person IDs ──→ Soldier history ──→ Companions/officers ──→ Noble characters
    │                               └──→ Chronicle            └────→ Houses/marriage
    │
    ├── Economy accounts ──→ Merchant budgets ──→ Businesses ──→ Estates/realm treasury
    │
    ├── Explicit ownership / claims ──→ Loss/retake land ──→ Fiefs ──→ Kingdom politics
    │
    └── Declarative events + save migrations ──→ Contracts/quests ──→ World packs/modding
```

### 26.7 Prioritization rule for new ideas

A proposal rises in priority if it satisfies several of these tests:

1. It improves activities players already enjoy frequently.
2. It unlocks multiple future systems rather than adding isolated content.
3. It creates choices with visible consequences.
4. It works well in 2D and on touch devices.
5. It can be tested headlessly and in a small browser scenario.
6. It does not introduce a permanent softlock, unstoppable economic loop or overwhelming UI.
7. It remains useful even if the player never becomes a lord or king.
8. A first-time player can use it with competent defaults; advanced settings add choices without adding mandatory maintenance.

A feature that fails these tests should move to the backlog, not be forced into v2.0 for completeness.

### 26.8 Suggested issue/template format

For each implementation slice, create one short ticket with:

```text
Feature ID and title:
Player problem / fantasy:
Current state and existing code:
Expected gameplay in one example:
Minimum behavior and acceptance test:
Dependencies / save changes:
UI and touch design:
Default / one-decision / advanced behaviors:
How automated choices are explained and overridden:
Proof that the system can be ignored during normal play:
AI and economy interactions:
Failure / loss / recovery cases:
Anti-exploit rules:
Out of scope for this slice:
Testing (unit, simulation, browser, phone):
Follow-on possibilities:
```

This helps the feature sheet remain useful even when development occurs over many releases.

---

## 27. Test scenarios and acceptance criteria

The clearest way to test the unified sandbox is to run **cross-system stories** rather than verifying each mechanic only in isolation.

### 27.1 Core scenario matrix

| ID | Scenario | What must hold true |
|---|---|---|
| **SC-01** | Recruit Edric in Oakford; earn XP, promote, wound and save | Same ID/name/origin; accurate career counters |
| **SC-02** | Pay wages, including partial pay or missed pay | Earned-wages counter tracks money actually paid; morale reacts correctly |
| **SC-03** | Edric dies after a long career | Surviving company reflects loss; roll of honor retains summary |
| **SC-04** | Fight in a 3×-size forest arena | Camera follows player; obstacles and projectiles use world coords; no softlock |
| **SC-05** | Toggle tactical view and select an archer group | Correct coordinate transforms; commands target actual location |
| **SC-06** | Start battle using Balanced preset | Useful initial formation with one or two clicks |
| **SC-07** | Customize deployment, save/load before battle | Valid positions and group orders survive or restore safely |
| **SC-08** | Nearby friendly patrol approaches ongoing battle | Correct arrival time, entry side and casualties; no double participation |
| **SC-09** | Enemy patrol arrives from another direction | Warning follows detection rules; player can reposition/retreat |
| **SC-10** | Pause battle for five real minutes | Campaign time does not advance while paused |
| **SC-11** | Fight five minutes at 1:12 rate | Equivalent to about 25 seconds of regular overworld progression; no extra fixed time charge |
| **SC-12** | Auto-resolve equivalent encounter | No duplicate rewards; supplies/time/contract outcomes coherent |
| **SC-13** | Merchant trades with 200-crown budget | All buy/sell entries real, budget bounded, no same-town profit loop |
| **SC-14** | Merchant can't find a profitable trade | Keeps capital; reports inaction instead of fabricating profit |
| **SC-15** | Purchase and run a mill as independent captain | Business operates independently of political rank; expense ledger accurate |
| **SC-16** | Hostile kingdom captures the town containing a private inn | Ownership/operation consequences follow world law, not accidental deletion |
| **SC-17** | Appoint companion to lead 12 soldiers | Soldiers are removed from personal party and appear in exactly one delegated party |
| **SC-18** | Commander suffers a defeat and returns wounded | Casualties, equipment, wages and loyalty reconcile once |
| **SC-19** | Player swears allegiance and obtains Greywall | Title/claim/control and obligations clear; can still ride personally |
| **SC-20** | Greywall falls while player is elsewhere | Correct loss of revenue/control and possible garrison loss; player continues |
| **SC-21** | Player becomes landless after castle loss | No phantom estate chores; personal warband and assets remain |
| **SC-22** | Player changes kingdom after losing land | Legal and political consequences clear; ongoing character preserved |
| **SC-23** | Player reconquers Greywall after defecting | Occupation/title/claim state transitions without duplicating land or troops |
| **SC-24** | Noble refuses an unreasonable order | Visible motivation and consequence; no hidden omniscience |
| **SC-25** | Player ruler negotiates alliance then breaches it | Treaty changes expire/break consistently; diplomatic reputation reacts |
| **SC-26** | Vassals rebel and depose the player | Former ruler retains surviving person/warband; no compulsory game-over |
| **SC-27** | Deposed player seeks refuge with old enemies | Diplomacy and personal relations control plausible options |
| **SC-28** | Player joins a tournament as a low-level character | Readable rules, losses meaningful but recoverable, no infinite reward farm |
| **SC-29** | Run 100 simulated campaign years with delegated commanders | No negative money exploits, repeated ownership collisions or infinite event loops |
| **SC-30** | Load a save across a v2 schema migration | Character/army/holding identities retained; backup recovery works |
| **SC-31** | Attempt import of partial or damaged save | Rejected; current save and last known good backup unchanged |
| **SC-32** | Save fails because browser storage is full | UI reports failure; import/restore does not report success falsely |
| **SC-33** | Modded save references removed content | Precise compatibility error; no silent deletion of named soldiers |
| **SC-34** | Mid-range phone, large arena, cavalry and reinforcements | Acceptable measured frame time; touch remains responsive |
| **SC-35** | Background app during combat, then resume | No unbounded strategic catch-up or unintended combat actions |
| **SC-36** | First-time player fights ten normal encounters without opening tactics | Useful default formations; no mandatory deployment; no avoidable AI suicide pattern |
| **SC-37** | Same encounter fought manually and auto-resolved under equivalent circumstances | Shared rules and fair, explainable assumptions; no extra rewards or duplicate cost |
| **SC-38** | Player buys only food, sells loot and never trades commodities | Core campaign remains economically viable with appropriate play; no forced market study |
| **SC-39** | Hire merchant, leave conservative preset unchanged for 30 days | Bounded budget, protected essentials, reasonable reports and believable gains/losses |
| **SC-40** | Own a mill, use default manager for multiple periods | Business runs without daily clicks; costs and failures are reported; no magic profits |
| **SC-41** | Rule a kingdom while personally fighting for several days | Routine governance delegated; urgent alerts reach player; no forced administration screen |
| **SC-42** | Expert changes formations, merchant margins or garrison policy | Measurable situational difference under the same rules, not a hidden "advanced" buff |
| **SC-43** | Change one system to advanced while leaving others on default | Per-system preferences persist; no unrelated options or behaviors forced on |
| **SC-44** | Lose castle or appointed manager while detailed policies are saved | Invalid orders safely cancel or revert; no crash, softlock, or lost player-controlled assets |
| **SC-45** | Fast-forward through hundreds of routine events | Digest is readable, significant event interrupts appropriately, detailed ledger available on demand |

### 27.2 Property and political edge cases

- A title is revoked while the lord's personal soldiers occupy the castle.
- A holding is captured twice in quick succession during fast-forward.
- A summoned vassal switches allegiance while traveling to the rally point.
- A king becomes a prisoner while their marshal continues the war.
- A rebel occupies the capital but the recognized king still controls three other castles.
- An independent merchant owns two shops within a hostile kingdom.
- A lord owes wages but their steward's treasury has money; permissions determine whether it can be transferred.
- A house's last titled member dies; its claim may survive through another recognized relative.
- A player rescues a former enemy who once deposed them.
- A loyal company commander dies and requires replacement before executing the next order.

### 27.3 Battle and time edge cases

- Pause, app suspend, reload, auto-resolve and battle retreat must not advance the world twice.
- A contract target cannot vanish in an off-screen battle while locked into a live player encounter.
- An allied patrol arrives after the last enemy falls: it must not spawn into an already resolved scene.
- A reinforcement arrives at unit cap: place troops in reserve or postpone entry.
- The hero leaves the camera view due to knockback, fast movement or an obstacle: camera recovers predictably.
- A player orders a group to inaccessible terrain: the order fails visibly or selects a legal nearby position.
- A retreating force leaves the tactical map while a new enemy wave approaches.
- The player commands a noble's troops; end-of-battle casualties and relations must be attributed to the correct owner.

### 27.4 Economics and delegation edge cases

- Merchant owns valuable goods but no liquid cash.
- Trade prices change between purchase and destination arrival.
- A quartermaster spends nearly all funds just before wages are due; default reserve should prevent careless bankruptcy.
- A business is seized during the same campaign tick as payroll and production.
- A commander is recalled while fighting; the recall remains pending until an appropriate transition.
- Player sells property while the appointed manager is en route with inventory.
- Market restocking, trading and sieges occur at the same strategic timestamp.
- Fast-forward 90 days in one step produces the same reasonable outcome as 90 smaller steps under the documented simulation model.

### 27.5 Quality gates for each expansion

- [ ] Feature works in a fresh game without debug tools.
- [ ] Existing save migration and import/export remain valid.
- [ ] UI works with mouse/keyboard and landscape touch.
- [ ] Useful zero-configuration behavior, one-decision preset and optional deeper controls have been evaluated.
- [ ] Default AI does not demand repetitive corrections; decisions are explainable and can be overridden where appropriate.
- [ ] Failure/loss paths tested, not only happy paths.
- [ ] No duplicate money, property, troops, XP, loot or event rewards.
- [ ] World simulation remains deterministic under a fixed seed where intended.
- [ ] Campaign bot or scripted scenario exercises the feature in context.
- [ ] A real-browser smoke test covers the central interaction.
- [ ] Device performance is measured for rendering/AI-heavy changes.
- [ ] Documentation, player-facing explanations and feature flags updated.

---

## 28. Open decisions and design experiments

This list should remain active even after implementation begins. The best answers will come from actual playtesting.

| Question | Candidate options | Suggested first experiment |
|---|---|---|
| **How large should battles be?** | 2×, 3× or 4× current map dimensions | Prototype one forest battlefield; measure travel tedium and camera comfort |
| **How should overview work on phones?** | Tap-to-toggle minimap, tactical pause, pinch zoom | Compare two layouts on an 812×375-equivalent viewport |
| **How much control is enough?** | Three presets only, presets + placement, full waypoint commands | Test players who never use advanced orders against those who do |
| **How much micromanagement is acceptable?** | Zero routine admin, low-frequency review, intensive realism | Measure mandatory clicks per 10 minutes for a captain, landowner and monarch |
| **How good should defaults be?** | Conservative, balanced or aggressive policies | Compare ordinary-task outcomes and player interventions with/without manual settings |
| **Should time tick during battle?** | 1:10, 1:12, 1:15 normal map rate | Simulate 5-minute battles with a nearby patrol; inspect arrival plausibility |
| **Do pause menus stop all time?** | Yes by default; custom difficulty optional | Start with zero progression while paused |
| **What should trigger reinforcements?** | Radius only, sight/sound, faction intent and orders | Begin with radius + faction + simple intention |
| **How many live soldiers get full history?** | All soldiers, veterans only, archive aging | Start with every individual in active rosters and compact dead summaries |
| **How detailed should soldier traits be?** | No traits, 2–3 named traits, full psychology | Add two traits with clear, measurable effects |
| **Can common soldiers become officers?** | No, veterans only, merit promotion | Test one veteran promoted to patrol captain |
| **Should followers die in battles?** | Protected camp, limited risk, full targetability | Start with rare risk to baggage/camp during defeat, clearly telegraphed |
| **How smart is the merchant?** | Known-city prices only, historical estimates, abstract margin | Use known past prices plus bounded estimates; no omniscience |
| **Does armor have durability?** | None, repair after serious battle, full degradation | Avoid durability initially; let blacksmith offer upgrades instead |
| **How many business types initially?** | Inn, mill, smithy, warehouse | Prototype a mill and one income/expense ledger |
| **How complex are treaties?** | War/peace/alliance only, plus access/trade, full diplomacy | Small explicit treaty set with duration and breach consequences |
| **How is noble loyalty modeled?** | One stat, 3–5 factors, full personality simulation | Start with relationship, interest, obligation and fear |
| **What happens on losing a fief?** | Claim persists by default, claim expires, determined by law | Separate physical control from legal title in a test case |
| **Can players found kingdoms immediately?** | Title declaration, minimum holdings, recognition requirement | Allow claim at low power, but treat recognition and enforcement as separate |
| **Are revolts announced?** | Always, intelligence-limited, partially hidden | Give escalating warning signs with uncertain details |
| **Is heir play mandatory?** | No, optional succession, full generational mode | Founding house without generational aging first |
| **How many named nobles matter?** | 8–12 regional, dozens, dynamically spawned | Start with a handful who can each make distinct decisions |
| **When does modding become public?** | After v2 core, after political game, separate milestone | Expose data schema internally first, release creator tools only once stable |
| **How many official worlds?** | One deep world, several smaller, procedural variations | Make Border March excellent before creating a second official setting |

### 28.1 Suggested early prototypes

**Prototype A — The Camera Test:** One larger battle map, hero-centered camera, minimap icons, tactical overview and one obstacle-heavy cavalry engagement. Validate touch controls and frame pacing before expanding map sizes elsewhere.

**Prototype B — The 25-Second World:** Run an exactly five-minute controlled tactical battle. Assert the overworld moves by the equivalent of 25 seconds at normal travel presentation rate. Add a patrol with a known ETA and a party intentionally too far away to join.

**Prototype C — Edric's Career:** Recruit one named soldier, pay him, promote him, wound him, detach him under a companion, bring him back, and preserve his profile through save/export/import. If this works, the future companion and household models are much less risky.

**Prototype D — The Dispossessed Lord:** Give the player one castle, attach a personal warband and private business, occupy the castle with an enemy, remove any remaining formal office, then continue the same character on the map and later retake it. This is the canonical test of the entire political design.

**Prototype E — Honest Merchant:** Assign 200 crowns to a merchant; run a 30-day trade simulation over multiple markets; compare with manual trade under identical inventory and scarcity rules; fail if cash or goods appear without a source.

**Prototype F — The Obedient/Disobedient Noble:** Two vassals receive the same high-risk military order. One obeys and one negotiates or refuses for understandable reasons. The player can inspect those reasons and respond politically.

**Prototype G — The Hands-Off Campaign:** Run the same small campaign as (a) a player who never opens advanced settings, (b) a player who only selects presets, and (c) an expert who micromanages tactics, trade and management. All must remain fun, viable and explainable; expert attention should provide situational advantages rather than rescue the player from broken defaults. Track forced menu visits, outcome differences, warnings, and ability to resume after time away.

---

## 29. Final design thesis

The strongest version of Crownless does not need a giant 3D world. Its depth can come from **how a small number of systems interact**:

- The **battle system** makes troops, terrain and command matter.
- Individual **soldiers and companions** make those troops worth protecting.
- The **living world** puts them into conflicts the player did not script.
- The **economy and followers** let a warband become an organization.
- **Land and politics** give that organization influence, obligations, enemies and opportunities.
- **Loss and reversibility** ensure power has stakes without ending freedom.
- **Houses and legacies** let those choices become personal histories.
- **Competent defaults and optional depth** make these systems approachable: a simple action game on the surface, a rich simulation whenever the player wants to engage it.
- A future **world/mod format** allows new settings to reuse the same underlying simulation.

There is no dividing line where the player “finishes” being a warband commander and “starts” being a lord or king. A monarch can fight a duel, personally escort a caravan, lead a desperate defense, or lose everything and return to life on the road. A landless captain can maintain a formidable army or build wealth without taking a title.

**The design promise is freedom with consequences.** Status changes what options are available and what others expect of the player, but it never changes the fundamental identity of the game.

### The development discipline that protects this vision

1. Finish the current MVP as a complete, satisfying Border March experience.
2. Make the first v2 release deepen warbands and battles, not swallow every kingdom idea at once.
3. Build persistent people, explicit ownership, orders and a canonical world clock as reusable foundations.
4. Add property, fealty, kingdoms and dynasties as extensions of those same systems.
5. Design failure and recovery alongside success, especially for land loss, defections and deposition.
6. Keep complexity optional and the browser/mobile experience accessible: reliable defaults first, meaningful presets second, detailed control by choice; never make micromanagement a prerequisite.
7. Open modding after the official system is stable enough that creators can rely on it.

> **Long-term product statement:** **Crownless is a 2D warband sandbox where you can rise from an unknown wanderer to a powerful ruler—and fall back again—without ever leaving the same living world.**

---

### Notes on provenance and use

This document is a planning synthesis of the feature ideas discussed with the project creator and the public repository's 0.18.0 MVP/GDD architecture. It is **not** an announcement of implemented v2.0 features, an independent playtest, or a binding delivery schedule. Technical structures and values shown above are proposals for prototyping. Treat each section as a starting specification to refine after gameplay experiments.

**Related project references:**

- [GitHub repository](https://github.com/greaneagle/crownless-mvp)
- [Current roadmap](https://github.com/greaneagle/crownless-mvp/blob/main/docs/ROADMAP.md)
- [MVP game design document](https://github.com/greaneagle/crownless-mvp/blob/main/Crownless_MVP_GDD_v1.md)
- [Gate D validation and current content milestones](https://github.com/greaneagle/crownless-mvp/blob/main/docs/GATE-D-VALIDATION.md)

*End of v2.0 feature and systems design — planning edition 1.1.*
