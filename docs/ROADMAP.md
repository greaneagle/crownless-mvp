# Crownless — Project Status & Roadmap

_Last reviewed: 2026-11-17 · Build 1.0.0 · Spec: `Crownless_MVP_GDD_v1.md` (engine overridden: HTML5 Canvas + classic JS, no bundler, GitHub Pages)._

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
From the owner's v2.0 design (`Crownless_v2_0_Feature_and_Systems_Design_Part_1.md` and `_Part_2.md`). Every system ships a default path, a one-decision preset and optional expert depth; power is gained and lost without ever ending the campaign.
- **Playtest findings (owner, 2026-11-17)** — in `docs/V2-PLAN.md` §4b:
  - **F-1, troops with XP but no upgrade.** Confirmed: the stuck soldiers were Mercenaries, which have no upgrade path while the Party screen shows an XP target. The owner chose to fix this in v2 through a **troop tree discovered as you play** (V2-03b). Unknown troops are hidden, troops seen in battle show only their name, and troops you have owned or trained show full stats. End-of-path troops show "max tier", and there is an "Upgrade all ready" action. Nothing changes before then.
  - **F-2, soldiers stacking on one spot in battle.** ✅ Fixed in 0.36.0: soldiers now have bodies. In 0.36.1 the spacing was tightened to shoulder to shoulder (12 px) at the owner's request. They never stack, and charging riders still ride through. V2-05 keeps this working on larger maps.
- **Phase 6, v2.0 "The Living Warband":**
  - ART-01 an art style guide and asset list (alongside)
  - V2-00 type checking with `@ts-check` and JSDoc (no build step)
  - V2-01 save schema v3, migrations and a storage layer
  - V2-02 one idempotent result path, events and seeded randomness
  - V2-03 named soldiers and service records, with a data-driven, moddable culture name generator
  - V2-03b a troop tree discovered as you play
  - V2-04 a canonical campaign clock (no flat 6-hour battle charge)
  - PROTO-A a camera test run in the Debug panel, on your phone first
  - V2-05 a world-space camera and larger arenas
  - V2-06 minimap and tactical overview
  - V2-07 battle preparation presets and deployment
  - V2-08 group AI, cohesion and counterplay
  - V2-09 nearby reinforcements
  - V2-10 company chronicle and roll of honour
  - V2-11 accounts and the quartermaster
  - V2-12 the merchant follower
  - V2-Q a few small quests that use the new systems (no new main story)
  - V2-T1 and V2-T2 tuning passes (economy, then battles)
  - V2-13 v2.0 acceptance; v2.0 is a testing release
  - **Release track** (the goal is to sell eventually; never blocks v2.0): R-01 commercial readiness, including OpenAI's terms for the ChatGPT-made sprites; R-02 packaging trial; R-03 demo plan
  - **Later backlog:** text size and zoom, other languages (English only for now)
- **Phase 7, v2.1–2.2 "Company & World":** more followers, officers and detached patrols, pursuit and detection, dynamic events, a duel tournament, a first business.
- **Phase 8, v2.3+ "The Landed World":** holdings, claims and occupation, fealty and allegiance, castellans, simple sieges, named nobles. Acceptance is "The Dispossessed Lord".
- **Phase 9, later:** kingdoms, treaties and rebellion, houses and marriage, modding, new worlds.

---

## 3. Working rules
- One source of truth per ID (`data/*.js`); runtime never hardcodes stats.
- No bundler, no runtime deps; dev-only tooling via `npx`.
- Every gate ends with a short validation doc and a real-phone playtest.
- Scope rule from the GDD: a new feature replaces an equal or larger one, or moves to "Later".
