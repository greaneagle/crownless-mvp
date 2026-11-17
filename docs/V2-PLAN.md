# Crownless v2 — Development Plan

_Planning document, written 2026-11-17 at build 0.35.0 and kept up to date as tasks finish (last update: build 1.2.0, V2-01 done). §2 is the picture at 0.35.0; the current status of every step is in `docs/ROADMAP.md`. Source: `Crownless_v2_0_Feature_and_Systems_Design_Part_1.md` and `_Part_2.md` (edition 1.1, written against build 0.18.0). Nothing here is implemented yet; this turns the design into ordered, testable work._

---

## 1. What the v2 design asks for (summary)

**Vision:** *Start with nothing, raise a warband, become part of a living world, and gain — or lose — wealth, land, followers, political authority and even a crown, while always keeping the freedom to travel and fight in person.*

**The rules that shape every task:**
1. **One continuous sandbox.** Mercenary, landowner, vassal, monarch and exile are relationships, not game modes. Nothing replaces the character, ends the campaign, or turns off field combat (§1, §4).
2. **Optional depth with competent defaults (§2.5, §22.7).** Every system ships three paths:
   - **zero-configuration:** useful as it stands
   - **one decision:** a preset or intent
   - **expert:** detailed control

   Automation uses the same rules and money as the player. A player who never opens a deep menu still gets a full campaign.
3. **Reversible power.** Everything gained can be lost and regained; loss never means game over (§4.4, §17.3, §18.6).
4. **Warband first.** The first v2 release deepens battles and soldiers, the things players do every session, before land and kingdoms (§26.2).
5. **2D by choice;** **modding later**, with content boundaries kept clean now (§1.3, §23).
6. **Hard separation:** finish the MVP first (§1.2, §26.1).

## 2. Where the game stands against the design

The design was written at 0.18.0. Since then:

| Design item | Status at 0.35.0 |
|---|---|
| Finish the MVP: reputation, quest interpreter, Q1–Q4 with three endings, Mara, escort and delivery, regional news, Gate D acceptance (§26.1) | ✅ Done (0.19–0.28) |
| Release quality: battle scaling, phone layout, settings and audio, tips and help, save safety, asset provenance | ✅ Done (0.29–0.34). **Gate E 5.7, device QA and acceptance, is still open.** |
| §22.3 explicit full screen; installable web app | ✅ Done (0.35) |
| §9.3 "reinforcing troops enter as additional waves if the active-unit cap is reached" | 🟡 Groundwork: a battle-size cap with reserves (0.29). Off-map reinforcements are not built yet. |
| §24.7 save hardening | 🟡 Mostly done (0.33): a backup with notice, the two-tab guard, save on page hide, forgiving import, cross-device tests. **Still open:** structural validation (a near-empty `{version: 2}` is accepted and filled with defaults), a versioned migration framework, a periodic autosave while travelling, and IndexedDB for larger saves. |
| §21.4 chronicle | 🟡 Regional news exists (a world chronicle in miniature). No personal chronicle yet. |
| §10 named soldiers | 🟡 Soldiers have permanent IDs, troop type, XP and wound timers; kills are counted per soldier for XP but not stored. No names, origins or records. |
| §5 canonical clock | ❌ A fought battle still adds a flat 6 hours afterwards (`BATTLE_DAYS`); no time passes during a battle. |
| §17 / §24.2 ownership | ❌ Each fort has one owner field (`c.owners`). There's no separation of sovereign, legal holder, occupier and administrator. |
| §24.8 seeded randomness | 🟡 The world and auto-resolve use a seeded generator, but casualties and some combat rolls use the unseeded `Math.random`. |
| Everything else in the design (camera, deployment, AI morale, followers, property, fealty, kingdoms, houses, modding) | ❌ Not started |

## 3. The plan at a glance

```text
Phase 5   Finish Gate E (5.7 device QA + acceptance) → tag v1.0 "The Border March"
Phase 6   v2.0 "The Living Warband"     — foundations, named soldiers, big battles, reinforcements, one follower
Phase 7   v2.1–2.2 "Company & World"    — more followers, officers & detached patrols, pursuit, events, tournament, first business
Phase 8   v2.3+ "The Landed World"      — holdings/claims model, fealty, sieges, castellans, named nobles
Phase 9   later "Kingdoms & Houses"     — realms, treaties, rebellion/deposition, houses & marriage, modding, new worlds
```

Each phase ends with an acceptance pass, as Gates C–E did: automated tests, a headless simulation, a real-browser playthrough and your phone pass.

**Workflow (owner decision):** everything stays on `main`. The GitHub Pages site is the **test build**, not a public release, so it doesn't need protecting. Half-finished features may show there, but each task still ends green (tests and lint) and playable. Each task below is one build with its own validation section, as before. **Numbering (owner-approved):** each finished task bumps the minor version from 1.1.0 (1.1.0, 1.2.0, …), fixes and docs-only tasks bump the patch, and V2-13 acceptance ships 2.0.0. Save schema steps are numbered separately (v3, v4, …), one per task that changes the save's shape, each with its own migration step.

---

## 4. Phase 5 — finish the MVP: v1.0

| ID | Task | Acceptance |
|---|---|---|
| **5.7** | ✅ **Done in 0.38.0 — Gate E passed** (owner pass open: an iPhone if available, and a real save transfer). Device QA and Gate E acceptance: real Android Chrome and iPhone runs (performance with Stress 40, full screen and home screen, save transfer, phone layout), plus the GDD §15 definition-of-done checklist. **First evidence (owner, ASUS Zenfone 10, Chrome):** the stress test at battle size 30 ran at **60 fps**, with 0.6 ms simulation and 1.7 ms drawing per frame and a slowest frame of 17 ms. The owner reports full screen, Add to Home Screen and play all work well | Every §15 box is checked or explicitly deferred; no critical data loss; no unavoidable progression blocker |
| **5.7b** | **Towns open on their menu (finding F-3).** ✅ Done in 0.37.0 | Arriving at any walkable place (Stonebridge today, more later) opens the settlement menu, with **Walk the streets** and **Leave** buttons. The streets are opt-in, and the town menu inside the streets still works |
| **5.8** | ✅ **Done: v1.0.0 released.** **Release v1.0:** freeze save schema v2, tag `v1.0.0`, keep a pre-v2 save fixture set for migration tests, short release notes | A v1.0 save becomes the first fixture the v2 migration must load |

## 4b. Findings from the owner's playtesting (2026-11-17)

Each finding names where it lands. F-2 was fixed at once; F-3 is a small v1 change done before v1.0.

| ID | Finding | Cause (checked in the code at 0.35.0) | Fix and acceptance | Lands in |
|---|---|---|---|---|
| **F-1** | **A soldier can't be upgraded** although they have 285/100 XP, aren't wounded, and there are crowns to pay. **Confirmed by the owner: they were Mercenaries.** | The troop type has **no upgrade path**. The hireable **Mercenary** (tier 2, neutral) has neither `upgradeTo` nor `altUpgradeTo`, yet the Party screen shows tier-2 troops as "best XP n/100" (`UPGRADE_XP.T2 = 100`) and draws no upgrade button, so XP piles up with nothing to spend it on. The upgrade code itself (`CL.party.upgrade`, `readyFor`) works for troops that have a path. No "upgrade all" exists; upgrades happen one troop type and branch at a time in the Party screen. | **Owner decision: nothing is changed now; fixed in v2 through the troop tree (V2-03b).** (1) A troop at the end of its path shows **max tier** (for example "XP 285 · max tier") instead of an XP target, and its XP keeps counting for its service record. (2) Hireable troops may gain a path where the tree design wants one (for example Mercenary → a tier-3 Sellsword). (3) An **Upgrade all ready** button, with a total cost and a confirmation. (4) Each disabled upgrade says why. Acceptance: a test that every troop either has a path or shows max tier, and a test of "upgrade all" with mixed ready, wounded and unaffordable soldiers. | **V2-03b** |
| **F-2** | **Soldiers stack on one spot** in battle (20 can occupy the exact same position). **✅ Fixed now, in 0.36.0 (spacing tightened to shoulder to shoulder in 0.36.1), at the owner's request.** | A unit's 12 px footprint is used only against trees, walls and crates. There is **no unit-to-unit separation**, so allies following the hero, or a crowd chasing one target, collapse onto one point. | Soft separation: each unit pushes neighbours that come closer than about 0.7 × two footprints, so a little overlap is allowed for a dense melee but no stacking. A spatial grid keeps it cheap at 40+ units (the proximity grid the GDD asks for). Re-run the battle benchmark and stress test. Acceptance: in a 40-unit battle no two living units are closer than 0.7 × (2 × footprint) for more than a moment, and no extra frame time appears on your phone. **Done in 0.36.0** (`CL.units.separate`, `tests/spacing.test.js`). V2-05 must keep it working in world space and at larger sizes; V2-08 formations build on it. | **0.36.0**; kept by **V2-05**, built on by **V2-08** |
| **F-3** | **Walkable towns should open on the menu**, not the streets (owner, after the playtest: "it all felt pretty good"; this was the one change asked for) | Arriving at Stonebridge drops you straight into the walkable streets; the menu is one tap away (Town menu). Other places already open on their menu | A walkable place opens its **settlement menu** on arrival; **Walk the streets** (already the menu's second button) and **Leave** stay available, and returning from a street conversation still goes back to the streets. A per-place flag in the content (`entry`: `'menu'` or `'streets'`, default menu), so mods and future towns can choose. Acceptance: tests for arriving (menu), walking the streets, leaving, and returning from a conversation | **5.7b**, ✅ done in 0.37.0 |

## 5. Phase 6 — v2.0 "The Living Warband"

**v2.0 is a testing release**, not the full commercial release (owner decision), so polish that only matters for a store (zoom and text size, store packaging) can wait.

Order follows the design's §26.2 dependencies, with one deliberate change: **named soldiers come early**. They depend only on the save foundations, give a visible payoff after the plumbing work, and de-risk the people model everything later relies on (Prototype C). The camera refactor, the riskiest and largest item, starts once the foundations are safe.

| ID | Task | Design § | Size | Depends on |
|---|---|---|---|---|
| **ART-01** | **Art style guide and asset list** (written for an artist; no code): resolution and pixel grid, palette, outline rules, character proportions and four facings, animation frame counts, tile sizes for larger arenas and buildings, UI and icon style, a portrait spec (if any), naming and export rules. Plus an asset list per v2 task, so art can be produced alongside the code. Also confirm the AI image model's commercial terms for the existing sprites (see R-01) | §2 pillars, design §11 art bible | S | — (runs alongside) |
| **V2-00** | ✅ **Done in 1.1.0.** `tsconfig.json` (checks only files marked `// @ts-check`; no output), `types/crownless.d.ts` (the `window.Crownless` namespace, Campaign, Soldier, WorldParty, Unit, BattleOutcome, BattleResult, and interfaces for `save` and `party`, which are also checked where each module assigns itself), `npm run typecheck` with TypeScript pinned at 6.0.3 through `npx` and run by `npm run lint` (so CI checks it too), all seven modules marked, `tests/typecheck.test.js` guarding the setup. The checker found two things: a quest's `expired` field holds a stage ID, not a flag (types and `docs/SAVE-FORMAT.md` corrected), and one timer call it couldn't follow (rewritten in `world.js`, same behaviour). Modules other than `save` and `party` are still typed `any` from the outside; each later task adds its module's interface and stricter settings as it touches them. **Original task:** **Type checking without a build step:** `// @ts-check` and JSDoc types on the core modules (`core`, `save`, `party`, `combat`, `units`, `story`, `world`), checked by `npx tsc --noEmit` (a dev-only tool, like lint) and added to `npm run lint`. Shared types for the campaign, soldier, party and encounter, which V2-01 and V2-02 then use. Converted module by module, so it never blocks other work | §24.10 ("no TypeScript conversion as a prerequisite"; type *checking* without converting fits) | S–M | 5.8 |
| **V2-01** | ✅ **Done in 1.2.0.** Schema v3 = v2 plus `worldId` and `contentVersion`. Loading checks structure per schema version (`CL.save.check`: a partial save is rejected with a list of what is missing), the world, then pure migration steps (`CL.save.MIGRATIONS`, 2 → 3), then the field-by-field repair. A save migrated on load is kept as it was in `crownless_save_v2`. The backup is only ever replaced by a complete save, and a write counts only when it reads back. Import and Restore report success only once stored, and otherwise put everything back (SC-31, SC-32). Autosave once per game day while time passes on the map. Storage layer `CL.storage` (`js/storage.js`, synchronous; `use(backend)` swaps it). Fixtures exported by the real 0.14.0 and 0.28.0 builds (`scripts/make-legacy-save-fixtures.js`, run against throwaway worktrees of those commits) and a 0.3 save; `tests/save-migration.test.js`. Not done here: IndexedDB or file backends (R-02 decides), and a pre-migration *export* file (the stored copy covers it without a download). **Original task:** **Save schema v3 and migration framework:** versioned migrations with fixtures (v1, v2 at 0.14 / 0.28 / 1.0), structural validation that rejects partial saves, last-known-good kept until a write succeeds, periodic autosave while travelling, `worldId` and `contentVersion` in the save, and a **storage layer** (localStorage today; IndexedDB or a desktop file store later) so a store build can save files | §24.7, SC-30–32 | M | 5.8 |
| **V2-02** | **One result path and a small event dispatcher:** battle, auto-resolve, retreat and capture all commit through one idempotent `resolveEncounter(resultId)`; domain events (`SoldierWounded`, `BattleResolved`, …) with unique IDs; named RNG streams (world, battle, loot, casualties) | §24.3–24.5, §24.8, §25.2 | M | V2-01 |
| **V2-03** | **Named soldiers and service records:** a generated name from the origin settlement's culture, origin, recruit date, battles, victories, kills / knockouts / assists, wounds, captures, wages actually paid, a bounded list of service notes, status. A roster view with filters, a profile card, and existing soldiers named on migration. An optional `portrait` slot, so the artist's portraits can drop in later. Per-soldier upgrade from the profile card. **Names come from a data-driven, moddable name generator (owner decision):** each culture in content (`data/names.js`) has given-name lists, optional bynames ("of Oakford", trade or trait nicknames) and simple combining rules. Factions and settlements point at a culture, so a recruit from an Aurelian town gets an Aurelian-style name, and a future kingdom or mod brings its own culture by adding data, with no code. Names come from the seeded random generator, so the same save always names the same soldiers. Starting cultures: Valedorn (knightly, Anglo-Norman flavour), Aurelian (Latin-imperial), and border and neutral folk (plain), written for this world with no real people. Validated at load like all content | §10, SC-01–03, Prototype C | M | V2-02 |
| **V2-03b** | **Troop tree, discovered as you play** (owner idea, 2026-11-17). One tree screen for all troop lines (Valedorn, Aurelian, neutral and hireable) that fills in as you learn: troops you have never met are not shown; troops you have **seen** in battle appear by name, faction and place on the tree, with no details; troops you have **owned or trained** show full stats, upgrade costs and XP targets. Upgrades happen from the tree and the Party screen, including **Upgrade all ready** with the total cost. End-of-path troops show **max tier**, which also settles F-1. What you know is saved with the campaign; a Settings or debug option can reveal everything for testing | §10, F-1 | M | V2-03 |
| **V2-04** | **Canonical campaign clock:** remove the flat 6-hour battle charge; one clock authority; the battle advances world time at the normal map rate ÷ 12 (configurable); deployment and pause add zero; post-battle time is explicit; tested across manual battles, auto-resolve, retreat, capture and reload | §5, SC-10–12, Prototype B (part 1) | M | V2-02 |
| **PROTO-A** | **Camera test run (before V2-05):** a Debug-panel "Camera test", like the stress test. One 3× forest arena with the hero-follow camera and a 30–40-unit fight with cavalry, run on your phone. The result screen reports fps, drawing ms and slowest frame, as the stress test does. Throwaway or behind a flag; it decides map size and camera feel before the real refactor. Reference point: the Zenfone 10 already runs 30 units at 60 fps with 2.3 ms used per frame | §28.1 Prototype A | S | V2-02 |
| **V2-05** | **World-space battle camera and larger arenas:** world coordinates throughout (units, arrows, obstacles, input); a damped hero-follow camera; screen-anchored HUD; one 3× forest arena first, measured on your phone, then the others; draw only what's visible; edge threat indicators. **Keep the bodies from 0.36.0** (finding F-2): soft unit-to-unit separation working in world coordinates and on larger maps, for allies, enemies and arriving reserves; re-check its cost at the new sizes | §6.1–6.2, §6.7, §24.6, SC-04, Prototype A, F-2 | L | V2-02 |
| **V2-06** | **Minimap and tactical overview:** detected enemies only; tap to focus; a phone toggle and desktop press-and-hold; group orders issued from the overview | §6.3, SC-05 | M | V2-05 |
| **V2-07** | **Battle preparation:** Balanced / Defensive / Aggressive / Custom presets, two clicks to Fight, **Simulate** (auto-resolve with reasons), a remembered preset with a fast-entry preference, Custom placement inside a legal deployment zone, ambushes with a constrained zone | §7, SC-06–07, SC-36 | M | V2-05, V2-06 |
| **V2-08** | **Group AI, cohesion and counterplay:** commander → group → soldier; formation states (forming → advancing → engaged → regrouping → retreating) as soft constraints; group morale (hold / waver / fall back / rout / rally) with a rally action; spears versus cavalry, shields screening archers, line of sight for archers; visible "can't do that" order feedback. Formations build on F-2's spacing: lines and blocks hold their gaps, and bodies stop enemies walking through a shield wall. **Shield cover** (owner idea, 2026-11-17): a raised shield also protects the ally right beside the blocker on the shield side, so the hero can cover a companion, a soldier can cover their neighbour, and a shield wall works as a wall. Limits: only adjacent allies, only against blows from the front arc, and the blocker's own block rules (movement slowed, can't swing) still apply. Acceptance: a test where an enemy swing at a covered ally is blocked, while the same swing from the side or at an uncovered ally lands | §8, SC-36–37, F-2 | L | V2-07 |
| **V2-09** | **Nearby reinforcements:** battles become active conflicts on the map; nearby parties keep moving at the battle rate; eligibility (reach, awareness, relationship, unit cap); an approaching-banner warning; edge spawns into reserves when full; involved parties locked so there are no double battles; one commit | §9, §5.4, SC-08–09, Prototype B (part 2) | L | V2-04, V2-05 |
| **V2-10** | **Company chronicle and roll of honour:** a personal chronicle (recruitments, notable battles, promotions, deaths, Q1–Q4 milestones) beside the regional news; a compact roll of honour for fallen and retired soldiers; post-battle "who did what" | §10.5, §21.4 | S–M | V2-03 |
| **V2-11** | **Accounts and the quartermaster:** separate accounts (your purse, the company chest, follower budgets) with every transfer having a source and a destination. A hireable **quartermaster** keeps a food reserve and the next wages covered within a budget, buys only necessities, warns before shortages, and logs every purchase. Default: "keep 5 days' food and next week's wages"; one decision: reserve days and budget; expert: per-good rules and substitution | §12.2, §25.1, SC-02 | M | V2-02 |
| **V2-12** | **Merchant follower:** trades with an assigned budget through the *same* market functions as you (scarcity and the per-unit price movement included). Knows only prices it has seen (plus bounded estimates); never sells reserved supplies; cautious preset by default. Reports what it did and why ("Sold 4 salt for 68, bought 3 iron for 27; skipped wool, cargo full"); stop and recover funds at any time | §12.3, SC-13–14, SC-39, Prototype E | M | V2-11 |
| **V2-Q** | **A few small quests that use the new systems** (owner decision: no new main story in v2, but the new systems should appear in quests). For example: a veteran's homecoming in their origin village (named soldiers and the chronicle); a supply run that teaches the quartermaster; a merchant's first venture that introduces the merchant; a border skirmish where an allied patrol can arrive (reinforcements); and a planned engagement that suggests the battle presets. Built with the existing quest interpreter; each one optional and ignorable | §21 | S–M | the systems each uses |
| **V2-T1** | **Tuning pass 1, the warband economy** (after V2-11/V2-12): wages, food, upgrade costs, contract pay, renown pace, follower salaries and the merchant's margins. Uses the campaign and story bots across many seeds, plus Prototype E (the merchant against manual trading, so there's no money printer) | §25.1, §27.4 | S | V2-12 |
| **V2-T2** | **Tuning pass 2, battles** (after V2-08/V2-09): arena size, unit spacing, morale thresholds, preset strength, auto-resolve parity with fought battles (SC-37), and reinforcement timing. Uses the battle benchmark, scripted scenarios and your phone | §8, §25.2 | S | V2-09 |
| **V2-13** | **v2.0 acceptance:** design scenarios SC-01–14, SC-30–39; Prototype G (a hands-off player, a preset-only player and an expert on the same campaign); 30-day and story bots extended; phone performance on large maps with cavalry and reinforcements; a final tuning pass from what the playtest finds | §27, Prototype G | M | all |

**Release track (the goal is to sell eventually; runs alongside and never blocks v2.0, which is a testing release):**

| ID | Task |
|---|---|
| **R-01** | **Commercial-readiness checklist:** rights (the sprites were generated with **ChatGPT**'s image tools through Sprite Studio, so check OpenAI's current terms of use on ownership and commercial use of outputs and keep a dated copy, artist contract terms, fonts, the synthesized audio), a privacy note (the game collects nothing), age rating input, and store requirements (itch.io, Steam, app stores). |
| **R-02** | **Packaging trial:** run the game as a desktop app (Tauri or Electron wrapper) with saves as files and offline play, and note what Steam or the mobile stores would need (achievements, cloud saves, controller support). A decision document, not a shipped build. |
| **R-03** | **Demo and storefront plan:** what a free demo includes (for example Q1 plus the sandbox until day N), trailer-capable scenes, and a press-kit outline. Scheduled near the end of v2.0. |

**Later backlog (owner decision: not v2 features):** an in-game text size and zoom setting (the page blocks pinch-zoom today), other languages (**English only** for now, though text keeps living in data files), and accessibility extras beyond what exists.

**Explicitly not in v2.0** (design §26.2): kingdoms, marriage, multiple businesses, multi-stage sieges, player mounted combat, procedural maps, public modding.

### Per-task contract (applies to every V2 task)
Each task's validation section answers the design's ticket questions (§26.8), condensed:
- **Default path:** what happens if the player never opens the new UI?
- **One decision:** which single preset or intent changes the behaviour?
- **Expert path:** what extra levers are there, under the same rules?
- **Ignorable:** proof the system can be left alone for ten ordinary minutes.
- **Loss and recovery cases**, anti-exploit rules, save changes and migration.
- **Testing:** unit tests, a bot or simulation, a real-browser run, your phone.
- **Quality gates** (§27.5): fresh game without debug tools; saves migrate; mouse and touch; no duplicated money, troops, XP or rewards; deterministic under a fixed seed; device performance measured for heavy changes.

## 6. Phase 7 — v2.1–2.2 "The Living Company & World" (outline)

Detailed tasks get written when Phase 6 ends; candidates, in rough order:
- **More followers:** surgeon (triage and recovery), scout (detection, route risk), then blacksmith (upgrades rather than durability chores) (§12).
- **Officers and detached patrols:** an order package (objective, constraints, resources, autonomy), transfers that keep soldier histories, reports (§11.3, SC-17–18).
- **Pursuit and detection:** limited vision, last-seen positions, searching, hiding in forests, route preferences and travel estimates (§13.2, §13.5).
- **Dynamic world events** that change state and offer a choice (shortages, infestations, militia requests, couriers), feeding news and the chronicle (§13.4, §21.3).
- **Tournament:** a single foot-melee duel format first (§15).
- **First business:** a mill or inn with a manager and an income/expense ledger, independent of rank (§14, SC-15, SC-40).
- **Battle extras:** additional formations, objectives and terrain interactions (§6.4, §8).

**Exit (design):** an independent player builds a lasting company with non-combat roles, delegates, earns through trade or property, and meets dynamic consequences without needing a title.

## 7. Phase 8 — v2.3+ "The Landed World" (outline)
- **Holdings model:** sovereign realm, legal holder, occupier, administrator and private owners, replacing `c.owners` (§17.1, §24.2).
- **Permissions query:** rights computed from oaths, offices and ownership, never `if (player.isKing)` (§4.3).
- **Allegiance objects:** independent, mercenary contract, sworn vassal, rebel, sovereign, deposed; switching with a consequence preview (§16, §22.5).
- **Castellans and policies:** garrison, tax stance, reserves, repairs, with a default steward (§17.2).
- **Simple sieges:** encirclement → preparation → one assault map → resolution; surrender, capture and ransom (§20.4–20.6).
- **A handful of named nobles** with a few stable motives and explained obey / negotiate / refuse decisions (§18.4).
- **Prototype D, "The Dispossessed Lord", is this phase's acceptance:** gain Greywall, lose it while away, carry on as a captain, switch allegiance, retake it.

## 8. Phase 9 — later "Kingdoms & Houses" (kept in the architecture, not scheduled)
Realms with treasuries, laws and offices; treaties with dates and breach rules; rebellion and deposition without game over; houses, marriage and claims (founding-house model first; generational play optional); army-scale campaigns; a world manifest, namespaced IDs and a declarative content format; creator tools and a second official world (§18–20, §23).

## 9. Risks to watch (from design §25.7, re-rated for this codebase)

| Risk | Note for this codebase | Early guard |
|---|---|---|
| Scope never reaches a release | The design is huge; v2.0 alone is about 20 items (V2-00 to V2-13, PROTO-A, V2-Q, two tuning passes, ART-01) | Freeze the v2.0 list above; everything else goes to Phase 7+ |
| Camera refactor destabilises combat | `combat.js`, `units.js`, `render.js` and `input.js` all assume screen space | PROTO-A first; V2-00 types around the coordinate code; the benchmark and stress test re-run; each step ends playable (`main` is the test build) |
| Phone performance on big maps | Zenfone 10 at battle size 30: 60 fps, 0.6 ms simulation and 1.7 ms drawing (2.3 of 16.7 ms used). Big maps and the camera are the unknown | PROTO-A on the phone before V2-05; re-measure at the end of V2-05 |
| Time integration double-counts | The 6-hour charge sits inside `applyBattleResult` | V2-04 tests every exit path; one clock authority |
| Save migration breaks old games | Many sanitize-based upgrades so far | V2-01 fixtures from 0.14, 0.28, 1.0 and every later release |
| Automation feels like cheating or busywork | Merchant and quartermaster | The same market functions as the player; activity log; Prototype E comparison |

## 10. Direction decisions

**Decided by the owner (2026-11-17):**

| Question | Decision | Effect on the plan |
|---|---|---|
| What comes first in v2.0? | Named soldiers first (after the save and result foundations), then big battles | Order V2-01 → V2-03 → V2-04 → V2-05… as above |
| First camp follower? | **Both** the quartermaster and the merchant in v2.0 | V2-11 (accounts + quartermaster) and V2-12 (merchant) |
| Art during v2? | **Write a style guide now**; an artist may unify the style later (2D stays) | ART-01 at the start of Phase 6; portrait and art slots in the data model |
| Release goal? | **Sell it eventually** | Release track R-01–R-03; the storage layer in V2-01; checking the AI image model's commercial terms becomes important |
| Protect the live site while building? | **No.** Everything stays on `main`; the live site is only for testing | No branches or flags for safety; each task ends green and playable |
| Device performance? | **Zenfone 10, Chrome:** stress test at size 30 at 60 fps (0.6 ms simulation, 1.7 ms drawing, 17 ms slowest frame); full screen and home screen work | Evidence for 5.7; the budget for PROTO-A and V2-05 |
| Sprite source? | Made with **ChatGPT** image generation through Sprite Studio | Recorded in `docs/ASSETS.md`; OpenAI's terms go into R-01 |
| Names and lore? | No lore yet; kingdoms come later. Names chosen to fit each realm, **data-driven and customisable** for mods | The culture name generator in V2-03 (`data/names.js`) |
| Languages? | **English only** for now | No translation work; text stays in data files anyway |
| Playtest verdict? | "It all felt pretty good." One change: walkable towns open on the **menu**, with Walk the streets and Leave | Finding F-3, done before v1.0 (5.7b) |
| Type checking? | **Yes** | V2-00 (`@ts-check` and JSDoc, no build step) |
| Camera prototype? | **Yes, as a test run** like the stress test | PROTO-A in the Debug panel |
| Story in v2? | **Systems only;** no new main story. A few small quests may use the new systems | V2-Q |
| Tuning? | **Yes, one or more passes** | V2-T1 (economy) and V2-T2 (battles), plus a final pass in V2-13 |
| Zoom and text size? | **Later**, not a v2 feature; v2.0 is a testing release | In the later backlog |

**Still open (defaults assumed until decided):**
- **World size during v2.0:** assumed to stay the 10-settlement Border March and grow in Phase 8, when holdings and nobles need more places.
- **Difficulty options:** assumed none in v2.0 beyond battle size; permadeath and ironman are Phase 9 settings at most (design §19.4).
- **Phone versus desktop priority for the new battle UI:** assumed phone-first, with every v2.0 battle feature usable by touch (design §2.6).
- **Time in battle:** the design's 1:12 rate is the starting value for V2-04 (design §28 lists 1:10–1:15 as the experiment). **Check before V2-04 (found at 1.1.0):** the map runs at 4 game hours per real second, so at 1:12 a 5-minute battle costs about 100 game hours (over 4 days), against today's flat 6 hours. That would swamp food, wages and the 2-day wound timers. V2-04 needs a much slower rate (around 1:100 or less) or a cap, decided with a simulation.
- ~~Older save fixtures for V2-01~~: done in 1.2.0 (`tests/fixtures/saves-0.14/`, `saves-0.28/`, `saves-0.3/`).
- **Old saves:** v1.0 saves will migrate into v2 (soldiers get names on load); no save is ever invalidated.
