# Crownless MVP — Baseline Reference (BUILD 0.3.0)

**Purpose.** This document records the *actual* behavior of the current prototype so later roadmap tasks do not regress Gate A/B. Every claim below is traceable to the source files listed under [Source map](#source-map). Where behavior is ambiguous, the code's actual behavior is described rather than intent.

**Audited:** 2026-11-14 · **Build:** `0.3.0` · **Scope:** documentation only (no source files modified).

---

## 1. Build identity

| Field | Value | Source |
|---|---|---|
| Build constant | `BUILD = '0.3.0'` | `game.js:2` |
| Page title | "Crownless 0.3 · The Captain's Trial" | `index.html:2` |
| HUD wordmark | "CROWNLESS v0.3 · GATE B" | `index.html:3` |
| Title overlay subtitle | "Gate B: Lead a band of infantry and archers, issue tactical commands, and win two waves of battle." | `game.js:18` |
| Version footer | "PRE-ALPHA 0.3.0 · AUTO-SAVES IN THIS BROWSER" | `index.html:3` |
| Save key | `crownless_v03_party` | `game.js:2` |

**Entry point.** `index.html` loads `style.css` in `<head>` and `game.js` with `defer`. The game renders to a single `<canvas id="game" width="960" height="540">` (16:9, `image-rendering: pixelated`). It is a self-contained vanilla HTML5 Canvas 2D app: no bundler, server process, or runtime dependency.

---

## 2. Controls (as implemented)

### Keyboard / mouse

| Action | Binding | Notes |
|---|---|---|
| Move | `W A S D` or arrow keys (held) | Combined with joystick input; hero speed 142 px/s |
| Attack | `Space` (held) or left mouse button | Blocked while guarding; hero cooldown ~0.49 s |
| Block | `Shift` (Left/Right, held) or right mouse button | Frontal guard; movement slows to 65% |
| Select infantry group | `1` | Sets active order group to infantry |
| Select archer group | `2` | Sets active order group to archers |
| Follow order | `F` | Applies to active group |
| Hold order | `H` | Snapshots current positions as hold points |
| Charge order | `C` | Applies to active group (see [Orders](#orders)) |
| Pause | `Esc` | Closes the Orders panel first if open, otherwise toggles pause |
| Diagnostics | `F3` | Toggles the diagnostics panel |
| Menu select | primary button on overlays | title → camp → battle → result → camp |

`Space`, arrow keys, `F3` have `preventDefault`. Key state is tracked in `game.hold[code]` on `keydown` and cleared on `keyup`; window `blur` clears all held input plus attack/block.

Mouse attack/block are only read on canvas `pointerdown` when `pointerType === 'mouse'` (button 0 = attack, button 2 = block); context menu is suppressed. `pointerup` anywhere clears attack/block.

### Touch / on-screen

| Control | Element | Behavior |
|---|---|---|
| Move | `#joystick` + `#knob` | Pointer-captured virtual stick; normalized x/y feeds `game.joystick` |
| Attack | `#attackBtn` | Press-and-hold sets `attackHeld` |
| Block | `#blockBtn` | Press-and-hold sets `blockHeld` |
| Orders | `#ordersBtn` | Toggles `#ordersPanel` |
| Group select | `[data-group]` buttons (1 Infantry / 2 Archers) | Same as keys `1`/`2` |
| Order select | `[data-order]` buttons (F Follow / H Hold / C Charge) | Same as `F`/`H`/`C` |
| Pause | `#pauseBtn` | Toggles pause |
| Diagnostics | `#debugBtn` | Toggles diagnostics panel |

On fine-pointer/hover devices the joystick and right control cluster render at reduced opacity (0.29) and become fully opaque on hover.

---

## 3. Mode / flow state machine

`game.mode` starts at `'title'`. Transitions are driven entirely by the single `#primaryBtn` plus the battle-end logic.

```
title ──(Prepare Party)──▶ camp ──(Begin Battle)──▶ battle
  ▲                          ▲                        │
  │                          │                        ├─(all enemies dead, wave 2 cleared)──▶ result (VICTORY)
  │                          │                        └─(hero + all allies dead)────────────▶ result (CAPTURED)
  │                          └──(Return to Camp: recover())──────────── result ◀────────────┘
```

| Mode | Overlay | What is shown |
|---|---|---|
| `title` | visible | "CROWNLESS" + Gate B blurb; button "Prepare Party" |
| `camp` | visible | "THE CAPTAIN'S CAMP", roster summary, recruit buttons; button "Begin Battle" |
| `battle` | hidden | Live canvas play; Orders panel available; `#prep`/`#result` hidden |
| `result` | visible | "VICTORY" or "CAPTURED" + result breakdown; button "Return to Camp" |

`changeMode()` (`game.js:18`) shows/hides `#overlay`, toggles `#prep` only in `camp` and `#result` only in `result`, and keeps `#secondaryBtn` permanently hidden. `startBattle()` (`game.js:16`) sets `mode='battle'` directly and hides the overlay + Orders panel. `endBattle()` sets `mode='result'`, computes results, then calls `changeMode('result')`.

> Note: the result screen's "Return to Camp" runs `recover()` *before* switching to camp, so wounded troops are restored on that transition.

---

## 4. Combat behavior

### Unit stats (`game.js:14`)

| Role | Team use | HP | Speed (px/s) | Damage |
|---|---|---|---|---|
| `hero` | player | 85 | 142 | 18 |
| `infantry` | ally | 70 | 94 | 11 |
| `archer` | ally | 46 | 84 | 8 |
| `brute` | enemy | 85 | 77 | 13 |
| `reaver` | enemy (default) | 52 | 103 | 11 |

Melee attack cooldown is ~0.86 s for all non-hero melee roles, hero ~0.49 s, archer 1.2 s. Attack animation lasts 0.31 s for every role. Initial cooldowns are randomized `0–0.4 s` to de-sync units.

### Hero movement & facing

- 4-direction movement with bounds `x ∈ [47, 908]`, `y ∈ [65, 490]`.
- Facing is set from the dominant movement axis (`left`/`right`/`up`/`down`), and from aim when stationary in contact.
- Guarding multiplies speed by 0.65 and disables attacking that frame.

### Attack arc & block

- **Melee reach:** hero 67 px, all other melee 48 px.
- **Facing check:** `facingToward()` (`game.js:25`) uses a dot-product threshold of `0.38` (≈ ±67.7°, a ~135° frontal arc). This same check gates both hits and blocks.
- **Melee:** on attack, the first living target within reach that is inside the frontal arc is hit, then the loop breaks (one target per swing). No armor mitigation; damage is flat.
- **Block:** `hit()` (`game.js:24`) negates the hit entirely when `target.guard` is true and the attacker is within `facingToward`. Block is infinite and frontal (attacks from behind still land). Only the hero ever sets `guard = true` — allied and enemy units keep `guard = false`.
- **Ranged:** archers fire when the AI calls an attack at `< 225 px`; `doAttack` then spawns an arrow if the target is `< 245 px`. Arrows travel at 240 px/s, live 1.6 s, carry the archer's damage (8), and hit any opposing unit whose center is within 19 px of the arrow (measured at target `y-16`).

### Enemy AI basics

- Units retarget the nearest living opponent every `0.17–0.41 s` (`aiTimer`); enemies target `[hero, ...allies]`, allies target `[enemies]`.
- Default pursuit distance: archers stop at 145 px, melee at 38 px; melee attacks within 47 px, archers within 225 px.
- No obstacle avoidance, separation/flocking, or explicit state machine. Charge has a separate order label but no dedicated AI branch (see [Orders](#orders)).

### Waves (`game.js:17`, `game.js:33`)

- `game.totalWaves = 2`.
- **Wave 1:** 6 enemies. **Wave 2:** 8 enemies.
- Role split: index `i % 5 === 0` → `brute`, otherwise `reaver`. Result: wave 1 has 2 brutes / 4 reavers; wave 2 has 2 brutes / 6 reavers.
- Spawn area: `x ∈ [735, 887]`, `y ∈ [91, 450]`; enemies face `left`.
- Clearing all enemies advances to the next wave (enemies array reset) or wins on the final wave.

### Health / KO / end conditions

- Damage reduces HP; at 0 the unit sets `alive=false`, `ground=true`; enemy deaths increment `game.kills`.
- **Victory:** all enemies dead on wave 2.
- **Defeat:** triggered only when the hero AND every ally are dead (`!hero.alive && allies.every(!alive)`). A dead hero with living allies does not end the battle.

### Hit feedback

- Target flashes for 0.14 s; a colored impact ring (`#f4bb72` ally / `#f77864` enemy) fades over 0.35 s.
- Attacking units draw a swing arc; guarding units draw a ring; damaged units show an HP bar; all units get a shadow and a small team-colored dot.

---

## 5. Campaign & party

### Roster & recruitment (`game.js:7, 19–20`)

Starter campaign (`starter()`): **gold 130**, infantry 3, archer 2, wounded 0/0, battles 0, victories 0, renown 0, `version: 1`.

| Recruit | Cost | Cap rule |
|---|---|---|
| Infantry | 20 crowns | Blocked when `gold < cost` **or** `infantry + archer >= 15` |
| Archer | 25 crowns | Blocked when `gold < cost` **or** `infantry + archer >= 15` |

The total roster cap is 15; both recruit buttons disable under the same conditions the `recruit()` function guards.

### Deployment (`game.js:16`)

`startBattle()` deploys `min(12, campaign.infantry)` infantry and `min(8, campaign.archer)` archers, plus the hero at `(330, 270)` facing right. Un-deployed recruits stay in the campaign count. Orders reset to `{ infantry: 'follow', archer: 'hold' }` and active group resets to `infantry` each battle.

### Orders (`game.js:23, 29–30`)

Active group is `game.group` (`infantry` or `archer`). `1`/`2` select a group; `F`/`H`/`C` (or panel buttons) set that group's order.

- **Follow:** move toward the hero (goal: archer 98 px, melee 62 px); if a nearby enemy is within archer 205 px / melee 75 px, switch to chasing it.
- **Hold:** if an enemy is within archer 218 px / melee 85 px, chase it (goal: archer 150 / melee 37); otherwise return to the group's snapshotted hold point (goal 5 px). Issuing Hold snapshots each living member's current position.
- **Charge:** there is no dedicated charge branch, so it falls through to the default *nearest-enemy advance* (goal: archer 145 / melee 38). There is **no damage or speed bonus** — this is the behavior the GDD audit calls "charge inert."

### Casualties & recovery (`game.js:21–22`)

For every **friendly unit that died** in battle, `endBattle()` rolls `Math.random() < 0.35`:

- `35%` → **killed** (lost permanently from the roster),
- `65%` → **wounded** (removed from active roster, added to `woundedInfantry`/`woundedArcher`).

`campaign[role]` is reduced by `lost + wounded` (clamped ≥ 0). Survivors are untouched. At camp, `recover()` moves all wounded back into the active roster and zeroes the wounded counters; it runs when returning to camp from the result screen.

### Rewards, capture, and loot (`game.js:21`)

- **Victory:** `victories++`, `renown += 4`, `gold += 52 + kills*3`. Result text shows "+{reward} crowns · +4 renown."
- **Defeat / capture:** `gold = floor(gold * 0.8)` — a **20% gold loss**. Result title "CAPTURED," text "20% crowns lost."
- `campaign.battles++` on every battle end (win or loss).
- **Loot:** there is **no field-loot or pickup mechanic**. All spoils are abstracted into the victory gold bonus (and the "gather the spoils" flavor text). No items, no drop tables.
- Result breakdown also reports enemies defeated, killed/wounded counts, surviving allies, and waves reached (`game.wave`/2).

---

## 6. Persistence

- **Storage:** `localStorage`, key **`crownless_v03_party`** (`SAVEKEY`, `game.js:2`).
- **Saved object** (`campaign`), `game.js:7–9`:

```json
{
  "version": 1,
  "gold": 130,
  "infantry": 3,
  "archer": 2,
  "woundedInfantry": 0,
  "woundedArcher": 0,
  "battles": 0,
  "victories": 0,
  "renown": 0
}
```

- **Load rules (`loadSave`):** parses JSON; accepts only if `d.version === 1`. Starting from `starter()`, it copies each key only when the stored value is a finite number `>= 0`, floored and clamped to `≤ 99999`. Missing/invalid fields fall back to starter defaults. Read errors log a `warn` and fall back to starter.
- **Save points (`save()`):** called after `recruit()`, after `endBattle()`, and after `recover()`. There is no save at boot, but nothing mutates `campaign` before those actions.
- Clearing browser storage resets the campaign to the starter state.

---

## 7. Diagnostics panel

Toggle via `F3` or `#debugBtn`; close via `#closeDebug`. (`game.js:39–43`)

- **Stats block (`#debugStats`):** pretty-printed JSON of `{ build, mode, hero, units:{allies,enemies}, fps, assets, campaign }`.
- **Event log (`#debugEvents`):** the most recent 150 diagnostics entries (`date`, `level`, `msg`, optional `data`). The in-memory buffer holds up to 800 events.
- **`diag` object:** `events[]`, `errors[]` (declared), `assets {requested, loaded, failed[]}`, `fps`, `frames`, `lastFps`, `started`, and `log(level,msg,data)`. Global `error` and `unhandledrejection` handlers log into the same event stream.
- **Asset counters:** `requested` increments per `loadImg`; `loaded` increments on `onload`; failed keys are pushed to `failed[]` and logged as errors. At boot the game requests **53** images (36 unit frames + 17 terrain).
- **Export buttons:** `Export JSON` (application/json) and `Export TXT` (text/plain) both download `JSON.stringify(report(), null, 2)` as `crownless-debug-<timestamp>`. `Copy` writes the same report to the clipboard; `Clear` empties the event log.
- **`report()`** also includes build, ISO time, page URL, user agent, viewport/DPR, live game state, orders, campaign, asset status, and FPS.
- **FPS** is recomputed once per second from the requestAnimationFrame loop.

---

## 8. Asset inventory

- **169 files** total in `assets/`, all PNG, **zero audio** (`mp3`/`wav`/`ogg` = 0).
- **152** `u####` unit-sprite frames (`u0000.png` … `u0295.png`, not all IDs present).
- **17** `w####` terrain/prop sprites: `w0000, w0001, w0002, w0003, w0007, w0012, w0020, w0034, w0050, w0061, w0091, w0110, w0121, w0132, w0147, w0167, w0174`.
- Sprites are extracted from the supplied Sprite Studio assets and are cropped from larger sheets; some animations are not hand-aligned.

**Unit frames actually referenced (`game.js:11`):**
- Hero: `0–3` (down), `16–19` (left), `32–35` (right), `48–51` (up).
- Ally infantry: `72–75`; ally archer: `85–88`.
- Enemies: `92–95`, `120–123`, `200–203` (assigned cyclically to spawned enemies).

**Terrain usage (`game.js:35`):** ground tiling uses `w0000/w0001/w0002`; static props use `w0091, w0034, w0050, w0110, w0121`. All 17 terrain images are loaded regardless. Ground/terrain sprites may be adapted or cut in later phases, so treat the current ground rendering as placeholder.

---

## 9. Known gaps vs the GDD (from `.swarm/GDD-AUDIT.md`)

This is a summary of the existing audit, not new analysis.

**Engine divergence (recorded decision):** GDD §13 recommends Godot 4.x + GDScript; the build is vanilla HTML5 Canvas 2D. Per the instruction to preserve existing work, the roadmap continues on HTML5 rather than rewriting in Godot.

| Gate | Status | Essence |
|---|---|---|
| A — Combat fun test | PASS (mechanics) / PARTIAL (verification) | Movement, swing, block, HP, KO, hit flash, touch+keyboard present; phone smoothness unverified. |
| B — Party battle slice | PARTIAL | Recruit, F/H/C, 2 waves (6+8), 35/65 casualties, gold reward; no loot collection, no return-to-map, no cavalry. |
| C — Campaign loop | FAIL | Only local save/load; no map/travel/encounters/trade/food/wages/progression/patrols. |
| D — Full regional content | FAIL | 5 hardcoded roles, 1 arena; no 10 settlements / 15 troops / 3 maps / 4 quests / contracts / companion / reputation / endings. |
| E — Public-release quality | FAIL | No export/import, no audio, no tutorial, no device QA. |

**Area summaries:**
- **§5 Character & progression — ABSENT:** no creation (name/gender/backgrounds), attributes, HP formula, level cap 10, XP, 8 skills, equipment/inventory, or party-cap formula. Starting purse is 130 vs spec 60; no starter gear/food.
- **§6 Combat — PARTIAL:** flat damage (no armor formula); swing reach 67 px / ~135° vs spec 24 px / 90°; no windup/active/recovery phases; block ~135° and infinite vs 120° and one-hit; archer 245 px / 1.2 s / 240 px-s / perfect aim vs 110 / 1.6 s / 180 px-s / 60%; no cavalry charge; capture lacks time-skip/item protection.
- **§7 Troops & AI — ABSENT/PARTIAL:** no 15 data-driven troops, factions, tiers, armor, wages, upgrade trees, or XP; cavalry absent; charge has no bonus; no obstacle avoidance/separation; no explicit AI state machine; wounded don't count toward cap/wages; no auto-resolve/Tactics; only two waves (no 30/40 scaling or reserve stacks).
- **§3/4/8/9/10 World, story, settlements, economy, reputation — ABSENT:** no strategic map/travel, 10 named locations, patrols/caravans/bandits, encounter options, story quests/branching/endings, contracts, trade goods/market/food/wages/items, faction reputation, Mara companion, or post-ending sandbox.
- **§11/12/13 UI, art, tech — PARTIAL/ABSENT:** ~4 of 12 MVP screens; touch layout not 35% zone / 48 dp; no world layout; no audio; no JSON content layer; services unseparated; no scene flow beyond title/camp/battle/result; no manual export/import; no proximity grid; device QA undocumented.

---

## 10. Regression guard (manual smoke checklist)

Run this against a fresh browser profile (or after clearing `localStorage`) to confirm Gate A/B still work.

**Boot & title**
- [ ] `index.html` loads without console errors; canvas is 960×540 and pixel-scaled.
- [ ] Title overlay shows "CROWNLESS", Gate B subtitle, button "Prepare Party".
- [ ] HUD reads "CROWNLESS v0.3 · GATE B"; footer reads "PRE-ALPHA 0.3.0".

**Camp & recruitment**
- [ ] "Prepare Party" opens camp: "THE CAPTAIN'S CAMP", roster summary (130 crowns · 3 infantry · 2 archers · 0 wounded · 0 wins).
- [ ] Recruit infantry (−20) and archer (−25) update gold and roster; at 15 total both buttons disable.
- [ ] Recruiting then reloading the page preserves the roster (save key `crownless_v03_party`).

**Battle start**
- [ ] "Begin Battle" hides the overlay; hero + 3 infantry + 2 archers appear; Wave 1 spawns 6 enemies; message "Enemy wave 1 / 2".
- [ ] HUD summary shows allies/enemies/wave and hero HP 85/85.

**Gate A mechanics**
- [ ] WASD/arrows move the hero and change facing; joystick does the same on touch.
- [ ] Space/left-click swings an arc and damages a frontal enemy in reach (~0.49 s cooldown).
- [ ] Shift/right-click/hold Block shows a guard ring, slows movement, and negates frontal hits; attacks from behind still land; attack is disabled while blocking.
- [ ] Ally archers fire arrows that travel and damage enemies.
- [ ] Damaged units show HP bars; deaths flash/fall; impact rings render.

**Gate B party slice**
- [ ] `1`/`2` switch groups; `F`/`H`/`C` (and panel buttons) issue orders; message confirms; Hold units return to their hold point when no enemy is near.
- [ ] Clearing Wave 1 spawns Wave 2 (8 enemies) with message "Enemy wave 2 / 2".
- [ ] Clearing Wave 2 → "VICTORY"; gold increases by `52 + kills*3`; renown +4; casualties reported (≈35% killed / 65% wounded).
- [ ] Letting hero + all allies die → "CAPTURED"; gold drops 20%; battle count still increments.
- [ ] "Return to Camp" recovers wounded back into the active roster and updates the summary.

**Diagnostics**
- [ ] `F3` / "Logs" opens the panel with build, mode, units, FPS, assets, campaign.
- [ ] "Export JSON" and "Export TXT" download `crownless-debug-*.json/.txt`; "Clear" empties the event log.
- [ ] Asset status shows requested/loaded counts and an empty failed list after boot.

**Pause**
- [ ] `Esc` (or Pause) freezes play and shows "PAUSED"; toggling resumes. If the Orders panel is open, `Esc` closes it first.

---

## Source map

| Concern | Location |
|---|---|
| Build/save constants, canvas setup | `game.js:2` |
| Diagnostics object + global error handlers | `game.js:3–4` |
| Game state object | `game.js:5` |
| Campaign starter / load / save | `game.js:6–9` |
| Sprite loading + frame tables | `game.js:10–12` |
| Unit stats factory | `game.js:14` |
| Battle start, deployment, reset | `game.js:16` |
| Wave spawn composition | `game.js:17` |
| Mode transitions / overlay copy | `game.js:18` |
| Roster UI / recruit | `game.js:19–20` |
| Battle end, casualties, rewards/capture | `game.js:21` |
| Wounded recovery | `game.js:22` |
| Orders | `game.js:23` |
| Hit/block resolution | `game.js:24–25` |
| Attack + projectiles | `game.js:26` |
| Facing / movement | `game.js:27–28` |
| AI + order behavior | `game.js:29–31` |
| Update loop (input, arrows, wave/end checks) | `game.js:32–33` |
| Ground / unit / frame rendering | `game.js:34–37` |
| Pause / report / exports / debug render | `game.js:38–42` |
| Event wiring (buttons, keys, joystick) | `game.js:43–46` |
| Main loop / boot | `game.js:47–48` |
| Canvas element + HUD markup | `index.html:3` |
| Layout + responsive styles | `style.css:1` |
| GDD compliance audit | `.swarm/GDD-AUDIT.md` |
