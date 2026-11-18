# Crownless — Task specifications after 2.0

_Written 2026-11-18 at build 2.0.0. The detailed companion to [`NEXT-PLAN.md`](NEXT-PLAN.md): one specification per task, in the design's ticket format (design Part 2 §26.8), shortened to what a developer needs. NEXT-PLAN gives the order, the phases and the owner's decisions; this file gives what each task is._

**How to read a task:**
- **Problem:** what the player lacks today.
- **Now:** the code and data it starts from.
- **Build:** what to make.
- **Layers:** the default, one-decision and expert behaviour (design §2.5).
- **Save:** whether it needs a new schema step.
- **Edges:** failure, loss and exploit cases.
- **Out:** what is out of scope.
- **Tests and acceptance.**

**Size:**
- S: a day or two of work.
- M: a few days.
- L: a week or more.

**Versions:** each finished task bumps the minor version (2.1.0, 2.2.0, …) unless the owner decides otherwise (NEXT-PLAN §8).

**Every task follows the contract in NEXT-PLAN §7:**
- tests and lint green;
- checked in a real browser at desktop and phone size;
- docs and the version updated;
- no commits until the owner asks.

Phases 8 and 9 build on choices made earlier. Their specifications are as complete as can be written now, and each is re-checked when its phase starts.

---

## Phase W — A Bigger World

### W-01 · Text size and UI scale (M)

**Problem.** Text is fixed in size, and the page blocks pinch-zoom (`user-scalable=no`), so small text can't be enlarged. A bigger world will mean more labels and longer lists.

**Now.**
- Device settings are in `js/settings.js`: music, sfx, battleSize, battlefield, prepPreset, prepSkip, prepCustom, reducedEffects, healthBars, tips, fullscreen.
- CSS is in `style.css`: mostly `clamp()` sizes, plus fixed pixel sizes on panels.
- Canvas text (map labels, approach banners, minimap, battle HUD bits) is drawn in `js/render.js` with fixed fonts.
- `fitHud` in `js/ui.js` places the message line under the top-left panel.

**Build.**
- A device setting **Text size**: Small 0.9, Normal 1.0, Large 1.15, Larger 1.3. It is stored in `crownless_settings` and shown in Settings.
- A CSS custom property `--ui-scale` on `#stage`, applied to every font size and to button padding and minimum heights (with a minimum touch target of 40 CSS px).
- Panels that can grow taller than the screen scroll (Orders, Prepare panel, Accounts, Journal, Party).
- `CL.ui.scale()` for canvas text. Render uses it for every font it draws: map labels, banners, the minimap legend, prep labels and damage text, if any.
- `fitHud` recalculated on change; no reload needed.
- Pinch-zoom stays blocked in battles and on the map (touch controls). The text size is the accessibility answer.

**Layers.** Default Normal. One decision: pick a size. No expert layer.

**Save.** None (a device setting).

**Edges.**
- At the largest size on 812×375 nothing may overlap the joystick or the attack and block buttons. The HUD wraps or abbreviates instead: for example "Allies 12 · Enemies 9" becomes "12 v 9" at Larger.
- Long settlement names and soldier names must truncate with an ellipsis, not overflow.

**Out.** Languages; colour themes; dyslexia fonts (backlog).

**Tests.**
- **Unit:** the setting is validated and applied; `CL.ui.scale()` follows the setting.
- **Browser:** every screen at each size at 812×375 and desktop. Screenshot check of the title, map, settlement, Party, Accounts, Journal, Prepare, battle and result.
- **Phone:** owner check at Larger.

**Acceptance.** Every screen is usable at Larger on a phone; nothing is clipped or overlapping; text size changes take effect at once and persist.

---

### W-02 · World-map camera: pan and zoom (M)

**Problem.** The strategic map can't grow. It always shows the whole 0–100 space on the 960×540 canvas.

**Now.**
- `js/world.js` has a fixed `VIEW = { x0: 40, y0: 22, sx: 8.8, sy: 4.96 }`, with `toPx`/`fromPx` converting map units to canvas pixels.
- `click(px, py)` → `targetAt` hit-tests settlements, sites and parties with `HIT_RADIUS_PX` 28.
- `mapDist` uses the view's aspect, so a journey's time matches how far it looks.
- `drawWorld` in `js/render.js` draws the whole map every frame.
- The battle camera (`js/camera.js`: follow, snap, toScreen and toWorld) is separate.

**Build.**
- **A map camera** `g.mapCamera = { x, y, zoom }` in map units:
  - `toPx`/`fromPx` go through it;
  - it follows the party while travelling;
  - it eases, clamps to the map's bounds, and keeps the party in view.
- **Zoom levels:** 0.6×, 1×, 1.6×, 2.4×, relative to today's scale.
  - At 1× and today's map size the view is identical to 2.0. That's the regression baseline.
  - Mouse wheel, pinch on touch, and +/− buttons on the map HUD.
- **Pan:**
  - drag with one finger or the mouse;
  - a "Centre" button returns to the party;
  - tapping still means "travel there", told apart from a drag by movement under 8 px.
- **At every zoom:**
  - icons stay a readable size (drawn at a fixed pixel size, positions scaled);
  - labels fade out at low zoom except towns and capitals;
  - the hit radius stays 28 px on screen.
- **Edge markers** for the player's contract target, active quest bands and the player's own party when off-screen (the same idea as the battle edge markers).
- **Distances stay in map units.** `mapDist` keeps its aspect constant, so travel time doesn't change with zoom.
- **Settings:** the zoom level is remembered per device.

**Layers.** Default: follows the party at 1×. One decision: zoom out to plan. No expert layer.

**Save.** None; the camera is transient. The zoom level is a device setting.

**Edges.**
- A drag that ends on a settlement must not start travel.
- Pinch while travelling doesn't stop travel.
- The camera never shows outside the map.
- Contact with a band opens the encounter whatever the zoom.

**Out.**
- The bigger map itself (W-05).
- A separate "world overview" screen; zooming fully out serves that.

**Tests.**
- **Unit:**
  - `toPx(fromPx(p))` round-trips at every zoom;
  - hit-testing at every zoom;
  - drag versus tap;
  - clamping;
  - at 1× the projection equals 2.0's for every settlement.
- **Bots:** campaign and story bots unchanged.
- **Browser:** pinch is emulated with two pointers; the wheel; buttons.
- **Phone:** owner check.

**Acceptance.** At 1× the game plays exactly as 2.0. At every zoom, taps reach the right target and travel times are unchanged.

---

### W-03 · Battle zoom (S–M)

**Problem.** On a phone, large battles can feel cramped; on desktop, a wider view would help command.

**Now.**
- `js/camera.js`: world pixels to screen with a translation only (`toScreen`/`toWorld`).
- `js/tactics.js` overview: its own transform with scale (`{x, y, scale}`).
- Render culls by camera view.
- Input converts taps and clicks through the camera.

**Build.**
- **Camera scale:** `g.camera.zoom` from 0.75 to 1.5, used by `toScreen`/`toWorld`, `view`, `visible`, and the render transform (`ctx.setTransform`).
- **Controls:**
  - wheel on desktop;
  - pinch on touch, but only on the field: not on the joystick or the buttons;
  - a small zoom toggle button (1× ↔ 0.75×) for one-handed play.
- **Follow:** the camera keeps the hero inside the central area at every zoom; edge markers recomputed at each zoom.
- **Minimap:** shows the view rectangle at the current zoom.
- **Tactical overview:** keeps its own zoom-to-fit, plus pinch to zoom in on part of the field.
- **Remembered:** the zoom as a device setting.

**Layers.** Default 1×; one decision: zoom out.

**Save.** None.

**Edges.**
- Pinch must never fire an attack or move the joystick.
- At 0.75× on a large map, drawing cost rises: measure, and cap at 0.85× when "Reduced effects" is on, if needed.

**Out.** Free camera (detached from the hero) outside the overview.

**Tests.**
- **Unit:** conversions at each zoom; taps on the field at each zoom hit the right unit and spot; culling still exact.
- **Benchmark:** at 1× unchanged; at 0.75× measured.
- **Browser and phone checks.**

**Acceptance.** Attacks, taps and orders land correctly at every zoom, and the frame budget is kept at 0.75× on the phone.

---

### W-04 · A data-driven world (M)

**Problem.** The game can only be the Border March. A bigger world, more kingdoms, and later mods all need the world to be data.

**Now.**
- `MAP_ID = 'border_march'` in `js/world.js`.
- `FACTION_EMBLEM` in `js/render.js` (V, A, R).
- `FACTION_ORDER` in `js/troops.js`.
- The debug fort switch alternates valedorn and aurelian.
- Factions in `data/factions.js`: id, name, short, culture, colour, description, initialReputation, recruits, garrison.
- `realm.js`: kingdoms() comes from the faction data, and default owners from settlements' `ownerFaction`.
- Story data refers to kingdoms by id, which is fine: that's content.

**Build.**
- **A world package:**
  - `world_map` entries gain `factions` (the kingdoms in this world), `start`, `regions` (named areas for news and text), `bounds` (map size in map units) and `view` (default zoom and centre).
  - The game reads the campaign's `worldId` (saved since schema v3) to pick its package.
  - The first and only package stays `border_march`.
- **Kingdoms from data:**
  - faction data gains `emblem` (one letter or glyph) and an `order` for the troop tree;
  - render, the troop tree and debug read them;
  - debug "switch owner" cycles through the world's kingdoms.
- **Validation:**
  - every settlement's owner, every party template's faction and every recruit list point at this world's kingdoms;
  - the world's start settlement exists;
  - bounds hold every settlement and site.
- **A test world** (tests only, not shipped): three kingdoms with other names on a small map, proving nothing in code assumes two.
- **Namespaced ids** reserved: ids may contain `:` (for example `border_march:stonebridge`) without breaking validation or saves. They aren't used yet (Phase 9).

**Layers.** Not player-facing.

**Save.** None. `worldId` already exists.

**Edges.** A save of an unknown world is already refused by name (since 1.2.0).

**Out.** Mod loading (P9-07); multiple worlds selectable in the UI (P9-08).

**Tests.**
- A grep test: no kingdom or world id appears in `js/`.
- The three-kingdom test world loads, simulates 30 days with the campaign bot, and renders headless.
- All existing tests are unchanged.

**Acceptance.** The test world plays. The real game is unchanged byte for byte in its saves.

---

### W-05 · The bigger region (L)

**Problem.** Ten settlements and two kingdoms are too small for lords, holdings, sieges, wars and diplomacy to be tested or enjoyed.

**Now.**
- **Map:** 0–100 map units; two roads, one river, two forest areas, hills; 2 sites.
- **Settlements:** 10, with markets, gear lists, recruit lists, scarcity baselines and garrisons.
- **People:** 3 cultures in `data/names.js`; 16 troops; party templates: 3 bands, 2 patrols per kingdom, 1 caravan per kingdom.
- **Text:** news lines in `data/news.js`; contracts in `data/contracts.js`.
- **Battle maps:** chosen by terrain (`battleMapAt`).

**Build (proposed defaults; NEXT-PLAN §8).**
- **Size:**
  - **Map:** 0–200 × 0–200 map units, four times today's area, at the same travel scale (a map unit takes as long to cross as today).
  - The Border March is placed whole in the middle at an offset (for example +50, +50), so its settlements, roads, river, lairs and story distances are unchanged.
- **Kingdoms:** four, plus the Road Reavers and one free city. Working names, all data and easy to rename:
  - **Valedorn** (west of the March, as now) and **Aurelia** (east, as now);
  - **a northern kingdom** (highland and forest; a new culture; heavy infantry and axemen);
  - **a southern or coastal league** (marsh, coast and salt trade; a new culture; crossbowmen and light horse);
  - **the free city:** a neutral trade hub with mercenaries for hire and the best market.
- **Settlements:** about 32 in all:
  - each kingdom: one capital town (walkable later), two castles or forts, three to five villages;
  - the free city;
  - the March's ten keep their ids and owners.
- **Troops:** each new kingdom gets a full tree from tier 1 to tier 3 (five or six troops with upgrade paths, shields and brace flags, and a cavalry branch), names, and gear for its armouries.
- **Terrain:**
  - more forest and hills;
  - a mountain pass (slow, with a defensible chokepoint);
  - marsh (slow);
  - a coast edge;
  - rivers crossed only at fords and bridges, so routes matter and battles at crossings use a new battle map (a ford map, generated like the large maps).
- **Map content:**
  - more lairs and sites, two per region;
  - caravan routes between capitals and the free city;
  - patrols per kingdom scaled by holdings;
  - Reaver bands per region.
- **Text:**
  - news lines and region names;
  - contract boards in every capital and the free city;
  - fort garrisons;
  - market baselines for the new goods: two new trade goods, for example timber and wine.
- **Story:** the four quests and the errands stay as they are, inside the March. Two or three new errands in other regions show off the new places, using the existing quest interpreter.

**Layers.** Not a setting; it's the world.

**Save.** Content only. The move of old saves is W-06.

**Edges.**
- Travel times on long routes: the campaign bot and the economy report re-check food and wage pressure (W-08).
- Battle map choice for new terrain: every terrain maps to a battle map; nothing falls through to a default that looks wrong.

**Out.**
- Lords and named nobles (P8-01, P8-07).
- War between kingdoms beyond today's frontier clashes (W-07 adds simple war and peace).
- Art for new places: placeholder sprites from the existing set until the art team delivers.

**Tests.**
- Content validation (troop trees complete; every recruit list, garrison, market and gear list valid).
- Reachability: every settlement reachable by road or open ground; no settlement inside impassable terrain.
- Travel time between the two farthest capitals within a target (for example under 4 game days at base speed).
- The story and errands still pass; Gate D tests unchanged.
- Bots: campaign 60 days on the new map; Prototype G.

**Acceptance.** All of the above, plus an owner play session on the phone at W-02's zoom levels.

---

### W-06 · Saves move into the bigger world (M)

**Problem.** Every save so far has migrated forward. The bigger world must not strand anyone's campaign.

**Now.**
- Save schema v9, migrations 1 → 9 in `js/save.js`, and fixtures from real builds back to 0.3.
- Positions saved in map units: `c.world.x/y`, parties' `x/y/tx/ty`, sites' state, quest band anchors, the merchant's prices by settlement id.
- `worldId: 'border_march'`.

**Build.**
- **A schema step (v10):**
  - offset every saved position by the March's placement in the new map (W-05);
  - add the new kingdoms' reputation (neutral);
  - add owners for new holdings from content defaults;
  - add market scarcity for new markets;
  - start party spawns for new templates;
  - keep `worldId` the same, since the world grew rather than changed: it's still `border_march`, now bigger.
- **Fixtures** `tests/fixtures/saves-2.0/` from the real 2.0.0 build, made with `scripts/make-legacy-save-fixtures.js` in a throwaway checkout.
- **Contract targets and quest bands** in mid-hunt keep their positions after the offset; ambush and escort contracts still complete.

**Layers.** Invisible to the player, except a one-time note on load: "The world has grown: new kingdoms lie beyond the March."

**Save.** Yes: v10.

**Edges.**
- A save mid-travel (`g.travel` is transient, so that's fine).
- A save mid-encounter (results are committed by result ID, unaffected).
- A pre-migration copy is kept as for every step.

**Out.** Moving a save into a different world (Phase 9).

**Tests.**
- Every fixture set from 0.14 to 2.0 imports and loads from storage into v10 with the same soldiers, gold, day, quests and position relative to the March.
- Then it plays on with the campaign bot for 10 days.

**Acceptance.** No save from any build is lost or thinned. The player stands where they stood, relative to the March.

---

### W-07 · A world simulation that scales (M)

**Problem.** The world simulation was written for nine parties. A bigger world wants 40–80, and later lords and armies.

**Now.**
- `js/parties.js` `runSteps`: every 15 game minutes each party chooses a target and moves.
- `resolveContacts` checks bandit versus caravan or patrol pair by pair.
- `frontierClash` checks patrol pairs.
- Detection is distance to the player.
- `reinforce.plan` scans all parties.
- `drawWorld` draws everything.
- News: `js/news.js`; clashes only between Valedorn and Aurelia.

**Build.**
- **A spatial grid** over the map (cells of about 10 map units), rebuilt each step. Contacts, detection, chase targets and reinforcement planning query nearby cells only.
- **Budgets:** a cap on parties per region (spawn rules per region, not just per template); parties far from the player step less often (every hour instead of every 15 minutes) with the same outcomes on average. Fast-forward stays equivalent (design Part 2 §27.4: 90 days in one step is the same as 90 smaller steps).
- **Map-drawing culling** to the map camera (W-02).
- **War and peace between kingdoms:**
  - a small saved table `c.relations[kingdomA][kingdomB] = 'war' | 'peace'`;
  - clashes and news only between kingdoms at war;
  - wars start and end on simple rules (border incidents, exhaustion) with a news line;
  - this is the seed of Phase 9 diplomacy, kept minimal.
- **News and clashes** for any pair of kingdoms; news lines name regions.

**Layers.** Not a setting.

**Save.** Yes: `relations` (a small schema step, or folded into W-06's v10 if they ship together).

**Edges.**
- Determinism: the same seed gives the same world (seeded streams).
- No party skips a contact because of stepping less often: contacts near the player always use the fine step.

**Out.** Lords (P8-01); treaties (P9-02).

**Tests.**
- **Equivalence:** the grid returns exactly the contacts a full scan would (as the battle obstacle grid did).
- **Performance:** 80 parties over 90 days headless, with the step cost measured.
- **Determinism:** same seed, same world.
- **Rules:** war and peace start and end; news follows.

**Acceptance.** 60–80 parties run without slowdown spikes on the phone's map screen (owner check), and every existing bot passes.

---

### W-08 · Tuning and acceptance of the bigger world (S)

**Problem.** Longer distances change food, wages, contracts and danger.

**Build.**
- Run the economy report, campaign bot, story bot and Prototype G across the whole region for 60 days.
- Re-tune:
  - contract pay by distance;
  - food prices away from farms;
  - patrol and band density;
  - travel speed on roads versus open ground;
  - caravan effects on far markets.
- A short validation section added to `docs/NEXT-PLAN.md` (as V2-VALIDATION did for 2.0).
- Phone session.

**Acceptance.**
- Bots never stuck.
- The economy healthy by V2-T1's measures.
- The story still ends in all 200 runs.
- The owner has played a session on the phone.

---

## Phase 7 — The Living Company

### B-01 · Battle balance pass (M) — the owner's deferred goal

**Problem.** Fighting in person with a company wins almost every close battle (88–100% at 50–75% odds), so a strong fighter has nothing to turn. Owner, 2026-11-18: Simulate should be only slightly worse than fighting, and fighting yourself a bit more likely to win close battles.

**Now.**
- V2-T2 measured the gap with a fought-versus-auto parity script.
- Auto-resolve: company soldiers count ×1.5; winner's loss 0.2 × odds ratio.
- Fought battles are easy because of V2-08 (shields, cover, ranks) and enemy routs.
- Enemy bands (looters, reavers) have no shields; enemy patrols do.

**Build.**
- **Enemy tactics:**
  - enemy shield troops use cover and ranks as the company does;
  - enemy groups keep a loose line instead of streaming in one by one;
  - targeting prefers the exposed (archers, the wounded, the hero when alone).
- **Morale:**
  - enemy morale a little steadier (for example the outnumbered penalty halved for bands defending their lair);
  - check that the rout threshold doesn't hand the player easy wins.
- **Optionally,** Reaver bands get one shielded troop (a "Reaver shieldman", tier 2).
- **Check after the changes:**
  - Balanced and the hero-down charge;
  - the bot hero's fights;
  - keep the auto-resolve ×1.5 or lower it back toward 1.2 so the gap is 5–15 points.

**Layers.** None new.

**Save.** None (unless a new troop: content only).

**Edges.** SC-36 (ten fights on defaults won) must still hold; the presets should still differ.

**Tests.**
- **Parity:** the parity script as a project script (`scripts/parity.js`), with fought results 5–15 points over the stated odds in close fights.
- **Unit:** enemy cover works.
- **Re-runs:** Prototype G and the economy report.

**Acceptance.**
- The parity target is met by the bot.
- The owner's phone session confirms a close fight can be turned by fighting well.

---

### P7-01 · Surgeon (S–M)

**Problem.** Every battle kills soldiers at the GDD's fixed 35%, with nothing the player can do but fight better.

**Now.**
- `party.rollCasualties`: each fallen soldier dies at `DEATH_CHANCE` 0.35, else wounded for `WOUND_DAYS`.
- Followers framework: `c.followers` (quartermaster, merchant); wages paid at payday; hiring from the Accounts screen.

**Build.**
- **The follower:** a Surgeon hired in towns (60 crowns, 10 a week).
- **Supplies:** uses medicine, a new supply bought like food (the quartermaster can stock it under a per-good rule, the first such rule).
- **Triage after battle:**
  - with the surgeon and medicine, the death chance falls (for example 0.35 → 0.22);
  - wounds heal faster (2 days → 1.5);
  - each saved life costs one medicine;
  - triage reports names: "Surgeon Ada saved Tam Owl and Hob of Stonebridge."
- **Without medicine,** a smaller benefit.
- **Auto-resolve** uses the same rule.

**Layers.** Default: the surgeon just works. One decision: hire. Expert: a medicine reserve rule in the quartermaster.

**Save.** Yes (follower and medicine stock).

**Edges.**
- Capture: the surgeon's supplies may be taken.
- Unpaid: leaves as the others do.

**Out.** Treating the hero's injuries; disease.

**Tests.**
- Deaths per battle measured with and without, over the same seeds.
- Supplies are spent once; the report names the saved; save and reload.

**Acceptance.** Fewer deaths (measured), clearly reported, and costs a real upkeep.

---

### P7-02 · Scout (S–M)

**Problem.** The map shows every party in the region; there's no reason to scout. P7-04 adds limited vision and this follower makes it manageable.

**Build.**
- **The follower:** a Scout hired in towns or villages.
- **Effects:**
  - wider detection radius;
  - earlier warning of a party chasing you, with its size;
  - a route estimate when choosing a destination (days, danger: bands seen near the route);
  - better ambush odds for the player (a bigger deployment zone when you catch a band).
- **Reports** are honest about uncertainty ("about 8 Reavers").

**Layers.** Default: warnings appear. No decisions beyond hiring.

**Save.** Yes (follower).

**Edges.** No omniscience: only what's in range.

**Tests.**
- Detection radius with and without; warnings follow detection rules; route estimates match actual travel time within 10%.

**Acceptance.** As tests, plus the owner judges the warnings useful rather than noisy.

**Needs.** P7-04.

---

### P7-03 · Blacksmith (S)

**Problem.** Gear only comes from loot and armouries; there's no way to invest in a favoured soldier or the hero.

**Build.**
- **The follower:** a Blacksmith hired in towns.
- **Hero:** paid upgrades of the hero's weapon and armour (+1 tier of damage or armour, capped twice per item).
- **Soldiers:** a "fine kit" upgrade for up to five named soldiers (+armour); costs crowns and iron (a trade good).
- No durability, no decay (design §12.4).

**Save.** Yes (upgrades on items and soldiers).

**Edges.** Upgraded items sell for more, but never above the armoury's markup (no flipping).

**Tests.** Caps; costs; no money loop; save and reload.

**Acceptance.** Targeted, capped, optional.

---

### P7-04 · Pursuit and detection (M)

**Problem.** Parties see everything within a radius and chase in straight lines; the world has no hiding, searching or losing a pursuer.

**Now.** `parties.wantsPlayer` compares distance with the template's `detection`; `chooseTarget` chases the player's current position.

**Build.**
- **Vision:**
  - day and night (the clock has hours): night shortens sight;
  - terrain: forests hide, hills extend sight;
  - parties remember a **last-seen position** and go there, then search for a few hours before giving up.
- **The player:**
  - the company's visibility (larger companies are seen further);
  - a "Hide" stance when waiting in forest (harder to see, no travel);
  - pursuit warnings when a party is chasing.
- **Map:** shows parties only when seen by the company. Others fade to last-seen marks, as in battle (V2-06).
- **Routes:** prefer roads; an option "Avoid danger" picks a safer route at a time cost.

**Layers.** Default: it just happens; warnings explain. One decision: Hide or Avoid danger.

**Save.** Yes (last-seen positions, search timers).

**Edges.**
- Quest bands keep their behaviour (camp or ambush).
- Contracts' targets remain findable (their last known position is shown).

**Tests.**
- Each rule (forest hides, night shortens, last-seen chase, giving up).
- Bots still find contract targets; the story bot still finishes.

**Acceptance.** A band loses you in a forest; a patrol searches your last-seen spot; nothing becomes unfindable that a quest needs.

**Needs.** W-07.

---

### P7-05 · Officers and detached patrols (L)

**Problem.** The company is one party; nothing can be delegated; soldiers can't do anything without the hero.

**Now.**
- One roster `c.roster`; soldiers are named with records.
- Mara is the companion (`js/companion.js`), with a `send` and `recall` for the story.
- World parties come from templates.

**Build.**
- **Captains:** appoint Mara, a future companion (P7-06), or a veteran soldier (tier 3, at least 10 battles) as a captain.
- **Detachments:** a separate party on the map with a chosen set of soldiers (each soldier is in exactly one party).
- **Order package** (design §11.3): objective, area, constraints, resources and autonomy. Constraints are things like "avoid parties stronger than us", "retreat below half strength" and "return by day N"; resources are a food and wage budget from the company chest; autonomy is either "follow the order exactly" or "use judgement". Objectives:
  - patrol a road between two settlements;
  - hunt bands in an area;
  - escort a caravan;
  - garrison a village (later holdings).
- **The detachment's life:** it moves and fights with the world simulation's rules (auto-resolve), carrying soldiers' histories (battles count once). Wages and food come from its budget.
- **Reports:** a short report every day or on events ("Captain Tam: broke 6 Reavers near Oakford; two wounded"), and a final report on return.
- **Recall and merge:** at any time, by meeting it or by courier (delay); soldiers rejoin the roster.

**Layers.** Default: none (the company is one party). One decision: send a patrol with a preset order. Expert: constraints and budgets.

**Save.** Yes: detachments, orders and budgets.

**Edges** (SC-17, SC-18):
- a captain defeated returns wounded with survivors; casualties, equipment, wages and loyalty reconcile once;
- a detachment can't be in two battles (the V2-09 lock);
- desertion and pay per detachment.

**Out.** Armies (P9-05); vassals' parties (P8-01).

**Tests.**
- Soldier-in-exactly-one-party invariant; reconciliation once.
- Save and reload mid-order; Prototype C extended (a detached and returned soldier keeps their record).

**Acceptance.** SC-17 and SC-18 pass; a bot sends a patrol that hunts bands for a week and returns with consistent records.

**Needs.** W-07.

---

### P7-06 · More companions (M)

**Problem.** Mara is the only companion; captains and the later political game need people.

**Build.**
- Two or three companions (data in `data/companions.js`) found in different regions, each with:
  - a background;
  - a motive (for example coin, revenge, a cause);
  - a small recruitment quest using the interpreter.
- Each can be a captain (P7-05).
- **Loyalty:** a few factors (pay, victories, motive met or offended). Low loyalty means warnings, then leaving, never without warning (design §12.5).

**Save.** Yes (companions list).

**Tests.** Join, leave, lead a detachment; loyalty rules.

**Acceptance.** Each companion can be recruited, can lead, and can leave for stated reasons.

**Needs.** P7-05.

---

### P7-07 · Soldier traits (S)

**Problem.** Soldiers differ only by troop and record.

**Build.**
- **Two or three traits** with visible, measured effects and trade-offs (design §10.4):
  - **Steadfast:** a cohesion bonus for their group;
  - **Cautious:** less pursuit and fewer losses, but slower to engage;
  - **Impulsive:** earlier engagement, more kills, more wounds.
- **Earned at milestones,** not random spam: for example Steadfast after holding through a rout.
- Shown on the soldier card and the roll of honour.

**Save.** Yes (traits on soldiers).

**Tests.** Each trait's effect measured in battle tests; milestone triggers once.

**Acceptance.** Traits change battles measurably and are earned visibly.

---

### P7-08 · Dynamic world events (M)

**Problem.** The world reacts only through news lines and frontier clashes.

**Now.** `js/news.js` records events and bulletins; contracts are generated from templates; errands use the quest interpreter.

**Build.**
- **An event system** (data in `data/events.js`): conditions on world state (a region's scarcity, a lost caravan, wars), an effect on state, and a choice for the player when nearby.
- **First events:**
  - **food shortage** in a town (prices up; sell food for goodwill or profit);
  - **wolf or bandit infestation** in a region (more bands; a bounty);
  - **militia request** (a village asks for help against raiders; the reward is reputation);
  - **courier on the road** (carry a message for pay; may be ambushed);
  - **refugees** (food and recruits, at the cost of supplies).
- **Each event:**
  - resolves once (result ID, V2-02);
  - has a duration;
  - ignoring it has a stated consequence;
  - feeds the news, and the chronicle when the player takes part.

**Layers.** Default: events happen and are reported. One decision: take part or not.

**Save.** Yes (active events).

**Edges.** No event loops (cooldowns per region and kind); events never block the story.

**Tests.** Each event's trigger, resolution once, consequence of ignoring, and cooldown; 90-day bot runs without loops.

**Acceptance.** As tests; events show up in the news and the chronicle.

**Needs.** W-07.

---

### P7-09 · Tournament (M)

**Problem.** There's no way to win renown and coin without risking the company.

**Build.**
- **When and where:** a foot-melee duel bracket of eight, held in capital towns every couple of weeks (announced in the news).
- **Entry:** an entry fee; the hero only, with tournament gear (blunted).
- **Fights:**
  - one-on-one in a small arena (a new one-screen battle map);
  - the existing duel mechanics (swing, block, timing);
  - AI opponents with levels.
- **Rewards:**
  - prizes in crowns and renown;
  - a chronicle line;
  - reputation with the host kingdom;
  - a named rival who may meet you again.
- **Losing:** costs the fee and a little renown, no wounds to the company.

**Layers.** Optional by nature.

**Save.** Yes (schedule, rival).

**Edges.** No farm: a cooldown per town, prizes that fall with repeated wins in one town, and fees that rise with renown.

**Tests.** Bracket logic; prize and fee bounds; no infinite reward; AI difficulty curve.

**Acceptance.** A playable bracket on touch; the anti-farm rules hold.

---

### P7-10 · First business: a mill (M)

**Problem.** Money comes only from fighting and trading; there's nothing to build.

**Build.**
- **Buying:** a mill bought in a village or town, a few hundred crowns.
- **Running it:**
  - a manager (hired or default) runs it;
  - it buys grain locally and sells flour, through the same market functions (scarcity included);
  - income and expenses in the ledger, under its own budget account (V2-11).
- **Reports:** weekly. Bad weeks and their causes (grain scarce, war, raids) are reported, with no magic profit.
- **War:** when the settlement changes hands, the new owner's law applies (a tax, or seizure if Hostile), with a warning before and the option to sell. It never vanishes silently (SC-16).
- **Later:** an inn as the second business type.

**Layers.** Default: the default manager. One decision: buy or sell. Expert: price rules for the manager.

**Save.** Yes (business, budget account).

**Edges.** No infinite money (input-limited, market-limited); selling returns a fair value, not more than the price paid.

**Tests.** Ledger exactness over 90 days; no money loop; the war-change cases (SC-15, SC-40).

**Acceptance.** Runs without daily clicks, reports costs and failures, and survives changes of owner by the rules.

**Needs.** V2-11, W-05.

---

### P7-11 · Battle extras (M)

**Problem.** Battles have one kind of goal (beat everyone) and few terrain effects.

**Build.**
- **Formations:**
  - **shield wall:** infantry on Hold close up, shields up more, slower;
  - **wedge:** cavalry or infantry charge in a point.
- **One battle objective:**
  - protect a wagon (escort contracts and ambushes): lose the wagon and you lose the contract even if you win;
  - or hold a point for N seconds against waves (militia requests).
- **Terrain:**
  - hills give archers range and slow climbers;
  - fords slow everyone and break formations (the W-05 ford map).

**Layers.** Default: Balanced does the right thing. Expert: pick a formation in Orders.

**Save.** None.

**Tests.** Each effect measured under the same rules (SC-42); objectives' win and loss.

**Acceptance.** Each makes a measurable difference, and none is required.

**Needs.** B-01.

---

### P7-T · Phase 7 tuning and acceptance (S)

**Build.**
- Prototype G across the bigger world with the new followers and officers.
- The design exit as a scripted scenario: an independent company with a surgeon and a merchant, a detached patrol, a business, and dynamic events met, over 90 days, without a title.
- Economy and battle passes.
- A validation section.

**Acceptance.** The exit holds in the bot and in the owner's play.

---

## Phase 8 — The Landed World

### P8-01 · Lords on the map (M)

**Problem.** Kingdoms are faceless: anonymous patrols and caravans.

**Build.**
- **Named lords** (persons with ids, culture names and a home holding) lead the kingdoms' parties: patrol, hunt bands, escort, gather for war.
- **Simple goals** shown on hover or tap ("riding to Greywall to muster").
- **Fights:** lords can be met, talked to, fought, captured and ransomed or released (design §20.6). Captured lords are held at a holding, not in the player's party, until P8-02.
- **Patrol templates** remain for small fry.

**Save.** Yes (lords, their parties, captives).

**Tests.**
- Lords' intentions are consistent; capture and ransom once.
- No lord in two battles (the V2-09 lock).

**Acceptance.** Lords move with readable intent, and can be fought and captured.

**Needs.** W-07.

---

### P8-02 · Holdings model (M)

**Problem.** `c.owners` gives each fort one owner; titles, occupation and private ownership can't differ.

**Build.**
- **Per holding** (fort, town, village): sovereign realm, legal holder (a person), occupier (who controls it now), administrator (a castellan), and private owners of businesses inside (design §17.1, §24.2).
- **A save migration** from `c.owners` (the sovereign is the old owner; the holder is a lord of that kingdom).
- **APIs** that answer "who controls / who holds / who may tax"; story conditions keep working (`owner` means sovereign).

**Save.** Yes (holdings replace owners).

**Tests.** Every transition (grant, conquest, occupation, return) without duplicates; old conditions still true.

**Acceptance.** Every place has clear, separate holder and occupier.

**Needs.** W-04.

---

### P8-03 · Permissions (S)

**Build.** One function, `may(person, action, place)`, computed from oaths, offices and ownership (design §4.3), used by every action that needs a right: recruit, tax, garrison, build, enter. A table of cases.

**Tests.** The case table.

**Acceptance.** No code checks "is the player a king".

---

### P8-04 · Allegiance (M)

**Build.**
- **The player's allegiance:** independent, mercenary contract (paid service for a period), sworn vassal (with obligations), rebel, sovereign, deposed (design §16).
- **Joining, leaving and switching:** a preview of consequences before confirming (reputation, holdings at stake, obligations, enemies made) (design §22.5).
- **Obligations:** muster when called, service days; refusing has stated costs.

**Save.** Yes (allegiance, obligations).

**Edges.** Switching never loses personal property or the warband; the mercenary contract ends cleanly.

**Tests.** Each switch's preview matches the outcome; obligations tracked.

**Acceptance.** As tests.

**Needs.** P8-02.

---

### P8-05 · Fiefs and castellans (M)

**Build.**
- **Getting a holding:** granted by a ruler for service, or taken by conquest (P8-06).
- **Administration:** a castellan or steward with policies:
  - garrison size and pay;
  - tax stance (low, normal, high, with unrest);
  - reserves;
  - repairs.
- **A default steward** keeps it running hands-off.
- **Money:** revenue and costs through accounts (a holding's own budget account); weekly report.

**Save.** Yes.

**Edges.** Unpaid garrisons desert; high taxes cause unrest (warnings first).

**Tests.** Ledger exactness; hands-off for 90 days without collapse.

**Acceptance.** Works with defaults, and policies matter measurably.

**Needs.** P8-02, V2-11.

---

### P8-06 · Sieges (L)

**Build.**
- **Phases** (design §20.4–20.6):
  1. **Encirclement:** the besieger's party or army at the holding.
  2. **Preparation:** days pass; ladders and a ram built; the defenders' food falls.
  3. **One assault:** a new siege battle map with walls, gate and ladders; defenders on walls; the existing battle systems.
  4. **Resolution:** capture, surrender (when starving), or the siege lifted.
- **Relief armies** arrive by the reinforcement rules.
- **Afterwards:** capture and ransom of lords; the holder and occupier change by the P8-02 rules.

**Save.** Yes (sieges in progress).

**Edges.**
- Anti-snowball (design §20.7): garrisons rebuild, and conquered places are unstable for a while.
- The phone budget on the assault map.

**Tests.** Every outcome; no softlock; phone performance.

**Acceptance.** A siege can be won, lost, lifted or surrendered.

**Needs.** P8-01, V2-09.

---

### P8-07 · Named nobles (M)

**Build.**
- **A handful of nobles per kingdom** (from P8-01's lords) with four factors (design §28): relationship, interest, obligation and fear.
- **Decisions on orders and petitions:** obey, negotiate or refuse, with reasons the player can read (Prototype F).
- **Their own goals:** they petition the player (if a ruler or ally) or the ruler.

**Save.** Yes.

**Tests.** Prototype F: the same risky order to two nobles gives different, explained answers.

**Acceptance.** As Prototype F.

**Needs.** P8-01, P8-04.

---

### P8-08 · Losing and retaking land (M)

**Build.**
- **Losing:** a holding lost while away (besieged by AI armies).
- **Claims** persist by default (law-dependent later).
- **The landless captain carries on:** warband, money, businesses (SC-20–23).
- **Retaking:** by siege or by petition.
- **Prototype D** as a scripted scenario and a playable debug start.

**Save.** Yes (claims).

**Tests.** Prototype D end to end: gain Greywall, lose it, carry on, switch allegiance, retake it, in one save.

**Acceptance.** Prototype D passes.

**Needs.** P8-02–P8-06.

---

### P8-T · Phase 8 tuning and acceptance (S)

**Build.** Revenue and war pace; anti-snowball checks; 90-day bots; Prototype G with a landed player; validation section.

**Version.** **3.0.0** (proposed).

---

## Phase 9 — Kingdoms & Houses

### P9-01 · Realms as organisations (M)

**Build.**
- **The realm:** a treasury (budget account), laws (taxes, inheritance stance), and offices (marshal, steward, chancellor) held by persons.
- The ruler's personal wealth stays separate from the realm's (Part 2 §18.1).
- Realm income and costs reported.

**Save.** Yes.

**Acceptance.** Every realm has accounts and offices that matter.

---

### P9-02 · Diplomacy and treaties (M)

**Build.**
- **Treaties:** war, peace, truce, alliance and trade access, with durations and breach rules.
- **AI kingdoms** make and break them for stated reasons.
- **The player** negotiates as a ruler or an envoy.
- **Reputation** reacts to breaches (SC-25).
- Grows from W-07's war and peace table.

**Save.** Yes.

**Acceptance.** Treaties expire and break consistently (SC-25).

---

### P9-03 · Founding or taking a kingdom (M)

**Build.**
- **Claiming:** declare a realm from held land, with recognition and enforcement separate from the claim (Part 2 §28).
- **The new realm:** vassals by grant; delegated authority so ruling never forces a management screen (SC-41).

**Acceptance.** A player kingdom with vassals runs while the player fights in person (SC-41).

---

### P9-04 · Rebellion and deposition (L)

**Build.**
- **Nobles:** ambitions and claimants; escalating warning signs with uncertain details (Part 2 §28); civil war.
- **Deposition is not game over:** the deposed keep person and warband, and can seek refuge with old enemies or fight for restoration (SC-26, SC-27).

**Acceptance.** SC-26 and SC-27 pass.

---

### P9-05 · Armies and campaigns (L)

**Build.**
- **Armies** gathered from lords' retinues and the player's company.
- **On the move:** muster, march (slower, needs supply), sieges and field battles.
- **Large battles** through the battle-size cap and reserves; the phone budget kept.

**Acceptance.** A campaign of several sieges without a stall or a snowball, within the phone's budget.

---

### P9-06 · Houses, marriage and claims (M)

**Build.**
- **The founding house:** the player's house, its members (spouse, heirs as persons), and its claims.
- **Marriages:** as alliances, by negotiation.
- **Rival houses.**
- **Generational play** optional and later (no forced aging) (Part 2 §19).

**Acceptance.** Marriage changes relations and claims consistently.

---

### P9-07 · Modding: a declarative content format (M)

**Build.**
- **The format:** the world manifest (W-04) published as a format; namespaced ids; data-only packs (troops, items, settlements, quests, dialogue, names).
- **Import:** validation; safe import (no code); a pack list in Settings.
- **Compatibility errors:** SC-33's protections extended to packs (a save naming a removed pack's content is kept and explained).

**Acceptance.** A sample pack adds a troop line and a settlement without code; removing it gives a precise error.

**Needs.** W-04.

---

### P9-08 · Creator tools and a second world (L)

**Build.**
- **Tools:** a pack checker (CLI), and a map preview that draws a world package.
- **A second official world:** smaller, with its own kingdoms, to prove the format (Part 2 §23.1).

**Acceptance.** The second world plays end to end with the same bots.

---

### P9-T · Phase 9 tuning and acceptance (M)

**Build.**
- Long runs: SC-29, 100 simulated years with no money exploits, ownership collisions or event loops.
- Ruler fatigue (SC-41).
- The full scenario matrix SC-01–42.

**Version.** **4.0.0** (proposed).
