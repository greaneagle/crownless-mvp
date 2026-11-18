# Crownless — Project Status & Roadmap

_Last reviewed: 2026-11-18 · Build 2.4.0 · Spec: `Crownless_MVP_GDD_v1.md` (engine overridden: HTML5 Canvas + classic JS, no bundler, GitHub Pages)._

This replaces the opencode-swarm plan (`.swarm/plan.md`, removed). The gate structure (A→E) is kept from the GDD; the task list is condensed and re-ordered around what the code actually needs.

---

## 1. Where the project actually is

| Area | State |
|---|---|
| **Runtime** | `js/*.js` — 11 classic-script modules on `window.Crownless` (split from the old minified `game.js` in Phase 0). Battle-only prototype: title → camp → battle (2 waves) → result → camp. |
| **Content data** | `data/*.js` — 9 classic-script modules filling `window.CROWNLESS_CONTENT` (adds `encounters`). Loaded by `index.html`, validated at boot by `js/content.js`, and the source of all troop, wave and loot numbers. |
| **Assets** | 169 PNGs (1.3 MB); `game.js` loads 53 of them (36 unit frames, 17 world tiles). |
| **Docs** | `docs/BASELINE.md` — accurate audit of 0.3.0 behavior (keep it; it is the regression reference). |
| **Tooling** | `npm test` (node:test, 34 tests), `npm run lint` (Biome via npx), `npm run serve`. CI runs both before the Pages deploy. |

### Gate status vs GDD
- **Gate A (combat feel)** — implemented to GDD §6 in 0.4.0 (phased swings, 90°/120° arcs, input buffer, telegraphs, auto-pause, portrait prompt). Awaiting a real-phone playtest; see `docs/GATE-A-VALIDATION.md`.
- **Gate B (party battle)** — done in 0.5.0: troops, waves and loot come from `data/`, armor formula, archer accuracy, per-soldier save v2 with migration/backup, 2-day wound recovery on a day clock. Only return-to-map is left, and it opens Gate C.
- **Gate C** — ✅ passed (0.14.0): world map, travel and settlement menus (0.6.0); character creation, equipment and debug tools (0.7.0); food, wages and morale (0.8.0); trading (0.9.0); world parties and encounter choices (0.10.0); levels, troop upgrades and party cap (0.11.0); bandit-hunt contracts (0.12.0); save export/import (0.13.0); acceptance (0.14.0).
- **Gate D** — ✅ passed (0.28.0): three battle maps with obstacles and fort garrisons (0.15.0); walkable Stonebridge (0.16.0); item catalogue, tiered loot and armouries (0.17.0); AI cavalry and all 15 troop roles (0.18.0); faction reputation and fort ownership (0.19.0); quest and dialogue interpreter with the Quest Journal (0.20.0); Q1 "A Stranger's Wage" (0.21.0); Q2 "The Broken Seal" (0.22.0); Mara the companion (0.23.0); Q3 "Two Banners" (0.24.0); Q4 "The Greywall Verdict" with three endings (0.25.0); escort and delivery contracts (0.26.0); trade-world interactions, frontier clashes and regional news (0.27.0); acceptance with a randomized whole-story soak test (0.28.0).
- **Gate E** — ✅ passed (0.38.0): battle scaling with a configurable battle size, reserves and a stress test (0.29.0); phone layout pass (0.30.0); settings and synthesized audio (0.31.0); first-time tips and How to Play (0.32.0); save safety and cross-device QA (0.33.0); asset provenance (0.34.0); full screen on phones and home-screen install (0.35.0, from the owner's phone testing); soldier spacing (0.36); towns open on their menu (0.37); acceptance (0.38.0).

### Problems to fix early
1. **`game.js` is minified source.** Every feature from here touches it; it is unreadable for review and hostile to AI-assisted edits. De-minify and split before adding systems.
2. **Two sources of truth.** `game.js` stats (hero 85 HP, infantry 70, reaver 52…) disagree with `data/troops.js` (GDD tiers: 45/60/80). The data files must become authoritative.
3. **Data defects vs GDD:** `eastwatch.ownerFaction` is `valedorn` (GDD: Aurelian town); six villages are typed `town`; `brackenfield`/`dunmarsh` are `neutral` (GDD: Valedorn / Aurelian). Items are 13 of the ~30 the GDD targets. `legacy_*` troops exist only to mirror the old hardcoded stats — remove once the runtime reads data.
4. **Save is v1 aggregate counts** (`{infantry:3, archer:2,…}` under `crownless_v03_party`). Gate C needs per-troop IDs, XP, wound timers — plan a v2 schema with a migration from v1.
5. **No tests.** Use Node's built-in `node:test` (Node 22 is installed) — zero dependencies, keeps the "no bundler" rule.
6. **Pages publishes the whole repo root**, including the GDD and docs. Harmless, but if that is unwanted, publish a `site/` folder instead.
7. **README** still describes "upload the contents of this archive" — rewrite for a git-based workflow.

---

## 2. Plan

Each step should leave the game deployable. Bold items are the critical path.

### Phase 0 — Foundation ✅ done 2026-11-16
- [x] 0.1 **De-minify and split `game.js`** into classic scripts under `js/` (e.g. `core.js`, `diag.js`, `save.js`, `units.js`, `battle.js`, `render.js`, `input.js`, `ui.js`, `main.js`) sharing one `window.Crownless` namespace. Behavior must match `docs/BASELINE.md` exactly — no gameplay changes in this step.
- [x] 0.2 Add `package.json` (scripts only: `test`, `lint` via `npx @biomejs/biome`), `tests/` with `node:test`: content reference validation + pure-function tests (`facingToward`, `hit`, casualty split, save load/merge).
- [x] 0.3 Add a CI job that runs tests + lint before the Pages deploy.
- [x] 0.4 Fix the settlement data defects in §1.3; rewrite README.

### Phase 1 — Finish Gate A (combat feel) — code done in 0.4.0, phone playtest pending
- [x] 1.1 Attack lifecycle per GDD: windup 0.16 → active 0.12 → recovery 0.24 s, one hit per target per swing, 90° arc, 100 ms input buffer.
- [x] 1.2 Block rules: 120° frontal arc, cannot start during an active swing, block/hit SFX-ready feedback hooks.
- [x] 1.3 Lifecycle: auto-pause on `visibilitychange`/blur, orientation/resize handling, touch-target ≥48 px check.
- [ ] 1.4 Playtest on a real phone → fill in the checklist in `docs/GATE-A-VALIDATION.md` (desktop validation already recorded there).

### Phase 2 — Finish Gate B (party battle slice) ✅ done in 0.5.0 (see `docs/GATE-B-VALIDATION.md`)
- [x] 2.1 **Load `data/*.js` in `index.html`; build a small `ContentDB` with load-time validation.**
- [x] 2.2 **Units built from troop definitions** (hp/damage/armor/speed/reach/ranged); apply `Damage = max(1, round(Raw·100/(100+4·Armor)))`; archer range/cooldown/accuracy from data. Remove `legacy_*` troops.
- [x] 2.3 **Save v2**: roster as troop-ID entries with XP and wound timers; migrate v1 saves; keep a backup copy before overwriting.
- [x] 2.4 Loot from weighted tables, granted exactly once per battle; results screen lists loot and casualties.
- [x] 2.5 Minimal campaign clock (days) so wounded recover after 2 days, not on "Return to Camp".
- [x] 2.6 Record `docs/GATE-B-VALIDATION.md`. (Return-to-map moves to Gate C step 1.)

### Phase 3 — Gate C (two-town campaign loop) ✅ passed in 0.14.0 — see `docs/GATE-C-VALIDATION.md`
Order chosen so each step is playable:
1. ✅ (0.6.0) World map screen: all 10 settlements, click/tap travel, time advancing (`Speed = 4 × terrain × load`), Reaver hideout site, return to map after battle.
2. 🟡 (0.6.0) Settlement menu: Recruit (by owner faction), Rest, Leave done; Trade and Contracts arrive with steps 5 and 9.
3. ✅ (0.7.0) Character creation (name, presentation, cloak colour, 3 backgrounds) + 8-slot equipment and pack; HP/damage/armor/shield/travel take effect. Debug tools panel added for testing.
4. ✅ (0.8.0) Food rations, weekly wages, morale and desertion, with HUD/menu warnings.
5. ✅ (0.9.0) Trading: 6 goods, per-town scarcity, exploit-proof pricing, cargo weight slowing travel, selling gear.
6. ✅ (0.10.0) World parties (patrols, caravans, bands) with off-screen fights and caravan price effects; encounter choices Attack / Auto-resolve / Negotiate / Retreat; seeded RNG; Wait on the map.
7. ✅ (0.6.0–0.7.0) Capture on defeat (−20 % crowns, an item, released near a settlement after half a day).
8. ✅ (0.11.0) Player XP, levels to 10, skill/attribute points; troop XP and GDD upgrade trees (cavalry locked until Gate D); party cap formula.
9. ✅ (0.12.0) Contract lifecycle (offer → accept → defeat → collect; fail/abandon/void) with the bandit-hunt template.
10. ✅ (0.13.0) Save export/import: file and paste-text, checksum, strict ID/version validation, pre-import backup and restore, storage warning.
11. ✅ (0.14.0) Acceptance: end-to-end test, 30-day multi-seed campaign simulation (found and fixed a stalled-economy problem in auto-resolve), real-click browser playthrough with reload check, GDD edge-case coverage table.

### Phase 4 — Gate D (full region & story) ✅ passed in 0.28.0 — see `docs/GATE-D-VALIDATION.md`
All 10 settlements; Stonebridge walkable hub; 3 battle maps; ~30 items; AI cavalry (all 15 troop roles); reputation + Greywall ownership; quest/dialogue interpreter; Q1–Q4 with 3 endings; Mara companion; escort + delivery contracts; regional news.

### Phase 5 — Gate E (release quality) ✅ passed in 0.38.0 — see `docs/GATE-E-VALIDATION.md`
1. ✅ (0.29.0) Battle scaling: active-unit cap (20 / 30 / 40) with reserves that step in as others fall; stress test and per-frame timing; measured (no proximity grid needed at MVP scale).
2. ✅ (0.30.0) Landscape UX pass: HUD fits beside the buttons, announcements below it, map labels placed without overlap, tap-to-walk steers, dev tools hidden in release builds (`?dev` shows them).
3. ✅ (0.31.0) Settings and audio: Settings panel (music/SFX volume, battle size, health bars, reduced effects; kept on the device); 14 synthesized sound effects and 3 music loops via Web Audio, no files.
4. ✅ (0.32.0) Tutorial and help: 15 first-time tips (once per device; the first battle waits on its controls card), a How to Play screen with every control, Q1 kept as the hands-on tutorial.
5. ✅ (0.33.0) Save safety and cross-device export/import: save on page hide, two-tab guard, backup-load notice, export reminders and storage-persistence request, forgiving paste import, cross-device and old-build round trips.
6. ✅ (0.34.0) Asset provenance: sprites are the owner's own AI-generated art (Sprite Studio); sound and map are code; no third-party assets or runtime dependencies. `docs/ASSETS.md`, `assets/manifest.json` and a guarding test; Credits in How to Play.
7. ✅ (0.38.0) Device QA and Gate E acceptance: §15 checklist complete, new money and result probes (`tests/gate-e.test.js`), full regression run. Owner pass open: an iPhone if available, and a real phone↔desktop save transfer. Device evidence: on the owner's Zenfone 10 (Chrome), the stress test at battle size 30 ran at **60 fps** (0.6 ms simulation, 1.7 ms drawing, 17 ms slowest frame); full screen, Add to Home Screen and play "all felt pretty good".
   - 7b. ✅ (0.37.0) **Towns open on their menu (finding F-3):** walkable places open their settlement menu on arrival, with Walk the streets and Leave; people in the streets can be talked to from the menu too; a per-place `entry` content flag (`menu` or `streets`).
8. ✅ (1.0.0) Release **v1.0 "The Border March"**: save schema v2 frozen (`docs/SAVE-FORMAT.md`); five v1.0 save fixtures (`tests/fixtures/saves-v1.0/`, guarded by `tests/save-fixtures.test.js`); release notes (`docs/RELEASE-NOTES.md`); tag `v1.0.0`.

### Phase 6+ — v2 (planned; see `docs/V2-PLAN.md`)
**Workflow:** everything on `main`. GitHub Pages is the test build, not a release.
**Version numbering (owner-approved, 2026-11-17):** each finished v2 task bumps the minor version (1.1.0, 1.2.0, …); fixes bump the patch; docs-only tasks (ART-01, R-01–R-03) bump the patch; V2-13 acceptance ships **2.0.0**. Save schema steps are numbered separately (v3, v4, …), one per task that changes the save's shape, each with its own migration.
From the owner's v2.0 design (`Crownless_v2_0_Feature_and_Systems_Design_Part_1.md` and `_Part_2.md`). Every system ships a default path, a one-decision preset and optional expert depth; power is gained and lost without ever ending the campaign.
- **Playtest findings (owner, 2026-11-17)** — in `docs/V2-PLAN.md` §4b:
  - **F-1, troops with XP but no upgrade.** ✅ Settled in 1.5.0 by V2-03b (the troop tree, the Sellsword, "max tier", Upgrade all ready). Confirmed: the stuck soldiers were Mercenaries, which have no upgrade path while the Party screen shows an XP target. The owner chose to fix this in v2 through a **troop tree discovered as you play** (V2-03b). Unknown troops are hidden, troops seen in battle show only their name, and troops you have owned or trained show full stats. End-of-path troops show "max tier", and there is an "Upgrade all ready" action. Nothing changes before then.
  - **F-2, soldiers stacking on one spot in battle.** ✅ Fixed in 0.36.0: soldiers now have bodies. In 0.36.1 the spacing was tightened to shoulder to shoulder (12 px) at the owner's request. They never stack, and charging riders still ride through. V2-05 keeps this working on larger maps.
- **Phase 6, v2.0 "The Living Warband":**
  - ART-01 an art style guide and asset list: **deferred (owner, 2026-11-18): a separate team is working on the art**
  - ✅ (1.1.0) V2-00 type checking with `@ts-check` and JSDoc (no build step): `npm run typecheck` (TypeScript 6.0.3 via `npx`, part of `npm run lint`), shared types in `types/crownless.d.ts`, seven modules checked (`core`, `save`, `party`, `units`, `combat`, `story`, `world`)
  - ✅ (1.2.0) V2-01 save schema v3, migrations and a storage layer: `worldId` and `contentVersion`; structural checks that reject partial saves; pure migration steps with a pre-migration copy; last-known-good backup and writes that must read back; imports and restores that report success only once stored; autosave once per game day on the map; `CL.storage` (`js/storage.js`); fixtures from the real 0.14 and 0.28 builds plus a 0.3 save (`docs/SAVE-FORMAT.md`)
  - ✅ (1.3.0) V2-02 one idempotent result path, events and seeded randomness: `CL.encounter.resolve` commits every encounter result (fought battle and capture, auto-resolve, retreat, toll or intimidation) exactly once under a result ID taken when the encounter opens; `CL.events` with unique, saved event IDs (BattleResolved, EncounterResolved, SoldierRecruited, SoldierPromoted, SoldierWounded, SoldierKilled, SoldierDeserted); named random streams for casualties, loot and upkeep beside the world stream; save schema v4; fixtures from the real 1.2.0 build
  - ✅ (1.4.0) V2-03 named soldiers and service records, with a data-driven, moddable culture name generator: `data/names.js` (Valedorn, Aurelian, border folk; factions, settlements and troops point at a culture); `js/soldiers.js` (seeded names, records kept from events: battles, victories, kills, assists, wounds, captures, wages actually paid; bounded notes); a Soldiers view in Party with a filter and a profile card (rename, per-soldier upgrade with reasons); the fallen and wounded named on result screens; save schema v5 naming old soldiers on load; fixtures from the real 1.3.0 build
  - ✅ (1.5.0) V2-03b a troop tree discovered as you play: a Troop tree tab in Party (unknown troops hidden, seen ones by name, owned ones in full with costs and XP targets); knowledge saved and learned from events and hiring offers; a debug Reveal toggle; the Sellsword, a tier 3 for the Mercenary; "max tier" everywhere a troop has no path; Upgrade all ready with the total and a confirmation; each disabled upgrade says why. Settles F-1. Save schema v6
  - ✅ (1.6.0) V2-04 a canonical campaign clock: `js/clock.js` is the one authority; a battle takes a **fixed 4 game hours** of overworld time, fought or auto-resolved (owner decision 2026-11-17, replacing the planned battle-rate clock); capture 12 hours, rest 24, set in `data/world_map.js`; retreats, tolls, pausing, menus and towns pass no time
  - ✅ (1.7.0) PROTO-A a camera test run in the Debug panel: **passed on the owner's Zenfone 10: 60 fps at 30 and 40 units, 0.5 ms simulation and 1.4 ms drawing, slowest frame 17 ms; "felt like a bigger battle, not just a fight in one room"; commands and the minimap need work.** The 3× arena and this camera are V2-05's starting point. Camera test 30 / 40 in a generated 3× forest (2880×1620) with a damped hero-follow camera, culling, edge markers for off-screen enemies, and an obstacle grid for big maps; the result screen reports fps, drawing ms, slowest frame, time to contact and battle length
  - ✅ (1.8.0) V2-05 a world-space camera and larger arenas: ordinary battles in forests and in the open use generated fields three screens across (Forest Wilds, Open Country) with the PROTO-A camera, culling and edge markers; the Greywall courtyard stays one screen; a device setting Battlefield: Small brings back the one-screen maps; bodies (F-2), reserves and collision checked on the large maps; the large maps are the cheapest to simulate
  - ✅ (1.9.0) V2-06 minimap and tactical overview: detection (only enemies the company has seen are shown, with last-seen marks; the edge markers follow the same rule); a minimap at the top centre of large battles, tap to look; a tactical overview (MAP on phones, hold Tab or M on desktop) that holds the battle still and sends the selected group to a tapped spot to hold
  - ✅ (1.10.0) V2-07 battle preparation: Attack opens a Prepare screen with the real field; Balanced (default), Defensive, Aggressive and Custom (drag group flags inside a legal deployment zone, set each group's first order); Fight in two taps; Simulate with the odds explained; a smaller zone when ambushed; remember the setup and skip the screen (device settings)
  - ✅ V2-08 group AI, cohesion and counterplay, split in two (owner decision 2026-11-18):
    - ✅ (1.11.0) V2-08a group AI, formations and shield cover: shield troops raise shields; shield cover for the adjacent ally on the shield side (hero included, arrows too); braced spears stop charges from the front; archers need a clear shot and step aside for one; loose Follow ranks; group states (forming, formed, advancing, engaged); every impossible order says why
    - ✅ (1.12.0) V2-08b group morale, rout and rally: every group on both sides holds, wavers, falls back or routs from a worked-out cohesion (losses, odds, flanks, nearby routs, veterans, the hero, supplies), never a roll; routing soldiers run for their own edge and leave; fled enemies count as beaten with no kill credit and half the spoils; your fled soldiers return unhurt; Rally (R / Orders) every 30 s; reserves replace runners at once
  - ✅ (1.13.0) V2-09 nearby reinforcements: world parties that can reach a battle within its 4 hours and hear it join at a worked-out time (an hour away is ten seconds of battle), from the side they come from; Reavers join Reavers, a friend's patrol helps, a Hostile kingdom's patrol comes for you; seen ones are named on the encounter screen, others announced 10 s ahead with a banner; reserves at the unit cap; too late if the battle ends first; helpers' kills are theirs; parties in a live battle are locked so none can lose two battles; one commit; auto-resolve counts the help that would arrive in good time
  - ✅ (1.14.0) V2-10 company chronicle and roll of honour: a Company chronicle in the Journal beside the regional news (the company founded, recruits and promotions folded per day, notable battles with who fell, deserters, the retired, quests completed or failed; at most 80 lines); a Roll of honour tab in Party for soldiers who fell, deserted or retired (who, from where, how long, their record and how they left; newest 60 in full, older ones counted); Retire with honour on a soldier's card; "Who did what" on the battle result; save schema v7; fixtures from the real 1.13.0 build
  - ✅ (1.15.0) V2-11 accounts and the quartermaster: your purse, the company chest and follower budgets, with every change of money going through one transfer function and a ledger (source, destination, reason); wages from the chest first; captors take a share of every account; a hireable quartermaster who keeps the next wages in the chest and buys food up to a reserve within a weekly budget (default 5 days, 60 crowns), drawing from your purse only what the food needs, warns before shortages and logs everything; save schema v8; fixtures from the real 1.14.0 build
  - ✅ (1.16.0) V2-12 the merchant follower: trades an assigned budget (its own account) at every market you reach through the same buy and sell functions as you; knows only prices seen on your travels (older ones trusted less, a bounded estimate); Cautious by default, Bold optional; sells first, then buys a unit at a time within margin, invested share, cash, cargo room and a per-good cap; reports what and why, or that no safe trade was found; stop, take back, or recover everything at any time; save schema v9; fixtures from the real 1.15.0 build
  - ✅ (1.17.0) V2-Q five small errands that use the new systems (no new main story): Home from the Wars (a Stonebridge-born veteran feasted; named soldiers and the chronicle), Full Larders (the quartermaster), A Merchant’s First Venture (the merchant), Smoke on the Border (a Crown watch rides in: reinforcements), A Planned Engagement (battle setups); optional, marked as errands in the Journal; the quest interpreter learned a few words for them
  - ✅ (1.18.0) V2-T1 economy tuning pass: measured with a new economy report (`npm run economy`); the warband economy kept as it is (no hoarding, almost no hardship); the quartermaster's weekly budget now automatic by default (it starved companies that left food to it); the merchant sells stock that waits (at cost after 6 days, at up to 15% loss after 14) and Bold is retuned; Prototype E passed
  - ✅ (1.19.0) V2-T2 battle tuning pass: battles always end (the company charges when the hero falls; an enemy left alone while falling back gives up; 45 s without a blow and the enemy slips away), Balanced has archers and cavalry go with the hero, and auto-resolve meets fought battles part way (soldiers ×1.5 for fighting in ranks, a won fight costs fewer); arena, spacing, morale and reinforcement timing measured and kept
  - ✅ (2.0.0) V2-13 v2.0 acceptance: every core scenario (SC-01–14, SC-30–39) mapped to its evidence in `docs/V2-VALIDATION.md`; Prototype G (hands-off, presets-only and expert players over the same campaigns, with a save, reload and resume) all viable; SC-33 fixed (a save naming a troop this version lacks is refused by name and kept, not thinned); a Debug-panel **Big battle 40 + help** for the SC-34 phone run; release notes. **v2.0 is a testing release.** Waiting on the phone: SC-34 and the feel of the new battles; SC-37 balance deferred by the owner
  - **Release track** (the goal is to sell eventually; never blocks v2.0): R-01 commercial readiness, including OpenAI's terms for the ChatGPT-made sprites; R-02 packaging trial; R-03 demo plan. **Deferred until after the art (owner, 2026-11-18)**
  - **Later backlog:** text size and zoom, other languages (English only for now)
- **After 2.0: the full plan is [`docs/NEXT-PLAN.md`](NEXT-PLAN.md), with every task specified in [`docs/NEXT-TASKS.md`](NEXT-TASKS.md)** (owner direction, 2026-11-18: zoom first, and a bigger world so the later features can be tested):
  - **Phase W, "A Bigger World":** first, browser regression tests (W-00, Playwright in CI) and test hygiene (H-01); then text size and UI scale, a world-map camera with drag, pinch and zoom (taps no longer travel on pointer-down), battle zoom, a data-driven world without hard-coded 0–100 bounds, world geometry and terrain, a larger region with more kingdoms (Border March kept as one part) shipped together with the save migration that moves saves into it, a world simulation that scales, and route planning (W-09).
  - The plan was reviewed against the code at c66d94c (NEXT-PLAN §11): each task is labelled Ready, Ready after decision, Specified or Provisional, and the decisions waiting on the owner are listed in NEXT-PLAN §8.
  - ✅ (2.1.0) W-00 browser regression testing: Playwright (the first development dependency, owner decision D-T1) runs the static game in Chromium at desktop size and as a landscape phone with touch: startup, character creation, loading real saves (and damaged or incompatible ones), map travel and encounters, the settlement menu and the streets, a battle from Attack to result with every control, Save & export, and layout checks (inside the screen, no overlaps, 44 px touch targets). Screenshots of nine screens against Linux baselines; a `browser` CI job that blocks deploy. Fixtures from the real 2.0.0 build (`saves-2.0`). Two bugs found and fixed: the Orders panel's close button hidden under Pause on phones, and an Attack pressed in a battle's first moments being lost
  - ✅ (2.1.1) H-01 test and measurement hygiene: test games no longer share the host's `Math` (a seeded run depended on what ran before it), with an isolation test; `npm test` 22 s → 8 s with the whole-campaign bot tests under `npm run test:slow` (CI runs both); `npm run parity` (fought versus auto-resolved, the baseline for B-01) and `npm run bench:map` (world simulation per game hour, the baseline for W-07); `.gitattributes` keeps the repository LF
  - ✅ (2.2.0) W-01 text size and UI scale: Settings → Text size (Small, Normal, Large, Larger) scales every HTML text, control and canvas label at once; touch targets at least 44×44 and growing with the text; the HUD shortens at Larger; menus keep their bottom buttons in view; browser checks of every key screen at all four sizes on desktop and phone, at Larger on four more phone sizes, and at 150% desktop zoom; the pinch-zoom trade-off documented. D-R1's sharp-canvas test is in the Debug panel, waiting on phone numbers
  - ✅ (2.3.0) W-02 world-map camera and gestures: drag to pan, pinch, wheel or + − to zoom from "fit" (1× on today's map) to 2.4×, Centre and following, edge markers to you and your targets; a tap travels only on release and only if it stayed a tap, so a drag or pinch never sets off; a cached terrain layer, culling, and the map's gameplay distance (`aspect`) moved into its data, so no view change alters a rule (tested: the same journey and contacts at every zoom). Debug panel → Map drawing test for the phone
  - ✅ (2.4.0) W-03 battle zoom: 0.75×–1.5× on large fields by pinch (field only; one finger does nothing), the mouse wheel or the zoom button (1× ↔ 0.75×, Z); the hero kept central; minimap box, edge markers and culling follow the zoom; pinch in at the widest zoom opens the overview, spread closes it; minimap and overview taps act on release from a clean tap; sighting judged at 1×, so the same battle at every zoom (tested; the benchmark is unchanged). The phone's Big battle numbers at 0.75× are the owner's
  - **Phase 7, "The Living Company":** the deferred battle balance pass (B-01), surgeon, scout and blacksmith, pursuit and detection, officers and detached patrols, more companions, soldier traits, world events, a tournament, a first business, battle extras.
  - **Phase 8, "The Landed World":** lords on the map, holdings and claims, permissions, allegiance, fiefs and castellans, sieges, named nobles, losing and retaking land. Acceptance is "The Dispossessed Lord".
  - **Phase 9, "Kingdoms & Houses":** realms, diplomacy and treaties, founding a kingdom, rebellion and deposition, armies, houses and marriage, modding and a second world.

---

## 3. Working rules
- One source of truth per ID (`data/*.js`); runtime never hardcodes stats.
- No bundler, no runtime deps; dev-only tooling via `npx`.
- Every gate ends with a short validation doc and a real-phone playtest.
- Scope rule from the GDD: a new feature replaces an equal or larger one, or moves to "Later".
