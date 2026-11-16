# Crownless — Project Status & Roadmap

_Last reviewed: 2026-11-16 · Build 0.19.0 · Spec: `Crownless_MVP_GDD_v1.md` (engine overridden: HTML5 Canvas + classic JS, no bundler, GitHub Pages)._

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
- **Gate D** — in progress: three battle maps with obstacles and fort garrisons (0.15.0); walkable Stonebridge (0.16.0); item catalogue, tiered loot and armouries (0.17.0); AI cavalry and all 15 troop roles (0.18.0); faction reputation and fort ownership (0.19.0). **Gates D–E** — not started.

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

### Phase 4 — Gate D (full region & story) — in progress, see `docs/GATE-D-VALIDATION.md`
All 10 settlements; Stonebridge walkable hub; 3 battle maps; ~30 items; AI cavalry (all 15 troop roles); reputation + Greywall ownership; quest/dialogue interpreter; Q1–Q4 with 3 endings; Mara companion; escort + delivery contracts; regional news.

### Phase 5 — Gate E (release quality)
Battle scaling (20→40 active, reserve waves, spatial grid); landscape UX pass; audio + settings; tutorial/help; asset provenance doc (the GDD requires original/licensed art — confirm the "Sprite Studio" source licence); save-safety and device QA.

---

## 3. Working rules
- One source of truth per ID (`data/*.js`); runtime never hardcodes stats.
- No bundler, no runtime deps; dev-only tooling via `npx`.
- Every gate ends with a short validation doc and a real-phone playtest.
- Scope rule from the GDD: a new feature replaces an equal or larger one, or moves to "Later".
