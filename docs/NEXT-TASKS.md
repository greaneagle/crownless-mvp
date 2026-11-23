# Crownless — Task specifications after 2.0

_Written 2026-11-18 at build 2.0.0; **reviewed and corrected the same day against commit c66d94c** (NEXT-PLAN §11); **Phase 8 re-specified 2026-11-20 at build 2.23.0** (NEXT-PLAN §5, §11 items 21–28). The detailed companion to [`NEXT-PLAN.md`](NEXT-PLAN.md): one specification per task, in the design's ticket format (design Part 2 §26.8), shortened to what a developer needs. NEXT-PLAN gives the order, readiness, schema steps and the owner's decisions; this file gives what each task is._

**How to read a task:**
- **Readiness:**
  - **Ready:** implement now.
  - **Ready after decision:** waits on an owner decision in NEXT-PLAN §8.
  - **Specified:** detailed, re-checked when the task starts.
  - **Provisional:** an outline to be specified when its phase starts.
- **Problem:** what's missing.
- **Now:** the code it starts from, verified at c66d94c.
- **Build:** what to make.
- **Layers:** the default, one-decision and expert behaviour (design §2.5).
- **Save:** whether it needs a schema step.
- **Edges:** failure, loss and exploit cases.
- **Out:** what is out of scope.
- **Tests and acceptance.**

**Sizes:**
- S: a day or two of work.
- M: three to five days.
- L: a week or more.
- Ranges (M–L) mean the low end assumes no surprises.

**Every task follows the contract in NEXT-PLAN §7.** Green Node and browser tests and lint; new tests for new logic, screens and saved state; checked in a real browser at desktop and 812×375; help text and debug tools; an asset request list when it adds art needs; version and docs updated; no commits, pushes, tags or pull requests until the owner asks.

---

## Phase W — A Bigger World

### W-00 · Browser regression testing (M–L, 5–8 days) — ✅ Done in 2.1.0

**Done (2.1.0, 2026-11-18).** As specified, with these notes:
- **Tooling:** `@playwright/test` 1.64.1 (pinned, `package-lock.json` committed). The test server is `scripts/static-server.js` (no dependency, no cache) instead of `http-server` through `npx`, so Playwright starts it the same way offline and in CI.
- **Specs** in `tests/browser/` (43 behaviour tests on desktop and on the phone = 86, plus 5 screenshot tests on each): `startup`, `load-save`, `world-map`, `settlement`, `battle`, `save-export`, `layout`, plus `screens.visual` (@visual). Helpers: `open`, `newGame`, `press`/`pressAt` (a click on desktop, a touch tap on the phone), `touch` (raw multi-finger touch through the DevTools protocol, for held controls, the joystick and W-02's pinch), `hold`, `mapToPage`, `debug` and `expectLayoutSound` (with `info` elements and `scrolled` panels).
- **Determinism:** seeded `Math.random`, Playwright's clock, fixed settings (tips and full screen off), and developer tools hidden as on the published site. Map travel advances with real frame time, so where roaming parties meet isn't repeatable: specs that travel clear the roaming parties first (Debug → Clear all parties).
- **Fixtures:** `tests/fixtures/saves-2.0/` made from the real 2.0.0 build (0415109) here, before any content change, as W-06 needs. They are also in `tests/save-migration.test.js`.
- **Bugs found and fixed:** on a 812×375 phone the Orders panel grew up under the Pause button, which covered its close button (`style.css`: the panel now stops below the top-right buttons and scrolls); and the hero started a battle with the random 0–0.4 s cooldown meant to stagger the AI, so an Attack pressed in the first moments outlasted the 100 ms input buffer and was lost (`js/combat.js`, with a Node test).
- **Screenshots:** baselines only from Linux Chromium (D-T2), made with `npm run test:visual:docker` or the workflow's "update screenshots" run; until they are committed, each screen is skipped with a note.
- **Deliberate-break check:** with the Orders button's handler removed and the joystick's move handler unbound, exactly the Orders specs (both projects, behaviour and layout) and the phone joystick spec failed; reverted.
- **Timing:** about 55 s for the behaviour suite with two workers on the development machine.


**Problem.** The 528 Node tests cover the game's logic, but rendering, input, mobile gestures and layout are only checked by hand in a browser. W-01, W-02 and W-03 change exactly those.

**Now.**
- The game is a static page: `index.html`, classic scripts, a canvas, HTML panels. `npm run serve` serves it with `http-server` through `npx`.
- The game exposes its state as `window.Crownless` (CL): campaign, game, save, storage, ui. Saves live in `localStorage` (`crownless_save`, `crownless_save_backup`, `crownless_settings`).
- Real-build save fixtures are in `tests/fixtures/saves-*`.
- CI: the `check` job in `.github/workflows/deploy.yml` runs `npm test` and `npm run lint`, then deploys.
- The project has no `package.json` dependencies and no lockfile.

**Build.**
- **Tooling** (owner decision D-T1):
  - `@playwright/test` as a pinned **development** dependency, with a committed `package-lock.json`. The game ships unchanged and still has no runtime dependencies.
  - `playwright.config.js` starts the static server (`http-server` on a free port, no cache) and runs Chromium.
  - Two projects: **desktop** (1280×720, mouse) and **phone landscape** (812×375, `hasTouch`, `isMobile`, device scale 3).
  - One more phone size later where it matters (667×375 and 915×412 for W-01).
- **Deterministic setup:** helpers in `tests/browser/helpers.js`:
  - start from an empty `localStorage`, or put a known fixture save into it before load (`addInitScript`); the `saves-1.15` and `saves-2.0` fixtures, and a "fresh campaign" made by the game itself;
  - fix `Math.random` with a seeded function and fix time with Playwright's clock (`page.clock`), so the game loop and animations are repeatable;
  - write a fixed `crownless_settings` before load:
    - tips off, so tip cards don't cover taps (one spec turns them on to test them);
    - full screen off, since `js/fullscreen.js` requests full screen on any touch `pointerup`;
    - a fixed battle size;
  - read state through `window.Crownless` for assertions, rather than reading pixels;
  - drive the canvas by coordinates computed from game positions (`CL.world.toPx`, and the camera from W-02);
  - no test calls game functions to skip the interaction it's testing.
- **Flows covered** (each a short spec in `tests/browser/`):
  1. **Startup:** the page loads without console errors, the title screen shows the version, Continue is offered when a save exists.
  2. **Character creation:** name, presentation, background, cloak, begin; the first settlement opens.
  3. **Loading an existing save:** a fixture save loads into the right day, gold, soldiers and place; a damaged or incompatible save shows its notice (SC-31, SC-33).
  4. **World map:** a tap on a settlement starts travel and arrives; a tap on a party opens the encounter; Pause and Wait.
  5. **Settlement:** menu buttons (recruit, buy food, contracts, accounts, journal, party); Walk the streets in Stonebridge and talk to an NPC by tap.
  6. **Mouse and touch:** the same map and menu flows with mouse clicks (desktop) and touch taps (phone).
  7. **Battle:**
     - Attack → Prepare → Fight;
     - joystick movement and keyboard WASD;
     - Attack and Block buttons;
     - Orders panel (group, order, Rally);
     - minimap tap, MAP overview;
     - the battle ends in a result screen.
     
     Debug-panel battles may be used to reach a battle quickly, but the controls are driven by real input.
  8. **Save, export and import:**
     - Save now writes `localStorage`;
     - Export is intercepted with Playwright's download API (nothing leaves the machine);
     - Import from a file and from pasted text;
     - a damaged file is refused with its message;
     - Restore works.
  9. **Responsive layout** at desktop and 812×375. Key controls (joystick, Attack, Block, Orders, top-right buttons, the message line) must be:
     - inside the viewport;
     - not overlapping each other (bounding-box checks);
     - at least 44×44 CSS px for touch.
  10. **Hooks for W-01 and W-02:** the layout checks are written as a reusable helper (`expectLayoutSound(page, screen)`), so W-01 runs them at four text sizes and W-02 adds gesture specs.
- **Screenshots (visual regression):**
  - Playwright `toHaveScreenshot` for important screens: title, map, settlement menu, Party, Accounts, Journal, Prepare, battle, result. Each at desktop and phone.
  - Animated or random parts are masked (the message line, unit sprites in battle if needed). A small pixel tolerance.
  - **Baselines come from CI's Linux Chromium only** (decision D-T2): fonts and rendering differ between machines.
  - Locally, `npm run test:browser` runs behaviour tests, and `npm run test:visual` compares screenshots when baselines exist for that platform.
  - `npm run test:visual:update` regenerates them, inside the Playwright Docker image or through a CI workflow run that uploads new baselines as an artifact.
- **CI:**
  - a `browser` job (parallel to `check`): `npm ci`, `npx playwright install --with-deps chromium`, `npm run test:browser`;
  - the HTML report and failure screenshots and traces uploaded as artifacts;
  - `deploy` needs both jobs;
  - the browser download is cached;
  - `playwright-report/` and `test-results/` go in `.gitignore`. The deploy job uploads a clean checkout, so nothing from a test run or `node_modules` is published.
- **Documentation:** a "Browser tests" section in the README:
  - install (`npm ci`, `npx playwright install chromium`);
  - commands;
  - how to update screenshots and when (only for intended visual changes, reviewed in the pull request or commit diff);
  - how to add a spec;
  - the rule: a task that changes UI or input adds or updates browser specs.

**Layers.** Not player-facing.

**Save.** None.

**Edges.**
- **Flakiness:**
  - waits are on state (`window.Crownless.game.mode === 'battle'`), never on fixed sleeps;
  - the clock is controlled;
  - each test gets a fresh browser context, so storage is isolated.
- **Time:** the browser suite should stay under about 3 minutes in CI; slow flows are tagged and can run nightly if needed.
- **The real `localStorage` of a developer's own browser is never touched.** Playwright uses its own profile.

**Out.**
- Firefox and WebKit (later, if needed).
- Real-device testing; the owner's phone stays the final check.
- Performance tests in the browser (Debug-panel tests cover the phone).

**Tests (of the task itself).**
- The suite runs green locally on Windows (behaviour) and in CI (behaviour and screenshots).
- A deliberate break is detected and then reverted: removing the Orders button's handler, or making map taps start travel twice.

**Acceptance.**
- The browser suite runs in CI on every push and pull request and blocks deploy when it fails.
- It detects broken interactions (shown by the deliberate-break check).
- W-01 and W-02 can extend it with their own specs.
- The Node logic tests are unchanged and still run as before.
- Tooling, commands and maintenance are documented.

---

### H-01 · Test and measurement hygiene (S) — ✅ Done in 2.1.1

**Done (2.1.1, 2026-11-18).** As specified, with these notes:
- **The leak:** every test game's sandbox was handed the host process's own `Math`, so a game loaded without a `random` drew from the host `Math.random`, and a script that patched it (as the V2-T2 parity runs did) made a seed's result depend on what ran before (seen: a seeded 8-day expert campaign changed after another seed ran first). `tests/helpers/load.js` now gives each game the context's own `Math`, with `Math.random` the test's `random` or else mulberry32 seeded from the game's `seed`, so every test game is reproducible. Seeded campaigns and battles give exactly the results they gave before. No other shared state was found: `BATTLE.activeCap` and module caches live inside each sandbox.
- **Isolation test:** `tests/isolation.test.js` fights a seeded battle (`tests/helpers/seeded-fight.js`) in a fresh child process and again in this one after other games and with the host `Math.random` patched, and requires equal results; a second test checks each game's `Math` is its own. Both fail on the old loader.
- **Fast and slow:** `npm test` is down from about 22 s to 8 s (531 tests). The bot-heavy ones moved to `tests/slow/` (`npm run test:slow`, 4 tests, about 17 s): the 60-seed story check and the after-the-ending check (from `gate-d.test.js`), the eight-seed stall check (from `acceptance.test.js`) and the short Prototype G (from `v2-acceptance.test.js`). CI's `check` job runs both; `npm run test:all` runs both locally.
- **`scripts/parity.js`** (`npm run parity`): five encounters from a lone hero to a ten-a-side fight, each fought by the campaign bot's hero and auto-resolved from the same seeded game, 40 hash-spread seeds by default; prints the stated odds, both win rates, soldiers lost and the gap. At 2.1.1 with 20 seeds (Balanced): fought 19–34 points over the stated odds, auto-resolve on them — B-01's baseline.
- **`scripts/bench-map.js`** (`npm run bench:map`): world simulation per game hour for 10–200 parties. On the development machine: 0.8 ms at 10 parties, 3.9 ms at 50, 10 ms at 100, 27 ms at 200, growing faster than linearly (pairwise contacts); 4 game hours pass per real second of travel. W-07's baseline.
- **`.gitattributes`** (`* text=auto eol=lf`): every text file in the index was already LF, and renormalising changed no file's content.

**Problem.** B-01, W-07 and W-08 depend on measurements, and those were noisy in V2-T2: test games in one Node process leaked state into each other, so results depended on run order. Bot-heavy tests will slow `npm test` as the world grows.

**Now.**
- `tests/helpers/load.js` builds a vm sandbox per `loadGame`, but some state is shared across instances.
- The fought-versus-auto parity script and the map timing exist only as scratch scripts.
- `npm test` takes about 21 s.

**Build.**
- **Find and fix the leak:** for example a module-level cache, `Math.random` patched on a shared realm, or the shared `CL.combat.BATTLE.activeCap`. Add a test that runs the same seeded fight in a fresh process and after other games in one process, and requires equal results.
- **Fast and slow tests:**
  - `npm test` keeps the fast logic tests;
  - bot-heavy tests (Prototype G, long campaigns, the story bot at 60 seeds) move under `npm run test:slow`, which CI also runs.
- **`scripts/parity.js`:** the same encounters fought by the bot and auto-resolved (from V2-T2), with seed spreading done right (consecutive seeds correlate the first draws).
- **`scripts/bench-map.js`:** world-simulation cost per game hour, for N parties.
- **`.gitattributes`** (`* text=auto eol=lf`) so the repository stays LF and the commit warnings stop. Check that no file changes content when this lands.

**Save.** None.

**Acceptance.**
- The isolation test passes.
- `npm test` stays fast; `npm run test:slow` and CI cover the rest.
- Both scripts run and are documented in the README.

---

### W-01 · Text size and UI scale (M) — ✅ Done in 2.2.0

**Done (2.2.0, 2026-11-18).** As specified, with these notes:
- **Setting:** `textSize` in `crownless_settings` (Small 0.9, Normal 1, Large 1.15, Larger 1.3), first in Settings; older settings without it get Normal. `CL.settings.textScale()` and `CL.settings.font(px, { weight, family })` (also `CL.ui.font`), so the canvas font helper is testable in Node.
- **HTML:** `--ui-scale` and `--ui-grow` (the same, never below 1) are set on `:root`, not `#stage`, because the Settings, Help and Debug panels live outside the stage. Every pixel font size in `style.css` is written against `--ui-scale` (a Node test enforces it), paddings and px line heights too; minimum sizes against `--ui-grow`. The phone `max-height: 430px` rules scale the same way. Text inputs never drop below 16 px (iOS zooms on focus below that).
- **Canvas:** every font in `js/render.js` comes from `font()` (a Node test forbids literal canvas fonts), and the boxes around text grow with it (the talk banner, the riders-in banners, map label boxes, count badges, Prepare's group flags, PAUSED now centred). Only the letters inside the flag and party-marker icons stay fixed (`fixedFont`), as part of the art.
- **HUD:** at Larger the top-left line takes a short form ("14 v 15 · Wave 1/1 · Res 3/0"; on the map "60 cr · 5 men · … mor. 70"); numbers are never shortened. Nothing in the game is truncated: long names and lines wrap.
- **Layout fixes found by the new checks** (several were wrong at Normal too): on touch every button, select, summary and slider is at least 44×44 (Settings' buttons and sliders, the Party "Remove" buttons and the soldier upgrade buttons were 35–41 px); the menu's bottom row (Leave, Back, Continue) sticks to the bottom of a scrolling menu, so it is always on screen (at Large and Larger on a desktop it fell below the fold); the HUD re-fits when its panels change size (a ResizeObserver: "Wait" → "Stop waiting" let the top-left panel run under the buttons); Prepare's action buttons size to their labels ("Simulate · 68%" spilled out at every size); buttons in list rows no longer shrink below their labels.
- **Battle controls:** the round buttons (already 66–136 px) keep their size and give their whole width to the label, so the Orders panel keeps its room. On a 375 px-tall phone at Larger the Orders panel shows its first two rows and scrolls within itself for the rest; it never covers the joystick, Attack or Block (tested). For the owner's phone check.
- **Tests:** `tests/text-size.test.js` (the setting, `font()`, the CSS and canvas rules); `tests/browser/text-size.spec.js`: every key screen (title, settlement, Accounts, Journal, Party and a soldier's card, the map, Settings, an encounter, Prepare, battle with Orders open, the result) at all four sizes on both projects, at Larger on 667×375, 740×360, 844×390 and 915×412, and with the desktop zoomed to 150% (853×480); each sweeps every visible control (in the viewport once scrolled to, 44×44 on touch, no label spilling out); canvas labels drawn at the scaled size; a change applies at once and persists; a change mid-battle doesn't pause or disturb it. Screenshots: four main screens at Larger added to `screens.visual`; the battle shots now hide the canvas instead of masking it (a mask painted over the HUD and controls too, so the W-00 battle shot compared nothing).
- **D-R1 (measurement only):** Debug panel → **Sharp canvas** draws into a `min(devicePixelRatio, 2)` × 960×540 backing store (not saved; input unaffected), and the practice-battle result now names the canvas mode and text size beside the drawing time. The default stays 960×540. **The phone numbers are the owner's:** Big battle 40 + help with Sharp canvas off and on, at Larger.
- **Not done:** `title` hint text: the only informative one in play (Rally) is already in How to play and shown as the countdown in Orders.

**Problem.** Text is fixed in size, and the page blocks browser zoom, so small text can't be enlarged. A bigger world will mean more labels and longer lists.

**Now.**
- Device settings live in `js/settings.js`.
- CSS is in `style.css`: mostly `clamp()` sizes, plus fixed pixel sizes on panels.
- Canvas text (map labels, approach banners, minimap, battle HUD bits, Prepare-screen labels) is drawn in `js/render.js` with fixed fonts.
- `fitHud` in `js/ui.js` places the message line under the top-left panel.
- The page sets `user-scalable=no` and `touch-action:none`, so pinch would otherwise zoom the page during battle and map gestures.

**Build.**
- **A device setting, Text size:** Small 0.9, Normal 1.0, Large 1.15, Larger 1.3. Stored in `crownless_settings`, shown in Settings, applied **at once without a reload**.
- **What it covers:**
  - HTML text: HUD, menus, panels, overlays, the tip cards, the help and settings panels, button labels, tooltips' text (`title` attributes become in-game hint text where they carry information);
  - **dynamically generated content:** result screens, ledgers, journal, soldier cards, encounter options, dialogue;
  - **canvas text** through one helper, `CL.ui.font(size)` returning a scaled font string, used for every font render draws (map labels, banners, minimap legend, Prepare labels, debug overlays included).
- **How:**
  - a CSS custom property `--ui-scale` on `#stage`, used in every font size, padding and min-height;
  - `fitHud` and the canvas re-layout run on change;
  - the fixed pixel sizes become scaled ones (for example `#ordersPanel` 13 px, `#result` 13 px, the Settings and Help panels 15 px); the `max-height: 430px` phone rules are kept and scaled too.
- **Canvas resolution** (decision D-R1):
  - The canvas stays a 960×540 backing store, so enlarged canvas text is drawn at that resolution.
  - As a measurement only, W-01 tries a backing store at `min(devicePixelRatio, 2)` with the Debug-panel Big battle and map tests on the owner's phone, and records the numbers.
  - It's adopted only if the owner agrees and the frame budget holds.
- **Layout rules:**
  - **Realistic sizes:** the largest setting stays usable at **812×375 and other realistic landscape phone sizes**: 667×375, 740×360, 844×390, 915×412.
  - **Touch targets:** at least **44×44 CSS px** at every size (WCAG 2.5.5); buttons grow rather than shrink their tap area when text is larger.
  - **Combat controls stay clear:**
    - panels that can be taller than the screen scroll inside themselves: Orders, Prepare, Accounts, Journal, Party, Settings, Help;
    - **during battle, no scrollable panel may cover the joystick, Attack or Block;** the Orders panel keeps clear of them and scrolls within its own area.
  - **Nothing essential is lost to truncation.** Truncated names and lines (soldier names, settlement names on the map, long news lines) end in an ellipsis and have a way to see them whole: a tap on the item shows the full text in its detail card or the message line. Numbers, costs and warnings are never truncated.
  - The HUD abbreviates instead of overlapping at Larger, for example "Allies 12 · Enemies 9" becomes "12 v 9".
- **Documentation** (README and How to Play):
  - the page blocks browser pinch-zoom because pinch is used by the game's own map and battle gestures (W-02, W-03);
  - in-game text size is the substitute. **It is not a full replacement:** it scales the game's text and controls but not the canvas art, and doesn't follow the system font size;
  - desktop browsers' page zoom (Ctrl +/−) still works and is supported at 100–150%.
- **Screen-reader and keyboard accessibility** are a separate concern: backlog A-01, not part of W-01.

**Layers.** Default Normal. One decision: pick a size. No expert layer.

**Save.** None (a device setting).

**Edges.**
- Changing size mid-battle doesn't pause or disturb the battle.
- A size change while a panel is open re-flows that panel.
- Saved settings from older builds without the key get Normal.

**Out.**
- A broad UI redesign or a framework migration.
- Colour themes and dyslexia fonts (backlog).
- Languages.

**Tests.**
- **Node:** the setting is validated and applied; `CL.ui.font()` follows it.
- **Browser (W-00), for each of the four sizes:**
  - at 812×375 and desktop, on the title, map, settlement, Party (soldier list and card), Accounts, Journal, Settings, Prepare, battle (with the Orders panel open) and result screens, `expectLayoutSound` checks the controls are in the viewport, don't overlap, and are at least 44×44;
  - a canvas check that labels are drawn with the scaled font;
  - at the largest size also 667×375 and 915×412.
- **Screenshots:** baseline at Normal and Larger for the main screens.
- **Phone:** the owner checks Larger.

**Acceptance.**
- Every check above passes at all four sizes.
- Size changes apply at once and persist.
- Nothing essential is hidden.
- The zoom limitation is documented.

---

### W-02 · World-map camera and gestures (M–L) — ✅ Done in 2.3.0

**Done (2.3.0, 2026-11-18).** As specified, with these notes:
- **Gestures:** `js/gestures.js` (`CL.gestures.recognizer`) is pure and takes pointer events in CSS px; map mode uses it through `js/input.js`, every other mode keeps its own handlers. A tap travels on release, only if it never moved past 8 CSS px and no second pointer joined; a drag pans, two pointers pinch (and pan with their midpoint), lifting one finger of a pinch leaves a pan, never a tap; `pointercancel`, a lost capture while the pointer is down, window blur and leaving the map end it with nothing. Mouse: only the main button; the wheel zooms at the cursor. Keys: arrows pan, + − zoom, C centres (only on the map; C is still Charge in battle).
- **Found by the browser specs:** after a touch drag the browser took the drag for a scroll and swallowed the next tap anywhere (the first press of Centre did nothing). The map now claims its finger moves (`touchmove` is prevented on the map), and the spec presses Centre straight after a drag.
- **Camera:** `js/mapview.js` (`CL.mapView`): `{ cx, cy, zoom, following }`, `toScreen`/`toMap` (exact inverses), `visibleRect`, `clamp`, `follow` (eased, a ±20% central box), `panBy`, `zoomAt`, `setZoom`, `step`, `centre`, `edgeMarker`, `inView`. It lays the map out in "world pixels", 2.0's `CL.world.toPx` (kept, with `fromPx`), and `CL.world.toScreen`/`fromScreen` go through the camera. "Fit" includes the 2.0 margin, so on today's map it is exactly 1× and the camera cannot move at 1× (2.0's projection, tested for every settlement and site). The map's size is `map().size` or 100 × 100 until W-04 gives maps their own.
- **Gameplay distance:** `aspect: 4.96 / 8.8` is now in `data/world_map.js` (validated) and `CL.world.mapDist`, road distance and facing use it; nothing in the rules reads `VIEW`. (`js/contracts.js` keeps its own 0.5636 for placing targets around a town, as before.)
- **Hit-testing and drawing:** `targetAt` and `partyDrawPos` use `toScreen`, with the 28 px radius at every zoom. The ground (grass, mottling now fixed to the map, forests, hills, river, roads) is drawn once per zoom step into a cached layer (the smallest of "fit", 1×, 1.6×, 2.4× at or above the zoom, so it is only scaled down; capped at 4096 px a side; each step's layer is kept, so a pinch across steps doesn't redraw) and copied each frame; at 1× the copy is pixel-exact. Places and parties off screen are culled. Below 0.75× only towns (and capitals, once there are any) keep their names, and bands show their count badge; on today's map that never happens.
- **HUD:** − + and Centre at the bottom right on the map only; − is off at "fit" and + at 2.4×; Centre glows while the view has wandered. Panning stops following; Centre or a new journey resumes it. Edge arrows point to the party (when panned away) and to contract and quest targets.
- **Setting:** `mapZoom` in `crownless_settings` (0.25–2.4, rounded to 0.01, default 1), saved at the end of a gesture or a button press, restored within the map's range each time the map opens.
- **Debug panel → Map drawing test:** four seconds at "fit", then four at 2.4× with the camera circling the map; the message line (and Logs) give fps, drawing ms and the slowest frame for each, with the canvas mode and text size. For the owner's phone, and again after W-05a.
- **Tests:** `tests/gestures.test.js` (tap, drag, pinch, pinch ending with one finger, cancel and lost capture, mouse and wheel); `tests/mapview.test.js` (inverse at every zoom and pan, 2.0's projection at 1×, clamping and the fixed point of a zoom, a 200 × 100 map below "fit" centred along its short axis, hit-testing of every place and party at every zoom, the same journey, path, time and band contact at four zooms and pans, following, Centre and edge markers, the zoom steps and setting, distance from the data); `tests/browser/map-camera.spec.js` (mouse and touch drags that end on a settlement and don't travel, a tap at 2.4× that travels and resumes following, Centre at the first press after a drag, a two-finger pinch that lifts one finger first, the wheel at the cursor, arrow keys, − and C, the zoom kept across a reload); the map's three buttons join the layout and text-size checks; one more screenshot (`map-zoomed`).
- **Not done:** the owner's phone check of drag, pinch and taps, and the Map drawing test's numbers on the phone.

**Problem.** The strategic map can't grow: it always shows the whole 0–100 space on the 960×540 canvas. Taps start travel on pointer-down, which rules out dragging and pinching.

**Now.**
- `js/input.js` (~line 217–229) calls `CL.world.click(...)` on **pointerdown** in map mode, which travels at once.
- Town taps (`CL.town.tap`), Prepare flag drags and battle minimap taps use the same listener.
- `js/world.js`: a fixed `VIEW = { x0: 40, y0: 22, sx: 8.8, sy: 4.96 }`; `toPx`/`fromPx`; `targetAt` hit-tests parties, settlements and sites with `HIT_RADIUS_PX` 28.
- `mapDist` uses `Y_ASPECT = VIEW.sy / VIEW.sx`, so gameplay distance is computed from the drawing constants.
- `drawWorld` in `js/render.js` draws the whole map every frame.

**Build.**

**1. Gesture-aware map input** (a small module, `js/gestures.js`, used by map mode now and battle zoom in W-03):
- `pointerdown` **begins tracking** an interaction. It records the pointer, its start position and time, and calls `setPointerCapture`. It **does not travel**.
- `pointermove` **tells a tap from a drag.** Once a pointer moves more than the threshold (8 CSS px), the interaction becomes a **pan**, and the map camera follows the drag.
- `pointerup` **confirms a tap only if** movement stayed within the threshold and no second pointer joined. Then it hit-tests and travels (or opens the target), exactly as a tap does today.
- **Two pointers:** a second pointer turns the interaction into a **pinch**. The distance between the pointers sets the zoom around their midpoint. Lifting one finger never turns the rest of a pinch into a tap.
- **Cancellation:** `pointercancel`, `lostpointercapture` and window blur end the interaction without a tap.
- **Mouse and touch are consistent:** a mouse drag pans; the wheel zooms around the cursor; a click is a tap.
- **Keyboard on desktop:** arrow keys pan, + and − zoom, C centres. WASD stays free for battle.
- **Other modes:** battle, town, Prepare and title keep their current handlers and behaviour until a task changes them (W-03 for battle zoom). The gesture module is opt-in per mode.

**2. A reusable camera transform** (`CL.mapView`, in `js/world.js` or its own module):
- **State:** `{ cx, cy, zoom }`: the map point at the screen centre and a zoom factor.
- **Conversions:**
  - `toScreen(mx, my)` and `toMap(sx, sy)`, exact inverses;
  - `visibleRect()`;
  - `clamp()`;
  - `follow(party, dt)` (eased, keeps the party inside a central box);
  - `panBy(dx, dy)`;
  - `zoomAt(factor, sx, sy)` (keeps the point under the fingers still);
  - `edgeMarker(mx, my)` for off-screen targets (the contract target, active quest bands, the player's own party when panned away).
- **Hit-testing** uses `toScreen` with a fixed 28 px radius at every zoom. Icons are drawn at a fixed pixel size. Labels fade out below a zoom threshold, except towns and capitals.
- **Gameplay distance is separated from the view.**
  - `mapDist` gets its own constant (`MAP_ASPECT`, equal to today's 4.96 / 8.8), defined with the world data, not the view.
  - Zoom and pan never change gameplay distance, travel speed, detection, reinforcement eligibility (V2-09), encounter contact or any rule.
  - A test proves it: the same journey and the same contacts at every zoom.

**3. Zoom behaviour** (decision D-Z1):
- **Levels:** "fit" (the zoom at which the whole map fits the canvas), 1×, 1.6×, 2.4×, plus continuous pinch between "fit" and 2.4×.
- **On today's 100 × 100 map, "fit" is 1×,** the current view, so the map can't be zoomed out below 1× and the 0.6× of the first draft doesn't apply. 0.6× would draw the map 528 × 298 px inside a 960 × 540 canvas, with nothing useful around it.
- **Once W-05 grows the map,** "fit" falls below 1× (about 0.5× for 200 × 200) and zooming out shows the whole region.
- **When the map is smaller than the view along one axis** (an aspect mismatch at "fit"), it's centred on that axis and the margin is filled with the map's background terrain. Clamping only applies along axes where the map is larger than the view.
- **At 1× and today's map,** with the camera at its initial position, the projection equals 2.0's `VIEW` for every settlement (the regression baseline).
- **The zoom level** is remembered as a device setting.
- **HUD buttons:** +, − and **Centre** (back to the party).

**4. Drawing:**
- **Through the transform:** `drawWorld` draws through the camera and culls what's outside `visibleRect()`.
- **A cached terrain layer:**
  - Today every frame redraws all terrain and calls `terrainAt` for each forest tree dot.
  - The static ground (grass, forests, hills, rivers, roads) is drawn once into an offscreen canvas per zoom step (or in tiles once W-05a's map is bigger) and copied each frame with the pan applied.
  - Moving things are drawn on top: parties, the player, markers and labels.
  - The cache is rebuilt when the zoom step changes or the world's terrain changes.
- **Decoration in map coordinates:** the grass mottling moves from screen to map coordinates, so it doesn't slide under the camera.
- **A Debug-panel map drawing test:** the whole map at "fit" and 2.4× while panning, reporting fps and drawing ms like the Big battle test. It's run on the owner's phone again after W-05a.

**Layers.** Default: the map follows the party at 1×. One decision: zoom or pan to plan. No expert layer.

**Save.** None (the camera is transient; the zoom level is a device setting).

**Edges.**
- A drag that ends on a settlement doesn't travel.
- A pinch that ends with one finger on a party doesn't open it.
- Pinch while travelling doesn't stop travel.
- Contact with a band opens the encounter whatever the zoom or pan.
- The Centre button and following resume after a pan once travel starts.

**Out.**
- The bigger map itself (W-05).
- Battle zoom (W-03).
- A separate overview screen; zooming fully out serves that.

**Tests.**
- **Node (gesture state machine):** synthetic pointer sequences show that:
  - tap → travel;
  - drag over the threshold → pan, no travel;
  - pinch → zoom, no travel;
  - pinch ending with one finger → no tap;
  - cancel or lost capture → nothing;
  - mouse wheel → zoom at the cursor.
- **Node (camera):**
  - `toMap(toScreen(p)) = p` at every zoom;
  - hit-testing at every zoom;
  - clamping, and centring below "fit";
  - at 1× the projection equals 2.0's for every settlement;
  - **zoom-independence:** the same journey (time and path) and the same contacts at "fit", 1× and 2.4×.
- **Browser (W-00):**
  - mouse drag pans without travel;
  - touch drag (phone project) pans without travel;
  - a two-pointer pinch zooms without travel (dispatched as two touch pointers);
  - a tap still travels;
  - wheel zoom;
  - the Centre button;
  - battle and town taps unchanged (their existing specs still pass).
- **Bots:** campaign and story bots unchanged (they don't use input).
- **Phone:** the owner checks drag, pinch and taps.

**Acceptance.**
- Dragging or pinching never starts travel (Node and browser tests).
- At 1× the game plays exactly as 2.0.
- At every zoom, taps reach the right target and every rule gives the same result.

---

### W-03 · Battle zoom (S–M) — ✅ Done in 2.4.0

**Done (2.4.0, 2026-11-18).** As specified, with these notes:
- **Camera:** `g.camera` is `{ x, y, zoom }`; `CL.camera.toScreen`/`toWorld`, `view`, `visible`, `target` and the render transform use the zoom; `zoomRange`, `clampZoom`, `setZoom` (keeps the view's centre, then the follow brings the hero back to the middle), `toggleZoom`, `remember`. **Only on a large field:** a one-screen field has nothing more to show, so it stays at 1× and the zoom button is hidden there, like MAP. The range is 0.75–1.5, never wider than the field.
- **Rules stay put:** what the company sees on screen (V2-06 `inSight`) is judged by `CL.camera.sightView`, the 1× view around the same centre, so zooming out never reveals an enemy to the rules. A Node test plays the same seeded battle at 0.75×, 1× and 1.5× and gets the same result to the unit, and `npm run bench` gives the same battles as 2.3.0.
- **Input:** a touch on the field goes to the W-02 recogniser (the joystick, buttons and panels are other elements, never tracked). A pinch zooms; one finger does nothing new; the minimap and overview taps now act on release from a clean tap, so a pinch never looks somewhere or sends a group (mouse clicks act at once, as before; a left click still attacks). `touchmove` on the field is claimed in battle too, so the browser never swallows the next press of ATTACK after a pinch. Mouse wheel zooms (not while the overview is open); **Z** and the zoom button toggle 1× ↔ 0.75×; the button shows the current zoom.
- **Overview "plus pinch":** closing the fingers in a pinch that *starts* at the widest zoom opens the overview; spreading them on the overview closes it. A pinch that merely reaches the widest zoom does not open it.
- **Drawing:** the field is drawn scaled; ground tiles, culling, the minimap's view box and the off-screen enemy markers follow the zoom. HUD, banners and controls stay at their size.
- **Setting:** `battleZoom` in `crownless_settings` (0.75–1.5, default 1), restored at the start of each battle.
- **Tests:** `tests/battle-zoom.test.js` (range and clamping, exact conversions, view and culling, the hero central and the edges at every zoom, the same enemies seen and the same battle at every zoom, minimap taps, the toggle and the setting); `tests/browser/battle-zoom.spec.js` (the button and its place among the controls, a pinch that neither swings, moves, looks nor sends, pinch to and from the overview, joystick/WASD, ATTACK and ORDERS while zoomed out, the minimap tap while zoomed, the wheel and Z on desktop, the zoom kept for the next battle).
- **Not done:** the phone's Big battle 40 + help at 0.75× (Debug panel, zoom button first). If it misses the frame budget, cap the zoom at 0.85× with Reduced effects, as the spec allows.

**Problem.** On a phone, large battles can feel cramped; on desktop, a wider view would help command.

**Now.**
- `js/camera.js` translates world pixels to the screen only (`toScreen`/`toWorld`).
- The `js/tactics.js` overview has its own scaled transform.
- Render culls by the camera's view.
- Battle input converts taps through the camera.

**Build.**
- **Camera:** `g.camera.zoom` from 0.75 to 1.5 in `toScreen`/`toWorld`, `view`, `visible`, and the render transform.
- **Controls:**
  - the W-02 gesture module in battle, **on the field only**: pinch zooms; one-finger drags on the field are ignored. They stay unused, so there's no change to movement, which is the joystick;
  - the joystick, Attack, Block and the panels are excluded from gesture tracking;
  - wheel zoom on desktop;
  - a small toggle button (1× ↔ 0.75×).
- **Follow:** keeps the hero in the central area at every zoom.
- **Edge markers, minimap view box and the overview** are updated. The overview keeps its zoom-to-fit, plus pinch.
- **Remembered:** the zoom level as a device setting.

**Layers.** Default 1×. One decision: zoom out.

**Save.** None.

**Edges.**
- A pinch never fires an attack or moves the joystick.
- At 0.75× on a large map the drawing cost rises: measure on the phone with the Big battle test, and cap at 0.85× with Reduced effects if needed.

**Out.** A free camera outside the overview.

**Tests.**
- **Node:** conversions, tap targets and culling at each zoom.
- **Benchmark:** unchanged at 1×.
- **Browser (W-00):** pinch on the field zooms without attacking or moving; the controls still work while zoomed.
- **Phone:** the Big battle test at 0.75×.

**Acceptance.** Attacks, taps and orders land correctly at every zoom, and the phone keeps its frame budget at 0.75×.

---

### W-04 · A data-driven world (M) — ✅ Done in 2.5.0

**Done (2.5.0, 2026-11-18).** As specified, with these notes:
- **The world package** (`data/world_map.js`): `bounds`, `aspect` (from W-02), `factions` (this world's kingdoms, in order), `outlaws` (the faction of road bands and sell-swords: `neutral`, never a kingdom), `start` (renamed from `startSettlement`), `regions` (named rectangles; `CL.world.regionAt`, for news and text to use) and `view` (`zoom`: the map's opening zoom until the player picks one, so the `mapZoom` setting now defaults to none). `CL.world.id()` is the campaign's `worldId` when this build has that world, else the first world listed (`defaultId`, what a new game starts in). A save keeps its own `worldId`, and one whose world this build lacks is refused by name, as before.
- **No bounds in code:** `CL.world.bounds()`, `clampToMap(x, y, margin)`, `inBounds`, `start()`. Parties keep 2 units inside the edges (they used 2–98), contract targets 5 (they used 5–95, also a bound), story bands 2; the map camera sizes itself from `bounds`. New parties begin at the map's middle before they're placed; a contract with no position falls back to the start settlement. One more literal was found by the source test: Debug → Bandits near me capped at 98. Releasing a captive picks the nearest kingdom's settlement, or the start if there were none.
- **Kingdoms from data:** factions have `emblem` and `order`; `CL.realm.kingdoms()` is the world's list, with `outlaws()`, `isKingdom()` and `forts()`; banners, the troop tree, the news fallback (the first fort's owner, no longer Greywall by name), reinforcements and the Debug fort switch (round all the world's kingdoms) read them. The campaign bot's contract boards are the settlements with a contracts service. (The Debug panel's reputation buttons are HTML and still name the March's two kingdoms.)
- **Validation:** bounds; kingdoms and outlaws known, outlaws not a kingdom; every settlement, site, terrain point, region and frontier point inside the bounds; every settlement owner and party template faction one of this world's; every kingdom with recruits; the start settlement exists.
- **Test world** (`tests/helpers/test-world.js`, through the new `loadGame({ content })`): Valedorn and Aurelian renamed Northmark and Sunhold everywhere in the data (prose untouched), a third kingdom, the Iron Reach, holding Redfield and Saltmere, the map stretched to 150 × 120, its own world id. It validates, starts, fits the map camera below 1×, has three kingdoms' reputations, and the fort switch goes round all three.
- **Tests:** `tests/world-package.test.js` (the March package, validation cases, the test world, saves of each world refused by the other, and the source test: no kingdom or world id except the 2 → 3 save migration, which records that every v2 save was a Border March one; no `'neutral'` outside `js/realm.js`'s standings; no `0, 100)`, `2, 98)`, `5, 95)` or `98)` literals); `tests/slow/test-world.test.js` (the campaign bot plays 30 days of the test world; parties go past 100 both ways; positions past 100 survive a save and reload).
- **The real game is unchanged:** three 20-day bot campaigns of the March write byte-identical saves before and after (apart from the build stamp), and every earlier test passes unchanged except the `mapZoom` default in the settings test.

**Problem.**
- The game can only be the Border March, on a 0–100 map.
- A bigger world (and later mods) needs the world, its kingdoms and its size to be data.

**Now** (verified at c66d94c):
- **Hard-wired world:**
  - `MAP_ID = 'border_march'` (`js/world.js`).
  - `FACTION_EMBLEM` (`js/render.js`), `FACTION_ORDER` (`js/troops.js`), the debug fort switch (`js/debug.js` ~307).
  - The campaign bot's boards (`tests/helpers/campaign-bot.js:134`).
- **Hard-coded 0–100 bounds:**
  - `js/parties.js`: clamps to 2–98 at lines 144–145, 178–179, 193–194, 208–209 and 440; to 0–100 at 583–597;
  - `js/world.js`: 134 and 335–336;
  - `js/contracts.js`: 332, including the fallback position 50, 50;
  - `js/story.js`: `bandSpot` caps at 98, line 272;
  - `js/parties.js:47`: new parties are created at 50, 50 before they're placed.
- **Kingdoms** come from `data/factions.js` (`realm.kingdoms()`); owners from settlements' `ownerFaction`.

**Build.**
- **The world package:** `world_map` entries gain:
  - `bounds` (`{ w, h }` in map units; 100 × 100 for the March today);
  - `aspect` (gameplay `MAP_ASPECT`; W-02);
  - `factions` (this world's kingdoms);
  - `start`;
  - `regions` (named areas for news and text);
  - `view` (default zoom and centre).
  
  The game picks its package by the campaign's `worldId` (saved since schema v3).
- **No bounds in code:** every clamp above uses `CL.world.bounds()` (with a margin where it used 2–98); the contract fallback uses the world's start settlement.
- **Kingdoms from data:**
  - factions gain `emblem` and `order`;
  - render, the troop tree, debug and the bots read them;
  - debug "switch owner" cycles through the world's kingdoms;
  - the bots read contract boards from settlements' services.
- **Validation:**
  - every settlement, site, party frontier point and road inside `bounds`;
  - every owner, party template faction and recruit list pointing at this world's kingdoms;
  - the start settlement exists.
- **A test world** (tests only): three kingdoms with other names, on a **150 × 120** map (bigger than 100, not square). It's loaded through a new `loadGame({ content: … })` option in `tests/helpers/load.js`, and proves nothing assumes two kingdoms or a 100 × 100 square.

**Layers.** Not player-facing.

**Save.** None. `worldId` exists; saved positions keep their 0–100 values in the March, now checked against `bounds` instead of literals.

**Edges.** A save of an unknown world is already refused by name (since 1.2.0).

**Out.**
- Namespaced ids (moved to P9-07: they would ripple through every id validator for no Phase W gain).
- Mod loading.
- Selecting a world in the UI.

**Tests.**
- A source test: no kingdom or world id, and no `0, 100` / `2, 98` / `98)` bound literals, in `js/`.
- The test world loads, the campaign bot plays 30 days on it, and parties reach every corner (positions beyond 100 survive a save and reload).
- Every existing test is unchanged. Saves written by this build are byte-identical to 2.0's for the March, apart from the version stamp.

**Acceptance.** The test world plays; the real game is unchanged.

---

### W-05a · World geometry and terrain (M) — ✅ Done in 2.6.0

**Done (2.6.0, 2026-11-18).** Decisions D-W1 and D-W4 taken as their defaults by the owner (a world about 4× the March's area; all terrain passable at a cost). As specified, with these notes:
- **Terrain as data** (`data/world_map.js`): `terrain` gains hills 0.8, mountain 0.4, marsh 0.5, river 0.3, ford 0.8 and bridge 1.0; features are `areas` (`{ kind: hills | mountain | marsh, poly }`), `waters` (`{ line, width, crossings: [{ kind: ford | bridge, x, y, r }] }`) and `coast` (sides of the map that meet the sea, drawn in the margin past the edge; the bounds already stop travel there). `terrainAt` order: a ford or bridge, a road (also the pass through mountains), a river, an area, a forest, grass.
- **The March stays as it was:** its existing `river` and `hills` are drawn only, as before, and it has no new features, so every travel time and battle map is unchanged (a test compares travel times from Stonebridge with 2.5.0's to the last digit). W-05b lays out the bigger region with real terrain. The help text gains terrain then, when players can meet it.
- **Battle maps from data:** `battleMaps` names the map for each kind (forest and marsh → Forest Wilds, hills and mountain → Open Country, river and ford → River Ford), with `open` and `fort` for the rest (a fort approach within 6 units of a fort). No battle map id is left in `js/world.js`.
- **River Ford** (`river_ford`, generated `{ kind: 'ford', scale: 3, seed: 13 }`): grass banks either side of a river between the armies, all of it a shallow ford; the map's `slow` ground halves the speed of anyone in it (`CL.units.groundFactor`, in `move`; maps without `slow` are unaffected). Drawn with ripples and on the minimap. Its one-screen counterpart is the Grass Field. Debug → **Ford battle 30** plays it on the large map whatever the Battlefield setting.
- **Drawing:** the sea, marsh reeds, hill arcs, snow-capped peaks, rivers by their width, ford stones and bridge planks, all in the cached terrain layer under the roads (W-02).
- **Validation:** every kind has a speed above 0; areas, waters and crossings lie inside the map and are of known kinds; coasts are known sides; `battleMaps` names known maps, with `open` and `fort`.
- **Tests:** `tests/terrain.test.js` (each kind at a point of the test world, its speed, every point passable, the ford against wading against grass, a journey straight across a river arrives, the battle map for each kind, the March unchanged, the ford map, wading at half speed, validation); `tests/browser/ford.spec.js` (the ford battle at desktop and phone size: the river drawn, walking and wading by real input at about half speed, the controls sound, a result). The test world gained every kind of terrain; its 30-day bot run still passes.

**Problem.** A bigger region needs more kinds of ground, and battles that match them.

**Now.**
- Terrain kinds: road 1.2, grass 1.0, forest 0.75, computed by `terrainAt` from polygons (forests), road polylines and a river line.
- `battleMapAt` picks a battle map by terrain.
- Two large generated battle maps (forest, open).

**Build.**
- **New terrain kinds** as data, each with a speed factor and a battle map:
  - **hills** 0.8;
  - **mountain** 0.4: a pass is a road through it;
  - **marsh** 0.5;
  - **coast:** the map edge's water is impassable only at the map edge, which the bounds already handle;
  - **river** 0.3 except at **fords** 0.8 and **bridges** 1.0.
- **All terrain stays passable** (decision D-W4). Straight-line travel and party movement still work; routes matter through cost, not walls. Impassable terrain waits for W-09.
- **A generated ford battle map,** made like the large maps, with a shallow crossing that slows units (P7-11 adds formation effects later). Hills and marsh map to the existing open and forest maps until the art team delivers.
- **Drawing** for the new terrain on the world map, culled by the W-02 camera.

**Save.** None.

**Edges.**
- Travel never stalls: every point has a speed above 0.
- A battle at a ford uses the ford map.

**Tests.**
- `terrainAt` for each kind.
- Travel time across a river at a ford against elsewhere.
- Battle map choice for each terrain.
- The March's travel times are unchanged.

**Acceptance.** As tests; the ford battle plays in the browser at desktop and phone size.

---

### W-05b · The bigger region's content (L) — ✅ Done in 2.7.0

**Done (2.7.0, 2026-11-19).** Decisions by the owner: D-W1 the default (2026-11-18); **D-W2: the March kept whole in the middle, but old saves are refused, not moved in** (2026-11-19), so W-06's migration is not needed; D-W3 the default (placeholder names and cultures). As specified, with these notes:
- **The Sundered Realm** (`data/world_map.js`, world id `sundered_realm`), 200 × 200. The March sits whole at + 50, + 50: its places, roads, forests, river, hills and lairs are where they were relative to each other, and its travel times are 2.5.0's (tested). Its river and hills stay drawn only, so travel inside it is as it was.
- **Kingdoms:** Valedorn adds Westholt Castle, Ashby and Fernley in the western shires; Aurelian adds Castra Nova, Calvinum and Tessaro in the eastern provinces; **Hrothmark** (the northern highlands: Hrothgard, Ulfstead Hold, Skarnwall and four villages) and the **Vessaro League** (the southern coast: Vessara, Torre Salina, Castel Verro and four villages) are new, with their own name cultures; the **Free City of Merrow** is a kingdom in the data's sense (reputation, a patrol, recruits) that hires out Mercenaries and has the cheapest market and the fullest armoury. 31 settlements; every town has a contract board and recruits, every village a market, no fort trades.
- **Troops:** six each for Hrothmark (Clansman → Axeman → Huscarl or Hill Rider; Fell Archer → Fell Warden: heavier, slower foot) and the League (Militia → Pikeman → Pavisier or Light Horse; Crossbowman → Arbalester: crossbows hit hard but load slowly, the light horse is fast and thin-skinned). They render with role art until their sprites exist.
- **Goods:** timber (cheap in the north) and wine (cheap on the coast). The content check no longer insists on exactly six goods.
- **Map content:** terrain from W-05a for real (the Hrothmark range with the Hrothgard–Greywall road as its pass, hills in the north-west and east, a marsh in the south-west, the Vess from the March to the sea with a ford and a bridge, the sea along the south); eight roads; two lairs in each of the five regions, with two new lair fights (Raider Warband, Deserters); four new Reaver bands, patrols by holdings (three per kingdom, the Merrow Watch), and caravans between the capitals and Merrow. 11 bands, 13 patrols and 5 caravans in all.
- **News:** a `{region}` placeholder ("the northern highlands"), and lines that use it.
- **Bots:** the campaign bot takes the nearest lair it can beat and walks to the nearest other contract board; the story bot wanders only the March (its regions), where Gate D's checks stay.
- **Old saves** (any save of the Border March world, every build to 2.6.0) are refused on load and on import. The game begins a new campaign, says once "The world has grown: new kingdoms lie beyond the March…", and keeps the old save untouched in `crownless_save_other_world`. The save schema stays v9. The migrations stay in `js/save.js`, and their tests (every fixture set from 0.14 to 2.0) run on the March as it was (`tests/helpers/old-march.js`), on which the W-04 test world is now built.
- **Art:** the asset request list is in `docs/ASSETS.md` ("Asset requests for the art team"). No image files were added, so the manifest is unchanged.
- **Help:** How to Play mentions the lands beyond the March and the new kinds of ground, and says every town posts contracts. The full help for the bigger map came with W-05c (2.8.0).
- **Tests:** `tests/realm-world.test.js` (the kingdoms, settlements and lairs; markets and boards; the troop trees; the farthest capitals reached in under four days; the world's parties stay on the map; region news; old saves refused and kept). Existing tests moved to the new coordinates or, for 2.0's projection and the saves, to the old March.
- **Prototype G on the new map** (6 seeds × 30 days): no run stuck, every one resumed from its halfway save; hands-off median 132 crowns, 109 won / 62 lost; presets 1,190 crowns, 196 / 17; expert 1,235 crowns, 203 / 11. The gap between fighting and Simulate stays B-01's to close.
- **Not done here:** the owner's phone session at W-02's zoom levels (acceptance).


**Problem.** Ten settlements and two kingdoms are too small for lords, holdings, sieges, wars and diplomacy.

**Now.**
- 10 settlements with markets, gear lists, recruit lists, scarcity baselines and garrisons.
- 3 cultures in `data/names.js`; 16 troops.
- Party templates: 3 bands, 2 patrols per kingdom, 1 caravan per kingdom.
- News lines in `data/news.js`; contracts in `data/contracts.js`.

**Build (proposed defaults, D-W1–D-W3):**
- **Map:** 200 × 200 map units at today's travel scale. The March is placed whole at a fixed offset (for example +50, +50); its layout, story distances and lairs are unchanged.
- **Kingdoms:**
  - Valedorn and Aurelia, extended westward and eastward;
  - **a northern kingdom** (highland and forest; a new culture; heavy infantry and axemen);
  - **a southern or coastal league** (marsh and coast; a new culture; crossbowmen and light horse);
  - a **free city** (neutral; mercenaries; the best market);
  - the Reavers in every region.
- **About 32 settlements:**
  - each kingdom: a capital town, two forts or castles, three to five villages;
  - the free city;
  - two lairs or sites per region.
  
  Settlement ids in the March keep their names.
- **Troops:** each new kingdom gets a full tier 1–3 tree (five or six troops, shields and brace flags, a cavalry branch), names and armoury gear. Two new trade goods (for example timber and wine).
- **Map content:**
  - patrols per kingdom scaled by holdings;
  - caravans between capitals and the free city;
  - contract boards in every capital and the free city;
  - news lines naming regions.
- **Art:** an **asset request list** for the art team in `docs/ASSETS.md` (new troop sprites, settlement icons, terrain tiles, the ford map). New troops render with role art meanwhile.
- **Bots:** the campaign and story bots read boards, markets and routes from the world, not hard-coded ids. Gate D's story checks stay on the March.

**Save.** Content only, but the build must also carry the v10 migration (**W-06**). Never release W-05b without W-06.

**Edges.**
- Long journeys: food and wage pressure are re-checked (W-08).
- Every new settlement has a market or a reason not to.
- Nothing spawns outside `bounds`.

**Out.**
- Lords and nobles (Phase 8).
- War rules beyond today's clashes (W-07).
- Walkable capitals (only Stonebridge is walkable).

**Tests.**
- Content validation: troop trees, recruits, garrisons, markets, gear.
- Reachability and travel time between the farthest capitals (under about 4 game days).
- The story and errands still pass; Gate D unchanged.
- The campaign bot (60 days) and Prototype G on the new map.
- The asset manifest test updated.

**Acceptance.** All of the above, plus an owner session on the phone at W-02's zoom levels.

---

### W-05c · New-region errands and help (S) — ✅ Done in 2.8.0

**Done (2.8.0, 2026-11-19).** As specified, with these notes:
- **Three errands** (`side: true`), one per new power, each offered by a new person in its capital who talks about the land (`data/dialogue.js`; no offer while that power is Hostile):
  - **Wolves in the Pass** (Steward Ingrid, Hrothgard): break the raiders walling off the mountain pass on the Hrothgard–Greywall road; 80 crowns, Hrothmark +10. Quest bands take a new `along` (0–1) to stand part-way between two places, here in the pass.
  - **Timber for the Shipwrights** (Factor Salviati, Vessara): buy timber anywhere, sell it in Vessara; 60 crowns on top of the trade's own profit, the League +10.
  - **False Lights** (the Clerk of the Council, Merrow): hire a sell-sword in Merrow, then break the wreckers at Wreckers’ Cove; 90 crowns, Merrow +10.
- **Help:** a new How to Play topic, **The lands** (after The map): the March in the middle, each power and its troops, a contract board in every town and someone with work in each capital, timber in the north and wine on the coast, regional news, the distances. The map topic says how to zoom out to the whole realm.
- **Tip:** **Beyond the March** shows once, the first time the party stands in a region outside the story's home. The world's data marks the March's regions `home: true`; the tip's new situation `awayFromHome` reads that, so no region id is in the code. The story bot keeps to the `home` regions too.
- **Fixed on the way:** Merrow listed the Mercenary twice for hire (its own recruit and every town's sell-sword); now once.
- **Tests:** `tests/errands.test.js` walks each errand end to end (the band in the pass on the road between mountain slopes; timber sold elsewhere doesn't count; no wreckers until the sell-sword is hired), checks that a Hostile power offers nothing, and checks that the story bot's errand filter covers every way in. `tests/tips.test.js`: the tip appears only outside the March, and only once; the lands topic names every power.


**Build.**
- Two or three errands outside the March (quest interpreter, `side: true`), each showing a new region's character.
- How to Play and tips for the bigger map: zoom, Centre, regions and kingdoms.

**Tests.** Each errand walked end to end (as `tests/errands.test.js`); the story bot ignores errands.

**Acceptance.** Errands complete; help text covers the new map.

---

### W-06 · Saves move into the bigger world (M) — ✖ Not needed (decision D-W2, 2026-11-19)

**Owner, 2026-11-19:** keep the March inside the bigger world, but don't move old saves in: they are refused (and kept safe) instead. W-05b did that in 2.7.0. The spec below is kept for the record.


**Problem.** Every save so far has migrated forward. The bigger world must not strand anyone's campaign, or move them to the wrong place.

**Now.**
- Save schema v9; migrations 1 → 9; fixtures from real builds back to 0.3.
- **Coordinate-bearing saved fields** (verified):
  - `c.world.x/y`;
  - every party's `x, y, tx, ty` and `anchor` (quest bands are parties with an anchor);
  - contract targets' `x, y` (`js/contracts.js` sanitize);
  - offers' positions, if any.
- **Not coordinate-bearing:**
  - news events (they keep ids only);
  - the merchant's prices (by settlement id);
  - sites' state (by id).

**Build.**
- **Fixtures first:** `tests/fixtures/saves-2.0/` from the real 2.0.0 build (`scripts/make-legacy-save-fixtures.js` in a throwaway checkout at 0415109), made **before** any W-05 content lands.
- **Schema v10 migration:**
  - offset every coordinate-bearing field by the March's placement;
  - add reputation (neutral) for new kingdoms;
  - add owners for new holdings from content defaults;
  - add market scarcity for new markets;
  - start party spawns for new templates;
  - keep `worldId` (`border_march`: the world grew, it didn't change);
  - record the offset in a migration note.
  
  **The migration is pure,** like every step in `CL.save.MIGRATIONS`. The offset and the new kingdoms' defaults are constants written into the migration, never read from the current world data, so later content changes can't change how an old save migrates.
  
  The migration runs **before** sanitize, so nothing is clamped to the old square.
- **A one-time message on load:** "The world has grown: new kingdoms lie beyond the March."
- **A pre-migration copy** kept as for every step.

**Layers.** Invisible apart from the message.

**Save.** Yes: v10.

**Edges.**
- A save mid-travel: `g.travel` is transient, so the party simply stands still.
- A save with an open encounter is committed by result ID, unaffected.
- An active contract target and its ambush or escort still complete after the offset.
- A v10 save opened in a 2.0 build is refused as "newer" (as today), never loaded unshifted.

**Out.** Moving saves between different worlds (Phase 9).

**Tests.**
- Every fixture set from 0.14 to 2.0 imports and loads from storage into v10 with the same soldiers, gold, day, quests, and **position relative to the March**.
- Then the campaign bot plays 10 days.
- A contract in progress completes after migration.

**Acceptance.** No save from any build is lost, thinned or misplaced.

---

### W-07 · A world simulation that scales (M–L) — ✅ Done in 2.9.0

**Done (2.9.0, 2026-11-19).** Decision D-W5 taken as its proposed default (not marked blocking). As specified, with these notes:
- **Spatial grid** (`js/spatial.js`, cells of 10 map units): each step builds one; sight, chases, rival patrols, contacts, clashes and border incidents query nearby cells, and reinforcement planning (`js/reinforce.js`) does too. Results keep the order of the full list, so a test plays the same seeded world with and without the grid and gets byte-identical parties, news, relations and markets.
- **Steps:** every party now chooses its target from where things stand, then all move (before, each moved straight after choosing, so later ones saw earlier ones already moved). Parties more than 25 map units from the player, and not on the player's business (a quest, a contract, an escort, a chase), save up their time and act once an hour.
- **Swept contacts:** bands against caravans and patrols, patrols against patrols, and parties against the player meet if they came within contact distance at any moment of the step, not only where they end it.
- **Budget:** the world's `simulation.partiesPerRegion` (16): a regular party that would spawn into a fuller region doesn't, and its template tries again later. A long rest in one step and the same rest a day at a time give the same kinds and amounts of events, within a quarter (slow test, 90 days, three seeds).
- **Speed:** `node scripts/bench-map.js --season 80 90` (new): 80 parties over 90 days, about 270 ms per game day in Node against about 640 for 2.8.0, with an even worst day; the save of that world is about 28 KB (budget 100 KB, slow test).
- **Map drawing** culls sites, settlements and parties outside the camera's view.
- **War and peace** (`js/realm.js`, `c.relations`, save schema **v10**, not v11: v10 was left free when W-06 was dropped): every pair of kingdoms is at peace, in tension or at war. Patrols at peace that meet may cause a border incident (a quarter of the time, at most one a day per pair), which sours peace to tension; patrols in tension or at war clash (the existing skirmish, at most one every 4 days in all), four clashes make tension a war; a war ends in an exhausted truce (tension) after at least 12 days once 12 soldiers have fallen, or after 45 days; 8 quiet days cool one clash, and 30 days of quiet tension make peace. The world's data sets the start (`relations`: the March pair in tension, marked `story`); **D-W5:** the story holds that pair until Q4's ending, whose data sets it (the road peace: peace; a crown taking Greywall: war), and the rules take over after.
- **News:** war declared, tension rising, a truce, peace made, for any pair, naming the region; frontier clashes gain a line naming the region.
- **Debug → Map stress 80:** 80 parties scattered over the world and a game day every second, through the map test's two views; reports fps, simulation ms and drawing ms apart, the slowest frame, and one save write (to a scratch key) with its size. The campaign is put back exactly as it was.
- **Help:** The lands explains war and peace.
- **Bots re-baselined:** the step changes shift how the random streams are drawn. The campaign bots and the test world's bot pass unchanged. Gate D's 60 random story campaigns no longer happened on the rarest branch, selling Aurelian's plans to the Crown (about 1 run in 100; once in 96 seeds tried). The two mirror-image sales now count as one branch there, and `tests/q3.test.js` walks both directions deterministically (the Crown's way already, the Remnant's way new).
- **Tests:** `tests/world-sim.test.js` (grid against a full scan; the same world with and without the grid; determinism; a swept crossing in one coarse step; far parties act hourly; the region budget; the starting relations; the story's hold and the endings; the rules end to end; patrols at peace don't fight and at war do; relations saved, repaired, and the 9 → 10 migration from a 2.7 save; the map stress test restoring the campaign), `tests/slow/world-sim.test.js` (80 parties over 90 days: a full world, no slow-day spikes, the save under 100 KB; fast-forward equivalence).
- **Not done here:** the owner's phone run of Map stress 80 (acceptance).


**Problem.** The world simulation was written for nine parties. A bigger world wants 40–80, and later lords and armies.

**Now.**
- `js/parties.js` `runSteps`: every 15 game minutes, every party chooses a target and moves.
- `resolveContacts` and `frontierClash` check pairs.
- Detection is a distance test.
- `reinforce.plan` scans all parties.
- `drawWorld` draws everything.
- Clashes only between Valedorn and Aurelia (`js/news.js`).

**Build.**
- **A spatial grid** (cells of about 10 map units) rebuilt each step. Contacts, detection, chase targets and reinforcement planning query nearby cells only.
- **Budgets:**
  - a cap on parties per region (spawn rules per region);
  - parties far from the player may step every game hour instead of every 15 minutes;
  - **swept contacts on coarse steps:** contact is tested between the two parties' movement segments, not only end points, so two parties can't pass through each other. A party moves about 3.6 map units an hour, and contact needs 1.6.
- **Fast-forward equivalence** (Part 2 §27.4): resting 90 days in one step gives the same kinds of outcome as 90 one-day steps. This is checked statistically, since step size changes how the random streams are consumed.
- **Map-drawing culling** to the W-02 camera.
- **War and peace between kingdoms:**
  - `c.relations[a][b]` is `'war'`, `'tension'` or `'peace'`;
  - clashes only between kingdoms at war or in tension;
  - wars start and end on simple rules (border incidents, exhaustion) with a news line.
  - **The March pair** stays at "tension" until Q4 ends; the endings set it (D-W5). This is the seed of P9-02.
- **News** for any pair of kingdoms, naming regions.
- **A Debug-panel map stress test** (many parties, fast time) for the owner's phone. It reports simulation and drawing ms separately, and the time of one save write.
- **A save size budget:** today's played save is about 15 KB. A 90-day save with 80 parties must stay under 100 KB; a test checks it.

**Save.** Yes: v11 (`relations`).

**Edges.**
- Determinism: the same seed gives the same world.
- Bots are **re-baselined** and the change recorded, since step changes shift random consumption.
- Quest bands keep their behaviour.

**Out.** Lords (P8-01); treaties (P9-02).

**Tests.**
- **Grid equivalence:** the grid returns exactly what a full scan would.
- **Swept contacts:** two fast parties crossing within one coarse step meet.
- **Performance:** 80 parties over 90 days headless (`scripts/bench-map.js`).
- **Determinism** for a fixed seed.
- **War and peace rules,** including the March pair and the endings.

**Acceptance.** 60–80 parties run without slowdown spikes on the phone's map test (owner), and every existing bot passes after re-baselining.

---

### W-08 · Tuning and acceptance of the bigger world (S–M) — ✅ Done in 2.10.0 (phone session to come)

**Done (2.10.0, 2026-11-19).** The runs, findings and numbers are in NEXT-PLAN, "Phase W validation". In short:
- **Measured across the region:** the economy report, the campaign bot, 200 stories and Prototype G, 60 days each. The campaign bot and the economy report gain `--roam`: the bot tours every capital's contract board and takes on lairs up to two days away.
- **The apparent economic collapse since 2.7 was the bot's.** It took on the nearest beatable lair anywhere in the realm and spent days crossing it. It now keeps to lairs within about a day's ride (60 map units when roaming). With that, the economy is as healthy as 2.6.0's, or slightly richer.
- **Re-tuned:** food follows the local grain price at half strength (7 crowns among the western farms, 8 at most markets, 9 in the highlands). How to Play says so. `tests/upkeep.test.js` covers it.
- **Checked and kept:** contract pay (already per league), patrol and band density (even across regions), road and open-ground speeds, caravans' market effects.
- **Acceptance:** no bot run stuck; the economy healthy by V2-T1's measures; the story ends in all 200 runs. The owner's phone session is still to do (the list is in NEXT-PLAN).


**Build.**
- **Runs:** the economy report, campaign bot, story bot and Prototype G across the whole region for 60 days.
- **Re-tune:**
  - contract pay by distance;
  - food prices away from farms;
  - patrol and band density;
  - road versus open-ground speed;
  - caravan effects on far markets.
- **Write-up:** a validation section in NEXT-PLAN (as V2-VALIDATION did).
- **Phone session:** text sizes, map gestures, battle zoom, the bigger map.

**Acceptance.**
- Bots never stuck.
- The economy healthy by V2-T1's measures.
- The story ends in all 200 runs.
- The owner's phone session done.

---

### W-09 · Route planning (M) — Ready after decision D-W4

**Problem.** Straight-line travel can't handle impassable terrain, and can't offer "Avoid danger" routes (P7-04).

**Build.**
- **A planner:** A\* over a coarse cost grid (terrain speed factors, roads, optional danger cost from known bands) for the player's travel and for parties' movement.
- **Paths:** stored as waypoints (transient; re-planned after load).
- **The map** shows the planned route while travelling.
- **Impassable terrain** (if D-W4 allows it): rivers except at fords and bridges, and high mountains.

**Save.** None (routes re-planned on load).

**Edges.**
- Unreachable targets refuse with a message.
- Parties never get stuck; a fallback is a direct line where passable.
- Performance: a budget per step.

**Tests.**
- Paths across rivers use fords.
- Travel time equals the sum of segment costs.
- Parties reach every settlement.
- Bots never stuck.

**Acceptance.** The above; and with impassable terrain on, the campaign bot plays 60 days without stalls.

---

## Phase 7 — The Living Company

### B-01 · Battle balance pass (M) — ✅ Done in 2.11.0 (phone session to come)

**Done (2.11.0, 2026-11-19).** Measured with `scripts/parity.js` (80 seeds a scenario; it gains a `tweak` hook to try one change at a time). Before: fought battles won 100% of every close fight, 26–34 points over the stated odds, and 30–40 points over Simulate.
- **The odds follow the square law** (`js/autoresolve.js`): both powers are squared before the share is taken (Lanchester's law for a melee), still held to 10–90%. Fought battles had always gone with the stronger side far more steeply than its share of the strength. No change to the enemy alone could put them 5–15 points over a proportional curve at every ratio: the measured outcome at 2.5 : 1 was 100% against a stated 71%. It's the same formula for the encounter screen, Simulate, off-screen fights and the bots, and the Simulate explanation says so.
- **The enemy fights better** (`js/combat.js`, `CL.combat.ENEMY`):
  - its foot keeps a loose line until close instead of streaming in one by one (a soldier 55 px ahead of the rest's middle and over 150 px from its target moves at 30%), unless it outnumbers the company by more than a quarter. Then it swarms, since with the line those fights became hopeless (−19 over the odds);
  - it goes for the exposed: an archer, a badly wounded soldier, or a hero with no soldier within 110 px, when not much further than the nearest.
- **Enemy morale** (`js/morale.js`): +6 steadier; a band defending its own lair minds being outnumbered half as much.
- **Fixed:** the stall guard skipped battles with waves still to come, so two enemies falling back where archers had no clear shot could hold the next wave back for ever (one battle in 80 in the measurements). Now they slip away and the next wave comes on.
- **Tried and dropped:** enemies going round the side of an engaged soldier. It made outnumbered fights collapse (to 12–40%) and others easier. Shielded Reaver content was not needed.
- **After (80 seeds, fought over the stated odds / over Simulate):** lone hero +14 / +13, small +11 / +11, close +18 / +18, veterans +2 / +3, outnumbered 0 / −3; the three close fights average +7. Enemy shields already cover their own (V2-08a), now tested.
- **Re-runs:** economy (12 × 60 days): the hands-off bot wins more of what it auto-resolves (60 wins and 12 losses a campaign, against 52 and 20) and ends richer (448 crowns at day 60, against 244); no hardship. Prototype G (6 × 30 days): hands-off 224 crowns, 19 soldiers, 163 won / 39 lost; presets 610, 20, 208 / 16; expert 705, 20, 197 / 16 (2.9.0: 132, 1,190 and 1,235). The bot hero falls more often in fought battles (hero down 120 and 101 times, against 55 and 54).
- **Tests:** `tests/battle-balance.test.js` (the square law; enemy cover; who the enemy goes for; the loose line and the swarm; enemy morale and the lair; the stall guard between waves), `tests/slow/battle-parity.test.js` (every scenario over the odds by 25 points at most and ending; the close fights' average in range). `tests/clock.test.js` now checks the clock only while a battle is still on.
- **Not done here:** the owner's phone session (can a close fight be turned by fighting well?).


**Problem.** Fighting in person with a company wins almost every close battle (88–100% at 50–75% odds), so a strong fighter has nothing to turn. Owner, 2026-11-18: Simulate should be only slightly worse than fighting, and fighting yourself a bit more likely to win close battles.

**Now.**
- V2-T2 measured the gap. Auto-resolve: company soldiers count ×1.5; winner's loss 0.2 × odds ratio.
- Fought battles are easy because of V2-08 (shields, cover, ranks) and enemy routs.
- Enemy bands (looters, reavers) have no shields; patrols do.

**Build.**
- **Enemy tactics:**
  - enemy shield troops use cover and ranks;
  - enemy groups keep a loose line instead of streaming in;
  - targeting prefers the exposed (archers, the wounded, the hero when alone).
- **Morale:** enemy morale a little steadier, for example the outnumbered penalty halved for bands defending their lair.
- **Content (optional):** Reaver bands get one shielded troop (content only).
- **Re-check:** Balanced, the hero-down charge and the bot hero's fights. Keep auto-resolve's ×1.5, or lower it back toward 1.2, so the gap ends 5–15 points.

**Save.** None (content only for a new troop).

**Edges.** SC-36 (ten fights on defaults won) still holds; the presets still differ.

**Tests.**
- **Parity:** `scripts/parity.js` (H-01): fought results 5–15 points over the stated odds in close fights.
- **Unit:** enemy cover works.
- **Re-runs:** Prototype G and the economy report.

**Acceptance.** The parity target is met; the owner's phone session confirms a close fight can be turned by fighting well.

---

### P7-01 · Surgeon (S–M) — ✅ Done in 2.12.0

**Done (2.12.0, 2026-11-19).** As specified, with these notes (`js/surgeon.js`):
- **The follower:** hired in a town (Accounts), 60 crowns and 10 a week with the wages; unpaid twice, they leave.
- **Medicine:** a supply in `data/markets.js` (15 crowns, weightless), bought at any market on the Accounts screen, and by the quartermaster to a reserve while a surgeon rides with the company: the first per-good rule (`medicine`, default 4, 0–20, within the same weekly budget, drawing from your purse into the chest as for food). Captors take half (rounded up).
- **Triage** (fought and auto-resolved alike): each fallen soldier still gets one roll from the same stream as before. Without a surgeon, below 0.35 dies. With one, below 0.22 dies; 0.22–0.35 is saved with one medicine while there is any, and without medicine only from 0.30 up. The saved are wounded instead; wounds heal in 1.5 days, not 2. Medicine is spent when the result commits (exactly once). The result screen names who was saved and the medicine used and left.
- **Measured:** over 2,000 rolls, deaths among the fallen are 35% without, 22% with medicine, 30% without medicine. Campaign bot, 8 × 30 days with a surgeon and quartermaster from day 0: 74 soldiers fell against 154 without, 42 lives saved, about 300 crowns less at the end (wages and medicine).
- **Also fixed:** a screen now opens at its top. Coming back from a long one (Accounts) left the settlement menu scrolled with its top buttons out of view on a phone.
- **Save:** schema **v11** (`medicine`, `followers.surgeon`).
- **Tests:** `tests/surgeon.test.js` (8: the thresholds; deaths measured; one roll each either way; committed once, faster healing, the saved named; auto-resolve's triage; towns only, wages, leaving unpaid; medicine bought, the quartermaster's rule, capture; saves, repair and the 10 → 11 migration), `tests/browser/surgeon.spec.js` (hire and buy on the Accounts screen at both sizes).


**Problem.** Every battle kills soldiers at the GDD's fixed 35%, with nothing the player can do but fight better.

**Now.** `party.rollCasualties` (`DEATH_CHANCE` 0.35, `WOUND_DAYS`); followers framework (`c.followers`, payday, the Accounts screen).

**Build.**
- **The follower:** a Surgeon hired in towns (60 crowns, 10 a week).
- **Supplies:** uses medicine, a new supply, with a quartermaster per-good rule (the first such rule).
- **Triage after battle:**
  - the death chance falls (for example 0.35 → 0.22);
  - wounds heal faster (2 → 1.5 days);
  - each saved life costs one medicine;
  - triage names who was saved.
- **Without medicine,** a smaller benefit. Auto-resolve uses the same rule.
- **Randomness:** the surgeon changes the death threshold, not the number of rolls. There's still one roll per soldier from the seeded `casualties` stream, so seeded results and existing tests stay aligned.

**Layers.** Default: just works. One decision: hire. Expert: a medicine reserve rule.

**Save.** Yes.

**Edges.** Capture may take supplies; unpaid, the surgeon leaves.

**Out.** The hero's injuries; disease.

**Tests.** Deaths per battle measured with and without; supplies spent once; the report; save and reload.

**Acceptance.** Fewer deaths (measured), clearly reported, at a real upkeep.

### P7-02 · Scout (S–M) — ✅ Done in 2.15.0

**Done (2.15.0, 2026-11-19).** Built on P7-04's sight rules, with the numbers set here (`js/scout.js`):
- **The follower:** hired in a town (Accounts), 45 crowns and 8 a week with the wages; unpaid twice, they leave.
- **Sight:** the company sees ×1.5 (18 map units by day on open ground).
- **Warnings:** the first sight of a hostile party (a band, or the patrol of a kingdom that counts you an enemy; not story bands or the caravan you escort) is reported with a scout's numbers ("a few", "about 6", "about 15"), a compass direction, and "riding this way" when it is. The same party is reported again at most every half day. What the company can't see, the scout can't report. Over 4 bot campaigns of 20 days: about 1.6 warnings a game day.
- **Route estimates** as you set off (not for rides under half an hour): the straight-line ride time from the map's own estimate, said as a scout would ("about 3.5 hours", "about 2 days"), and the hostile parties seen or last seen within 6 units of the way. There's no route planning (W-09), so the estimate is of the straight ride the company actually takes; a test checks it within 10% of the real time.
- **Ground:** attacking a band gives a deployment zone ×1.25 each way. Not when ambushed.
- **Save:** schema **v13** (`followers.scout`).
- **Tests:** `tests/scout.test.js` (6: towns, wages, leaving unpaid; sight with and without; warnings by the sight rules, numbers, heading, once per half day, none without a scout or for friendly traffic; the ride estimate against the real ride and the dangers named; the deployment zone; saves and 12 → 13), `tests/browser/scout.spec.js` (hire, the estimate on setting off, a warning, at both sizes).
- **Waiting on the owner:** whether the warnings are useful and not noisy.


**Build.**
- **The follower:** a Scout.
- **Effects:**
  - a wider detection radius;
  - earlier pursuit warnings with sizes;
  - route estimates (days and danger) when choosing a destination;
  - a bigger deployment zone when you catch a band.
- **Honest uncertainty:** "about 8 Reavers".

**Save.** Yes.

**Tests.** Detection with and without; warnings follow detection rules; route estimates within 10% of actual.

**Acceptance.** As tests; the owner finds the warnings useful, not noisy.

### P7-03 · Blacksmith (S) — ✅ Done in 2.13.0

**Done (2.13.0, 2026-11-19).** The numbers the spec left open were set here (`data/items.js` `forge`, `js/blacksmith.js`):
- **The follower:** hired in a town (Accounts), 50 crowns and 8 a week with the wages; works wherever the company is; unpaid twice, they leave.
- **Forging** the hero's equipped weapon, shield, helmet, body armour, gloves or boots, at most twice each:
  - each level adds damage +2 (weapon), armour +2 (body) or +1 (the rest);
  - it costs 30% of the piece's value × the level in crowns (at least 10) and 1 iron × the level (2 for body armour) from your cargo.
  - The piece becomes its own item, "Arming Sword +1" (`arming_sword+1`), worth 30% more per level. These items are made from the rules when the content loads, so inventory, equipment, saves and selling need nothing new. No armoury stocks them. Horses, rings and quest items aren't forged.
- **No money loop:** a forged piece sells at half its value, at most 0.8 × the plain value, never reaching the armoury's 1.3 × for the plain piece. A test checks every forged item at the best Trade.
- **Fine kit** for up to five named soldiers: +1 armour and +8 hit points in battle, ×1.15 strength in auto-resolve, for 40 crowns and 2 iron each. It stays through promotions and is lost with the soldier.
- **No durability** (design §12.4).
- **Fixed on the way:** fine kit must reach soldiers in the first deployment too, not only those stepping in from reserve (the test caught it).
- **Save:** schema **v12** (`followers.blacksmith`; forged ids and `kit` need no step).
- **Tests:** `tests/blacksmith.test.js` (6: the forged items and armouries; forging, its costs, the cap and the reasons; no money loop; fine kit's cap, costs and effect in battle and auto-resolve; towns, wages, leaving unpaid; saves, repair and 11 → 12), `tests/browser/blacksmith.spec.js` (hire, forge and fit by real input at both sizes).


**Build.**
- **The follower:** a Blacksmith.
- **Hero:** paid upgrades of the hero's weapon and armour (at most twice per item).
- **Soldiers:** "fine kit" for up to five named soldiers; costs crowns and iron.
- **No durability** (design §12.4).

**Save.** Yes.

**Edges.** Upgraded items sell for more but never above the armoury's markup (no flipping).

**Tests.** Caps, costs, no money loop, save and reload.

**Acceptance.** Targeted, capped, optional.

### P7-04 · Pursuit and detection (L) — ✅ Done in 2.14.0 (without "Avoid danger" routes, which wait for W-09)

**Done (2.14.0, 2026-11-19).** The owner gave no answer on route planning, so the "Avoid danger" routes were left with W-09 and everything else was built. The numbers were set here (`js/sight.js`):
- **Sight** in map units of gameplay distance: a party sees its `detection` (bands 9, patrols 7), the company 12. Night (20:00–05:00) ×0.6; a watcher on hills or mountains ×1.3; the watched in a forest ×0.6. Parties looking for the company also scale by its size (×0.7 alone, +0.03 a person, ×1.3 at most) and by **Hide** (×0.4). Hide is a map button (H) shown in a forest while standing still; setting off breaks it.
- **Pursuit:** a band, or a Hostile kingdom's patrol, that loses sight of the company rides to where it last saw it, searches within 3 units for 3 hours, then gives up ("…have lost sight of you"). Story bands, ambushes and contract bands keep their own behaviour.
- **The map** shows only the parties the company sees, plus a faded mark with a "?" where it last saw the rest. The mark lasts a day; a contract target's is kept until found. The giver marks where the target is when you take the contract. Story bands and the caravan you escort always show. A party you can't see can't be tapped, and edge arrows point to where you know a target is. The map darkens at night.
- **Bots:**
  - the campaign bot hunts a contract target by what it knows: it rides to the last-seen mark and waits and watches there (the first version stalled, riding to the spot it stood on);
  - a broke lone rider (no soldiers, under 30 crowns) now takes an even fight, at a lair or on the road, instead of waiting for 55–60% odds. In the slow test, seed 7 of the eight 15-day starts lost its first two fights and, now that lone riders are harder to spot, never met another it would take on;
  - the story bot needs nothing new (story bands always show).
- **Save:** still schema v12. Optional new fields: `world.hidden` (only while true), and a party's `lastSeen` and `seenAt`. All are repaired on load.
- **For other systems' tests:** `CL.sight.options.rules = false` gives sight as before (W-02's zoom-independence tests use it).
- **Tests:** `tests/sight.test.js` (7: the sight factors; size and Hide; a band losing you in a forest, searching and giving up; a Hostile patrol searching; the map's marks and memory, unseen parties not tappable, contract marks; story bands and escorts always shown; saves and repair), `tests/browser/sight.spec.js` (Hide in a forest, none in the open, an unseen band not tappable, at both sizes).
- **Not done:** "Avoid danger" routes (W-09).


**Problem.** Parties see everything within a radius and chase in straight lines.

**Now.** `parties.wantsPlayer` compares distance with `detection`; `chooseTarget` chases the player's current position.

**Build.**
- **Vision:** day and night (the clock has hours); forests hide, hills extend sight.
- **Pursuit:** last-seen positions, searching, then giving up.
- **The player:** the company's visibility by size; a **Hide** stance in forest; pursuit warnings.
- **Map:** shows only parties the company sees, with last-seen marks for the rest (as battle detection, V2-06).
- **Routes:** "Avoid danger" (W-09).

**Layers.** Default: it just happens, with warnings. One decision: Hide or Avoid danger.

**Save.** Yes.

**Edges.** Quest bands keep their behaviour; contract targets stay findable (last known position shown).

**Tests.** Each rule; bots still find contract targets; the story bot still finishes; browser tests for hidden and last-seen marks.

**Acceptance.** A band loses you in a forest; a patrol searches your last-seen spot; nothing a quest needs becomes unfindable.

### P7-05 · Officers and detached patrols (L) — ✅ Done in 2.16.0

**Done (2.16.0, 2026-11-19).** The screens and presets were designed here (`js/detachments.js`, the Detachments screen):
- **Captains:** a tier 3 veteran with at least 10 battles, or the fit companion.
- **Detachments:** chosen fit soldiers leave the company's roster for the detachment, with their records. Each soldier is in exactly one party; they still count toward the party cap (`CL.party.headcount`). A detachment is a world party (template `company_detachment`, kind `detachment`), drawn in gold with the captain's initial and always shown.
- **The order package:**
  - **objective:** hunt bands within 15 units of where you are, or patrol a road between the two nearest settlements;
  - **days:** 1–14, default 5;
  - **turn back:** below half (the default), below a third, or never;
  - **avoid stronger parties:** on by default;
  - **autonomy:** judgement (the default; only fights at 55% odds or better) or exact (takes on any band in its order);
  - **food:** days + 1 of rations, from your stores;
  - **pay:** the wages for the period plus a quarter, from the chest, then your purse.
- **One decision** (the default layer): pick a captain, "Half the company", Send.
- **Its life:** it moves by the world simulation's rules and fights bands it meets, auto-resolved like any off-screen fight. Each soldier who fought counts the battle once, the wounded heal on the usual clock, and the fallen go on the roll of honour. Spoils go to its purse, half the renown to you. Its log gets a line a day and every event, and events reach you as messages.
- **Turning back:** its time is up, its food runs out, it falls below the set strength, it is beaten, its pay runs out, or a courier you send reaches it (6 units an hour). It rides back to the company and rejoins on meeting. You can also ride to it, or rejoin on the screen when it is beside you.
- **Rejoining (SC-17):** soldiers return to the roster, the purse to the chest and the food to the stores, exactly once. A final report is kept with the last three back.
- **Beaten (SC-18):** the captain comes back wounded (a soldier) or downed (the companion) with the survivors. If nobody is left, the detachment is gone with its purse and food.
- **Pay and desertion** are its own: wages from its purse each payday; unpaid, one soldier (the least senior, never the captain) slips away and it turns back.
- **The story:** a companion leading a patrol when Q3 sends her (`send: 'mara'`) is called back first, with a message, and the patrol heads home without her. Fights are instant, so a detachment is never in two battles, and a locked party (V2-09) is skipped.
- **Save:** schema **v14** (`detachments`). Soldier IDs are unique across the company and its detachments on load. A missing map party is re-made, and the account is set from the purses.
- **Tests:** `tests/detachments.test.js` (10: captains; sending and the one-party rule; a hunt recorded once; rejoining once; beaten; the reasons to turn back and the courier; pay and desertion; the companion and Q3; saves mid-order with repairs and 13 → 14; a week's hunt in a living world with every soldier and crown accounted for), `tests/browser/detachments.spec.js` (send and recall by real input at both sizes).
- **Fixed on the way:** the Party sheet's Detachments button first sat in the tab row, and at larger text on phones it squeezed the tabs until their labels spilled out; it has its own row now.
- **Not done:** escorting a caravan and garrisoning a village (the spec's later objectives); detachments joining your battles as reinforcements.


**Problem.** Nothing can be delegated; soldiers can't act without the hero.

**Now.** One roster; Mara with the story's `send` and `recall`; world parties from templates.

**Build.**
- **Captains:** appoint Mara, a companion (P7-06, ✅ 2.17.0), or a veteran soldier (tier 3, at least 10 battles).
- **Detachments:** a separate party with chosen soldiers (each soldier in exactly one party).
- **Order package** (design §11.3):
  - objective: patrol a road, hunt bands in an area, escort a caravan, garrison a village (later);
  - constraints: avoid stronger parties, retreat below half strength, return by day N;
  - resources: a food and wage budget from the chest;
  - autonomy: exact or judgement.
- **Its life:** it moves and fights by the world simulation's rules (auto-resolve). Soldiers' histories count once.
- **Reports:** daily or on events, and a final report.
- **Recall and merge:** by meeting it or by courier.

**Layers.** Default: no detachments. One decision: send a patrol with a preset order. Expert: constraints and budgets.

**Save.** Yes.

**Edges** (SC-17, SC-18):
- a defeated captain returns wounded with survivors; everything reconciles once;
- no detachment in two battles (the V2-09 lock);
- **a companion away on a detachment when a story stage sends them** (Q3's `send: 'mara'`) is recalled first, with a message;
- pay and desertion per detachment.

**Out.** Armies (P9-05); vassals' parties (P8-01).

**Tests.** The soldier-in-one-party invariant; reconciliation once; save and reload mid-order; Prototype C extended; the Q3 interaction.

**Acceptance.** SC-17 and SC-18 pass; a bot sends a patrol that hunts for a week and returns with consistent records.

### P7-06 · More companions (M) — ✅ Done in 2.17.0

**Done (2.17.0, 2026-11-19).** `js/retinue.js`, three entries with `retinue: true` in `data/companions.js`, their errands (`data/quests.js`) and trees (`data/dialogue.js`):
- **Who:** Sigrun (Hrothgard, Hrothmark; +1 Tactics, 8 a week; likes bands broken, hates tolls paid to Reavers), Iacopo (Vessara, the League; +1 Trade, 12 a week; likes a wage on time, hates a missed one) and Livia (Tessaro, Aurelian; +1 Shield, 8 a week; likes caravans brought through and bands broken, hates attacks on a kingdom's patrols or caravans). Mara stays the story's companion (`c.companion`); these are `c.retinue`.
- **Joining:** each is met in their home and joins after a small errand: Sigrun's raiders at the Raider Steading, Iacopo's 120-crown debt, Livia's deserters at the Deserter Camp. The join option needs room in the company (`{ room: 1 }`); a full company is told to come back. The story effect `{ retinue: id }` joins them.
- **With the company:** a party slot (all of them, away or not), food, a weekly wage on payday (and in the quartermaster's wages due), a unit beside the hero in battle (wounded when they fall, never killed; `woundDays` 2), their skill while fit, and their strength in auto-resolve.
- **Captains:** fit retinue companions are offered as detachment captains (`kind: 'companion'`, their id); they are `detached` while they lead; beaten or lost, they come back wounded; leaving the company while out, the patrol turns home without them (`CL.detachments.loseCaptain`).
- **Loyalty** (0–100, from `loyalty.start`): +2 paid, −12 unpaid, +1 a victory, −3 a defeat, plus their own `likes` / `dislikes` (bands beaten, a kingdom attacked, a toll paid, a caravan saved, paid, unpaid). Below 35 they warn you and say why (once a day); below 15, and only once warned on an earlier day, they leave for good, saying why. Shown on the Party sheet with their mood and what they care about.
- **Save v15:** `retinue: [{ id, woundedUntil, equipment, loyalty, unpaid, warned, warnedDay?, why, detached? }]`; the gone (`<id>_gone` flag) never come back.
- **Tests:** `tests/retinue.test.js` (join, lead, leave, loyalty rules, battle wounds, saves) and `tests/browser/retinue.spec.js`.

**Build** (as specified).
- Two or three companions in different regions, each with a background, a motive and a small recruitment quest.
- Each can captain.
- **Loyalty** from pay, victories, and motive met or offended: warnings, then leaving, never without warning.

**Save.** Yes.

**Tests.** Join, lead, leave; loyalty rules.

**Acceptance.** Each can be recruited, lead, and leave for stated reasons.

### P7-07 · Soldier traits (S) — ✅ Done in 2.18.0

**Done (2.18.0, 2026-11-19).** `js/traits.js`:
- **Milestones** (from the soldier's own record, checked after each battle and each wound; the first reached decides, once, never changed): Steadfast at 8 battles, Cautious at 2 wounds, Impulsive at 8 kills. Told as a message ("Tam Owl has become Steadfast after 8 battles with the company."), kept as a `trait` note, shown on the soldier's row and card (with the milestones still to reach when they have none) and on the roll of honour.
- **Fought battles:** Steadfast +6 cohesion to their group for each standing (up to +18, `parts.steadfast` in js/morale.js); Cautious engages at × 0.7 the distance, strikes a runner only within 60 px, takes × 0.8 from each blow; Impulsive engages at × 1.5, deals × 1.15 and takes × 1.2.
- **Auto-resolve and patrols:** strength × 1.05 / 0.95 / 1.1 and the chance to fall × 1 / 0.75 / 1.3 (a per-soldier factor in `rollFallen`; the same rolls are drawn, so the stream is unchanged without traits).
- **Measured** (`tests/traits.test.js`): over eight seeded fights of six footmen against eight looters, an impulsive company takes over 10% more damage and a cautious one over 10% less; a steadfast group that lost half its number keeps at least +9 cohesion.
- **Save:** an optional `trait` on soldiers, their `trait` notes and roll-of-honour entries; unknown values dropped on load. No schema step: nobody had one before.

**Build** (as specified).
- **Traits:** Steadfast (group cohesion bonus), Cautious (less pursuit, fewer losses, slower to engage), Impulsive (earlier engagement, more kills, more wounds).
- **Earned at milestones,** not random spam.
- Shown on the soldier card and the roll of honour.

**Save.** Yes.

**Tests.** Each trait's effect measured; milestones trigger once.

**Acceptance.** Traits change battles measurably and are earned visibly.

### P7-08 · Dynamic world events (M) — ✅ Done in 2.19.0

**Done (2.19.0, 2026-11-19).** `js/happenings.js` (`CL.happenings`), content in `data/world_events.js` (not `data/events.js`: `CL.events` is already the domain event bus):
- **Starting:** once a day from day 2, a 45% chance that one event starts, at most 3 open, one per settlement, chosen by weight among the (kind, place) pairs whose conditions hold and whose cooldown (per kind and region) has passed. The rolls come from the campaign's seed and the day, never the world random stream.
- **Five kinds**, each with its condition, its one decision (take part or not) on a card in that settlement, and its stated consequence if ignored:
  - food shortage (grain 0.08 above usual, a kingdom at war, or a lost caravan): sell 20 rations at the old price → eased | grain left 0.2 above usual;
  - infestation (a village): a band near it, sized against the company, with a bounty paid to whoever beats it (taking it marks the band) → cleared, or others if someone else does | farms plundered (grain and wool dearer);
  - militia request (a kingdom at odds): drill them for a day (XP, crowns, +4 reputation) → drilled | −2 reputation, only if you were there and rode on;
  - courier (a town): carry a letter 20–70 leagues → delivered (crowns, renown, reputation) | late (−2, if you took it) or ignored;
  - refugees (near a war or a clash in the region): feed them (15 rations) or take on two levies → fed / took | grain dearer.
- **Reported and remembered:** each start and end is a news line (written by the event); what the company had a hand in (took part, or was there and rode on) goes into the chronicle; the Journal lists open events you know of. Events never touch story flags, quests, owners or services.
- **Save v16:** `happenings` (open, past, cooldowns, next check); a band's `eventId`; news events may carry a written `text`. Tests: `tests/happenings.test.js`, a 90-day bot run in `tests/slow/happenings-bots.test.js`, `tests/browser/happenings.spec.js`. A debug button, World event here, starts one where you are.


**Build.**
- **An event system** (`data/events.js`): conditions on world state, an effect, and a choice for the player when nearby.
- **First events:** food shortage, infestation (bounty), militia request, courier on the road, refugees.
- **Each event:** resolves once (result ID); has a duration; ignoring it has a stated consequence; feeds the news and the chronicle.

**Layers.** Default: reported. One decision: take part or not.

**Save.** Yes.

**Edges.** Cooldowns per region and kind; never blocks the story.

**Tests.** Each event's trigger, single resolution, ignore consequence and cooldown; 90-day bot runs without loops.

**Acceptance.** As tests; events show in the news and the chronicle.

### P7-09 · Tournament (M–L) — ✅ Done in 2.20.0

**Done (2.20.0, 2026-11-19).** `js/tourney.js` (`CL.tourney`), rules in `data/tournaments.js`, the tourney ground `tourney_lists` in `data/battle_maps.js`:
- **Schedule:** the five great towns (no "capital" flag exists; these are the capitals and the free city) each hold one every 14 days, staggered by 3 from day 4, announced in the news; entries open 3 days. Seven named fighters of the town's people (from its culture's names), skill 0.8–1.2; your rival takes the last place 60% of the time, in the other half of the draw.
- **The duel** (`enc.duel` in `js/combat.js`): the hero alone on a one-screen fenced list against one fighter; no soldiers, companions, reserves, help riding in, prepared setup, morale or stall guard; the orders and MAP buttons hidden. The hero's numbers come from the loaner kit (arming sword, kite shield, iron helm, gambeson, boots) through `CL.character.heroCombat(c, kit)`: the hero's own gear is never moved, so there is nothing to restore or lose. `CL.party.endBattle` hands the result to `CL.tourney.endBout`: no encounter commit, no casualties, loot, time or reputation from a bout.
- **Bracket:** three bouts; the other bouts are settled by skill (`a / (a + b)`, from the tournament's own seeded rolls). The fighter you meet: a mercenary, then a tougher mercenary, then a sellsword, multiplied by round, by the fighter's skill and +8% for each earlier win in that town.
- **Fee and prizes:** fee 20 + ½ renown (20–150). Champion 150 crowns, 5 renown, +4 with the host's kingdom; finalist 50, 2, +1; out in the first bout −1 renown. Each earlier win in the town multiplies the prize by 0.6 (never below 0.2). Cooldown 28 days per town; one bracket at a time. Measured: winning every time allowed in one town pays at first and then costs, under 500 crowns net over 30 wins.
- **Rival:** whoever beats you (or, if you win, the finalist you beat), with their skill rising by 0.05 each time they beat you; besting them in a bout gives +2 renown. A chronicle line for every tournament fought; the news tells the result.
- **Reload mid-bout:** the bracket is saved with `bout` set before the fight; outside a battle `settle` counts an unfinished bout as lost (never replayed).
- **Save v17:** `tourney` = `{ hosts, open, bracket, rival }`. Tests: `tests/tourney.test.js`, `tests/browser/tourney.spec.js` (a bout won with ATTACK by touch). Debug: Tournament here.


**Now.** No duel or one-on-one mode exists in the code. Battles are always party against party (`js/combat.js`), on the small or large maps.

**Build.**
- **The event:** an eight-entry foot-melee duel bracket in capitals every couple of weeks (announced in the news).
- **A one-on-one arena mode** (new):
  - built on the battle engine: the hero against one AI fighter, no soldiers, no reserves, no orders panel;
  - a one-screen arena map;
  - loaner tournament gear that replaces the hero's own for the bout and is restored afterwards, never lost;
  - the result goes to the bracket, not the encounter commit path (no casualties, loot or reputation from bouts).
- **Entry:** a fee.
- **Rewards:** prizes, renown, a chronicle line, host reputation, a named rival.
- **Losing:** costs the fee and a little renown, never the company.

**Save.** Yes.

**Edges.** Anti-farm: a cooldown per town, falling prizes for repeat wins in one town, fees that rise with renown.

**Tests.**
- Bracket logic, reward and fee bounds, no infinite reward, the AI difficulty curve.
- The hero's own gear is restored after every bout, including after a reload mid-bracket.
- A browser test of a duel on touch.

**Acceptance.** A playable bracket on touch; the anti-farm rules hold.

### P7-10 · First business: a mill (M) — ✅ Done in 2.21.0

**Done (2.21.0, 2026-11-20).** `js/business.js` (`CL.business`), rules in `data/businesses.js`, a new trade good `flour` (base 18) in `data/markets.js` with a baseline in every market (½ grain's + ½, +0.1 in towns):
- **Buying:** in a village (300) or town (600) with a market, from the town screen, not from a Hostile owner, one mill at a time. The card shows what the village miller would make at today's prices (`estimate`).
- **Running it:** each payday (from `js/upkeep.js`, with that day), with no clicks: the law first, then the manager's wage from the mill's own money (`budget:mill`; too little and it stands idle), an 8% chance of a breakdown (20 crowns, no grinding), then grinding through `CL.trade.buy` / `sell` in that market (the same prices and scarcity; `carry: false`, so nothing in the wagons). It grinds a sack only while its flour, after the owner's 10% due, beats its grain by the margin (1 crown), within the price rules, its money and the week (village miller 20 sacks, yield 1, 6 a week; master miller 30, yield 1.2, 12 a week, 60 to hire). The report gives the numbers and, when it stopped short or had a bad week, why.
- **Ledger:** every transfer touching the mill's money goes to the mill's own book (120 lines); money between it and your purse is in both. Captors never take it (it stays at the mill). Over 90 days its money equals its book exactly and the sum of the weekly reports.
- **Measured (13 weeks, 300 put in):** Oakford +236 (master +326), Highmere +90, Stonebridge +394 (master +778), dear-grain Eldmoor and Dunmarsh lose the wage each week and say why.
- **The owner's law:** every owner takes the due. A change of hands is told. A Hostile owner (now or later) warns and seizes the mill and its money after 7 days unless you sell or mend relations; told in a message, the mill's log, the chronicle and the list of past businesses. The law is checked first on payday, so a mill seized that day neither pays nor grinds (§27.4). Selling works from anywhere: 60% of the price paid (never more) plus its money.
- **Expert:** price rules (most for grain 8–14, least for flour 11–17, or none).
- **Fix on the way:** `CL.trade.drift` rounded each step to a thousandth, so on the map (a few minutes a frame) markets hardly restocked; it keeps a millionth now, and a day in 1,440 steps restocks like one.
- **Save v18:** `businesses` = `{ owned: [mill], past }`; chronicle kind `business`. Tests: `tests/business.test.js` (17), `tests/browser/business.spec.js`. Debug: Mill: run a week; Mill: owner Hostile.
- **Not done:** the inn (later); settlements other than forts never change hands yet, so the change-of-hands case is tested by setting the owner directly.

**Spec (kept for the record).**

**Build.**
- **Buying:** a mill in a village or town.
- **Running it:**
  - a manager (default or hired);
  - buys grain and sells flour through the same market functions;
  - a ledger under its own budget account;
  - weekly reports, including bad weeks and their causes.
- **When the settlement changes hands:** the new owner's law (a tax, or seizure if Hostile), with a warning and the option to sell; never vanishes silently (SC-16).
- **Later:** an inn.

**Layers.** Default manager. One decision: buy or sell. Expert: price rules.

**Save.** Yes.

**Edges.** Input- and market-limited (no infinite money); selling never returns more than the price paid.

**Tests.** Ledger exactness over 90 days; no money loop; the owner-change cases (SC-15, SC-40).

**Acceptance.** Runs without daily clicks; reports costs and failures; survives changes of owner by the rules.

### P7-11 · Battle extras (M) — ✅ Done in 2.22.0

**Done (2.22.0, 2026-11-20).** `js/formations.js` (`CL.formations`: the infantry's formations and the lie of the land), `js/objective.js` (`CL.objective`: the escort's wagon), a generated Hill Slopes battle map (`js/arena.js` `hills`, `data/battle_maps.js` `hill_slopes`; the world's hills and mountains now fight there), a formation row in Orders, and `scripts/extras.js` to measure each effect on its own. No save change: a formation and a wagon last one battle.
- **Shield wall** (Orders → Wall; Defensive starts in one): on Hold and Follow the infantry close up (files 22 px apart, not 28), walk at 70%, keep their shields up whenever a foe is near in front or an archer in front has them in range, strike over them (the shield drops only for the blow), and a raised shield covers the soldier on either side out to 46 px (34 px and one side, loose). On Charge it breaks up.
- **Wedge** (Orders → Wedge): on Follow and Charge a point ahead of the hero, 15% quicker, and the first blow on each new foe lands ×1.3 and shakes them as a flank blow does (morale); no shield cover given or taken. On Hold it falls back to loose.
- **High ground:** the hill map has three rises (the company's knoll, a hill between the armies, a knoll on the enemy's side). An archer on one shoots 25% further, either side's. Archers whose setup starts them on a rise hold it (Balanced, Defensive and Aggressive; not Custom).
- **A ford breaks formations:** a soldier wading the shallows is loose, whatever was chosen.
- **The objective: protect the wagon** (escort ambushes; the spec's alternative, holding a point for a militia request, was not built). The caravan's wagon (70 HP, armour 2, an obstacle on that battle's own copy of the map) stands behind the company. It is an ambush: the band bursts from cover 420–640 px ahead, and every third Reaver is a wagon-raider who starts behind the company on its flank (420–560 px back, 330–460 px aside, so both groups strike together) and goes for the wagon unless someone stands within 60 px of it. Your soldiers count a raider by the wagon 150 px nearer and leave Follow or Hold for one from 420 px. If the wagon burns, or the fight is lost (fought or simulated), the caravan and the contract are lost (`contracts.onCaravanLost`, as abandoning it). The HUD shows the wagon; the result says whether it came through.
- **Measured** (`npm run extras`, 40 seeds each, the effect on and off on the same encounters; the defensive ones with a steady hero who holds where the company formed up, because the parity bot's hero runs the fight off to the far side of the field):

  | Effect | Win % on / off | Soldiers lost on / off |
  |---|---|---|
  | Shield wall (Defensive) against 8 Reavers and 3 mercenaries | 100 / 100 | 0.63 / 1.07 (and 57 s against 73 s) |
  | Shield wall (Defensive) against 6 crossbows and 6 militia | 100 / 73 | 0.57 / 2.60 |
  | Wedge (chosen in Orders) against 4 looters and 7 Reavers | 75 / 63 | 2.38 / 2.42 |
  | Archers on the knoll against 6 crossbows and 5 militia | 60 / 40 | 4.55 / 5.22 |
  | A ford breaking the wedge (River Ford) | 98 / 98 | 1.27 / 1.73 |
  | Soldiers minding the wagon (8 Reavers, 4 looters) | 93 / 85; wagon saved 63% / 65% | 1.52 / 1.68 |

  Breaking the wedge in the water *helps* the company: a wedge has no shield cover, and that costs more where everyone wades slowly. Minding the wagon wins more fights but does not save more wagons: with the parity bot the hero leads the company to the front and the soldiers do not leave a fight in hand. The wagon is still at stake: lost in about a third of the fights won.
- **Setups:** Defensive's wall, by `scripts/parity.js` (40 seeds): veterans 88 → 95% won, 2.13 → 1.82 lost; outnumbered 53 → 63%, 2.83 → 2.63; the rest the same. Aggressive in a wedge was tried and dropped: outnumbered fell from 80% to 60%. Balanced is unchanged to the decimal.
- **Escort ambushes are a different fight, and now too easy when fought (for P7-T):** the band no longer marches from the far side of the field, and a third of it goes for the wagon instead of the company. With the parity bot, the same company against 8 Reavers and 4 looters wins 93% as an ambush against 17.5% from afar (40 seeds; 3.55 soldiers lost from afar, 1.52 now). Simulate's odds for it are unchanged, so in escort ambushes fighting is now far better than B-01's 5–15 points over the odds. The wagon is the new risk, lost in about a third of the fights won.
- **Fixed on the way:** wagon-raiders left out of the enemy's loose line (B-01); otherwise the line's middle moved behind the company and the rest crawled at 30% speed, waiting for it.
- **Debug:** Hills battle 30, Wagon ambush 20 (practice battles).
- **Tests:** `tests/extras.test.js` (where each formation holds; the setups; Orders; the wall's guard, strikes and cover; against archers; the wedge's point, speed, cover and first blow; the hill map, range and the setups' archers; the wagon on its own map copy, raiders and their targets, the soldiers' care, burning, and the contract won and lost, fought and simulated), `tests/slow/battle-extras.test.js` (each effect's measured difference, 20 seeds), `tests/browser/extras.spec.js` (the formation buttons, the wagon in the HUD).
- **Not done here:** the hold-a-point objective; the owner's phone session for the feel of the wall and the wedge.

**Build.**
- **Formations:** shield wall (infantry on Hold close up, more shields, slower) and wedge.
- **One objective:** protect a wagon (escort ambushes) or hold a point (militia requests).
- **Terrain:** hills give archers range; fords slow everyone and break formations (W-05a's ford map).

**Layers.** Default: Balanced does the right thing. Expert: pick a formation in Orders.

**Save.** None.

**Tests.** Each effect measured under the same rules (SC-42); objectives win and lose; browser test of the formation buttons.

**Acceptance.** Each makes a measurable difference; none is required.

### P7-T · Phase 7 tuning and acceptance (S) — ✅ Done in 2.23.0 (owner's play to come)

**Done (2.23.0, 2026-11-20).** The evidence is in [`docs/PHASE-7-VALIDATION.md`](PHASE-7-VALIDATION.md).
- **The exit as a scripted 90-day scenario:** `tests/slow/phase7-exit.test.js`. The expert bot plays 90 days with the world's events, saving at day 45 and playing on from the reloaded save. At day 90, in all three seeds measured:
  - 19 soldiers;
  - all five roles kept, and 9–10 detachments sent;
  - a mill (−14, +190, +82 crowns) and a merchant up on its stake;
  - 22–23 events seen and 3–4 joined;
  - 3,600–4,200 crowns;
  - no land held.
- **Prototype G with followers and officers** (`npm run prototype-g`): the world's events now run in every style. The expert (`tests/helpers/campaign-bot.js`) also hires a surgeon, a scout and a blacksmith once it has six soldiers (before recruiting more). It sends four soldiers out hunting under a captain when it has ten fit, buys a mill where today's estimate leaves 15 crowns a week, and takes part in events where it can. Over 30 days: hands-off 168 crowns median, presets 614, expert 585 with all five roles. Everyone resumes from the save.
- **Economy pass:** healthy, 534 crowns median at day 60 (448 at B-01), no hardship; no change.
- **Battle passes:** parity unchanged since B-01 (+1 to +14 over the odds).
  - **Escort ambushes brought back into range.** The wagon-raiders now lie still in cover until the band's front closes with the company (one within 95 px of you or a soldier) or one of them is hit. The wagon has 40 HP (was 70). Counting a fight as won only when the wagon comes through, the four ambushes measured are +4, +19, +6 and +26 over the odds: +13.9 on average, against +18.9 in 2.22.0. Tried and dropped:
    - more raiders (+3.3 on average, −23 in one ambush);
    - the band starting further off (−28.6).
  - **Soldiers minding the wagon** still make no clear difference to whether it is saved. That is left for the owner's play.
- **Tests:**
  - the exit (above);
  - the raiders lying in wait (`tests/extras.test.js`);
  - `npm run prototype-g` added.
- **Not done here:** the owner's play. The four checks are listed at the end of the validation document.

**Build.** Prototype G across the bigger world with followers and officers; the design exit as a scripted 90-day scenario; economy and battle passes (parity script); a validation section.

**Carried over from P7-11:** fought escort ambushes are now much easier than Simulate's odds (93% won against 17.5% for the same band met in the open; see P7-11). Bring them back toward B-01's target: a stronger ambush, fewer wagon-raiders, or raiders who hold back until the front has engaged. `npm run extras` and `npm run parity` measure it.

**Acceptance.** The exit holds in the bot and in the owner's play.

---

## Phase 8 — The Landed World

_Re-specified 2026-11-20 at build 2.23.0 (commit 09176e8); NEXT-PLAN §5 has the build order, readiness and corrections, and §8 the decisions (D-P8a–D-P8e). The tasks are listed in build order. "Now" is verified at 09176e8._

**What runs through every Phase 8 task:**
- **The design's invariants (§25.3), checked after every world day in the bots:**
  - each holding has exactly one controller and at most one legal holder;
  - each kingdom has exactly one ruler (the office), and nobody holds two rulers' offices;
  - a holder is sworn to the holding's sovereign, or is its ruler;
  - nothing (troops, money, holdings, prisoners) is duplicated or lost across a change of hands;
  - a claim alone never pays revenue or controls a garrison.
- **Reversibility (design §4.4):** every new state has its loss path, tested: grant → loss, oath → release or breach, capture → ransom or escape, appointment → dismissal.
- **The person goes on:** after any loss, the hero still travels, fights, trades and recruits where welcome (SC-20–SC-22).
- **No fixed classes; one set of rules for everyone** (owner, 2026-11-20):
  - **Rank is never stored.** It is what a person holds and which office they have now. A "landless", "lesser" or "great" lord is only a description of their holdings today.
  - **Every lord and the player go by the same rules:** they gain fiefs by grant or by taking a seat, and lose them by siege, revocation or leaving a realm. You can take a lesser lord's village (by taking its seat) and leave them landless, and an AI realm can do the same to anyone, you included.
  - **The ruler is an office, not a kind of person:** `c.rulers[realm] = person`. In Phase 8 it never moves. In Phase 9 it can: a lord, AI or the player, can become a ruler (P9-03, P9-04, P9-06), and a deposed ruler rides on as a lord, landless or not.
- **No holding is ever vacant** (D-P8f, owner 2026-11-20). Every holding has a holder at all times, a lord or the ruler. **Taking a fief** (by siege, P8-06a, or a seat's villages with it), the conqueror, AI lord or player, if not the ruler, chooses one:
  - **ask the liege for it:** the liege decides (P8-05's grant order, weighed by opinion in P8-07);
  - **suggest someone** they're on good terms with: if granted, that lord's relationship with the conqueror grows;
  - **hand it to the ruler outright:** relationship and influence with the ruler grow; the ruler holds it and grants it later;
  - **keep it** without asking: the ruler may accept it, or expel them from the realm (P8-04) and send lords to retake it (P8-06a).
  
  When the ruler took it, or it was taken in the ruler's name, the ruler decides who gets it (the player too, once a player can be a ruler in Phase 9). AI lords choose by their needs and opinions (P8-07); a hands-off player gets a default (ask the liege) with one prompt. Until P8-05 ships, a conquest leaves the ruler as holder.
- **Men and women** (D-P8g, owner 2026-11-20). People have a `gender`. Noblewomen hold fiefs, lead their own parties and can be rulers (queens); followers can be women. **Regular soldiers, levies and every troop line, are men**; women soldiers come later as troop types of their own. Text about people uses their gender (lord or lady, son or daughter).
- **The Realm screen** (new in P8-02, from the map like Company and Accounts) grows a tab per task: Holdings, Lords, Allegiance, Fief, Claims. At 812×375, each fits or scrolls, with touch targets of at least 44 CSS px.
- **No chores (design §22.6):** each new system works hands-off, with a default and at most one weekly line in the week's log. Urgent events (your fort besieged, a summons, a ransom offer) interrupt, and nothing else does.
- **Debug:** each task adds the cheats that reach its state (grant a village or a fort, start a siege, capture a lord, make a lord landless, and so on).
- **Tests by tier** (owner, 2026-11-20; NEXT-PLAN §7, "The test tiers"): every task runs `npm test`, lint and its own browser specs on desktop and phone. The full browser suite runs when shared UI changes. Only the slow files the task's code reaches run with it. The whole slow suite (about 28 minutes, nearly all the 60-campaign story check) runs at the checkpoints after P8-01, P8-05, P8-06b and P8-T. The slow files each task is expected to need:

  | Task | Slow files | Checkpoint |
  |---|---|---|
  | P8-01 lords on the map | `world-sim`, `campaign-bots`, `battle-parity`, `happenings-bots`, `test-world` | **Whole suite** |
  | P8-04 allegiance | `campaign-bots` | |
  | P8-05 fiefs and castellans | `campaign-bots`, `phase7-exit` | **Whole suite** |
  | P8-06a sieges on the map | `world-sim`, `gate-d-campaigns` (sieges near the story forts) | |
  | P8-06b the assault battle | `battle-parity`, `battle-extras` | **Whole suite** |
  | P8-07 named nobles | `campaign-bots`; ran also `landed`, `world-sim`, `happenings-bots` (sieges, grants and the lords' riding changed) and the new `prototype-f` | |
  | P8-08 losing and retaking land | `campaign-bots`, `test-world`; ran also `landed` (siege targets, revocation) and both prototypes | |
  | P8-T tuning and acceptance | all, with Prototypes D and F | **Whole suite** |

  A task that turns out to reach more than its row runs those files too, and says so. **From P9-L1 the rows are replaced by each task's Brief (its "Run" line), and the way of working below.**

### How each task runs from P9-L1 (owner, 2026-11-23)

The battle tasks took long and spent most of their effort around the task: reading the whole plan, re-running suites, and tuning loops. From P9-L1 a task is done by its section alone. Each task below ends with a **Brief**: where to start in the code, the defaults already decided, the save step, the build order, the tests to write, the checks to run, what to play and what to leave out. The owner's rules (commit only when asked; never push, tag, open pull requests or publish; same rules for the AI; only what a character could know; plain short sentences) are unchanged.

1. **Read** this section, the task's own section and the files its Brief names. Not the rest of this file, NEXT-PLAN, ROADMAP, the release notes or the review log, unless the Brief points there. The Brief's numbers and names are the defaults: use them; nothing in a Brief needs the owner's answer.
2. **Build** in the Brief's order. Content facts (realm names, laws, numbers) go in `data/`; no kingdom name or 0–100 bound literal in `js/` (the grep tests); every right through `js/rights.js` or `js/realm.js`. Files with LF line endings (on Windows, the Edit tool or Python with `newline=''`).
3. **Check, once each,** in this order; a step that fails is fixed and that step alone run again:
   - while building: the task's own Node files only (`node --test tests/<file>.test.js`);
   - at the end: `npm test` (about 3 minutes) and `npm run lint` (about 1 minute);
   - the browser specs the Brief names, both projects (`npx playwright test tests/browser/<file>.spec.js`). The full browser suite only at checkpoints, or when the task changes the HUD, the overlay's layout or shared rules in `style.css` (not for a button or card inside one screen);
   - the slow files the Brief names, once, in the background, sequentially (`node --test --test-concurrency=1 tests/slow/<a>.test.js …`), while the docs are written. `battle-parity` takes about 26 minutes since 3.5.0 (its sieges fight at 150): run it only when the task changes combat, the assault or auto-resolve;
   - a measurement (`node scripts/landed.js <days> <seeds>`, `node scripts/parity.js …`) with the Brief's numbers, once.
4. **Tuning is time-boxed:** at most two changes of a number toward its target. If it is still off, ship the better of the tries and write the numbers in the Done paragraph as open for P9-T. (Most of P9-B5's time went on a third, fourth and fifth try.)
5. **Failures outside the task:** a test in a file the task neither changed nor reaches is run once alone. Still failing: note it in the report and the Done paragraph and go on; don't fix it in this task unless it blocks it. Known flakes under load: the tourney's "BOUT LOST", the battle-zoom pinch and the ford battle on the phone, and the battle-size spec's slow-battle offer.
6. **Play** only what the Brief's "Play" line names: one pass in the preview ("crownless", port 8123) at 812×375, by real taps, and one screenshot. A task with no new screen is played by its scripted case and its `landed` run; no preview.
7. **Docs,** short, in this order: this file (the heading ✅ Done in x.y.0 and a Done paragraph of at most eight bullets: what was built, the numbers measured, what is open); NEXT-PLAN (the row's ✅; a review-log item only if the plan changed); ROADMAP (one line); RELEASE-NOTES (New, Changed, Known, Under the hood with the test counts); `data/help.js` (the topic the Brief names, for player-facing systems only; topics are the `title:` entries near its top, and the first-time tips the table at its end); SAVE-FORMAT (only with a save step); Debug tools as the Brief says. The version in its places: `CL.BUILD` in `js/core.js`, `package.json`, `package-lock.json` (twice), `index.html` (the title, the `<small>` and the version line) and README (the title and the Phase 9 line).
8. **Report** in at most fifteen lines: what changed, the numbers, the checks run, the slow files skipped, what is open; then ask to commit.

**The save step** (P9-01 to P9-06 each add one: v25 to v30). In `js/save.js`: `VERSION`; a `MIGRATIONS[n]` entry (defaults, or the owning module's `migrate`, as `nobles.migrate` does for v24); the required-fields row for the new version (the table at the top, one row a version); the field in `sanitize` through the owning module's `sanitize`. Then `types/crownless.d.ts`, a SAVE-FORMAT entry, and in the module's test file: v(n−1) → v(n), a round trip, junk repaired, and the latest fixture folder (`tests/fixtures/saves-2.30`) loading through the new step. No new fixture folder is needed until the owner plays on a build with the new state.

**Checkpoints** stay: the whole slow suite and the full browser suite after P9-04, P9-06 and P9-T, run in the background in one go.
- **Art:** lord banners, siege camps and wall pieces go to the asset request list (`docs/ASSETS.md`) and ship as placeholders.

### P8-02 · Holdings model (L) — ✅ Done in 2.24.0

**Done (2.24.0, 2026-11-20).** Save schema v19. `js/realm.js` holds the people, the holdings and `transfer`; the world package has `nobles` (26 people: a ruler and five or six lords per kingdom, Merrow none); villages have a `seat` and Greywall and Ashgate are `story: true` (`data/settlements.js`); each culture's names are split into `given` (men's) and `givenFemale` (`data/names.js`).
- **People** (`c.people`, `person:1`…; `c.rulers`; `c.nextPersonId`): `{ id, key, name, gender, realm, home, kin, traits, status, heldBy }`, plus `'player'` as a person with no realm. Every realm has landless lords, lords of one place and lords of several, and men and women among them. Vessaro has a queen (Lucrezia Salviati). Valedorn's and Hrothmark's rulers are kings; Aurelia's is the First Magistrate (factions now say what their ruler is called: `ruler: { male, female }`). Rank is never stored: `realm.standingOf(id)` says great, lesser or landless from what they hold now. A kingdom with no ruler in the data (the W-04 test world's Iron Reach) gets a plain one.
- **Holdings** (`c.holdings`, 30: every settlement of a kingdom; Merrow is marked `freeCity` and has none): `{ kind, sovereign, holder, controller, seat, administrator, claims }`, the holder never null. Readers: `holding`, `holderOf`, `sovereignOf`, `claimsOn`, `villagesOf`, `fiefsOf`, `standingOf`, `locked`, `isCapital`. `realm.owner` keeps its meaning (who controls it) and every caller works unchanged. `realm.holdings(c, f)` is now `controlled` (the old name kept as an alias).
- **`realm.transfer(c, sid, { controller, sovereign, holder, reason, willing, by })`** is the one change of hands:
  - A seat's villages go with its controller, held by the new ruler.
  - A holder who loses a holding against their will keeps an `old` claim, once per claimant, and a claim made good is removed.
  - A grant from the ruler, or a willing return to the crown, leaves no claim.
  - It refuses a holder not sworn to the sovereign, a fourth fief for a lord, a village moved apart from its seat, and a capital's gates (P9-05).
  - It writes the news: `fort_taken`, or the new `fief_granted`. The chronicle (`kind: 'holding'`) only when the player is a party to it.
  - It emits one `HoldingChanged` event per call; nothing listens yet.
  - `setOwner` is now a wrapper: the kingdom becomes sovereign and controller, and its ruler the holder.
- **Story forts:** `realm.locked(c, sid)` until Q4's ending. The Debug panel checks it; `transfer` and `setOwner` don't, so Q4's effect (through `setOwner`) and the tests that move Greywall work as before.
- **Soldiers are men:** `makeName(…, gender)`. Soldiers draw from `given`, or from `givenFemale` for a troop with `gender: 'female'` (none yet; the content checker allows only those two values). Followers and the tournament rival use both lists in the old order, so their names are as before. So does the 4 → 5 migration. Soldiers already in a save keep their names.
- **The Realm screen** (read-only), with two tabs. **Holdings:** each realm's holdings with holder, seat, who holds the gates when it's another realm, claims, and "the story decides it" for a story fort. **Lords:** each person with what they hold or "landless", their kin (son, sister…), home and traits. **A tap on a settlement on the map** says who holds it and for whom, and who has its gates.
- **Debug → Holdings:** next controller (forts; the story lock and capitals refuse), next holder, claim for you. Flip Greywall/Ashgate now refuse until Q4 ends.
- **`realm.invariants(c)`** lists what breaks the design's invariants (§25.3) for holdings and people. The campaign bot checks it after every world day (`stats.invariants`).
- **Save v19:** the 18 → 19 step (`save.migrateHoldings`) is pure and builds the Sundered Realm from constants (`V19_SUNDERED`). A changed fort (Q4's Greywall) passes to its new kingdom with its villages, and the old holders keep claims; another world keeps its owner overrides and `sanitize` completes it. `owners` is gone. A save whose holdings name a kingdom this build lacks is refused, naming it (SC-33).
- **Fixtures:** `tests/fixtures/saves-2.23/`, made from a clean checkout of 9826a3e: fresh, the day-20 campaign, the story bot's play, Q4 ended for Aurelia through the real parley with a mill at Brackenfield, and a Phase 7 company. `scripts/make-legacy-save-fixtures.js` makes the new three when the old build has mills.
- **Tests:** `tests/holdings.test.js` (15, including a 90-day bot run with forts changing hands and the invariants checked every day); `tests/browser/realm.spec.js` (2, desktop and phone). Edited: the realm owners test, the mill's change of hands (now Brackenfield under Greywall), the scout's set-off message, the world-names check (the migration's constants may name kingdoms), and the tests that make an older save from a current one (`tests/helpers/pre-holdings.js`).
- **Not as specified:**
  - **The Realm screen opens from the Journal** ("The Realms: who holds what", on the map and in every settlement), not from a button of its own. A map button pushed the phone's top row into the HUD panel at the larger text sizes, and a settlement-menu button pushed Rest off an 812×375 screen. For the same reason the settlement screen doesn't repeat its holder; the map tap and the Realm screen show it.
  - No existing test failed on a soldier's seeded name, so none needed updating for the men's lists.
  - `happenings.test.js`'s owners check needed no edit (it reads `realm.owner`).

**Problem.**
- **Land is one field.** A fort's kingdom is `c.owners[fort]`, and every other settlement's comes from content. Sovereignty, the legal holder, who occupies it and who runs it can't differ, so dispossession, occupation and claims can't be represented (design §17.1, §24.2).
- **The realms have nobody.** There are no lords to hold land, and nobody to hold land without being the kingdom.

**Now.**
- `js/realm.js`:
  - `defaultOwners`, `owner(sid)` (the campaign's owner for forts, else content `ownerFaction`);
  - `setOwner` (forts only; news `fort_taken`);
  - `garrison` (content troops; the holder's standard garrison when taken);
  - `holdings(c, f)`, `welcomes`;
  - `sanitize`.
- **Callers of `owner`:**
  - recruiting (`js/party.js`);
  - soldiers' culture (`js/soldiers.js`, which reads `owners` in its own sanitize);
  - the story's `owner` condition and effect (`js/story.js`; its validator allows the effect on forts only);
  - dialogue (`data/dialogue.js`: the Greywall lines, and Q4's owner effect in the `greywall_parley` choices; `data/quests.js` has none);
  - news;
  - the mill's owner's law (`js/business.js`, polled on its tick, not an event);
  - contracts (`js/contracts.js`: offers, the giver's owner, escort news);
  - world events (`js/happenings.js`) and tournaments (`js/tourney.js`), which also call `welcomes`;
  - patrols (`js/parties.js`: musters and targets, through `realm.holdings(c, f)`);
  - the map's settlement colours (`js/render.js`), the settlement card and garrison and the "won't hire" lines (`js/ui.js`), the respawn after a defeat (`js/world.js`);
  - debug (`js/debug.js` fort switch);
  - `scripts/prototype-g.js` (`titled`) and `scripts/make-save-fixtures.js`;
  - `js/save.js` (`owners` in the starter and in the fields every v3+ save must have) and `types/crownless.d.ts`.
- **Names:** each culture in `data/names.js` has one `given` list of men's and women's names mixed; soldiers, followers and the tournament rival all draw from it.
- **The world:** 31 settlements (5 towns, 8 forts, 18 villages); each kingdom has one capital town, two forts and four or five villages; Merrow is a free city.
- **No people outside the company.**

**Build.**
- **People** (`c.people`, ids `person:<n>`, plus `'player'`; D-P8c):
  - **The world package gains `nobles`:** per kingdom a ruler and about six lords:
    - two great lords (a fort, usually with a village);
    - one or two lesser lords (a village);
    - two landless lords (nothing; a landed lord's kin or the ruler's household knight).
  - **Each noble has:**
    - a culture name from `data/names.js`;
    - a **home** (their own seat, or for the landless, their kin's seat or the capital);
    - their **kin** ties;
    - a short trait line for P8-07.
  - **A person record:** `{ id, name, gender: 'male' | 'female', realm, home, kin: [{ person, tie: 'parent' | 'child' | 'sibling' | 'cousin' | 'spouse' }], traits, status: 'free' | 'captive' | 'wounded', heldBy }`. Kin ties are symmetric and checked by the content validator; the words come from the tie and the gender (son or daughter, brother or sister, lord or lady). `c.nextPersonId` keeps ids unique for people made later.
  - **Men and women** (D-P8g): each kingdom's nobles include women, landed and landless, and at least one realm has a queen.
  - **The rulers' office:** `c.rulers` = `{ realm: person }`, one per kingdom (not Merrow). Nobody is a ruler by their record, only by holding the office, so Phase 9 can pass it on.
  - **Whether a lord is "great", "lesser" or "landless"** is never stored: it is what they hold now (`realm.fiefsOf(person)`), so it changes as land is granted and lost.
  - **Merrow** has no persons.
- **Holdings** (`c.holdings`, one per settlement of a kingdom, keyed by settlement id; D-P8b):
  - `kind`: `village`, `fort` or `town`, from the settlement;
  - `sovereign`: the realm that claims it;
  - `holder`: the person legally granted it (a lord or the ruler), set in the world data at the start; **never null** (D-P8f): when no lord holds it, the ruler of its sovereign does;
  - `controller`: who holds it now (the gates and garrison of a fort or town; for a village, its seat's controller);
  - `seat` (villages only): the fort or town of the same kingdom it is tied to, from the world data;
  - `administrator`: null until P8-05;
  - `claims: [{ by, realm, since, kind: 'granted' | 'conquest' | 'old' }]`.
- **One person may hold several holdings, or none.** A village's holder need not be its seat's holder: a lesser lord's village can sit under a great lord's fort. At most three fiefs per lord (D-P8d), checked by the content validator and by grants. The ruler's office isn't capped: what the crown holds until it grants it is held by the ruler.
- **`realm.owner(sid)` keeps its meaning (who controls it now):**
  - for a fort or town, its controller;
  - for a village, its seat's controller;
  - for Merrow and any settlement outside the holdings, the content owner.
  
  Every existing caller keeps working unchanged. New readers:
  - `realm.holding(sid)`, `holderOf`, `sovereignOf`, `claimsOn`;
  - `villagesOf(seat)`;
  - `fiefsOf(person)`.
- **One transition function,** `realm.transfer(c, sid, { controller, sovereign, holder, reason })`:
  - It records the old holder's claim (`old`) when the holder changes against their will.
  - **It always names a holder** (D-P8f): the conqueror, or the ruler when none is given. P8-05 adds the conqueror's choice (ask, suggest, hand over, keep); until then the ruler holds what is taken.
  - **When a seat's controller changes,** it carries the seat's villages with it: each passes to the new controller and sovereign, held by its ruler until granted, and each old holder keeps a claim.
  - It writes the news, and the chronicle only when the player is a party to it (holder, claimant or taker).
  - It emits one domain event per call, `HoldingChanged` (the events are PascalCase, `js/events.js`), listing the holding and the villages carried with it. Nothing listens yet: the mill's law keeps polling `owner` on its tick; contracts and the scout may listen later.
  - `setOwner` becomes a thin wrapper: a kingdom taking a fort becomes sovereign and controller, and its ruler the holder (the crown holds it until it's granted).
  - **The story lock** is checked by grants, sieges and the Debug panel (`realm.locked(c, sid)`), not by `transfer` or `setOwner`, so the story and the existing tests that move Greywall keep working.
- **Story forts:** Greywall and Ashgate are marked `story: true` in the world data. Until Q4 ends, only the story moves them (and their villages): no grant, siege or debug grant. The Q4 effect goes through `transfer`. The old lord keeps an `old` claim, so a Greywall that passes to Aurelia leaves its Valedorn lord a landless grievance for later.
- **Villages follow their seat:**
  - recruiting, contracts, markets' owner and the mill's law read `owner`;
  - so taking a fort changes its villages too;
  - the P7-10 change-of-hands path becomes real.
- **The Realm screen** (read-only here), with two tabs:
  - **Holdings:** each kingdom's towns, forts and villages, each with its holder, controller, seat and any claims;
  - **Lords:** each person, with what they hold (or "landless"), their kin, and where their home is.
  
  Tapping a settlement on the map shows its holder and controller.
- **Soldiers are men** (D-P8g): each culture's names split into `given` (men's) and `givenFemale` (women's), checked by the content validator. Soldiers draw only men's names; nobles, followers and the tournament rival may be either, and troops gain an optional `gender` (default `male`) so women's troop types can come later. Soldiers already in a save keep their names (a soldier's record is history); the pure 4 → 5 roster migration keeps drawing from both lists, so old saves migrate to the same names.
- **Seats** (owner, 2026-11-20): each village's seat is the nearest fort or town of its kingdom; Greywall's are Highmere and Brackenfield, so they follow it in Q4. A village may have no seat only when its kingdom holds no fort or town (the W-04 test world's Iron Reach).
- **Debug:** set a holding's controller, set its holder, add a claim.

**Layers.** Default: nothing to do. The player sees who holds what on the Realm screen and on a settlement's tap card.

**Save.** v19:
- **The migration** builds `c.holdings` for every settlement of a kingdom:
  - the holder is the world data's starting holder;
  - for the forts in v18's `c.owners` whose owner differs from content (Q4's Greywall), the new owner is sovereign and controller and its ruler the holder. The fort's villages go with it, and the original holders keep `old` claims.
- **It builds `c.people`** from the world package at the time of the migration, written into the migration as constants. Migrations stay pure (NEXT-PLAN §9). The constants are for `sundered_realm`; a save of another world (only the tests' worlds) keeps just its owner overrides, and `sanitize` completes it from that world's data.
- **`c.owners`** is dropped after the migration, and from the fields a v19 save must have.
- **Fixtures:** `tests/fixtures/saves-2.23/` from the 2.23.0 build before any change, made from a clean checkout of 9826a3e with `scripts/make-legacy-save-fixtures.js` extended for the set: a fresh game, the day-20 campaign, the story played through Q4 with Greywall passed to Aurelia (through the real dialogue, with a mill at Brackenfield so its villages follow and the mill's law is told), and a Phase 7 company with followers, a retinue and a mill.
- **Docs:** SAVE-FORMAT updated.

**Edges.**
- A holding whose kingdom no longer exists in the data: refused with a precise error, as SC-33.
- **Content validation errors:**
  - a village with no seat, or a seat of another kingdom;
  - a person holding more than three fiefs;
  - a kin tie that isn't returned.
- **Soldiers' culture:** a soldier from a village that has changed hands keeps the culture of where they were raised (the soldier's record), not the new owner's.
- **A capital** never changes controller in Phase 8 (P9-05), even by debug.

**Out.**
- Titles as separate objects (in Phase 8 a title is "holder of a holding");
- private owners other than businesses (they already have their own record);
- raiding villages (backlog).

**Tests.**
- **The migration:**
  - every fixture;
  - story `owner` conditions and the Greywall dialogue read the same before and after;
  - the Q4 fixture gives Aurelia's ruler as holder of Greywall and its villages, with Valedorn claims.
- **`transfer`:**
  - every combination (conquest, grant, return to crown), without duplicates;
  - a seat's villages carried with it;
  - claims recorded once;
  - the event once.
- **People and holdings:**
  - every kind of lord exists at the start (landless, one holding, several);
  - `fiefsOf` changes as holdings move;
  - kin is symmetric;
  - no holding is ever without a holder, through every `transfer`;
  - men and women among the nobles, and at least one queen.
- **Names:** every new soldier (hired, story, migrated from v18) has a man's name, over many seeds; followers and nobles may have either; the 4 → 5 migration's names are unchanged. Tests that pin a soldier's seeded name are updated where the men's list changes it.
- **Tests edited, not just added:** `realm.test.js`'s owners sanitize test, `business.test.js`'s change of hands (Oakford's seat is a capital, so it moves to a Greywall village), `happenings.test.js`'s owners check (moved to `c.holdings`).
- **Villages follow their seat:** recruiting, contracts and the mill's law.
- **Story forts:** locked until the ending.
- **The invariants** over a 90-day bot run.
- **Browser:** the Holdings and Lords tabs and a settlement's tap card, desktop and phone.

**Acceptance.**
- Saves from 2.23.0 load with the same world, and the story plays the same.
- A fort can be held by one person, controlled by another realm, and claimed by a third.
- A village can be held by a different lord from its seat's.
- Some lords hold nothing, some one place, some several.

### P8-03 · Permissions (S) — ✅ Done in 2.25.0

**Done (2.25.0, 2026-11-20).** No save change. `js/rights.js` (`CL.rights`): `may(c, who, action, target) → { ok, why }`, `why(…)`, `allegiance(c, who)`, `enemyOf(c, who, f)` and `ACTIONS`.
- **`who`** is `'player'` or a person (P8-02). **`target`** is a settlement for place actions, a person for `askHelp`, `ransom` and `release`, and a place or a realm for `swear`.
- **Worked out only from the state:**
  - **Standing:** the player is an enemy where its owner counts them Hostile.
  - **Allegiance:** a lord is sworn to their own realm, the player to none (until P8-04). A lord is an enemy where their realm is at war with the owner.
  - **Holdings:** the controller decides place actions; the holder, the administrator, or (when occupied) the occupier's ruler runs a holding; only the sovereign's ruler grants.
  - **War and peace:** needed for a siege.
  - **Story locks and capitals.**
- **Actions:**
  - **Place actions:** `recruit`, `contract`, `trade`, `rest`, `buyBusiness`, `enterFort`, `enterTourney`, `joinEvent` and `shelter` (where a beaten hero is let go). A Hostile owner refuses all of them but `trade` and `rest`, as before.
  - **Running a holding:** `appoint`, `setPolicy`, `drawTreasury`.
  - **Rulers:** `grant`, never a story fort or its villages before the ending, nor what an enemy occupies.
  - **Taking a fort:** `seize`, the gates without a siege (the Debug panel; forts only, never a story fort or a capital). `besiege` needs a realm at war behind you, so an independent company can't.
  - **Allegiance:** `swear`, `leave`, `askHelp`.
  - **Captives:** `ransom`, `release` (whoever holds the captive).
- **Every existing check calls it:**
  - recruiting (`party.recruitsHere`), contract boards, buying the mill, joining world events, entering tournaments, and where a beaten hero is released;
  - the Debug panel's controller and holder changes (`seize`, `grant`);
  - `realm.welcomes`, kept for older callers, now asks `CL.rights`.
- **The refusals keep the words each screen used** ("…will not sell to you", "…will not deal with an enemy"). The recruiting and contract ones are new: "The Valedorn Crown won't let you recruit here: they count you Hostile".
- **The UI shows why:** a Hostile owner's recruit buttons now stay shown but disabled, with the reason as their title and in the note beneath (they were hidden). The contract board says the same.
- **Debug → Holdings → Your rights there** logs every action's verdict at the chosen holding.
- **Not rights, left where they are:** who fights whom (parties' and reinforcements' hostility) and the mill's owner's law (its seizure). The grep test names them.
- **Tests:**
  - `tests/rights.test.js` (7): the case table (each action for an independent company, a Hostile one, a holder, a controller, story-locked, at war) and the grep test (no `realm.welcomes`, `isHostile`, `locked` or `isCapital` check outside `rights.js` and `realm.js` but the named ones).
  - `tests/browser/rights.spec.js` (desktop and phone): the disabled recruit button with its reason, and the board's.
  - Every existing test passes unchanged.

**Problem.** Rights are scattered:
- `realm.welcomes` for recruiting and contracts;
- the mill's "not from a Hostile owner";
- debug-only fort changes.

Phase 8 adds many rights: appoint, tax, summon, grant, besiege, swear, leave, ransom. Design §4.3 asks for "rights computed from offices, treaties, ownership… never `if (player.isKing)`".

**Build.**
- **`CL.rights.may(c, who, action, place?) → { ok, why }`,** where `why` is a short readable reason ("Valedorn won't let you recruit here: they count you Hostile").
- **Derived only from state:**
  - standing;
  - holdings (holder, controller, sovereign);
  - allegiance (P8-04 fills it in; until then everyone is independent);
  - war and peace (W-07);
  - story locks.
- **Actions** (more as later tasks need them):
  - `recruit`, `contract`, `trade`, `rest`, `buyBusiness`;
  - `enterFort` (a controlled fort's services);
  - `appoint`, `setPolicy`, `drawTreasury` (P8-05);
  - `besiege` (P8-06a);
  - `swear`, `leave`, `askHelp` (P8-04, P8-07);
  - `ransom`, `release` (P8-01);
  - `grant` (rulers only).
- **Every existing check calls it:** recruiting, contracts, the mill. The UI shows `why` where a button is disabled, instead of hiding it.

**Save.** None.

**Tests.** A case table: each action × independent, Hostile, holder, controller, story-locked, at war. Every existing behaviour unchanged (the existing realm, party, contract and business tests pass untouched). Browser: a disabled button shows its reason.

**Acceptance.** No right in the code is checked outside `CL.rights`; a grep test keeps it so.

### P8-01 · Lords on the map (M–L) — ✅ Done in 2.26.0

**Done (2.26.0, 2026-11-20).** Save schema v20. `js/lords.js` (`CL.lords`) holds the lords' parties, intentions in words, captives and ransoms. A `lord` party kind (`data/world_parties.js`: one template a realm, `lord_<realm>`, with its `leader` troop) is handled in `js/parties.js`, `js/reinforce.js`, `js/combat.js`, `js/render.js` and the capture path (`js/party.js`, `js/world.js`).
- **A party a lord:** 22 at the start, every lord but the four rulers, who keep to their halls. Each forms at the lord's home; a lord whose home another realm holds makes a seat of their own, or the capital, their home.
  - **Size** follows what they hold now: landless 12, a village 16, a fort or town 21, and 3 more for each further fief (Hamon with Greywall and Highmere: 24). They grow and shrink as land is granted and lost, and refill at home.
  - **Troops** are the realm's own by tier. The share of veterans rises with standing: T3 is 10% for the landless, 15% for the lesser and 25% for the great.
  - **The lord fights in person:** the realm's best foot soldier (Guard, Legionary, Huscarl or Pavisier) at twice the HP and 1.35× damage, with their name over their head.
  - **On the map:** the realm's shield with a gold edge, labelled with the lord's name.
  - **Outside the budget:** lords don't count against W-07's per-region spawn budget. Map stress 80 now means 80 regular parties plus every lord.
- **Intentions** (`intent` on the party):
  - `chase`: a company their realm counts Hostile.
  - `search`: where they lost sight of it.
  - `home`: when the ranks are below half; at home they refill and `rest` for half a day.
  - `hunt`: Reavers in sight.
  - `clash`: soldiers of a realm at odds with theirs, on the same frontier-clash timer as patrols.
  - `patrol`: the bounds of their lands, for landed lords whose lands their realm still holds.
  - Otherwise `ride` with a kinsman's party (a 40% chance when one is out) or `campaign` along the realm's borders (its three places nearest another realm).
  
  The tap card (a map tap on the party) reads, for example, "Lord Hamon Greymantle, holder of Greywall Fort and Highmere: riding the bounds of their lands". A landless lord is "Lord Tancred Greymantle, Lord Hamon Greymantle's son, landless", or "…, sworn to Queen Lucrezia Salviati, landless".
- **Everywhere a party is handled:**
  - **The encounter** shows who they are, what they're doing and the realm's words. Attacking a lord who isn't after you costs 25 reputation with their realm (a patrol costs 15).
  - **Auto-resolve and the battle lock** work as for any party.
  - **Reinforcements:** a lord stands with their realm, as patrols do.
  - **Reavers** flee lords as they flee patrols. Patrols and lords hunt each other's realms' soldiers in frontier clashes, and skirmish there.
  - **News:** `lord_beaten`, `lord_captured` and `lord_ransomed`, each line naming the lord.
  - Lords are never contract targets.
- **Capture and ransom, both ways:**
  - **A lord beaten by the player**, fought or simulated, is the player's prisoner, and their party is gone.
  - **Their kin with land, else their realm's ruler, offer a ransom** after 2–4 days: 100 crowns plus 25 for each soldier they led. The offer interrupts the map as its own screen (A RANSOM OFFER) with Accept, Hold and Release.
    - **Hold:** another offer in 2–4 days.
    - **Release:** +5 renown, and a `freed` deed kept for P8-07.
  - **Escape:** a held lord has a 3% chance a day, or 8% while the company is under six soldiers.
  - **Beaten while holding prisoners:** they all go free.
  - **Off-screen:** a lord beaten by a realm's soldiers (a frontier clash that leaves them with nobody) is that realm's prisoner and comes home in 5–15 days. A lord beaten by Reavers gets away and rides out again from home. A freed lord rides out with 40% of their ranks and goes home to refill.
  - **Beaten by a lord:** the hero is ransomed, not robbed. You keep at least 80% of the money, lose nothing from your pack and keep your medicine, and are let go at the lord's home.
  - **Deeds** (`freed`, `ransomed`, `held`, and `held_kin` for the kinsman who paid) are kept on the person for P8-07.
- **Realm screen → Lords** now says where each lord is: what they're doing, "your prisoner", "a prisoner of the …", or "keeps to their hall" for a ruler.
- **Debug → Lords:** lord near me, capture a lord, ransom offer now, lord held off-screen.
- **`realm.invariants`** now also checks the lords: one party each, never a captive on the map or a ruler riding, and every prisoner record matching its person.
- **Save v20:** `prisoners`; the lords' parties are in `parties` (kind `lord`, `lordId`, `intent`). A v19 save gets the lords on load, at their homes. Fixtures: `tests/fixtures/saves-2.25/` from a clean checkout of 00d28aa (fresh, day-20 campaign, the story bot's play, Q4 for Aurelia with a mill, a Phase 7 company).
- **Tests:**
  - `tests/lords.test.js` (12): the parties at the start, sizes following fiefs, intentions over 20 days, the tap card, the encounter and the lord in battle, sides, capture and ransom once (Hold, Accept, Release, kin or crown paying), escape ending a ransom, off-screen captivity, being beaten by a lord, saves, the 2.25 fixtures, and a 90-day bot run with the invariants every day.
  - `tests/browser/lords.spec.js` (3, desktop and phone): the tap card, and the ransom screen's three buttons.
  - **Edited for the lords:**
    - the parties counts (`parties.test.js`: the lords ride beside the 29 regular parties);
    - the per-region budget (`world-sim.test.js`: regular parties only);
    - the troop reach (`cavalry.test.js`: a lord's template lists no fixed troops);
    - the 2.23 fixtures' people (a dispossessed lord's home moves);
    - the save version, and the v1.0 fixtures' summary (regular parties only);
    - the kinds still moving after the ending (`slow/gate-d-campaigns.test.js`: lords too);
    - `scripts/bench-map.js` (`n` regular parties, the lords on top);
    - the mill's browser spec, whose pattern missed a bad week's report ("Wage 6…", capitalised; the lords changed which week came up).
- **Checkpoint (the whole slow suite, NEXT-PLAN §7):**
  - **Run together,** 9 of 12 passed. The three failures:
    - the after-the-ending kinds, a test to update for lords;
    - two timing limits broken under the suite's own load (a 7.7 s day against a 1.7 s median, and the 90-day world-events run over 60 s).
  - **Run alone,** all three pass: the world-events run in 46.5 s (it took 44.6 s at 2.25.0, so less margin to its 60 s limit), and world-sim's day times steady.
  - **The lords' cost** (`node scripts/bench-map.js --season 80 30`): 966 ms per game day with 80 regular parties and 22 lords, against 734 ms with 80 and no lords at 2.25.0. That is 32% more time for 27% more parties; the worst day is within 5% of the median, and the save is 48.6 KB.
  - **Map stress 80 in the browser:** it ran, reporting "80 + 22 lords", but the Browser pane was hidden, so its fps and frame times are a throttled background page's and say nothing about the phone. **Still to check on the owner's phone.**
  - **The tournament browser spec on the phone** loses its bout now and then. It does so at 2.25.0 too (2 runs in 8 there, 1 in 8 here); it isn't this task's.
- **Not as specified:**
  - **No "Talk" choice** with a lord yet: the encounter shows who they are and their words, and attacking is the choice. There is nothing to ask a lord until allegiance and opinions (P8-04, P8-07).
  - **A captured lord's holdings stay theirs** while they're away, with nobody running them in their stead, until P8-05 brings castellans.
  - **Rulers don't ride.**
  - **Intentions are simpler than the list:** "shadow enemy parties at war" is `clash` on the frontier-clash timer, and "hunt bandits further afield" is the border campaign.

**Problem.** P8-02's lords exist only on paper. The design wants named lords travelling with their retinues, met, fought, captured and ransomed (§16, §20.6).

**Now.**
- **Party kinds** in `js/parties.js` (`bandit`, `patrol`, `caravan`, `detachment`): each branch of `chooseTarget`, `nearest`, `rival` and the contact checks switches on `kind`.
- **Reinforcements:** `reinforce.sideOf` decides sides for reinforcements.
- **The battle lock:** `reinforce.lock` / `locked` (V2-09) keeps a party in one battle.
- **Encounters** go through `parties.current`; the hero's capture is in `js/world.js`.
- **The grid and the step budgets** come from W-07.

**Build.**
- **A `lord` party kind:**
  - one party per free lord, landed or landless (about 24), formed at the lord's home: their own seat, or for a landless lord their kin's seat or the capital;
  - its size follows what the lord holds: about 10–14 troops for a landless lord, 14–18 for a village, 18–24 for a fort, more with several fiefs (tuned in P8-T);
  - tier mix by the lord's standing;
  - the lord in person, as a hero-like unit in battle: the portrait name and a stronger unit of the realm's top troop.
- **Intentions** (stepped by the world simulation with the grid and budgets):
  - patrol their lands (landed lords: around their holdings);
  - **campaign** (landless lords, and landed lords with nothing to guard): roam the realm's borders, hunt bandits further afield, shadow enemy parties at war, ride with a kinsman;
  - hunt bandits near them;
  - return home to rest and refill;
  - from P8-06a, gather for war and besiege;
  - from P8-07, answer summons.
  
  The tap card shows who the lord is and what they're doing in two lines: "Lord Aldric of Westholt, holder of Westholt Castle and Ashby" or "Ser Maren, Lord Aldric's daughter, landless", then "riding home to refill the ranks".
- **Everywhere a party is handled:**
  - encounters (talk; attack, with the reputation cost of attacking a patrol, more for a lord);
  - auto-resolve;
  - reinforcements (a lord is on their realm's side, as patrols);
  - frontier clashes between lords of kingdoms at odds (W-07);
  - news (`lord_beaten`, `lord_captured`, `lord_ransomed`);
  - the battle lock.
  
  Lords are never contract targets in Phase 8.
- **Capture and ransom, both ways:**
  - **A lord whose party loses a fought or simulated battle to the player** is taken prisoner (`c.prisoners`).
  - **The lord's realm offers a ransom** after 2–4 days, through a message with Accept, Hold and Release:
    - the ransom is 100 crowns plus 25 per troop the lord led;
    - releasing for nothing earns renown and the lord's goodwill (stored for P8-07);
    - each day a held lord has a 3% chance to escape, 8% while the company is under 6 soldiers.
  - **If the player is beaten while holding prisoners,** they go free.
  - **A lord beaten off-screen** is held by the winner's realm and ransomed after 5–15 days (abstract).
  - **A beaten player** is still captured and released as now. When the captor is a lord, the hero is ransomed instead of robbed: gold, at least the kept minimum (`DEFEAT_GOLD_KEPT`), and released at the lord's home.
  - **Kin pay:** a lord's ransom is offered by their kin if they have land, else by their realm; a kinsman remembers who held them (P8-07).
- **Patrols stay** for small fry. Lords replace no existing party.

**Layers.** Default: lords are met like patrols. One decision: accept or decline a ransom. Expert: read intentions to choose fights.

**Save.** v20: the lords' parties (in `c.parties`, kind `lord`, `lordId`), `c.prisoners`, the off-screen captives' release days.

**Edges.**
- A lord can't be in two battles (the lock), or be both prisoner and on the map.
- A ransom can't be paid twice, nor after the lord has escaped.
- A captured lord's holding is held by their castellan or the crown until they're back (P8-05).
- About 24 lord parties, within W-07's budgets: the step budget is checked with Map stress 80 plus every lord.
- A landless lord's home is lost (their kin's seat is taken): they make the capital their home.

**Out.** Lords' deaths (D-P8c); lords as contract targets; ransoming common soldiers.

**Tests.**
- Intentions consistent with state (no "riding home" while at home; landless lords campaign, never "patrol their lands").
- Party sizes follow fiefs held, and change when a lord gains or loses land.
- Capture once, ransom once, escape ends a ransom.
- No lord in two battles, or prisoner and on the map.
- `sideOf` for lords.
- Off-screen captivity returns the lord.
- A 90-day run with lords: invariants, and no growth in the step budget's misses.
- Browser: the tap card, a ransom message's three buttons.

**Acceptance.** Lords are visible, readable and meetable. Capture and ransom work both ways with no duplicates. The map stays within W-07's budget on the phone (Debug → Map stress 80 with lords).

### P8-04 · Allegiance (M) — ✅ Done in 2.27.0

**Done (2.27.0, 2026-11-21).** Save schema v21. `js/allegiance.js` (`CL.allegiance`) holds the state, pay, service, leaving and the preview. The rights to `serve`, `swear`, `askRelease` and `defect` are `CL.rights`'s (P8-03); `rights.allegiance(c, 'player')` is now your vassal's realm.
- **Service** (a card on a capital's notice board):
  - needs Neutral standing or better;
  - runs 30 days at a weekly pay of 20 + 3 a soldier + a tenth of your renown, from the realm's purse (the ledger's `world` → purse);
  - every day under contract is a day of service to that realm;
  - its patrols and lords take your side in a fight (`reinforce.sideOf`);
  - attacking its own patrols, caravans or lords breaks it;
  - it ends at its term, with a message to renew at the capital. Renew on the same card, or take service again after a served term with no wait.
- **Fealty** (a card on the same board, to the ruler):
  - needs Friendly standing, 150 renown, and 20 days of mercenary service to that realm or the story's favour (your Q4 side);
  - pays nothing;
  - a vassal owes 10 days of service in every 30. A day of service is a battle won against Reavers or an enemy at war with the realm, or a day spent at one of your holdings, at most one a day. A month short counts as a missed call, and three cast you out.
- **Leaving** (the Realm screen's new **Allegiance** tab, from anywhere):
  - **Ask for release:** free when you owe nothing and the realm is at peace; 15 standing if you owe service; refused while the realm is at war. Your fief returns to the crown with no claim.
  - **Leave a contract early:** 10 standing.
  - **Defect:** 40 standing; each fief lost with a `granted` claim kept (`realm.transfer` gains `claimKind`); the realm's lords hunt you for 10 days whatever your standing (`parties.wantsPlayer`), then stop.
  - **Expulsion** (three months short, a breach, or standing turned Hostile): as defection, without the hunt.
  - **Seven days between oaths.** A served term doesn't count.
- **The preview** (`allegiance.preview(c, action, realm)` → `{ ok, why, lines, effects }`) is shown on every card before its button. `act` does exactly its `effects`; a test checks each action against them. It says what you lose ("You will lose Westholt Castle. You keep a claim to it."), the standing, the hunt, an ended contract ("Your contract with the Aurelian Remnant ends."), "Lords who think well of you may think less of you" (uncertain until P8-07), and always "Your soldiers, money, mill and followers stay yours" (naming what you have). A refusal shows its reason on the card, with the button disabled.
- **Invariants:** a holding held by the player must be of the realm they're sworn to.
- **Chronicle:** an `allegiance` entry for each contract or oath that ends, and how.
- **Debug → Lords:** serve or swear to the chosen holding's realm whatever the requirements, grant it to me (sworn to its realm), service +10 days.
- **Tests:**
  - `tests/allegiance.test.js` (9): the design's §16.5 acceptance as a script (a contract, fealty, Westholt granted, released on terms, the soldiers kept); pay against the ledger; the term and renewal; sides and the breach; a vassal's service and expulsion; defection and the hunt ending; release's costs and refusal, the seven days, leaving early; switching; every action's preview against what it did with nothing personal lost; saves and the 2.26 fixtures.
  - `tests/browser/allegiance.spec.js` (2, desktop and phone): the Service card's preview and button, the disabled Swear card with its reason, the Allegiance tab and leaving; a vassal's defection preview.
  - **Edited:** `rights.test.js`'s swear case (it now has requirements), and the save version.
- **Not as specified:**
  - **No summonses yet** (P8-06a, P8-07). Missed calls come only from short months of service, and service at a summons isn't counted yet.
  - **Land is granted only by debug** until P8-05.
  - **"Its lands recruit you even at Neutral"** needed nothing: only a Hostile owner bars recruiting already.
  - **Leaving a contract early** wasn't specified. It costs 10 standing.
  - **AI lords' allegiance** waits for P8-07, as planned.
- **Test tiers (NEXT-PLAN §7):**
  - `npm test` (747) and lint ran;
  - the full browser suite ran (169; 167 passed. The ford's wading-speed timing and the phone's tournament bout failed under its load; the ford passes 4 of 4 alone, and the bout is the known flake from 2.25.0);
  - the slow `campaign-bots` file ran (2 of 2).
  
  The other slow files were skipped: this task doesn't reach the story, battles, world parties' counts, followers or the world package. The whole suite runs at the P8-05 checkpoint.

**Problem.** The player is always an independent. The design's acceptance (§16.5) is: "accepts a mercenary contract, becomes a vassal, receives a castle, leaves the realm under negotiated terms, retains personal soldiers, and sees only the expected titles and obligations change."

**Build.**
- **`c.allegiance`** = `{ kind: 'independent' | 'mercenary' | 'vassal', realm, since, until (mercenary), serviceDays, summonsMissed, history }`. One at a time (design §25.3: no contradictory offices).
- **A mercenary contract:**
  - from a realm's capital (a new "Service" offer where the town has contracts);
  - needs Neutral standing or better;
  - 30 days at a weekly pay by renown and company size, from the realm's purse;
  - you fight its enemies when met (attacking its own patrols, caravans or lords breaks it);
  - its patrols and lords count you on their side (reinforcements);
  - its lands recruit you even at Neutral.
  
  It ends at its term (renewable) or on a breach.
- **Swearing as a vassal:**
  - from the ruler at the capital;
  - needs Friendly standing, renown at least 150 (tuned in P8-T), and 20 days of mercenary service to that realm or a quest's favour (Q4's side);
  - no pay;
  - you may be granted land (P8-05; D-P8d);
  - your obligations:
    - answer summons (P8-06a, P8-07);
    - don't fight the realm's people;
    - keep 10 service days in every 30.
  
  Service days count days spent fighting the realm's enemies, garrisoning your fief, or at a summons.
- **Leaving:**
  - **Asking for release** (at the capital, or by message from anywhere): granted when obligations are met and the realm isn't at war, else granted with a reputation cost or refused at war. The fief returns to the crown with no claim (D-P8e).
  - **Defecting** (leaving without release, or swearing to another realm): −40 standing with the old realm. Its lords hunt you for 10 days (P7-04 pursuit). You lose your fief but keep a `granted` claim (D-P8e).
  - **Expulsion** (three summonses missed, a breach, or standing falling to Hostile): as defection, without the pursuit.
- **The consequence preview** (design §22.5): before every swear, leave or defect, a panel lists what changes and what stays, in plain lines:
  - "You will lose Westholt Castle. You keep a claim to it."
  - "Your soldiers, money, mill and followers stay yours."
  - "Valedorn's lords will hunt you for 10 days."
  - "Lord Aldric may think less of you" (from P8-07).
  
  Uncertain consequences are said as uncertain.
- **The Realm screen, Allegiance tab:**
  - your allegiance;
  - its term or service days;
  - obligations met or owed;
  - Leave or Ask for release, with the preview.

**Layers.** Default: stay independent, nothing changes. One decision: take service or swear (with the preview). Expert: time a defection.

**Save.** v21: `c.allegiance`.

**Edges.**
- A mercenary of a realm that goes to war with another you hold property in: the mill's law applies, nothing more.
- Swearing while a mercenary of another realm ends that contract (previewed).
- A contract's term ending mid-battle ends after the battle commits.
- Personal property and the warband are never lost by any switch.
- Leaving can't be spammed: 7 days between oaths.

**AI lords use these same rules** from P8-07: they take service, ask for release and defect, with the same consequences for their fiefs and claims.

**Out.** Rebel, claimant, sovereign and deposed (Phase 9). Treaties between realms (P9-02).

**Tests.**
- The design's §16.5 acceptance as a scripted test (the castle from P8-05's debug grant until that task ships).
- Every transition's preview matches what happens.
- Nothing personal lost (soldiers, gold, items, businesses, followers).
- Pursuit after defection ends.
- Pay reconciles to the ledger.
- Browser: the preview at both sizes.

**Acceptance.** The §16.5 acceptance passes, and every change of allegiance shows its consequences before it happens.

### P8-05 · Fiefs and castellans (M) — ✅ Done in 2.28.0

**Done (2.28.0, 2026-11-21).** Save schema v22. `js/fiefs.js` (`CL.fiefs`) holds the week, the money, administration, grants and the conqueror's choice.
- **Every holding's week** (on the payday, the AI's and the crown's too):
  - **Tax:** base (village 30, fort 60, town 120) × prosperity / 50 × the stance (light 0.7, normal 1, heavy 1.4); nothing over 80 unrest.
  - **The crown's tenth:** once a week (`dueWeek`), never from the crown's own land.
  - **Wages:** a fort's garrison at a third of each soldier's wage; a village's militia at 5.
  - **The steward:** 6 a week, for a fort of yours with no castellan.
  - **Repairs:** 10 a week, 15 points of walls, while on.
  - **Refill:** a fort's garrison toward its target (light 12, normal 22, strong 32) in the realm's garrison mix, three a week at half their hire cost (over target, the extra are paid off); a village's militia by one.
  - **Drift:** prosperity +1 / 0 / −1 and unrest −3 / −1 (to 20) / +5 by stance.
  - **Unpaid:** unpaid men raise unrest by 10. After two warnings a fort's garrison deserts one a day until paid.
  - **Never below nothing.** A holding starts with four weeks of tax in hand. Over 60 unrest warns.
  
  A taken fort gets its taker's standard garrison, as before. `realm.garrison` returns the garrison as it stands.
- **Money:**
  - **A fief of yours** keeps its money in `budget:fief_<id>` with its own book, as the mill does (`accounts.transfer` hands the line to `fiefs.bookFor`). The holding's treasury moves into the account when it is granted to you, and back when lost. Captors never take it.
  - **Everyone else's** money is the holding's `treasury`. An AI lord refills their household from their fiefs' treasuries (3 crowns a man) and rides short when they can't pay; the landless are kept by kin and crown.
  - **One line a week** for all your fiefs ("Your fiefs this week: Westholt Castle +12 (180 in hand) · Fernley +20 (140 in hand).").
  - **Put in or draw out** 50 at the holding (`drawTreasury`).
- **Administration:**
  - your fort's steward and your village's reeve by default;
  - a castellan from the company's veterans, a captain as P7-05, appointed in person at the holding. They leave the roster and are kept in the save. Dismissed, they rejoin the next time you're there.
  - **SC-44:** a holding lost while a castellan serves and policies are set: the castellan rejoins the company at once, the policies reset to the defaults, and the money stays with the holding.
- **Policies** (balanced defaults): garrison, tax, food reserve (kept for P8-06a), repairs. They change in place on the Fief tab.
- **Grants:**
  - **What the crown has to give:** a holding held by its ruler that isn't the crown's own land (`crownLand`: what the ruler held at the start), not a town, its gates its own, not story-locked. That covers land taken in war, Q4's Greywall in old saves, a lord's land forfeit after 30 days held unransomed (they keep a claim), and a vassal's left behind.
  - **Timing:** it is offered weekly and decided 2–4 days later.
  - **Candidates, in order:** who did most in its taking; landless lords (kin of the realm's lords first, then the player); fewer fiefs; service days and renown. Nobody with three.
  - **You** are a candidate as a sworn vassal; a fort needs 300 renown and 30 days of service unless you took it. After 60 days of service with no land, the crown may give you one of its own villages.
  - **Yours comes as a message** (A GRANT OF LAND, with the tax, costs and obligations) with Accept or Decline; declined, the next candidate has it. AI lords accept.
  - **The news:** "Lady Alys Ardane, landless until now, is granted Tessaro by King Godric Ardane."
- **The conqueror's choice** (D-P8f; `fiefs.conquered(c, sid, taker, choice, suggest)`):
  - **ask:** a grant with the taker first;
  - **suggest:** the lord named first; granted, they remember it as a `suggested` deed;
  - **hand:** +5 `c.influence` with the ruler and a `handed` deed;
  - **keep:** the ruler lets it stand for a friend with room and no missed calls, else casts the player out (P8-04: the fort lost, a `granted` claim kept).
  
  Yours is a prompt (THE CONQUEROR'S CHOICE) with "Ask the liege" first. AI lords ask until P8-07.
- **The Realm screen's Fief tab:** each holding of yours, with who runs it, its garrison or militia (and walls), prosperity, unrest, treasury, last week, the policies, money and the castellan.
- **Debug → Lords:** take it for my realm (the chosen fort, then the choice), the crown's grants now, fiefs: run a week, fiefs: empty treasuries.
- **Bots:** every campaign bot answers ransoms, grants and the conqueror's choice with the defaults. A `landed` style serves at capitals, swears when it may, renews, and leaves the steward and policies alone.
- **Tests:**
  - `tests/fiefs.test.js` (14): each holding's state; a fief's book and account against its report every week for 13 weeks, with one line a week for two fiefs; the due once a week; SC-42 (tax, garrison and repairs each measured); unrest over 80; desertion after two warnings; castellans and SC-44; the grant order with a landless kinsman winning; the cap, the story lock and a declined grant; SC-19 (a village, then a fort); the four choices for you and a lord; grants within days and a lord's land forfeit; the landed bot 60 days with no forced screen; saves and the 2.27 fixtures.
  - `tests/browser/fiefs.spec.js` (2, desktop and phone): the grant message, the Fief tab and a policy, the conqueror's four answers.
- **Not as specified:**
  - **A castellan is a veteran only,** not the companion (the companion's detachment flags assume a detachment).
  - **No capture branch for SC-44's castellan:** they always come back to the company.
  - **"An independent who takes a fort" hands it to a kingdom or swears:** not built. Independents can't take forts until P8-06a.
  - **A kept fort's ruler doesn't send lords to retake it** until P8-06a's sieges.
  - **"Unrest over 80 recruits nothing"** stops the garrison's and militia's refill, not your own hiring there.
  - **The Lords tab shows who holds what now;** who gained and lost land is told in the news.
  - **A town's watch costs nothing.**
- **Checkpoint (NEXT-PLAN §7):**
  - `npm test` (761), lint, and the full browser suite: 173 passed, none failed.
  - **The whole slow suite:** 11 of 12. The 90-day world-events run broke its 60 s "in good time" limit under the suite's own load, as at P8-01's checkpoint. Alone it takes 46.6 s (46.5 s at 2.26.0), so the fiefs' weeks add no measurable time. The limit failed at every checkpoint run in parallel, so it is now 120 s (owner, 2026-11-21): a guard against a loop, not a benchmark.

**Problem.** A holding does nothing for or against its holder: no revenue, garrison costs or policies (design §17.2). The AI lords' land means nothing either.

**Build.**
- **What each kind of holding gives and costs:**

  | Kind | Gives | Costs | Run by |
  |---|---|---|---|
  | **Village** | Tax from its prosperity; recruits from its people; its market | A small militia (defends against raiders, never besieged) | A reeve (the default, free) or a castellan |
  | **Fort** | A little tax; a garrison that guards its villages | Garrison wages, repairs | A castellan or the default steward |
  | **Town** (the capitals, the rulers') | The realm's largest tax | Its watch | The ruler's own officers (not playable in Phase 8) |

- **The conqueror's choice** (D-P8f; "What runs through every Phase 8 task"): whoever takes a fief, if not the ruler, asks the liege for it, suggests someone, hands it to the ruler, or keeps it. Keeping it unasked lets the ruler accept, or expel the taker (P8-04) and send lords to retake it (P8-06a). The player gets one prompt with "ask the liege" as the default; AI lords choose by their needs and opinions (P8-07, which until it ships picks "ask"). A suggestion that is granted raises the conqueror's relationship with the lord named; handing it over raises relationship and influence with the ruler (influence is new state, P8-07's to spend).
- **Grants** (D-P8d): a holding is never vacant. The crown has one to give when the conqueror asks for it, suggests someone or hands it over; when its lord is held unransomed for 30 days; or when its holder leaves the realm (defection, expulsion, P8-04). The ruler holds it meanwhile, and grants it within a few days. The candidates are weighed in this order (a conqueror who asked, or the lord they suggested, counts as "did most in its taking"):
  1. who did most in its taking;
  2. landless lords (kin of the realm's lords first);
  3. lords with fewer fiefs;
  4. service days and renown.
  
  The player is a candidate as a sworn vassal, and **AI lords compete** for the same grant. A player's first grant is most likely a village; a fort needs more renown and service. A ruler may also grant one of the crown's own villages after long service. Nobody holds more than three fiefs.
- **The grant arrives as a message** with Accept (with the preview: obligations, costs) or Decline. Declining sends it to the next candidate.
- **An independent who takes a fort** (P8-06a) chooses to hand it to a kingdom for a reward and standing, or to swear and hold it.
- **The news tells grants:** "Ser Maren, landless until now, is granted Highmere." The Lords tab shows who gained and lost land.
- **Administration:**
  - a castellan from the company (a captain as P7-05: a veteran or the companion, who leaves the company while serving);
  - or the default steward for a fort (hired, 6 crowns a week) or reeve for a village (free);
  - dismissing brings a castellan back to the company the next time you're at the holding.
  
  With several fiefs, each has its own administrator and book; the week's log gets one line for all of them.
- **Policies** (all with a balanced default):
  - **garrison target** (light 12, normal 22, strong 32 troops);
  - **tax stance** (light, normal, heavy):
    - the lands pay their prosperity × a rate;
    - heavy pays about 40% more and raises unrest;
    - light lowers unrest and raises prosperity slowly;
  - **food reserve** (days, for P8-06a);
  - **repairs** (walls lose condition in a siege and are mended over days at a cost).
- **Garrisons are tracked:**
  - `c.holdings[sid].garrison` as troop counts, for every fort (the AI's too), refilled from its villages up to the target at the holding's cost;
  - villages keep a militia count instead (no target to set);
  - wages from the holding's own budget account (`budget:holding:<id>`, P7-10's pattern), with a book of its own;
  - the liege's due (10% of revenue) paid to the crown;
  - the AI's holdings run by the same rules, so an AI lord's land matters to the party they field (P8-01).
- **Weekly:**
  - the holding's report, with revenue, wages, due, repairs and its money, one line in the week's log;
  - you may put money in or draw it out at the fort (`rights.may(..., 'drawTreasury')`).
- **Unrest and desertion,** warnings first:
  - unpaid garrison troops desert one a day after two warnings;
  - unrest over 60 warns, and over 80 the lands pay nothing and recruit nothing until it falls.
- **The Realm screen, Fief tab:** each of your holdings, with its administrator, garrison or militia, policies, treasury and the last report.
- **A "landed" campaign-bot style** (`tests/helpers/campaign-bot.js`): it serves, swears, accepts a grant and keeps the default steward and policies.

**Layers.** Default: the steward and balanced policies, with one weekly line. One decision: accept the grant. Expert: the policies and a chosen castellan (SC-42: a measurable difference under the same rules).

**Save.** v22: garrisons, policies, prosperity and unrest per holding; the holding's book; castellans' assignment.

**Edges.**
- A castellan captured, or the holding lost, while policies are set: the policies are cancelled safely, and the castellan comes back or is a prisoner (SC-44).
- A holding's treasury goes negative: never; wages are paid only from what is there.
- The liege's due is never taken twice in a week.
- Granting a story-locked fort or its villages: refused.
- A lord granted a fourth fief: refused (the next candidate gets it).

**Out.** Building new things; more than three fiefs per person (the cap is tuned in P8-T).

**Tests.**
- **Ledger:** exact over 90 days, the holding's book against its weekly reports.
- **Policies:** each makes the measured difference (SC-42).
- **Desertion:** after the warnings.
- **SC-19:** swear and obtain a holding (a village, then a fort), as a scripted scenario.
- **Grants:** the candidates' order; a landless AI lord wins a crown-held village when the player has done nothing for it; each of the conqueror's four choices (ask, suggest, hand over, keep), with its relationship, influence and expulsion outcomes, for the player and an AI lord alike; the player wins when they took it; nobody passes three fiefs; a declined grant goes to the next candidate.
- **Several fiefs:** each has its own book, and one week's line covers them all.
- **SC-44.**
- **The landed bot:** keeps its fief 60 days hands-off with no forced screens.
- **Browser:** the grant message, the Fief tab, at both sizes.

**Acceptance.** A fief runs hands-off with one weekly line. Its costs and failures are reported. Every expert policy makes a measured difference.

### P8-06a · Sieges on the map (M–L) — ✅ Done in 2.29.0

**Done (2.29.0, 2026-11-21).** Save schema v23. `js/sieges.js` (`CL.sieges`) runs every siege; `scripts/landed.js` (`npm run landed`) plays the world alone.
- **AI sieges:**
  - **Planning:** once a day each realm at war, with no siege of its own and no fort it took still weak, picks the fort of a realm at war with it that is nearest its capital, if it may besiege it (CL.rights: never a story fort before Q4 ends, never a capital). Up to four of its free lords within reach who aren't thin gather there; two at least.
  - **Gathering:** the party intention `gather`, riding to a camp around the fort. It begins when they are there with 1.5× the garrison's power (2× against a realm's last fort), and is abandoned after 5 days.
- **Encircled:**
  - the fort and its villages refuse every place action but shelter to anyone but the besiegers (CL.rights);
  - the defenders eat a day of food a day (a fort's `food`: its food policy, refilled 2 a day in peace);
  - ladders after a day, a ram after three.
- **Each day's choice:**
  - **Surrender** at no food, or when the odds are hopeless (90%).
  - **AI besiegers:** assault at 60% with ladders; lift when weaker than the garrison or after 20 days.
  - **Assault** (simulated): the defenders count ×(1.2 + 0.4 × walls), less 0.3 with a ram. Won, it falls; lost, the besiegers lose 40% and lift. Siege losses count toward the war's exhaustion (`realm.clashed`).
- **Relief:** at the encirclement, the defending realm's free lords within reach ride to it (`relief`; for a realm's last fort, every free lord). When they arrive, the two sides fight by power; the losing lords are beaten (captured by the other realm), and beaten besiegers lift.
- **Lifted** when the war ends, or (yours) when you ride off or leave your realm's service.
- **A fort taken:**
  - `realm.transfer`, once, with its villages; the old holder keeps a claim;
  - half its taker's garrison, the walls down 40 (20 when it surrendered), unrest at least 60, weak for 30 days, 3 days of food;
  - the news and, when you were in it, the chronicle;
  - the conqueror's choice (AI lords ask; you get the prompt, or "ask" when it fell while you were away);
  - the lords go home to refill;
  - businesses meet the new owner's law (P7-10's poll).
- **Your siege:** a card on a fort's settlement screen.
  - **Before:** the Besiege preview (the garrison, the walls' worth, the storm odds, the days to starve it, the −25 standing for an independent).
  - **After:** your siege's day, food, ladders and ram, the odds, and **Assault** (simulated: your soldiers fall and are wounded through the surgeon's triage; won, +15 renown), **Wait a day**, **Lift the siege**.
- **Your fort besieged:** an urgent screen (UNDER SIEGE: Ride back sets off for it; Leave it to the steward or castellan). A scout who sees the lords gathering against it warns you first.
- **The map:** a besieged fort is ringed in dashed red with "under siege".
- **Anti-snowball:**
  - one siege a realm;
  - lords home to refill after;
  - a taken fort weak for 30 days;
  - **new, the spec's rules made firm:** a realm doesn't start another siege while a fort it took is weak; a realm's last fort needs 2× to besiege and is relieved by all its lords; a war that ends leaves a 30-day truce (`truceUntil` on the relation) before the next.
  
  No free troops for anyone.
- **`npm run landed [days] [seeds]`:** the world alone after the story's ending (D-W5 holds the March pair in tension until then), with the company parked in Merrow. 180 days on seeds 1–3:
  - 3 wars on each seed;
  - 9, 14 and 9 sieges planned;
  - 6, 5 and 5 forts taken (stormed 3/2/3, surrendered 3/3/2), and some lifted, relieved or abandoned;
  - 18, 12 and 15 grants;
  - every realm keeping a fort every month;
  - the invariants held every day.
- **Debug → Lords:** siege it (AI): the chosen fort's enemies go to war and gather. Sieges: a day.
- **Tests:**
  - `tests/sieges.test.js` (10): planning and the story lock; encirclement, shut villages, food, ladders and ram; starved out (one transfer, villages, claims, half a garrison, unrest, the conqueror asking, lords home); stormed and thrown back; lifted at the war's end and relieved; SC-20 (your fort falls while you're away: warned, its money and control lost, a claim kept, you go on); SC-16 (a mill under a fallen fort meets the new law); your own siege (preview, shut villages, starved out, the conqueror's choice, riding off lifts it); an independent's cost; saves and the 2.28 fixtures.
  - `tests/slow/landed.test.js`: 180 days alone on three seeds.
  - `tests/browser/sieges.spec.js` (2, desktop and phone): the Besiege preview and your siege's buttons; the urgent screen.
  - **Edited:** `rights.test.js` (an independent may now besiege).
- **Not as specified:**
  - **The assault is simulated only;** the fought battle on the walls is P8-06b.
  - **Relief is fought by power, off-screen;** you can't ride in to join it by the reinforcement rules.
  - **A castellan always comes back to the company,** never captured; the garrison is halved, not "killed, taken or scattered" by the outcome.
  - **No surrender policy for your castellan:** they surrender at no food or hopeless odds.
  - **A conqueror who kept a fief unasked and was cast out** is not made a siege target.
  - **The siege ring on the map** isn't checked by the browser tests, only by eye.
- **Test tiers (NEXT-PLAN §7):**
  - `npm test` (771), lint, and the full browser suite: 177 passed, none failed.
  - **The slow files this task reaches:** `world-sim`, `gate-d-campaigns` (the 60-campaign story check passes), the new `landed`, `campaign-bots` and `happenings-bots`; 7 of 8 passed together.
    - The failure: `world-sim`'s spike check (a 4.3 s day against a 1.1 s median) under the files' own load. Alone it passes. `node scripts/bench-map.js --season 80 90` gives 990 ms median and 1,067 ms worst: no spikes.
    - **The save of that world is now 80 KB** (48.6 KB at 2.26.0), inside its 100 KB budget but growing; P8-T should look at it.
  - **Skipped:** `battle-parity`, `battle-extras`, `phase7-exit` and `test-world`, which this task doesn't reach.

**Problem.** No fort is ever taken in play, so Prototype D's "lost while the player is elsewhere" can't happen (design §17.3, §20.4–20.7).

**Build.**
- **A siege** (`c.sieges`, at most one per fort):
  - its besiegers (lord parties and/or the player);
  - the defenders (the garrison, and any party inside);
  - the day it began;
  - ladders and ram progress;
  - the fort's food days.
  
  It is stepped once per world hour.
- **Who besieges:**
  - **AI realms at war (W-07):** a realm picks the nearest enemy fort, not story-locked, and two or more of its free lords gather there (the `gather` intention, with rally and arrival times). A siege begins when the gathered power is at least 1.5× the garrison's.
  - **The player:**
    - while at war with its controller (as a mercenary or vassal of a realm at war with it);
    - or as an independent, at the reputation cost of attacking that realm;
    - from the fort's tap card: Besiege, with a preview of the odds and the time.
  - At most one siege per realm at a time.
- **Phases** (D-P8a):
  - **Encirclement:**
    - the fort's services close to anyone not friendly to the besiegers;
    - its villages' trade and recruiting stop;
    - the defenders eat their food days.
  - **Preparation:** ladders after 1 day, a ram after 3. Each day, the besiegers' commander (the player, or the AI) chooses to assault (the AI when its odds with what's prepared pass a threshold), wait, or lift the siege.
  - **Assault:** fought (P8-06b) or simulated, the defenders behind walls (×1.5 power in auto-resolve, less with a ram, more on walls in good repair).
  - **Starvation:** at 0 food days, or when the odds are hopeless, the garrison surrenders: it walks out, and the castellan goes free.
  - **Relief:** the defending realm's free lords ride to break the siege (P8-01 intentions). A relief army fights the besiegers by the reinforcement rules (V2-09), and the player may join either side by riding in.
- **Resolution** (`realm.transfer`):
  - control passes;
  - the garrison is killed, taken or scattered (by the outcome);
  - the castellan is captured, or escapes (one chance in three);
  - the conqueror makes the choice of D-P8f (P8-05): ask, suggest, hand over or keep; a ruler who took it in person decides;
  - its villages follow (P8-02's `transfer`), held by the conqueror's ruler until granted (P8-05) to a landless lord, the player or another lord, while their old holders keep claims;
  - a conqueror who kept a fief unasked and is expelled becomes a target: the realm's lords besiege it like an enemy's;
  - **a lord left with nothing** becomes landless: their party campaigns on from their kin's seat or the capital;
  - businesses there meet the new owner's law (P7-10);
  - the old holder keeps a claim;
  - the walls lose condition;
  - a fort taken starts with half a garrison and 30 days of unrest.
  
  The chronicle and the news record it.
- **Warnings and choices for the player** (design §17.3):
  - when your fort is besieged: an urgent message (the scout warns a day earlier if the gathering is seen);
  - you may ride back, ask a lord for relief (from P8-07), or leave it to the castellan;
  - the castellan's policy decides when to surrender (the default: never while food lasts and the odds aren't hopeless).
- **Anti-snowball** (design §20.7; no rubber-banding):
  - sieges only at war, and wars end by exhaustion (W-07's `exhaustion`, now counting siege losses);
  - one siege per realm;
  - lords go home to refill after a siege;
  - a taken fort is weak and restless for 30 days;
  - a realm with one fort left gets no free troops (it's simply harder to besiege, with its lords nearer home).
- **`npm run landed`** (new script): 180 days of the world alone on several seeds. It reports wars, sieges begun, lifted, surrendered and stormed; forts per realm over time; grants, and how many lords are landless, hold one place or several; and the invariants.

**Layers.** Default: AI sieges happen around you; your fief's castellan defends. One decision: ride back or not. Expert: besiege, time the assault, starve instead.

**Save.** v23: `c.sieges`; walls' condition and food days per holding.

**Edges** (design §27.2–27.4):
- a holding besieged twice in quick succession during fast travel;
- a siege whose war ends (it's lifted at once);
- a siege at the same hour as payday and the mill's week (the law runs first, as P7-10);
- a lord summoned to a siege who is captured on the way;
- a besieger party in the battle lock;
- the story forts (never, until Q4 ends).

**Out.** The battle on the walls (P8-06b); towns besieged (P9-05); siege engines and towers.

**Tests.**
- Each phase and outcome, deterministic under a seed.
- Surrender, storm, lift and relief.
- Transfers once each.
- Claims recorded.
- Businesses' law on a real change of hands (SC-16).
- **SC-20:** your fort falls while you're elsewhere, with the correct loss of revenue, control and garrison; you continue.
- `npm run landed` invariants as a slow test: no realm loses every fort in 180 days without a player, and forts do change hands.
- Browser: the siege on the map, the urgent message, the Besiege preview.

**Acceptance.** Forts change hands in play by understandable rules. You're warned in time to act. The world doesn't snowball over 180 days on its own.

### P8-06b · The assault battle (M–L) — ✅ Done in 2.30.0

**Done (2.30.0, 2026-11-21).** No save change. `js/arena.js` `assault(opts)` builds the walls; `js/assault.js` (`CL.assault`) runs the battle on them.
- **The map** (2 screens across, built for each battle and never shared):
  - the wall across the field (26 px, solid; arrows fly over it);
  - a gate in the middle (shut: an obstacle of this battle's map until broken);
  - one to three ladder points, from the preparation (a day each, three at most);
  - the walkway behind it (high ground, P7-11's +25% archer range);
  - the paved courtyard, with a keep line of four blocks at its far end.
  
  Defending, it is mirrored, the courtyard on your side.
- **The way through** (`arena.wayThrough`): a soldier whose way is across the wall goes to the nearest open gap on their side, then through it; with none open, they wait at the wall. It is in the AI's movement for foot and horse. The hero is yours to walk; the wall stops them anywhere but a gap. Nobody stands inside the wall (tested).
- **The ram** (from three days): any attacker within 70 px of the gate for 25 seconds breaks it. On a defence, every third attacker carries it to the gate.
- **The defenders hold the wall:** one whose foe is outside stands at the inner head of the nearest ladder or the gate instead of sallying out.
- **Winning:** routing the other side, as any battle. Also the attackers holding the courtyard (three or more of them in it, at least 1.5× the defenders still there, for 12 seconds).
- **Setups on the walls** (`prep.plan` asks `assault.anchors`):
  - **Balanced, attacking:** infantry at the first ladder on Charge, archers behind on Hold, cavalry back at the gate.
  - **Defensive, defending:** archers on the walkway, infantry at the gate, all on Hold.
- **From the siege:**
  - **Storm the walls** on your siege's card, beside **Simulate** (P8-06a's, with the same walls' bonus). Won, the fort is taken (P8-06a). Lost, you are **thrown back**: soldiers lost, but no gold seized, no item taken, no capture; the defenders' losses come off the garrison and the siege is lifted.
  - **Defending:** when the besiegers storm a fort you are in, the battle is fought, with 52% of the garrison beside you as helpers (the rest hold the other walls); won, the siege is lifted and the attackers' losses come off their lords; lost, the fort falls, with you captured as in any lost battle.
- **Parity** (`node scripts/parity.js --siege [seeds]`): your siege of Castra Nova three days in, and your defence of it. 40 seeds:
  - attacking: odds 46%, Simulate 38%, fought 55% (9 over);
  - defending: odds 60%, Simulate 53%, fought 75% (15 over).
  
  The garrison's share and the courtyard hold were tuned for this: with the whole garrison, defending was 30 over.
- **Debug → Battle size & stress test:** Siege assault 30 and Siege defence 30 (practice, two ladders and a ram), reporting fps and the slowest frame on the result screen.
- **Tests:**
  - `tests/assault.test.js` (6): the map and its mirror, the way through (a soldier crosses by the ladder and is never inside the wall), the ram, the setups, storming won and thrown back, defending held, Simulate's walls and practice changing nothing.
  - `slow/battle-parity.test.js`: the siege scenarios within −5 to +25 of the odds over 40 seeds.
  - `tests/browser/assault.spec.js` (desktop and phone): Storm the walls from the siege, the battle on the wall, the fort taken.
- **Not as specified:**
  - **No preparation screen before an assault:** it starts with the walls' own setup (Balanced at the ladders, or Defensive on the walkway). Custom placement isn't offered; the screen is the encounter's.
  - **You can't ride in to fight a relief,** as in P8-06a.
  - **Reinforcements** don't join assaults.
  - **The phone test's numbers** are for the owner's phone: the pane here runs throttled when hidden.
  - **Ladders show as gaps in the wall** until there's art (ASSETS 14).
- **Checkpoint (NEXT-PLAN §7):** `npm test` (777), lint, the full browser suite (179 passed, none failed) and the whole slow suite (14 of 14, run together, including the siege parity) all green.

**Problem.** A fought assault needs walls. The only walled map is the fixed Greywall Courtyard used by Q4.

**Build.**
- **A generated assault map** (`js/arena.js`, like P7-11's `hills`; data in `data/battle_maps.js`):
  - **a wall line across the field:**
    - a gate in the middle;
    - one to three ladder points, from the preparation (more after longer preparation);
    - the wall as an obstacle;
    - defenders on its walkway count as on a rise (P7-11: archers' range +25%);
  - **the courtyard behind,** with a keep line to fall back to.
- **The ram:** if prepared, it is carried to the gate by attackers (an objective like P7-11's wagon, in reverse) and opens it after a set time at the gate.
- **Attack and defence:**
  - the player attacks their own siege's fort;
  - the player defends when inside a besieged fort (their own, or a friendly one they ride into), or when relieving one.
  
  The same map serves both sides, flipped.
- **Battle preparation:** presets that make sense on walls (Balanced: infantry at the ladders, archers behind; Defensive for defenders: archers on the walkway, infantry at the gate). Custom placement within each side's area.
- **Winning:**
  - attackers win by routing the defenders or holding the courtyard for a set time;
  - defenders win by routing the attackers or holding until the attackers' morale breaks;
  - the result feeds P8-06a's resolution.
- **Simulate uses the same wall bonus** as P8-06a's auto-resolve. `scripts/parity.js` gains siege scenarios (attack and defence) aimed at B-01's 5–15 points over the odds.
- **Debug:**
  - Siege assault 30 (practice, attack and defence);
  - the phone test, reporting fps and the slowest frame (like Big battle 40).

**Layers.** Default: Balanced on the walls, or Simulate. Expert: Custom placement at the ladders, timing the ram.

**Save.** None (a battle's state lasts one battle).

**Edges.**
- Units can't stand inside the wall, or be pushed through it.
- Ladders are the only way up besides the gate.
- A unit ordered to the far side of the wall goes to the nearest ladder or the gate, or the order fails visibly (§27.3).
- Reinforcements arriving at an assault enter on their own side of the wall.
- The battle size cap holds.

**Out.** Second walls, towers, engines, burning gates; sieges of towns.

**Tests.**
- The map generator (wall, gate, ladders, courtyard) and pathing through the gaps.
- The ram as an objective.
- Each preset's placement.
- Win and loss both ways.
- Parity for siege scenarios in range.
- Browser: an assault started from the siege, at both sizes.
- The phone test's numbers recorded for the owner.

**Acceptance.** A fought assault is playable and readable on the phone, within the frame budget. Fighting it is a few points better than Simulate, as B-01 aims.

### P8-07 · Named nobles: needs, opinions and rivalries (M–L) — ✅ Done in 2.31.0

**Done (2.31.0, 2026-11-21).** Save v24 (`nobles`). `js/nobles.js` (`CL.nobles`); the Lords tab in `js/ui.js`.
- **Needs** (`needs`, computed, never saved), each with a score and its words:
  - land: landless, or a claim to a lost fief;
  - coin: a kinsman to ransom, a fief purse short of the men it owes, or the coin motive;
  - men: under 55% of the household;
  - safety: a holding besieged or gathered against (or the realm at war);
  - standing: beaten, passed over or out-granted in the last 30 days (or the glory motive).

  The top one (`needLine`) shows on the tap card and the Lords tab. They lean the lords' riding (`leaning`): short of men they pick no fights; fearing for their lands they leave other realms' soldiers be; after glory or spoils they look 40% further for Reavers.
- **Motives** from the trait line (`motives`): guards their lands, hungry for glory, loyal to the crown, owes the crown nothing, minds the coin, hungry for land. Stable; they weigh the factors.
- **Opinions** (`opinions[from][to] = { rel, log }`, sparse): deeds move `rel` (`DEEDS`), half to the doer's close kin (parents, children, siblings, spouses), a point a week back toward nothing. A lord's view of their ruler starts from their motives (loyal +15, owes nothing −10), of their kin at +10. The P8-01 deeds feed it (`lords.deed`), and so do the player beating a lord, defecting, and leaving an oath owing service.
- **Ties** (`tie`), read from the log, never scripted: a feud (took their fief, or you hold their kin), a rival (got the grant they wanted), a friend (a friendly deed and goodwill of 8 or more).
- **Requests** (`consider`): four factors, each a line with its sign:
  - obligation: sworn to the same crown, kin, their ruler's summons, a debt (a waived ransom, help given);
  - relationship (×0.6), with the deed behind it;
  - interest: how far from their lands, their lands threatened, their ranks thin, at another siege, a claim on the place, the crown's war, the walls against the host as anyone can see them, a feud beside them (never), a rival (cold);
  - fear: the asker's men and renown (yours), the crown's.

  The answer: obey at 30, a price or favour at 10, delay (a day) when the reason is thin ranks, another siege or their lands threatened, else refuse. A price for a siege or relief is in crowns; for the rest, a favour (their petition) unless they want coin. Only what the lord could know goes in: your purse never does (SC-24, tested).
- **Your requests** (Lords tab, Ask…): Join my siege, Relieve my fort, Ride with me (three days: they keep beside you and take your side in a fight against anyone but their own realm), Back my claim (your bid at court for 60 days). Each with why not. A 3-day cooldown per lord, 7 after a refusal; a price paid once (it stays open on the card until the cooldown ends); a promise lapses, and you are told, if they are taken on the way. Their debt to you is paid by doing it.
- **The ruler's summons** (`summon`): every lord a realm gathers for a siege answers by the model; who refuses stays home, the news tells one, and the ruler remembers it (once a week a lord). A besieged fort's call for relief goes the same way (`answersRelief`), except a realm's last fort, which every lord rides to save. **Your summons**, as a vassal: a message and a line on the Allegiance tab; being at the siege answers it (a day of service each day); its end without you is a call missed (P8-04).
- **Between lords:** fighting a siege through together makes friends; a fort taken makes the old holder's feud with its taker (their claim was P8-06a's), and resentment of the crown that didn't hold it; a grant makes rivals of the top candidates who wanted land and were passed over. Feuding lords won't answer a summons beside each other. **Grants weigh opinions** (P8-05's order, after the fewest fiefs): the ruler's goodwill /10, ±1 for each friend or rival at court, and your backing and influence for you (or for the lord you back). A realm at war goes first for a fort one of its lords claims.
- **The conqueror's choice for AI lords** (`conquerorChoice`): keep it (owes nothing, thinks ill of the crown), suggest a landless kinsman, hand it to the crown (loyal, with land enough), or ask.
- **Changing realm** (`weekly`, each lord's week): thinking less than −30 of their ruler, a lord grumbles at court (the news), and a week later leaves for the realm whose ruler they think best of (at least 15 better): released at peace (fiefs back to the crown, no claim), defecting at war (fiefs lost, a `granted` claim kept). Once in 60 days; never from a siege (after it ends); never leaving a realm with three riding lords or fewer; one a realm a month. Their kin at home think less of them; the old ruler remembers. They ride out again from their new capital.
- **Revocation:** a lord who refused two summonses in 60 days loses a fief (a village first; never a story fort's), which the crown grants to another; they resent it.
- **Petitions** to you (one open at a time, about one chance in eight a day once 5 days have passed since the last), from a lord who thinks well of you (+10 or more), by their top need: clear the bandits about their fief (80 crowns, 10 days), lend 100 crowns (130 back in 14 days, a week's grace at a time), pay a kinsman's ransom to the realm holding them, back their claim, support them for a grant. Accept or decline at the top of the Lords tab; either way they remember. The reward is paid once.
- **The Lords tab:** each lord's realm and holdings (or landless), kin (and their realm if another), friends, rivals and feuds, top need, where they are, motives, and what they think of you and why.
- **`npm run landed`** also reports land gained and lost, grumbling, who left and joined each realm, summonses refused, revocations, friends, rivals and feuds, and riding lords per realm. 180 days, three seeds: 1–3 lords change realm a run, 10–13 rivalries and 4–5 feuds, every realm keeps 4–7 riding lords.
- **Not built:**
  - the "escort my caravan" petition (five of the six kinds);
  - AI lords ransoming each other's kin (a realm's prisoners still come home "ransomed by their own");
  - lords asking each other for men;
  - a land-hungry lord seeking out sieges beyond the summons, and a men-short one avoiding a summons (the realm doesn't summon thin lords).
- **Debug → Nobles:** Lord likes me, Lord grumbles (now; they leave in a week), Lord leaves realm, Petition now, Nobles: a week.
- **Tests:** `tests/nobles.test.js` (20), `tests/slow/prototype-f.test.js` (Prototype F), `tests/browser/nobles.spec.js` (the Lords tab, a request and its answer, a petition, at both sizes), and the landed slow test's P8-07 acceptance.

**Problem.**
- **Lords obey nothing and want nothing.** Prototype F asks for two vassals given the same high-risk order: one obeys, one negotiates or refuses, for reasons the player can read (design §18.4, §28 "relationship, interest, obligation and fear").
- **The lords don't deal with each other** (owner, 2026-11-20). They should have needs, friends, rivals and feuds of their own, act on them, and change realm when it suits them, by the same rules as the player.

**Build.**
- **Needs** (computed from state each day, never stored; a lord's top need shows on their tap card):

  | Need | When | What the lord does about it |
  |---|---|---|
  | **Land** | Landless, or lost a fief | Joins sieges that could win one; seeks grants; resents a grant that passes them over |
  | **Coin** | Fiefs pay less than the party costs, or a ransom to raise | Hunts for spoils; asks kin or the ruler; takes the player's paid requests |
  | **Men** | Party well under strength | Goes home to refill; avoids fights |
  | **Safety** | A holding threatened or besieged | Stays near home; asks for relief; refuses to ride far |
  | **Standing** | Renown low against their peers; passed over; a defeat | Seeks battle and tournaments (P7-09); takes risks |

  Needs drive the lords' intentions on the map (P8-01) and colour every answer below.
- **Opinions, with the same four factors for everyone.** Each lord has a view of the player, of their ruler and of every other lord they've dealt with (kept sparse: only pairs with a history).

  | Factor | What it is | Changes by |
  |---|---|---|
  | **Relationship** | −100…100 | Deeds: fighting beside them, relieving their siege, ransoming or freeing them or their kin (P8-01), taking their fief, beating them, winning a grant they wanted, insults, defections. **Kin remember:** half of a deed carries to close kin |
  | **Interest** | Computed per request | How it touches their needs and holdings: distance from home, threat to their lands, gain |
  | **Obligation** | Stated | Sworn to the same ruler, kin, or a debt (a waived ransom, help given) |
  | **Fear** | Computed | The asker's power against theirs, and the asker's renown |

  A few stable motives per lord, from P8-02's trait line ("guards his lands", "hungry for glory", "loyal to the Crown", "owes the Aurelians nothing"). Motives change slowly, never daily at random.
- **Between lords: friends, rivals and feuds,** derived from their history, never scripted:
  - **friends:** fought together, relieved one another, ransomed each other's kin;
  - **rivals:** wanted the same grant, and one got it;
  - **feuds:** one took the other's fief, or holds their kin captive. A feud carries a claim (P8-02), so the loser has a reason to fight for it back.
  
  What they do about it:
  - ask each other for help (relief, a siege, men), answered by the same model as the player's requests;
  - won't ride together, and may refuse a summons that puts them beside a feud;
  - back or oppose each other when the ruler grants land;
  - ransom each other's kin;
  - press their feud's claim when their realm is at war with the holder's.
- **Grants weigh opinions** (adds to P8-05's order): the ruler's opinion of each candidate counts, and lords back their friends and oppose their rivals. Friends at court matter, the player's included.
- **Requests and answers (the player and the lords alike):**
  - **The player asks a lord** (from the Lords tab or the lord's tap card):
    - to join a siege;
    - to relieve your fort;
    - to ride with you for a few days;
    - to back your claim or your bid for a grant.
  - **The lord answers obey, negotiate, delay or refuse:**
    - negotiate names a price in crowns or a favour (a petition);
    - delay names a day.
    
    Each answer comes with its reasons in plain words, from the factors and needs: "He's sworn to the same Crown (+). Ashgate is three days from his lands, and Redfield is threatened (−). You freed him at Redfield (+). He doesn't fear you."
- **The ruler's summons** to AI lords and the player use the same model:
  - AI lords may refuse, which shows in the news;
  - for the player, a summons is an obligation (P8-04).
- **Lords change sides by the player's rules** (P8-04, D-P8e):
  - a lord whose opinion of their ruler stays low (unmet needs, passed over, feuds the ruler ignores) asks for release, or defects to a realm whose ruler they think better of;
  - their fiefs go back to their old crown, and they keep claims, which their new liege may back (a reason for war);
  - their kin decide for themselves;
  - a ruler may revoke a fief from a lord who keeps failing obligations (P8-08's revocation, the same for AI lords) and grant it to someone else.
  
  The news tells it: "Ser Maren leaves the Valedorn Crown for Hrothmark."
- **The lords' own petitions** to the player, as small requests with a reward and a deadline, at most one open at a time, chosen by their top need:
  - clear bandits from my lands;
  - escort my caravan;
  - lend me coin;
  - ransom my kin;
  - back my claim;
  - support me for the grant of Highmere.
- **The Lords tab:** each lord, with:
  - their realm and what they hold (or "landless");
  - their kin, their friends and rivals;
  - their top need;
  - where they are;
  - their relationship with you, and a line of why.

**Layers.** Default: no requests needed; lords act by themselves, and their quarrels reach you as news. One decision: answer a petition. Expert: read needs and factors to choose whom to ask and when, and to court friends before a grant.

**Save.** v24:
- opinions (player, ruler and lord-to-lord, sparse);
- debts and open petitions;
- the history behind friendships, rivalries and feuds.

Needs are computed, not saved.

**Edges.**
- No hidden omniscience: a lord's reasons use only what they could know (SC-24).
- **No churn:**
  - requests have a cooldown per lord, and a refusal hardens for 7 days;
  - a lord changes realm at most once in 60 days, and only after a warning sign in the news ("grumbles at court");
  - `npm run landed` reports defections per realm.
- A lord who agrees and is captured on the way: told, and the request lapses.
- Negotiated payment is paid once.
- A lord defecting while at a siege or a summons leaves after that ends (design §27.2: "a summoned vassal switches allegiance while travelling").
- Kin on opposite sides of a war: allowed, and both remember it.

**Out.**
- Lords rebelling, claiming a throne or becoming rulers (P9-04);
- marriages and houses (P9-06);
- the player as a ruler giving orders (P9-03).

**Tests.**
- **Needs:** each need from its state, and the intentions and answers it changes.
- **Holdings shape answers:** the same request to a landless lord and to a landed one whose lands are threatened gives different answers, with reasons that say why.
- **Kin:** a deed to one lord moves their kin's opinion by half.
- **Between lords:**
  - a grant makes a rival;
  - a taken fief makes a feud and a claim;
  - feuding lords don't ride together;
  - friends back each other's grants.
- **Changing sides:**
  - an unhappy lord warns, then leaves by P8-04's rules;
  - fiefs go back to the crown, and claims are kept;
  - no lord changes twice in 60 days;
  - the §25.3 invariants hold throughout.
- **Revocation:** an AI lord who keeps failing obligations loses a fief, which is granted to another.
- **Prototype F as a slow test:** two lords given the same high-risk request; one obeys, one negotiates or refuses; the reasons name the factors that decided it.
- **Determinism:** each factor's effect.
- **SC-24.**
- **No spamming** (cooldowns).
- **Petitions:** reward once.
- **Browser:** the Lords tab, a request and its answer, at both sizes.

**Acceptance.**
- Prototype F passes, and every lord's decision can be read and answered politically.
- Over 180 days of `npm run landed`:
  - lords gain and lose land;
  - rivalries and feuds form from what happened;
  - a few lords change realm;
  - no realm empties of lords.

### P8-08 · Losing and retaking land (M) — ✅ Done in 2.32.0

**Done (2.32.0, 2026-11-21).** No schema step (optional fields: see SAVE-FORMAT). `js/claims.js` (`CL.claims`); the Claims view and handing back on the Realm screen's Fief tab.
- **Every loss path, and its state** (holder, controller, claim, castellan):

  | Path | Holder and gates | Your claim | A castellan |
  |---|---|---|---|
  | A siege, surrendered | the taker's ruler, the taker's gates; villages with the seat | `old`, on the fort and its villages | walks out to you |
  | A siege, stormed | the same | the same | taken with the fort (`heldCastellan`); freed when it is yours or your realm's again |
  | Your liege's revocation | the ruler; the gates unchanged | none (the liege's right) | comes back to you |
  | Released from your oath | the ruler | none | comes back |
  | Defected or expelled | the ruler | `granted` | comes back |
  | Handed back (Fief tab: Give it back, then a word of what it means) | the ruler | none | comes back |

  **The revocation** (`allegiance.missed`): the first call missed (a short month or a summons) while you hold the realm's land is a warning naming the fief; the second takes it back (a village first); the third casts you out (P8-04). Your standing falling within 10 of Hostile while you hold their land: one warning before the expulsion. AI lords' revoked fiefs leave no claim either.
- **The landless view:** holding nothing, the Fief tab is **Claims**: your company, money, mill and followers named as yours, then each claim with how it came about, who holds it now, "a claim gives no income and no control", and what could press it. Landed with claims too, they follow your fiefs. No chores (SC-21). Your policies are kept with the claim and restored if you get it back, falling back to the defaults where they no longer apply (SC-44).
- **Pressing a claim:**
  - **retake it by siege** (P8-06a's rights): if your liege backs the claim (you are their sworn vassal, with room for a fief, and the ruler thinks no worse than −10 of you), it is yours again at once, with the villages you claimed, and no conqueror's choice; otherwise it is a conquest like any other;
  - **ask your liege to press it** in their war (once a week): if the ruler thinks no ill of you (with your influence), the realm's next siege goes for it for 30 days;
  - **buy it back** at peace from the realm that holds it (800 crowns for a fort; a village goes with its seat), held of your liege with you as holder, and the villages you claimed.

  A claim on land your own crown holds becomes a grant offered to you (once: declined, it goes elsewhere), and you come right after whoever did most in its taking among a grant's candidates. A claim on land a lord of your own crown holds is refused while you are sworn.
- **Prototype D** (`tests/slow/prototype-d.test.js`, 18 s): Westholt Castle and Ashby for Valedorn with a warband and a mill; Hrothmark's real siege takes it while you are at Stonebridge; cast out; 15 days landless, recruiting; service with Aurelia, then the oath; your siege retakes Westholt and Aurelia backs your claim: Westholt and Ashby are yours again. The invariants hold at every step; no soldier or holding is doubled.
- **Debug → Nobles: Prototype D start** (the world's data names its places, `prototypeD`): you hold Westholt Castle and Ashby for Valedorn with a warband of 12 and a mill at Ashby, at Stonebridge; Hrothmark goes to war and its lords gather against Westholt.
- **Not built:** petitioning the occupier for the fort's return for service (only for a price); claims inherited by kin (P9-06).
- **Changed tests:** P8-04's obligations test now sees the second short month revoke Fernley before the third casts you out; P8-05's book test keeps its service met.
- **Tests:** `tests/claims.test.js` (10: each loss path, SC-20 to SC-23, pressing, the grant, the edges, AI lords, saves), `tests/slow/prototype-d.test.js`, `tests/browser/claims.spec.js` (the Debug start, the Claims tab, buying back, handing back, at both sizes).

**Problem.** The pieces of loss exist after P8-02–P8-07, but the design's canonical test, Prototype D ("The Dispossessed Lord"), needs every loss path, the landless life and the way back to work together (§17.3–17.6, SC-20–SC-23).

**Build.**
- **Every loss path, in one place:**
  - a siege (P8-06a);
  - a liege's revocation, after repeated failed obligations or a Hostile standing, with a warning first;
  - leaving the realm (P8-04);
  - a grant you decline to keep (handing it back).
  
  Each ends in a defined state of holder, controller, claim and castellan (D-P8e).
- **The landless view:**
  - when you hold nothing, the Fief tab becomes **Claims**, a short list: each claim, how it came about, its realm, and what could press it;
  - no empty chores screen (SC-21);
  - policies of a lost holding are kept with the claim, to restore if you get it back;
  - they are cancelled safely if they can't apply (SC-44).
- **Pressing a claim:**
  - **retake by siege:** as a vassal or mercenary of a realm at war with the occupier, or as an independent at the cost;
  - **petition** your liege to press it in their war (P8-07's request to the ruler);
  - **petition** the occupying realm for the fort's return for a price or service.
  
  After retaking, the fort goes to your current liege, with you as holder if your claim is backed. That is Prototype D's "change allegiance and retake it". Its villages come back with it, and are granted again by your liege (you first, for those you held).
- **Prototype D as a scripted scenario** (design §28.1), `tests/slow/prototype-d.test.js`:
  1. give the player a fort and one of its villages, a warband and a mill;
  2. have an enemy realm take the fort while the player is elsewhere;
  3. remove the remaining office (expulsion);
  4. play on as a landless captain for 15 days;
  5. swear to the enemy's enemy;
  6. retake the same fort without any quest-specific reset.
  
  Every step's state is checked against the invariants.
- **A Debug start, "Prototype D: the dispossessed lord":** a sworn vassal with a fief, a warband of 12 and a mill, and an enemy gathering. The owner can play the loss and the return on the phone.

**Layers.** Default: losses are told, the claim is kept, and the hero carries on. One decision: how to press the claim. Expert: petitions and timing.

**Save.** Optional fields: policies kept with a claim; the revocation's warnings.

**Edges** (design §27.2):
- a title revoked while you're inside the fort;
- you lose the fort but keep a village tied to another seat: you're still landed, and the Fief tab shows just the village;
- a holding captured twice in quick succession;
- a claim on a fort your new liege then holds (it becomes a grant);
- a claim against your own liege (refused while sworn);
- retaking with the old castellan prisoner of the occupier (freed with the fort).

**Out.** Claims inherited by relatives (houses, P9-06); courts and legal rulings.

**Tests.**
- **Prototype D** as the slow test above.
- **SC-20 to SC-23** as scripted scenarios.
- **The same for AI lords:** you take a seat and its lesser lord becomes landless, campaigns, and holds a claim against you; an AI realm takes a seat from another, with the same result.
- **Each loss path:** its defined state.
- **The landless view** has no chores.
- **A claim** never pays.
- **Browser:** the Claims view and the Debug start, at both sizes.

**Acceptance.** Prototype D passes in the bot, and the owner can play it from the Debug start.

### P8-T · Phase 8 tuning and acceptance (S–M) — ✅ Done in 3.0.0

**Done (3.0.0, 2026-11-21).** No save change. The measurements and the owner's checks are in `docs/PHASE-8-VALIDATION.md`.
- **Tuned:**
  - **a fort pays for itself:** fort tax base 60 → 80 and a fort's prosperity from 40 → 50, so on the defaults (steward, normal tax, 22 in garrison) it nets about +10 a week (−19 before); a village +22, unchanged. A contract still brings about 360 a week, so land is a modest income, not a reason to stop working. The AI's forts live by the same rules, so their treasuries no longer drain.
  - **a sworn vassal's first land:** the crown's own village after 30 days of service (from 60). The landed bot swears around day 30–50 and is granted its first village around day 70–80.
  - **a realm's last fort holds out longer:** its besiegers wait for the ram (3 days) and 75% odds before they storm it, and it surrenders only to hunger, never to hopeless odds, so its relief has time to arrive (P8-06a's rules let one realm lose every fort in one seed of six).
  - **a conquest asked for a grant already waiting** names its taker first (a test of the exit found the weekly grants could queue it before the conqueror's choice was made).
  - Siege odds (parity, 40 seeds): attack 9 and defence 15 points over the odds, unchanged since P8-06b, inside B-01's 5–15. Thresholds (150 renown and 20 days to swear; ransoms of 100 crowns and 25 a soldier) left as they are: the bots reach the oath by day 30–50, and a lord's ransom of 400–700 crowns is a week or two of a company's income at that stage.
- **Anti-snowball** (`npm run landed 180 6`): every realm keeps a fort in all six seeds; 3–9 forts change hands a run; lords stay a mix of landless (6–10), single-holding (3–10) and several-holding (6–9), no lord holding more than 40% of a realm's holdings (two of Vessaro's five); 0–4 of the 8 landless lords win land and 2–3 landed lords lose it all; 1–3 lords change realm a run.
- **The bots:** Prototype G has the landed style (serves, swears, takes the grants it is offered, leaves the steward and the defaults) and counts forced screens (a ransom, a grant, a conquest, your fort besieged) per 10 days; every style keeps the invariants over 90 days. The bot answers a grant or ransom waiting even where a headless page never opens the prompt, and leaves a besieged fort to its steward.
- **The exit** (`tests/slow/phase8-exit.test.js`, about 45 s): 120 days in one save with a reload at day 60: service and fealty (the landed bot, days 0–25), Ulfstead Hold stormed for Valedorn and granted on the conqueror's request, lost to Hrothmark's siege while away, landless, defection, service and fealty to Aurelia, Ulfstead retaken and the claim backed. The invariants hold every day; nothing doubled.
- **Reproducible runs:** Prototype G and the exit seed a new game's dice streams and respawn its parties from the fixed seed (a new game seeds them from the clock, which made runs differ).
- **Checks:** 806 fast tests; the whole slow suite (17 tests, about 42 minutes); 187 browser tests at both sizes.
- **Version 3.0.0** (D-V1).

**Build.**
- **Tuning:**
  - **revenue and costs of a fief:** a fief should pay for itself with the default steward and normal tax, without making trade or contracts pointless;
  - **war pace:** forts change hands, but not every week;
  - **siege odds:** fought and simulated, by the parity script;
  - **the thresholds:** renown to swear, service days, ransom sizes;
  - **the lords' politics:** how often lords change realm, quarrel and feud (lively, without churn);
  - **lords and land:** party sizes by fiefs held, the cap of three fiefs, and the pace of grants, so landless lords do win land over time and some landed lords lose it.
- **Anti-snowball:** `npm run landed` over 180 days and several seeds, no player. The target: every realm keeps at least one fort, forts change hands several times, and the realms' lords stay a mix of landless, single-holding and several-holding (no lord gathers a realm's land).
- **The bots:**
  - Prototype G gains the landed style (P8-05), alongside hands-off, presets and expert;
  - forced screens are counted (design §28: "mandatory clicks per 10 minutes for a captain, landowner…");
  - 90-day runs keep the §25.3 invariants.
- **The exit:**
  - Prototype D (P8-08) and Prototype F (P8-07) as slow tests;
  - the exit as a 120-day scripted campaign: acquire, lose, go landless, change allegiance, retake, in one save with a reload in the middle.
- **A validation document,** `docs/PHASE-8-VALIDATION.md`, like Phase 7's, with the checks waiting on the owner's phone play.

**Version.** 3.0.0 (D-V1).

**Acceptance.** The exit holds in the bot and in the owner's play.

---

## Phase 9 — Kingdoms & Houses

The phase opens with five battle-scale tasks (owner, 2026-11-22; decisions D-P9a–D-P9e; P9-B5 added after P9-B4's checkpoint), built first and in order, then the lords' loose ends (P9-L1) and the kingdoms (P9-01 to P9-08). Every task is **Specified** (2026-11-22); each is checked against the code when it starts, as Phase 8's were.

- **The same rules for everyone** (P8's "no fixed classes"): what the player can do as a ruler, a claimant or a commander, an AI lord can do by the same rules, and the reasons for the AI's choices use only what it could know.
- **Layers everywhere** (D-P9e's principle): each system works by default, hands-off, with one decision at a time; the depth is there for whoever wants it.
- **Tests by tier** (NEXT-PLAN §7): every task runs `npm test`, lint and its own browser specs on desktop and phone; the full browser suite when shared UI changes; the slow files its code reaches. The whole slow suite runs at the checkpoints after **P9-B2**, **P9-B4**, **P9-04**, **P9-06** and **P9-T**. The slow files each task is expected to need:

  | Task | Slow files | Checkpoint |
  |---|---|---|
  | P9-B1 battle size | `battle-parity`, `battle-extras` | |
  | P9-B2 proportional battles | `battle-parity`, `battle-extras`, `campaign-bots` | **Whole suite** |
  | P9-B3 a bigger company | `campaign-bots`, `world-sim`, `landed`, `phase7-exit` | |
  | P9-B4 command in layers | `battle-parity`, `battle-extras`, `campaign-bots` | **Whole suite** |
  | P9-B5 the walls at the world's scale | `battle-parity`, `battle-extras`, `campaign-bots` | |
  | P9-L1 the lords' loose ends | `landed`, `prototype-f` | |
  | P9-01 realms as organisations | `landed`, `campaign-bots`, `world-sim` | |
  | P9-02 diplomacy and treaties | `landed`, `world-sim` | |
  | P9-03 founding or taking a kingdom | `landed`, `campaign-bots`, `test-world`, `phase8-exit` | |
  | P9-04 rebellion and deposition | `landed`, `prototype-d`, `prototype-f` | **Whole suite** |
  | P9-05 armies and campaigns | `landed`, `world-sim`, `campaign-bots`, `battle-parity` | |
  | P9-06 houses, marriage and claims | `landed`, `campaign-bots` | **Whole suite** |
  | P9-07 modding | `test-world` | |
  | P9-08 creator tools and a second world | all (a second world for the bots) | |
  | P9-T tuning and acceptance | all, with the long runs | **Whole suite** |

  A task that turns out to reach more than its row runs those files too, and says so.

### P9-B1 · Battle size, measured and raised (M–L) — ✅ Done in 3.1.0 (the owner's phone benchmark in 3.1.1)

**Problem.** A battle holds at most 40 fighters at once (Settings: 20, 30 or 40), set for the phone when battles were first scaled (GDD §6, V2). The owner wants 100–150 at once (D-P9a), and the phone was hardly stressed at 40.

**Build.**
- **Measure first, on the owner's phone:**
  - Debug → Battle size & stress test gains a **benchmark**: the same open-field battle at 40, 60, 80, 100, 120 and 150 fighters, each for 30 seconds of fighting, one after another;
  - it reports, for each size: the average fps, the slowest frame, and simulation and drawing ms a frame (as the stress test does), and copies a one-line summary to the Logs;
  - `scripts/bench-battle.js` (the Node benchmark) extended to the same sizes measures the simulation alone, for the record.
- **Then the performance work the numbers ask for,** in this order, stopping when 100 holds at 30 fps on the phone:
  - **thinking:** fighters far from any enemy, or holding, re-plan less often (every few frames, staggered); targets found through a grid of the battlefield (as `js/spatial.js` does for the map) instead of looking at every fighter;
  - **drawing:** off-screen fighters not drawn; health bars, hit rings and arrow trails thinned with the size (the Reduced effects setting's cuts, by default above 80); sprites drawn from cached frames;
  - **morale and groups:** counted per group, not per fighter, each frame.
- **The setting:** Battle size from 20 to 150 in steps of 10 (Settings), saved with the device's settings as now. The default is the largest size the owner's phone held at 30 fps or better (100 is the hope); a lower one on a device that runs slower in its first battles is offered, never forced.
- **The field:** the large battlefield's size grows with the battle size (more room for 150), and deployment zones with it.

**Out.** Sharing the field by army size (P9-B2); a company beyond 20 (P9-B3).

**Tests.**
- The benchmark's Node run: every size completes, no fighter stuck, no frame over a bound in the simulation alone.
- Battles at 100 and 150 end (no stalemate), with the same rules as at 40 (B-01's parity at 40 and at 100).
- Browser: the setting's range and its use in the next battle, at both sizes.

**Acceptance.** On the owner's phone, the benchmark's 100 holds at 30 fps or better (or the measured largest size is recorded as the default, with what limits it).

**Done (3.1.0).** Settled with the owner at the start (2026-11-22, D-P9a): the deployment grows with the size, the benchmark is an open field grown for the size, a device on the old default moves to the new one, and 60 fps stays the target at 40.
- **The setting:** Battle size from 20 to 150 in steps of 10, in Settings and the Debug panel. A device that never chose a size follows the default; one that chose keeps it (`battleSizeChosen`; settings from before 3.1.0 on that build's default, 30 on a phone and 40 on a computer, count as not chosen). **The default is provisional:** 100 on a computer and 60 on a phone (`CL.settings.BATTLE_DEFAULT`), until the owner's benchmark gives the phone's number.
- **A slow battle's offer:** a campaign battle that ran under 30 fps for at least 10 seconds offers a smaller size on its result screen ("Use 40"), once a device and only while no size was chosen. It is never applied by itself.
- **The field:** the deployment limits (12 foot, 8 archers, 6 riders at 40) grow with the size (45, 30 and 23 at 150), so a company of 74 starts on the field instead of 26; a block bigger than the old limit forms a wide line, inside the field. A company no bigger than before forms up exactly as it did, at any size. Generated large fields grow above 80 (3 screens at 80, 3.75 at 150, `CL.arena.growth`); the one-screen fields and the courtyard don't.
- **The benchmark:** Debug → Battle benchmark runs the same open-field battle at 40, 60, 80, 100, 120 and 150, 30 seconds each, each side with twice its share in reserve so the field stays full, the company following the hero so the fight is in view. The result screen and one line in Logs give each size's fps, slowest frame (from the second second on) and simulation and drawing ms, and the largest size at 30 fps or better. Stress 100 and Stress 150 join the panel. `npm run bench` runs the same battle at the same sizes in Node, with a count of fighters standing idle far from the fight.
- **The performance work the numbers asked for** (simulation alone in Node, on the development machine, at 150: 4.0 ms a frame and 8.6 ms at the 95th percentile before; 1.9 and 2.6 after, with everyone following; 0.54 ms at 40):
  - **thinking:** finding the nearest opponent is one pass instead of a sort of every fighter (a quarter of the battle's cost at 150); braced spears test distance before the troop;
  - **morale, groups and sight:** the checks that tested every fighter against every opponent four or five times a second (regrouping, giving up the field, a group's "engaged", what the company sees) use one grid a check (`CL.units.proximity`), with exactly the same answers;
  - **drawing:** above 80 at once the drawing is thinned as Reduced effects does (no hit rings except the Rally's, health bars only over the badly hurt, the fallen fading after 20 seconds, the hero and companions never), only the fallen still showing are sorted, and arrows are drawn in one stroke a side. Off-screen fighters were already skipped.
- **Measured in the desktop preview:** the benchmark ran every size; that browser pane runs at 30 fps whatever the load, so its fps says nothing, but its work a frame does: at 150, 0.9 ms of simulation and 0.5 ms of drawing (0.4 and 0.4 at 40).
- **Not done:** the owner's phone benchmark, and so the phone's default (60 until then); re-planning far or idle fighters less often, and cached sprite frames (the numbers didn't ask for them; the phone may). B-01's parity at 100 moves to P9-B2 (today's battles are under 40, so a bigger size changes nothing yet); P9-B1's tests check instead that battles of 40, 100 and 150 end and that the stronger side wins at each.
- **The owner's phone benchmark (3.1.1, 2026-11-22):** every size from 40 to 150 at 60 fps, the slowest frame 17 ms. At 150: 2.4 ms of simulation and 2.6 ms of drawing a frame; at 40: 1 and 1.9. The acceptance holds (100 at 30 fps or better, with room to spare). The default is 150 on phones and computers, and the size now goes to **200** (the owner: "we could even go bigger"): Settings and the Debug panel offer 160 to 200, the large field grows to 4.2 screens at 200 (3.7 at 150), 200 joins the benchmark and Stress 200 the panel. In Node, 200 costs 2.7 ms a frame. 200 is a choice, not the default, until a benchmark shows it holds.
- **Found for P9-B2:** fighters running from the field hold no place, so reserves step in while they are still on it (up to 193 drawn at a size of 150); and at 150 the reserves come in three at a time with a message each, which is too many messages.

### P9-B2 · Proportional battles, reserves on both sides (M) — ✅ Done in 3.2.0

**Problem.** Today the enemy takes up to half of the field whatever the sizes, in waves, and only your side and helpers come in as reserves. In Mount & Blade, 300 meeting 200 fight in that proportion, and both sides send in reserves as men fall (D-P9c).

**Build.**
- **The share:** each side's places on the field are its share of all the fighters in the battle (yours with companions and helpers; theirs with their helpers): 300 against 200 at a battle size of 100 fight 60 against 40. Never fewer than 10 a side (or all of a smaller side).
- **Reserves on both sides:** as fighters fall or flee the field, each side's reserve sends in the next, keeping its share; they enter from its own edge, in groups, never into the middle of a formation (as V2-09's helpers do).
- **Nearby parties** (V2-09) join their side's reserve when they arrive, and the share is worked out again.
- **The end:** a side is beaten when everyone on the field and in reserve has fallen or fled, or its morale breaks (the whole army's morale counts its reserve).
- **What stays:** fixed encounters (a lair, a story battle, a tournament, the walls' assault) keep their waves; Simulate and auto-resolve count everyone, as now; the result commits once (V2-04).
- **The Prepare screen** shows each side's numbers and their share of the field ("You: 300, 60 on the field. Them: 200, 40.").

**Tests.**
- The share at several sizes and battle sizes, the minimum of 10, rounding.
- Both sides' reserves come in and keep the share; nobody enters twice; the totals at the end equal those at the start less the fallen.
- Parity (B-01) re-measured: fought battles still 5–15 points over the odds, at 40 and at 100.
- Browser: a 60-against-40 battle with both reserves coming in, at both sizes.

**Acceptance.** A battle between two large parties fights in proportion, and both sides reinforce until one is beaten.

**Done (3.2.0).**
- **One army, not waves:** a band, patrol, caravan or lord met on the map (`parties.battleDef`) is one army (`share`), no longer cut into waves of 8. A story band keeps its waves; so do lairs, the tournament and the walls' assault.
- **The share** (`CL.combat.shareOf`): everyone fights if everyone fits; otherwise each side gets the battle size in proportion to its numbers, never fewer than 10 (or all of a smaller side). Yours count the hero, the fit companions and the healthy soldiers. 300 against 200 at 100: 60 and 40.
- **Reserves on both sides** keep their share as men fall or flee. They come in groups that grow with the size (3 at 40, 8 at 200), from behind their own standing line (its rearmost, 150 px further back, slid along until no opponent is close), five abreast. A shared battle says so at most every 6 seconds a side (before, a message for every 3).
- **Parties riding in** (V2-09) join their side's reserve first in line, the share is worked out again by the new numbers (nobody already fighting leaves), and as many as there is room for ride straight in from their own side of the field.
- **The end, morale, results:** as before. A side is beaten when its field and reserve are spent; morale already counted the reserve; Simulate counts everyone; the result commits once; only those who reached the field are rolled for.
- **The Prepare screen** says "You: 150, 60 on the field. Them: 100, 40. The rest step in as men fall." (or that everyone fits).
- **B-01's balance, re-measured** (`node scripts/parity.js`, 40 seeds):

  | | lone hero | small | close | veterans | outnumbered |
  |---|---|---|---|---|---|
  | 3.1.1 (waves of 8) | +14 | +11 | +14 | +1 | +4 |
  | 3.2.0 as one army, B-01's line as it was | +14 | +11 | +14 | −44 | +26 |
  | 3.2.0 (line loosened, always kept) | +14 | +11 | +19 | +4 | +16 |

  As one army, the enemy's loose line made the equal fight hopeless (fought 35% against odds of 79%), and its swarming when it had the numbers made the outnumbered fight easy. The line's slack is now 175 px (from 55), and it is kept whatever the numbers (`ENEMY.lineOutnumber` is infinite). The three close fights average +13 (target 5–15).
- **Big battles** (`node scripts/parity.js --big`, 20 seeds; the close fights eight and six times over): close ×8 +37 at a size of 40 and at 100, veterans ×6 +29 at 40 and −6 at 100. All end. The slow parity test checks that they end and that fighting is never more than 15 under the odds; it sets no ceiling yet.
- **Not done:** a ceiling for big battles. A company with many archers wins big fights far above the odds Simulate states, because Simulate values an archer like any soldier of its tier, and many archers firing together win battles. That is for P9-B4 (the enemy's plans) and P9-T (Simulate's tuning). Fighters running from the field still free their place at once (up to about 190 drawn at a size of 150): left as the spec has it ("as fighters fall or flee").
- **The checkpoint (the whole slow suite, the full browser suite) found three more, fixed:**
  - `battle-extras`: against 6 and 6 crossbows the company now won every time with or without the shield wall, so they are 8 and 8 (the wall: 85% against 42.5%). The wedge now meets 8 at once (the old first wave), where it wins as often as loose ranks but loses more men; **against 11 at once it wins less often (85% against 95%)**, and a stronger first blow doesn't mend it (no shield cover against a line that holds): open for P9-B4's formations.
  - The Phase 7 exit, seed 1: the company earns a little less early (1,780 crowns at day 90 against 2,402) and buys its mill a week later, so at day 90 the mill had run one week (−26). It earns from then (+40 by day 97, +109 by day 104): the exit now runs 100 days.
  - The sieges browser spec checked that no siege at all was left after Lift; at war, Aurelia's lords may begin their own during the day you wait (it failed 1 in 10 before 3.2.0, more often after). It now checks that yours is over.
- **Played:** a 150-against-100 battle at 100 in the browser at 812×375: the Prepare line, the field at 60 and 40, both reserves coming in, the win at 64 s with 4 of 149 lost.

### P9-B3 · A bigger company (M–L) — ✅ Done in 3.3.0

**Problem.** The company can't pass 20 (`party.partyCap`). The owner wants 150–200 (D-P9b), the limit growing with what the hero becomes.

**Build.**
- **The limit,** with no fixed cap of 20 and a ceiling of 200: a base, plus Leadership, plus renown, plus each companion who can lead (as an officer: Mara and the retinue), plus land (a fort or town's levy; a village's men), plus Friendly standing as now. The Party screen shows how the limit is made up. Proposed: 8 + 5 per Leadership + 1 per 20 renown + 10 per officer + 15 a fort, 5 a village, up to 200 (tuned in P9-T).
- **What a big company costs and needs, scaled:** wages and food (the quartermaster's budget with them); recruits (more per settlement and refilling faster, or the limit can't be met); upgrades and gear at volume.
- **The world to match:** lords' households and the realms' patrols grow (the lords from 12–30 to about 40–120 by what they hold); bands of Reavers larger in the wild; garrisons; sieges' numbers (P8-06a's ratios kept).
- **The Party screen for a big company:** soldiers grouped by troop with counts, expanded on a tap; upgrades by group; the phone layout kept.
- **Detachments** (P7-05) may take more, and lead more.
- **Save:** none expected (the roster is already a list); if one is needed, a schema step with fixtures as usual. Size is not a concern (D-P9d: up to 10 MB); if a save nears 4 MB, it moves to IndexedDB first.

**Tests.**
- The limit from each part, and the ceiling.
- A 150-soldier company's week: wages, food and the quartermaster exact; recruiting refills.
- The world's sizes by what lords hold; `npm run landed` and the bots at the new sizes; the economy pass (`npm run economy`) still healthy.
- Browser: the Party screen with 150 soldiers at both sizes.

**Acceptance.** A company grows past 100 in play, the battles it fights use P9-B1's size and P9-B2's sharing, and the economy and the bots stay healthy.

**Done (3.3.0).**
- **The limit** (`party.limitParts`, as proposed): 8 + 5 a point of Leadership + 1 for every 20 renown + 10 for each companion who rides with you as an officer (Mara and the retinue) + 15 for each fort or town you hold and 5 for each village + 2 while Friendly, at most 200. The Party screen shows the sum in words. Mara joining takes a place and brings ten.
- **At volume:** the recruiter hires five at once once there is room for five; the quartermaster's fixed weekly budget may go to 10,000 (it stopped at 1,000, below a big company's food); wages, food and the automatic budget already followed the roster. Recruiting has no per-settlement pool (only money and room), so "more recruits per settlement" had nothing to change.
- **The Party screen:** above 20 soldiers the Soldiers list is grouped by troop ("Footman ×50 · T2 infantry · 3 wounded"), each group opened by a tap and kept open while the screen is; By type (with its upgrades by type) was already there. **Detachments:** no limit on their size before or now; above 16 fit soldiers the picker gains "Footman +5 · 10/50" by troop.
- **The world to match** (`armies` in the world package, data/world_map.js, validated; `world.armies()`):
  - a lord's household three times the data's (36 landless, 48 a village, 63 a fort, about 80 with three fiefs);
  - a fort's garrison three times (66 on the defaults; targets 36/66/96, the refill nine a week), each soldier drawing a third of the wage he did, so a fort's book is as P8-T tuned it. Households and garrisons grow alike, so every ratio of Phase 8's sieges holds;
  - bands, patrols and caravans that form beyond the Border March 2.5 times the template's (in the March, as they were: the story's land and the gentle start). This found that `world.regionAt` never returned a region's `home` flag; it does now.
  - **A realm's last fort** is stormed only at odds of 0.85 after the ram (0.75): on six seeds of `npm run landed`, with the world's random history changed by three times the soldiers, one kingdom lost its last fort (Valedorn, seed 3, day 112); at 0.85 no kingdom is ever left without one, on all six seeds and every month.
- **Measured:** `npm run landed` (six seeds, 180 days): 3–4 wars and 4–9 forts taken a run, as before, every invariant held. `npm run economy` (12 × 60 days): wages short 1.7 a campaign (1.6), never out of food, no desertions; money at day 60 164 (286); 21 soldiers at day 60 (19). The campaign bot hires only while it keeps two weeks of wages in hand, the newcomer's included (one week before): without that the landed bot hired beyond its pay (13 warnings in 180 days against 1).
- **Tests that leaned on the old sizes** now read the world's factors (garrisons of 66, households of 36–81, bands beyond the March), and a noble's test and **Prototype F** bring companies in the world's scale. In Prototype F it takes 60 (12 before) for Lord Hamon to respect your company and name a price rather than refuse: his household is three times bigger, and the hero's own share of the company's power counts for less in bigger armies.
- **A captain's income grows with the company** (owner, 2026-11-22: "raise the income"). First measured, the bots' companies stopped near 60 over a year: a hundred soldiers cost about 700 crowns a week, more than a captain earned. Now:
  - **contracts fit the company:** a hunt's band and an escort's ambush were already matched to the company's strength, but stopped at 14; past 20 in the company their largest grows with the square root of the company's size over 20 (about 31 for 100), a hunt paying by the band's size and an escort by the same factor. Up to 20, the offers are as before. (Growing in full proportion overshot: 21,000–24,000 crowns at day 180 and 67,000–71,000 at a year.)
  - **mercenary service** pays the company's wages and a tenth more, with the base and renown as before (it was 3 crowns a soldier, half a soldier's wage).
  - **The bots** play as a careful captain: up to 20 soldiers they hire as they always did (one week's wages in hand); past 20 they keep three weeks' wages, the newcomer's included, and the expert buys its mill before growing past 20 (without that it never saved for one, and the Phase 7 exit's property failed). Seed 1: the expert has **85 soldiers at day 180 and 109 at a year**, on about 2,500 crowns and 3 warnings, its mill making +302 and +1,234; the landed bot 95 and 116, on about 2,000 crowns and 2 warnings. Before (limit 20): 19–20 soldiers hoarding 9,757–12,590. `npm run economy` (12 × 60 days, the early game): 18 soldiers and 250 crowns at day 60, 1.3 wages short a campaign, never out of food (3.2.0: 19, 286, 1.6).
  - **The Phase 8 exit**'s loss of Ulfstead while away now brings Hrothmark's lords at half again their households: the campaign's dice fall differently from 3.3.0, and a first storm at 1.3 : 1 failed. The step is about the loss, not the odds of one storm.

### P9-B4 · Command in layers (L) — ✅ Done in 3.4.0

**Problem.** Today's orders (infantry, archers and cavalry; Follow, Hold, Charge; the shield wall and wedge; Rally) suit 20 soldiers. With 60–100 of yours on the field there is more to command. As everywhere in the game (D-P9e): the defaults should make just playing fun, and every deeper layer should be there for whoever wants it.

**Build.**
- **Divisions:** up to six (proposed), each a named group with a banner colour. A default split comes from your soldiers: infantry, archers, cavalry, and a second infantry or archer division when a type is large. You can move soldiers or whole troop types between divisions on the Prepare screen (or the Party screen) and rename them. Each keeps its own formation: loose, shield wall, wedge, and (new) a line, a column and a square against cavalry.
- **Layer 1: no orders.** A plan is chosen for you from your divisions, the enemy's and the field (archers on a rise, infantry ahead of them, cavalry on the open flank, Hold against a stronger enemy, Charge against a weaker one), and the divisions carry it out. It is the default, and should win fair fights well.
- **Layer 2: orders by type** (as now, per division): "cavalry, follow me; infantry, charge; archers, hold", with the formation row.
- **Layer 3: captains and placement.** On the Prepare screen, each division gets a captain from your veterans or companions (their skill steadies and speeds it, as a detachment's captain), a place to stand and a facing; a few saved plans of your own (as Custom is today).
- **Layer 4: live command.** During the battle, the tactical map (MAP) takes orders for each division: move to a point, face, hold, charge a chosen enemy group, fall back to a point; orders timed together ("cavalry round the left when the archers loose", "infantry back ten paces before the volley"). A pause keeps the phone usable.
- **The phone:** layers 1 and 2 need no more than today's buttons; layer 4 lives on the tactical map, one division at a time, with large targets.
- **The enemy** uses the same plans (layer 1, and layer 3's placement), so big battles have shape on both sides.

**Layers.** As the build says: each one optional; nothing deeper is ever needed to win a fair fight.

**Tests.**
- The default split and plan from different companies and fields.
- Each layer's orders reach the right division; timed orders fire in turn.
- Parity (B-01): fought battles at layer 1 within 5–15 points over the odds, at 40 and at 100.
- Browser: dividing the company, a captain and a placement on the Prepare screen, and a live order on the tactical map, at both sizes.

**Acceptance.** A hands-off player wins fair big battles with no orders; an expert can stage a flank and a timed retreat on the phone.

**Done (3.4.0).**
- **Divisions** (`js/divisions.js`): six slots, the three roles and a second of each. By default a soldier is in their role's division, and a role of more than 30 splits into two, one each in turn, so a company that never changes them fights exactly as before. Your choices go with the campaign (`c.divisions`, optional fields, no schema step): a troop type's division (on Prepare), one soldier's (their card on the Party screen) and a division's name. A soldier still fights by their role; the division is who they take orders with. Orders, formations, facings and captains are per division; a second division stands beside its first.
- **Formations:** loose, shield wall and wedge (P7-11, their shapes and effects as they were) and new: a **line** (wide, two deep, ×0.9 on the move), a **column** (narrow, ×1.1, on Charge too) and a **square** (a ring that braces against riders from every side, as spears do in front; ×0.5). What a role may take: foot all six, archers loose, line and column, horse loose, wedge, line and column.
- **Layer 1, no orders:** the **Auto** setup, the default on a new device, chooses from the odds Simulate would state: Aggressive at 85% or better, Defensive (a shield wall on Hold) at 45% or worse, Balanced between; archers on a rise keep it, and the cavalry go to the flank with fewer trees and walls. (At 75% Auto charged a band of veterans and did worse than Balanced: 85% it is.) **The enemy plans by the same rules** when it is an army of more than 20 met on the map: much the weaker, it holds and waits; otherwise it comes on; either way it forms up in blocks (foot ahead, archers behind, horse on the flanks). A band of 20 or fewer, a lair, a story fight, an escort's ambush, the tournament and the walls fight as before: given its plan, the small fights went to 100% fought, so they keep B-01's.
- **Layer 2, orders by division:** the Orders panel shows a button for each division the battle has (keys 1–6), and the formations the selected division may take.
- **Layer 3, captains and placement:** on Prepare, a folded Divisions section: each division's captain (a veteran of tier 3 with 10 battles, or a companion; they stand with the division they lead, steady its group's morale by 8 and quicken it by 5%), formation, facing and name; each troop type's division; and three plans of your own (offsets from the hero's start, orders, formations, facings; on the device, `prepPlans`). Every division's flag can be dragged.
- **Layer 4, live command:** on the tactical map the Orders panel (docked out of the field's way, and clear of the battle buttons on the phone) chooses the selected division's action: **Move** (and hold there, as before), **Charge** (the enemies nearest the spot first), **Fall back** (to the spot without stopping to fight, then hold), **Face**; and when: **now**, **in 5 s**, **in 10 s** or **on the volley** (when your archers next loose). Orders set while the map holds the battle go off together when their time comes. Debug: Reset divisions.
- **Parity** (`npm run parity`, 40 seeds): the small fights at 40 are as 3.3.0 left them, with Balanced and with Auto alike: lone hero +14, small +11, close +19, veterans +4, outnumbered +16 (the close fights' average +13). The slow parity test checks Auto as well. **Not met: big battles at 100** (`--big`): close ×8 +37 and veterans ×6 +29 at 40 and at 100. A hands-off company wins every fair big fight (the acceptance's first half), but Simulate's odds undervalue a company in big fights (open since P9-B2), and the enemy's plan made its army a little easier (veterans ×6 at 100: −6 before it). Simulate for armies belongs with P9-05's armies and P9-T's tuning.
- **Found at the checkpoint (the whole slow suite):** the extras script set the wedge the old way, so its wedge and ford scenarios fought in loose ranks; now set per division, and both pass. The enemy's plan re-placed a fort's defenders off its walls; it now skips the assault. **Still failing, since 3.3.0 (P9-B3):** the slow siege test (`siege-attack`: fought 58% against odds of 10%). The garrisons grew three times and the test's company of 16 did not. Scaled to the world (48), the odds are Phase 8's again (41%), but fought in waves of 8 the garrison loses every time (100%); as one army sharing the field, the assault wins none and some fights never end, as its wall placement is made for waves. Both tries were taken back. The assault needs re-fitting for armies.
- **Played** at 812×375: the Divisions section on Prepare (four divisions with 40 footmen, their flags in the divisions' colours) and a timed order on the tactical map by real taps (Archers · Fall back · In 5 s, a tap on the field), which went off at 5.5 s. That play found the map's Orders panel covering the MAP button on the phone, now moved; and the browser spec found a troop move losing the captain and formation chosen before it, now kept.

### P9-B5 · The walls at the world's scale (S–M) — ✅ Done in 3.5.0

**Problem.** Found at P9-B4's checkpoint. P9-B3 made every garrison three times bigger (Castra Nova: 66), but the walls' assault (P8-06b) still fed the garrison in waves of 8, and its slow test still used Phase 8's company of 16. The odds of storming fell to 10%, while the fight won 58%: a company could beat a far bigger garrison a few at a time, and hold the courtyard against the 8 on the field. Owner, 2026-11-22: a small task of its own, before P9-L1.

**Build.**
- **The measure at the world's scale:** the siege test's company and the besieging lords three times as big (48; three lords of 51), so Phase 8's ratios hold. Measured at the default battle size (150, everyone on the field).
- **One army a side** (P9-B2's shared field and reserves), no longer waves of 8.
- **The garrison on this stretch of wall:** the rest hold the other walls (Phase 8 already put half of a garrison beside you when defending).
- **The wall's own strength:** a ladder takes two climbers at a time; climbing is slow and breaks ranks, as wading does; a climber cannot strike. The others wait at the foot.
- **Defending:** the garrison counts on your side of the shared field; what doesn't fit waits in reserve and comes in, fighting for itself.
- **A stalled shared battle ends:** after 45 s without a blow, the whole army withdraws, its reserves with it (before, a reserve kept it going for ever).

**Layers.** Nothing new to learn: the walls look and play as before; the numbers are bigger.

**Tests.**
- The assault's armies: one shared army; the garrison's part on this stretch; the besiegers whole.
- The ladders: two at a time, slow, no blows from a ladder, waiting at the foot.
- Defending: the garrison on the field or in reserve, and coming in.
- A stalled shared battle withdraws whole.
- Parity (B-01): fought assaults 5–15 points over the odds on average, never under −5 or over +25, both ways, at 150; every assault ends at 40 too.

**Acceptance.** Storming a fort is about as hard as Simulate says, attacking and defending, at the world's scale.

**Done (3.5.0).**
- **The measure at the world's scale** (`scripts/parity.js`): the company 48 (Phase 8's sixteen, three times), the three lords 51 each, Castra Nova's garrison 66; at a battle size of 150, the default since 3.1.1 (`node scripts/parity.js --siege 40`, `--size 40` for the old one). Scaled, the odds are Phase 8's again: 41% to storm, 57% to hold.
- **One army a side** (`js/assault.js`): the garrison (or the besiegers) as one wave sharing the field, with reserves (P9-B2). The Debug practice assaults too, and a new **Siege assault 100** (50 a side).
- **The garrison on this stretch of wall:** storming, 58% of it (the rest hold the other walls); defending, 90% beside you (Phase 8's half was too few once it fought as one army). Defending, it counts on your side of the shared field; what doesn't fit waits in your reserve and comes in, fighting for itself.
- **The ladders** (`js/arena.js`, `js/assault.js`): a ladder is slow ground (×0.25, so ranks break, as in a ford); it takes two climbers at a time, the rest waiting at its foot; a climber can't strike and always climbs on to the top (without that, a climber near a defender stopped on the ladder and nobody else could climb).
- **A stalled shared battle ends** (`js/combat.js`): 45 s without a blow and the whole army withdraws, its reserves with it. Before, any reserve kept such a battle going for ever (found in defences at 40: the besiegers falling back outside the gate, nobody closing).
- **The measuring bot** fights the walls as a careful captain: in reach only, behind its soldiers when storming, back in the courtyard when defending. As before 3.5.0 it ran first up a ladder (or out over the wall), fell, and broke its company.
- **Parity** (40 seeds at 150): storming 60% fought against odds of 41% (+19), defending 58% against 57% (+1): an average of +10, B-01's aim. The slow test holds both inside −5 to +25 and checks that every assault ends at 40 too. **Not met at 40** (20 seeds): storming far easier (+39) and defending harder (−17), as big battles at 40 are (open since P9-B2): for P9-T. **The balance is steep:** storming against 39 of the garrison wins 60%, against 40 of it 38%; one rout decides it.
- **What was tried first,** and dropped: counting the garrison still to come in the courtyard (the fight never won), waves sized by the world (+26 storming, −32 defending), and one army with the whole garrison (storming never won).
- **Played** at 812×375: Siege assault 100 by real taps from Debug; with the infantry on Charge, never more than two on a ladder, the rest queued at its foot and the defenders at its head; won in 25 s.

### P9-L1 · The living lords' loose ends (M) — ✅ Done in 3.6.0

**Problem.** P8-07 and P8-08 left a few pieces of the lords' politics out. They make the world feel lived in (owner, 2026-11-22).

**Build.**
- **Lords ransom each other's kin:** a lord held by another realm is ransomed by their landed kin (paid from their fiefs), or by a friend at that court; the kin remember who held them and who paid.
- **Lords ask each other for men:** a lord short of men asks a friend or kinsman, answered by P8-07's model.
- **The land-hungry seek sieges** beyond the summons: a landless lord with a claim, or hungry for land, asks their ruler to press it (as you can, P8-08) and joins a siege that could win it.
- **The "escort my caravan" petition** (the sixth of P8-07's petitions), with a caravan of the lord's own.
- **A lost fort back for service:** P8-08's buying back also offered for a term of service to the realm holding it (the mercenary's 30 days, or a campaign).

**Tests.** Each piece in the landed world (`npm run landed`) and as a scripted case; no churn (P8-07's cooldowns).

**Brief (2026-11-23).** Five small pieces on P8-07's model; none needs a new module or a save step.
- **Start from:** `js/lords.js` (`payerOf`: the kin with land, else the ruler; `prisoners`; a lord held off-screen comes home after `AWAY_DAYS`, 5–15 days, today without any payment), `js/nobles.js` (`NEEDS`, `KINDS`, `PETITIONS`, `consider`, `ask`, `weekly`, `petitionFor`, `petitionText`, `answerPetition`, `note` and `DEEDS`), `js/claims.js` (`canBuyBack`, `buyBack`, `askLiege`, `pressedFor`), `js/sieges.js` (`plan` already aims at a fort a free lord of the realm claims, line 162), `js/allegiance.js` (`serve`, `RULES.term` 30), `js/contracts.js` (the escort's caravan that rolls only while you stay close).
- **Decided:**
  - **Kin ransom:** a lord held by another realm is freed when the payer (`payerOf`) pays the lord's `RANSOM` price from the treasury of one of their holdings into a holding of the captor's realm (the captor's, else the ruler's capital). Holding to holding, never from `world` (P9-01 moves it into realm treasuries). Short of money: try again in 7 days; after 30 days unpaid, the realm's ruler pays. New deeds: `ransomed` (+15, payer → freed lord) and `held_kin` (−10, freed lord's kin → captor).
  - **Men:** weekly, a lord whose top need is men asks one friend or kinsman (`ties`) through `consider` (a new kind `men`). Obeyed: up to a quarter of the giver's troops move to the asker. At most once in 30 days a pair.
  - **Land-hungry:** weekly, a landless lord with a claim, or with land as their top need, asks their ruler to press a claim, at most every 30 days (answered as the player's `askLiege` is); pressed, `sieges.plan` already prefers it, and such a lord rides to that siege unsummoned.
  - **Escort petition:** a sixth petition, `escort`, from a lord whose holding has a market: their own caravan to a town of their realm, run by `contracts.js`'s escort rules, reward 1.5 times a board escort's pay, 10 days.
  - **A fort back for service:** on the Claims tab, beside Buy back, "Serve for it": a mercenary term (`RULES.term`, 30 days) with the realm that holds it, offered only while it is at peace with your liege; served to the end, the fort is handed back as by `buyBack`; broken off, the offer is gone for 60 days.
- **Save:** none. New fields are optional inside `c.nobles` and `c.prisoners`; `sanitize` keeps them well formed.
- **Build order:** kin ransom → men → land-hungry → escort petition → serve for a fort.
- **Write tests in:** `tests/lords.test.js` (an AI-held lord ransomed by kin, the money between treasuries, the memory), `tests/nobles.test.js` (men lent and refused; a land-hungry lord's request and the siege it leads to; the escort petition offered, done and failed), `tests/claims.test.js` (serve for a fort: offered, served, broken off). Add their counts to `scripts/landed.js`'s report (kin ransoms, men lent, claims pressed, escorts).
- **Run:** those three files; `npm test`, lint; browser `tests/browser/nobles.spec.js` and `tests/browser/claims.spec.js` (one new case each, by real taps); slow `landed` and `prototype-f`; `node scripts/landed.js 180 3` (no churn: each new count a handful per realm in 180 days, not dozens).
- **Play:** the escort petition from the Lords tab, and Serve for it on the Claims tab.
- **Explain:** "The lands" topic in `data/help.js` (`id: 'lands'`), a sentence each; Debug: the existing "Petition now" gives the escort where there is a market.
- **Not here:** realm treasuries (P9-01), lords' deaths (P9-06).

**Done (3.6.0).**
- **Kin ransom** (`lords.kinRansom`): a lord held by a realm is ransomed from their payer's fiefs into the captor crown's chest (its capital, else a holding it controls); short, a week later; from day 30 the ruler; after 60 days unpaid, let go. The freed lord thanks the payer (`helped`) and, with their kin, remembers the captor (`held`): the Brief's two new deeds were already in the table as other words, so these existing ones serve.
- **Men** (`nobles.askMen`, a new request kind `men`): kin of one realm lend (a quarter, never more than is lacking); a friend alone rarely, a giver short of men never. "It costs him men" weighs −5 (−10 left a father refusing his son).
- **Land-hungry** (`nobles.seekLand`): a claim pressed (if the ruler thinks 0 or better of them) and a siege joined unsummoned, once in 30 days; `sieges.plan` now ranks a pressed claim first, then a lord's claim, then the rest. A lord's `pressed` is now kept in saves (it was kept for yours only).
- **Escort petition:** a lord short of coin (need 0.45 or more) with a fief that has a market asks you to take their caravan to the nearest town of their realm, at 1.5 times a board escort's pay, by the board's escort rules (`contracts.forLord`); a lord's fief is a valid giver for that contract. Paid on arrival, the petition is done; failed or abandoned, it lapses.
- **Serve for it** (Claims tab): **changed from the Brief**, which asked for a mercenary term with the holding realm; that would be a second allegiance while sworn to your liege. Instead: on the same conditions as buying back, no price, win four battles against the holding realm's enemies within 30 days and never attack its people; done, the fort is handed back as if bought; broken off or run out, not again for 60 days.
- **Fixed on the way:** accepting a lord's ransom petition called `lords.free`, which wasn't exported (P8-07): it would have thrown. Exported and tested.
- **Measured** (`node scripts/landed.js 180 3`, new "loose ends" line): 6–16 lords ransomed by their own and 0–3 let go a seed; men asked 8–16, lent 7–11; 1–2 claims pressed; 0–1 sieges joined unsummoned; every invariant held.
- **Checks:** `npm test` (845), lint; browser `nobles` and `claims` (one new case each, by real taps); slow `landed` and `prototype-f`. Played at 812×375: Lady Hawise's escort petition accepted from the Lords tab. Not run: the other slow files and the full browser suite (no shared UI changed).

### P9-01 · Realms as organisations (M–L) — ✅ Done in 3.7.0

**Problem.** A realm is a ruler, some land and a relation to the others. Its money is the world's (the ledger's `world` account): a mercenary's pay, a garrison's refill and a lord's ransom come from nowhere, and a war costs the crown nothing. Design §18.1: a kingdom has a ruler, laws, territory, a treasury, offices, vassals and grievances, and the ruler's wealth is separate from the realm's.

**Build.**
- **A treasury per realm** (an account `realm:<id>` in `js/accounts.js`, with its own book, as the fiefs have):
  - **in:** the crown's tenth from every holding (P8-05's due), the tax of the crown's own land, a toll on its markets, spoils and ransoms its lords bring in, tribute (P9-02);
  - **out:** the pay of mercenaries it hires (P8-04's pay, today from `world`), the garrisons of the crown's own forts, ransoms for its captive lords (P8-01's "ransomed by their own"), the upkeep of armies (P9-05), the offices' wages;
  - never below nothing: a realm that can't pay hires no mercenaries, pays its garrisons late (P8-05's desertion) and can't ransom its lords. This is anti-snowball by cost (§20.7), not by rubber-banding.
- **The ruler's own purse,** separate: the ruler's personal holdings' treasuries (as any lord's) and their household. A ruler may lend to the realm (a debt, P8-07's) or take from it (a grievance).
- **Laws** (data per realm, `data/factions.js`, with defaults; no kingdom named in `js/`):
  - **power:** a crown (the ruler decides) or a league (a council of the great lords decides war, peace and grants by their opinions; the Vessaro League);
  - **the crown's share** (the tenth, or more or less);
  - **succession** (P9-06): eldest child, kin by election, or the council's choice;
  - **fiefs a lord may hold** (P8-02's cap of three, per realm);
  - **war:** can the ruler declare it alone, or does it need the council (the great lords' opinions, P8-07)?
- **Offices** held by lords, appointed by the ruler by opinion and standing (P8-07): **marshal** (leads the realm's armies, P9-05), **steward** (the treasury: a good one raises its income a little), **chancellor** (diplomacy, P9-02). An office brings standing and a wage, and obligations: a marshal who refuses to lead loses it. A lord passed over for an office remembers it (P8-07's `passed_over`).
- **The Realms screen:** each realm's card gains its treasury (a figure and a trend, not the book, unless you are its ruler or steward), its laws in a line, and its offices.
- **The same for the player:** as a vassal you see your realm's laws and offices; you can be given an office (from P9-03 a ruler, you appoint them).

**Layers.** Default: realms run themselves; their wealth shows in what they can do. One decision: accept an office when offered. Expert: read a realm's treasury before taking service or choosing a side.

**Save.** v25: realm treasuries and books, offices and their holders, laws only where they differ from the data.

**Edges.**
- A realm with an empty treasury at war: it fights on with what it has; its lords pay their own (P8-05).
- An office holder captured, defecting or dying (P9-06): the office falls vacant and is filled again within days.
- The free city (Merrow) has a treasury and no offices.

**Out.** Treaties (P9-02); ruling as the player (P9-03).

**Tests.**
- Money is conserved: over 180 days of `npm run landed` every crown's book balances against its weekly lines; nothing comes from or goes to `world` that should be a realm's (Prototype E's rule: no money without a source).
- A broke realm can't hire or ransom; its garrisons desert.
- A league decides war by its lords' opinions; a crown by its ruler.
- Offices filled by opinion and standing; a vacancy filled again.
- Saves: v24 migrates (treasuries from a few weeks of their income), round-trip, junk repaired, fixtures from 3.x.

**Acceptance.** Every realm's spending comes from its own treasury, and over 180 days of the world alone the books balance and no realm goes broke by accident (a realm at long war may, by design).

**Brief (2026-11-23).**
- **Start from:** `js/accounts.js` (accounts `world`, `purse`, `chest`, `budget:*`; `known` decides which exist; `transfer` writes the player's ledger), `js/fiefs.js` (`week`: tax, costs and the crown's due, today paid into `world`, line 185; a holding not yours keeps its money in `holding.treasury`; garrisons refill at half hire cost), `js/allegiance.js` (a mercenary's pay, `CL.accounts.earn` from `world`, line 309), `js/lords.js` (`payerOf`, ransoms; P9-L1's kin ransom), `js/realm.js` (`realms`, `rulerOf`, `FIEF_CAP`, `tickRelations` where wars start), `js/nobles.js` (`opinion`, the `passed_over` deed), `data/factions.js`, `js/ui.js` `renderRealm` (the Holdings tab's cards).
- **Decided:**
  - **A new module `js/crowns.js`** (realm treasuries, laws, offices), loaded after `js/realm.js` in `index.html` and in `LOGIC_MODULES` (`tests/helpers/load.js`).
  - **Money:** a realm's treasury is a number in `c.crowns[id].treasury`, moved by `crowns.pay(c, from, to, n, why)`, where either side is a realm, a holding or `world`. The player's ledger only sees what touches the player. Each realm keeps a weekly book (`book`: the last 12 weeks, in and out by line).
  - **In:** the crown's due (the fiefs' 10%, now into the treasury); the whole tax of holdings the ruler holds; ransoms paid to it. **Out:** mercenaries' pay (allegiance), the garrisons of the ruler's forts, ransoms for its lords after 30 days (P9-L1), office wages (10 a week each). Never below nothing: a realm that can't pay doesn't hire (allegiance's offer says why), can't ransom, and its own garrisons go unpaid (the fiefs' desertion rule).
  - **The ruler's purse:** the treasuries of holdings a ruler holds stay theirs, as now; no loans between purse and realm in this task (P9-T if needed).
  - **Laws** in `data/factions.js`, per realm: `laws: { power: 'crown' | 'league', share: 0.1, succession: 'eldest' | 'kin' | 'council', fiefCap: 3, war: 'ruler' | 'council' }`; the Vessaro League a league with council war; validated in `js/content.js`. `FIEF_CAP` and the due read the laws. A council decides war by its riding lords' average opinion of the other realm's ruler (below −20: war).
  - **Offices:** marshal, steward and chancellor per realm, filled within 3 days of a vacancy by the ruler's best opinion among riding lords with land (standing breaks ties). A steward adds 5% to the crown's due; the marshal leads sieges (`sieges.plan` names them first); the chancellor waits for P9-02. Passed over: the `passed_over` deed. Merrow: a treasury, no offices.
  - **Start money:** four weeks of its income.
- **Save:** v25, `c.crowns` (treasury, book, offices; laws only where they differ from the data). The save step as above.
- **Build order:** module and save → money in and out → the broke realm → laws → offices → the Realms screen.
- **Write tests in:** `tests/crowns.test.js` (new: conservation, a broke realm, a league's war, offices and vacancies, the save step); adjust `tests/allegiance.test.js` and `tests/fiefs.test.js` where pay and the due now go to a realm.
- **Run:** those files; `npm test`, lint; browser `tests/browser/realm.spec.js` (a realm's card shows its treasury, laws and offices); slow `landed`, `campaign-bots`, `world-sim`, `phase7-exit` (the accounts); `node scripts/landed.js 180 3`, reporting each realm's treasury at the start, its lowest and the end, with the books checked weekly (`crowns.invariants`, called where `landed` calls the others).
- **Play:** the Realms screen's cards; take service with a realm and see its pay line.
- **Explain:** "The lands" topic in `data/help.js`, a paragraph; Debug: "Realm treasury ±1000" for the chosen holding's realm.
- **Not here:** treaties and tribute (P9-02), your own realm (P9-03), armies' upkeep (P9-05).

**Done (3.7.0).**
- **`js/crowns.js`** (after `realm.js`): `c.crowns[realm] = { treasury, book, offices, vacant, laws? }`, for every realm and the free city. Money moves only by `crowns.pay(c, from, to, n, line)` between a realm (`realm:<id>`), a holding, your purse or `world`, never below nothing; each realm's book keeps 12 weeks by line, checked daily in `realm.invariants`.
- **In:** the due (the law's share, +5% with a steward) from `fiefs.week`; the ruler's own land (`crowns.crownLand`), whose tax goes to the treasury and whose costs (wages, repairs, recruits, militia) come from it, leaving its holding treasury as the ruler's purse; kin ransoms into the captor's treasury; a free city's trade (a town's tax a week). **Out:** a mercenary's pay (short when broke, with a message), ransoms paid by the ruler after 30 days, office wages (10 a week into the holder's first fief).
- **Broke:** no hiring (the `serve` right needs two weeks of your pay in the treasury and says why); no ransom by the ruler; the crown's garrisons unpaid, then deserting.
- **Laws** in `data/factions.js` (`laws`, checked in `js/content.js` `LAWS`); Vessaro a league with council war and council succession. `realm.fiefCap(f)` / `fiefCapOf(id)` replace the fixed cap everywhere it is used for a lord. A council goes to war (`crowns.mayWar`, in `realm.clashed`) only when its riding lords' average opinion of the other ruler is below −20.
- **Offices:** filled at the start and within 3 days of a vacancy by the ruler's best opinion among riding lords with land (standing, then id, breaks ties); the runner-up notes `passed_over`; a captive, a lord who left or lost all land leaves it vacant. The marshal is named first among a siege's lords. The chancellor waits for P9-02; offices for the player wait for P9-03.
- **Save v25:** `crowns` (`crowns.migrate` adds `{}`; on load, four weeks of income; junk repaired). Realms screen: treasury and trend, laws, offices on each card. Debug: Realm treasury ±1000. Help: a paragraph in "The lands".
- **Measured** (`node scripts/landed.js 180 3`, a new treasuries line): every book balanced every day on every seed; no realm below 73 crowns (Valedorn and Aurelian at war, after ransoms and refills), none broke. Treasuries start at about 800 and end at 1,100–8,900. **Open for P9-T:** the Vessaro League's council keeps it out of war (its lords' opinions of other rulers stay near 0): on seed 1 it fought no war in 180 days, against 12 days at war with Valedorn without the council. Treasuries pile up at peace until P9-02 to P9-05 give them things to spend on.
- **Checks:** `npm test` (853, with the new `crowns` file of 8; the world-sim rule test now sets Vessaro's war law to the ruler, since its council holds it back), lint; browser `realm` (one new case, both sizes); slow `landed`, `campaign-bots`, `world-sim`, `phase7-exit`, all passing. Played at 812×375: the Realms cards; the service offer's line and a week's pay, read in the preview's console rather than by taps.

### P9-02 · Diplomacy and treaties (M) — ✅ Done in 3.8.0

**Problem.** Realms are at peace, in tension or at war (W-07), with a truce after a war (P8-06a). Design §18.3: a small vocabulary of treaties with dates, obligations and breach rules, and no "alliance = +50" shortcut.

**Build.**
- **Treaties** (`c.treaties`): `{ kind, between, since, until, terms, broken? }`, a small vocabulary:
  - **peace** (ends a war; may carry terms: a holding handed over, tribute);
  - **truce** (P8-06a's, now a treaty with its end day);
  - **nonaggression** (no war between them while it lasts);
  - **alliance** (each joins the other's defensive wars; asked to join an attacking war, it may decline by its interests);
  - **military access** (their lords and armies may cross and rest in its land);
  - **trade** (their caravans pay no toll; prices move a little toward each other's);
  - **tribute** (one pays the other weekly, from its treasury, P9-01).
- **Diplomatic standing:** each realm's trust in each other realm (−100…100), raised by kept treaties and lowered by broken ones (by everyone who hears of it, not just the injured realm). A realm that breaks treaties finds fewer partners.
- **The AI's diplomacy,** by interests it could know:
  - at war on two fronts, or losing (forts lost, treasury low): seeks peace, or a truce;
  - weaker than a neighbour that threatens it: seeks an alliance with that neighbour's rival;
  - beaten: may accept peace with tribute or a holding;
  - rich and secure: offers trade.

  Offers are answered by the same factors as P8-07's (relationship between the rulers, the realm's interests, its obligations, fear). In a league (P9-01), the council's opinions decide.
- **The chancellor** (P9-01) makes the realm's offers; a good one makes them better.
- **The news** tells treaties made and broken; the Realms screen gains a **Diplomacy** tab: each pair's state, their treaties with their end days, and trust.
- **The player before ruling:** as a vassal, you are bound by your realm's treaties (attacking an ally's people is attacking your own: P8-04's breach); you may be sent as an envoy (a small errand: carry the offer, a reward and standing if it is accepted).

**Layers.** Default: the world's diplomacy happens around you, in the news. Expert: read the Diplomacy tab to choose whom to serve; as a ruler (P9-03), make the offers yourself.

**Save.** v26: treaties, trust.

**Edges.**
- An ally asked to join a war it can't afford (P9-01): declines, with a reason; the asker's trust in it drops a little.
- A treaty whose realm is gone (P9-05): ends.
- Story pairs (D-W5) keep their locks until the story ends.

**Out.** Secret treaties, hostages, marriage alliances (P9-06 brings marriage).

**Tests.**
- Each treaty's start, end, obligations and breach; a broken treaty's trust everywhere.
- An alliance brings the ally into a defensive war, and lets it decline an offensive one.
- Tribute moves money between treasuries, exactly.
- `npm run landed`: treaties form and end over 180 days; wars still come and go; no realm locked in permanent peace or permanent war.

**Acceptance.** The AI realms make and keep or break treaties for reasons the news can tell, and their wars and peace follow from them.

**Brief (2026-11-23).**
- **Start from:** `js/realm.js` (`RELATIONS`, `STATES`, `relation`, `setRelation`, `tickRelations`: where wars and peace come today; `storyHeld` for the story's locks), `js/sieges.js` (`end`: the truce after a siege war), `js/crowns.js` (P9-01: treasuries for tribute; the chancellor; a league's council), `js/nobles.js` (`consider`'s factors, for offers between rulers), `js/news.js` (`record` and its kinds), `js/contracts.js` (errands, for the envoy), `js/ui.js` `renderRealm` (a new tab).
- **Decided:**
  - **A new module `js/diplomacy.js`:** `c.treaties` (`{ id, kind, between: [a, b], since, until, terms, broken }`) and `c.trust` (`trust[a][b]`, −100 to 100, sparse; the bounds as named constants).
  - **Lengths:** truce 30 days, nonaggression 90, alliance 180, access 90, trade 120, tribute as long as the peace that made it (else 90). Peace has no end day.
  - **Trust:** a kept treaty +5 a month to both; a broken one −40 with the injured realm and −15 with every other. Under −30, a realm won't sign with that one.
  - **The AI,** weekly, one offer a realm at most: at war on two fronts, or having lost a fort in 30 days, or with a treasury under two weeks' costs → asks for a truce or peace; a neighbour with twice its riding lords' strength (`autoresolve` power) → asks that neighbour's rival for an alliance; beaten (two forts lost this war) → accepts peace with tribute of a tenth of its weekly income; rich (a treasury over 12 weeks' costs) and at peace → offers trade. Answers by `consider`'s factors between the rulers; in a league, the council's average.
  - **Today's tension and war states stay;** treaties sit on top. War between treaty partners is a breach.
  - **The envoy:** a board errand ("carry the Crown's offer to …"), offered to a vassal of the realm; reward 60 and +5 standing, and the offer gains 10 in its answer.
- **Save:** v26, `c.treaties` and `c.trust`. The migration turns today's siege truce into a truce treaty.
- **Build order:** module and save → treaties' start, end and breach → trust → the AI's offers → news → the Diplomacy tab → the envoy.
- **Write tests in:** `tests/diplomacy.test.js` (new: each kind's life, a breach heard everywhere, an ally joining a defensive war and declining an offensive one, tribute exact between treasuries, the save step).
- **Run:** that file and `tests/realm.test.js`; `npm test`, lint; browser `tests/browser/realm.spec.js` (the Diplomacy tab); slow `landed`, `world-sim`; `node scripts/landed.js 180 3`, reporting treaties made, kept and broken, and days at war per pair (no pair at war more than 150 of 180 days; no realm at peace with all for all of them).
- **Play:** the Diplomacy tab; the envoy errand from a town's board.
- **Explain:** a Diplomacy paragraph in "The lands", and a first-time tip for the tab; Debug: "Offer a treaty now" (the chosen holding's realm makes its next offer).
- **Not here:** your own offers as a ruler (P9-03), marriage alliances (P9-06).

**Done (3.8.0).**
- **`js/diplomacy.js`** (after `crowns.js`): `c.treaties` (`{ id, kind, between, since, until, terms, kept, broken }`), `c.trust[a][b]` (−100…100 as `TRUST.min`/`max`), and `c.offers` (the day an offer was last made, so it waits 30 days). Lengths as the Brief; one treaty of a kind per pair.
- **War and treaties:** `realm.clashed` asks `diplomacy.goesToWar`: a nonaggression pact or alliance holds the brink unless a side's deciders (the ruler; a league's council) think worse than −20 of the other ruler; without one, the side that thinks less of the other goes first. `setRelation(…, by)` then breaks every treaty between them by the attacker (−40 the injured, −15 every other court). A war worn out into tension leaves a truce treaty with the relation's `truceUntil` as its end. A kept treaty: +5 to both a month.
- **Allies:** the attacked realm's allies join unless short of money (under two weeks' costs, −5 trust); the attacker's allies are asked like an offer (a quarrel of their own with the target +20, none −20). Joins don't call further allies.
- **The AI** (weekly, on the payday, one offer a realm): the Brief's four reasons. Answers: the deciders' average opinion of the other ruler, half the trust, the chancellor (+5), and interests (weariness up to +20, losing +20, winning −15, tribute +15; a common foe ±; peace for trade). Forts lost are read from their old holders' claims.
- **Envoy:** while you are sworn to the offering realm and have no contract, the offer waits 3 days on its capital's board as an `envoy` errand (a new board-less contract template, a sealed letter to the other capital): carried, it is answered +10, for 60 crowns and +5 standing; failed or left, it is answered as it is.
- **Save v26** (`treaties`, `nextTreatyId`, `trust`, `offers`; truces migrate). Diplomacy tab on the Realms screen with a first-time tip; news kinds `treaty_signed`, `treaty_broken`, `ally_joins`; Debug "Offer a treaty now"; a paragraph in "The lands".
- **Measured** (`node scripts/landed.js 180 3`, a new treaties line): 10–12 treaties made a seed (mostly trade; a truce or four; one to three alliances; on seed 1 a peace with tribute), 4–6 kept to their end, 0–1 broken; days at war per pair at most 27 of 180; no realm at peace with all for more than 44 days; every invariant held. **Open for P9-T:** pacts rarely break (rulers seldom think ill of each other); fewer wars on seed 3 (one).
- **Not built:** trade and access have no effect beyond trust (no tolls or borders for them to lift); the player's own offers wait for P9-03. **Checks:** `npm test` (861, with the new `diplomacy` file of 8; the Gate D template count leaves out the board-less envoy), lint; browser `realm` (one new case), and `settlement` and `allegiance` (the board's text): the allegiance spec still expected 3.6.0's "from their purse", broken since 3.7.0 and fixed here; slow `landed`, `world-sim`. Played at 812×375: the envoy taken from Stonebridge's board by taps (the ride to Hrothgard skipped in the console), and the Diplomacy tab with its tip; playing it found and fixed the board showing `{treaty}` raw.

### P9-03 · Founding or taking a kingdom (L) — Specified

**Problem.** The player can be independent, a mercenary or a vassal (P8-04), never a ruler; land is held only of a realm (P8-08 left holding land as an independent to here). Design §18.2: a ruler's powers are a lord's, with a wider reach; there is no separate "kingdom game".

**Build.**
- **Realms that aren't in the data** (D-P9f): a realm can be founded in play (`c.realms`), with a name the founder chooses, a banner colour from a palette, the culture (and troops) of its capital's land, and P9-01's laws (a crown by default). Every module that asks "is this a realm?" asks `realm.realms(c)`, the data's and the new ones (a grep test, as P8-03's rights).
- **Ways to rule:**
  - **declare a realm** from land you hold (a fort or town, with renown and a company: thresholds tuned in P9-T): your holdings leave their realm (as a defection: a claim and a grievance for the old crown, and likely a war);
  - **hold land as an independent** first (P8-08's claim made good with no liege): a fief of your own, recognised by nobody, which a realm will try to take;
  - **take a realm's crown** by a claim and a rebellion (P9-04), or by being chosen in a league (P9-01's council).
- **Recognition:** other realms recognise you or not (P9-02's trust and a treaty); unrecognised, you are fair game. Recognition is separate from the claim (design §18).
- **Vassals:** lords may swear to you by P8-07's rules (a lord who thinks ill of their own ruler and well of you; kin; those you freed). You grant them land (P8-05's grants, the ruler's choice now yours), summon them (P8-07's summons from your side: they answer by the model), and keep their opinions.
- **Ruling, delegated (SC-41):** the steward runs the treasury, the marshal the wars (P9-05), the chancellor the treaties (P9-02), each by a policy you set in a line ("defend", "expand toward…", "seek peace"), with alerts only for what needs you (a rebellion's warning, a treaty offer, a siege of your capital). You keep riding with your company; ruling never needs a screen.
- **The ruler's screen** (the Realms screen's **Your realm** tab): treasury, laws, offices, vassals with their opinions, treaties and offers, and the policies. Everything is also done by default.
- **The same for AI lords** (P8's "no fixed classes"): a lord with land, renown and discontent (P8-07) can declare a realm too, and the same rules follow.

**Layers.** Default: you can found a realm and let your officers run it. One decision at a time: an offer, a grant, an alert. Expert: set laws, choose officers, negotiate each treaty, give each vassal their orders.

**Save.** v27: realms founded in play, the player's realm and its policies, independent holdings.

**Edges.**
- Founding while at war with your old realm: the war is with your new one.
- Your capital taken (P9-05): you move your seat to another holding; with none left, your realm is gone and you are independent again, with claims.
- The story's realms and locks: the story's ending must have happened before you can found a realm in the March (D-W5).

**Out.** Rebellion and deposition (P9-04); armies (P9-05); houses (P9-06).

**Tests.**
- A founded realm everywhere a data realm is (the grep test, rights, the map's colours, news).
- Declaring from a fort: the old realm's claim and war; recognition by a friend.
- A lord swears to you; you grant them a village; you summon them and they answer.
- SC-41: ten days of fighting while ruling: routine governance delegated, alerts reach you, no forced screen (the bots count screens, as P8-T's).
- SC-25 (with P9-02): you make an alliance, then break it: it ends, and trust drops everywhere.
- An AI lord founds a realm in `npm run landed` when the conditions come, and the invariants hold.

**Acceptance.** A player can found or take a kingdom, appoint its officers, grant land, make a treaty and keep riding as a captain, with every routine decision delegated.

**Brief (2026-11-23).** The largest of the kingdom tasks. Its first step is plumbing across many files; do it first and alone, with its grep test, before anything visible.
- **Start from:** `js/realm.js` (`kingdoms()` and `realms()` read `data/factions.js`; `isRealm`, `capitalOf`, `rulerOf`, `transfer`, `addClaim`, `relation`); every `CL.content.table('factions')` and `content.get('factions', …)` outside `js/content.js` (grep them: they become realm lookups); `js/render.js` (map colours and banners from a faction's `color` and `emblem`); the `factionName` helpers in several modules; `js/rights.js` (`ACTIONS`, `may`); `js/claims.js` (land taken back with no liege); `js/nobles.js` (`changeRealm`, `summon`, `consider`); `js/fiefs.js` (`decideGrants`, `give`, `offer`); `js/crowns.js` (offices, laws); `js/diplomacy.js` (recognition); `scripts/prototype-g.js` (the bots' screen counts).
- **Decided:**
  - **Realms in play:** `c.realms[id] = { id, name, short, emblem, color, culture, laws, founded, by }`, merged into `realm.kingdoms()`; ids `r1`, `r2`…; the banner colour from a fixed palette in `data/factions.js` (`palette`); the culture of the capital's settlement. A grep test fails on any `table('factions')` outside `js/content.js` and `js/realm.js`.
  - **Declaring** (a new right, `declare`): you hold a fort or town, with 600 renown and 40 soldiers. The old realm gets a claim on each holding and a grievance; at peace, war follows in 7 days unless it accepts (by its ruler's opinion of you, as `consider`). AI lords by the same rule; at most one new realm in the world in 180 days (P9-T tunes).
  - **Independent land:** a claim taken back with no liege becomes your holding with no realm (`controller: 'player'`), shown as unrecognised; any realm may besiege it as if at war.
  - **Recognition:** each realm answers by its trust (P9-02) and its ruler's opinion of the founder; an unrecognised realm counts as at war for sieges, not for battles on the road.
  - **Vassals:** in `nobles.weekly`, a lord who thinks −30 or worse of their ruler and +20 or better of you asks to swear to you; you accept or not (a message). Your grants and summons use the existing flows, with you as the ruler.
  - **Delegation (SC-41):** three policies, a line each, on the Your realm tab: steward (`hold` | `grow` | `hoard`), marshal (`defend` | `expand <realm>` | `peace`), chancellor (`peace` | `allies` | `none`); defaults grow, defend, peace. Alerts only for a treaty offer, a vassal's grievance turning to a faction (P9-04), and your capital besieged.
- **Save:** v27, `c.realms` and the player's policies (`c.rule`); independent holdings need no new field (`controller: 'player'`).
- **Build order:** 1) realms in play and the grep test (nothing visible changes; `npm test` green before going on) → 2) independent land → 3) declaring and recognition → 4) vassals, grants and summons → 5) policies, alerts and the Your realm tab → 6) AI lords declaring.
- **Write tests in:** `tests/founding.test.js` (new: a founded realm everywhere a data realm is, declaring, recognition, a vassal, a grant, a summons, delegation's alerts, the save step) and `tests/rights.test.js` (the grep test; `declare`).
- **Run:** those files and `tests/realm.test.js`; `npm test`, lint; browser `tests/browser/realm.spec.js` (the Your realm tab by real taps: declare, set a policy) and `tests/browser/world-map.spec.js` (the new banner draws); slow `landed`, `campaign-bots`, `test-world`, `phase8-exit`; `node scripts/landed.js 180 3` (an AI realm founded on some seeds, the invariants). SC-41: a scripted ten days of riding while ruling, counting screens the game opens (none forced).
- **Play:** declare a realm from a held fort, set the marshal's policy, accept a vassal.
- **Explain:** a "Your realm" topic in `data/help.js`, and a first-time tip for the tab; Debug: "Declare my realm here" (without the thresholds).
- **Not here:** rebellion and deposition (P9-04), armies and the capital's fall (P9-05), houses (P9-06).

### P9-04 · Rebellion and deposition (L) — Specified

**Problem.** P8-07's lords grumble and change realm one at a time; nobody contests a crown. Design §18.5–18.6: rebellion grows from grievances, with warnings and responses, and deposition is not a game over.

**Build.**
- **Grievances** (P8-07's opinions of the ruler, and their deeds: passed over, revoked, taxed, a feud the ruler ignores, a war they didn't want) gather into **factions:** lords who think ill of the ruler and well of one another (friends, kin), around a **claimant** (a lord with a claim to the crown by kin or law, or the strongest among them).
- **Warnings,** uncertain and escalating: rumours (the news), a companion's word, a lord's petition; the ruler hears what anyone at court could.
- **The ruler's responses** (AI and player alike): concessions (land, a lower share, an office), a mediator, dividing the faction (favour to one member), arresting the claimant (risky: it can start the war), or preparing for war.
- **Demands** with a deadline: met, the faction breaks up; refused, they **rise**: their holdings and garrisons go with their holders (a realm of their own for the war, P9-03's founded realm); the lords who stay loyal fight them; the others choose by opinion.
- **Outcomes:** the rebels win (the claimant takes the office; the deposed ruler rides on as a lord with their personal holdings, or is held); the crown wins (rebel lords captured, fiefs revoked and granted to the loyal); a compromise (concessions, the claimant pardoned).
- **The deposed** (SC-26, SC-27, §18.6), the player included: alive, free or captive; their company and companions (those personally loyal stay); their businesses; their claim to the crown kept; a foreign ruler may offer exile, service or support for a return.
- **The player's part:** on either side (summoned by both), as a mediator, or as the claimant.
- **No cascades:** one rebellion a realm at a time, a long peace after one (90 days proposed), and a ruler who wins by concessions is trusted more for a while.

**Layers.** Default: rebellions happen to the realms you know, and you choose a side when summoned. Expert: court the faction, stir it, or stand as claimant.

**Save.** v28: factions, demands, rebellions.

**Edges.**
- A rebellion during a foreign war: the foreign enemy may back the rebels (P9-02).
- The claimant captured or dead (P9-06): the faction's next strongest, or it breaks.
- The player deposed while away: told, and the same save goes on.

**Tests.**
- A faction forms from grievances only (no random roll); its warnings come first.
- Each response's effect; demands met and refused.
- The three outcomes, with holdings, garrisons and claims right (§25.3 invariants throughout).
- SC-26: your vassals rebel and depose you; you keep your person, company and claim; the save goes on.
- SC-27: deposed, you seek refuge with an old enemy, who answers by diplomacy and opinion.
- `npm run landed` over a year: some rebellions, no realm in constant civil war.

**Acceptance.** Design §18.9's second half: a disloyal noble can decline an order, form a faction and rebel; a deposed player plays on in the same save as a free claimant or a captive.

**Brief (2026-11-23).**
- **Start from:** `js/nobles.js` (`opinion`, `ties`, `deeds`, `RULES.leaveBelow`, `changeRealm`, `summon`, `summonPlayer`, `weekly`), `js/realm.js` (`transfer`, `addClaim`, `setRelation`), P9-03's founded realms (a rising is a realm for its war), `js/crowns.js` (offices and a lower share as concessions), `js/allegiance.js` (the player's side), `js/news.js`, `js/companion.js` and `js/retinue.js` (a companion's word as a warning).
- **Decided:**
  - **A new module `js/rebellion.js`;** `c.rebellions` (factions and risings, one a realm at a time).
  - **A faction forms** when three or more riding lords of a realm think −30 or worse of the ruler and +10 or better of one another. Its claimant: the one with a claim to the crown (kin of the ruler), else the strongest by riding troops. No random roll.
  - **Warnings,** a week apart: a rumour in the news (for anyone), a companion's word (if one rides with you), a petition from a faction lord who thinks well of you. AI rulers learn the same way.
  - **Responses** (an AI ruler by its motives; the player from a message): concession (a fief from the crown's own, the share 2 points lower, or an office: the faction's average opinion +15); mediator (a lord liked by both: +10 and a 30-day pause); divide (a fief to one member: they leave the faction); arrest (the claimant held: half the time the faction rises at once); prepare (summons the loyal: the rising starts weaker).
  - **Demands,** 14 days: met, the faction breaks up; refused, it rises as a founded realm at war with the crown, and every other lord chooses a side by opinion.
  - **Outcomes,** when that war ends (P9-02's peace, all rebel forts taken, or all the crown's): the rebels win (the claimant rules; the old ruler keeps their own holdings as a lord, or is held); the crown wins (the rebels' fiefs revoked and granted); a compromise (concessions; the claimant pardoned).
  - **After:** 90 days of peace in that realm before another faction; a ruler who conceded gains +10 with all its lords.
  - **The player deposed:** your realm (P9-03) ends; you keep your person, company, the companions loyal to you (all, by default), your businesses, and a claim to the crown; an old enemy may offer refuge (by P9-02's trust and opinion).
- **Save:** v28, `c.rebellions`.
- **Build order:** a faction from grievances → warnings → responses → demands and the rising → outcomes → the player's part (summoned by both sides; mediator; claimant; deposed).
- **Write tests in:** `tests/rebellion.test.js` (new: forms only from grievances, each response, each outcome with holdings, garrisons and claims right, SC-26, SC-27, the save step).
- **Run:** that file and `tests/nobles.test.js`; `npm test`, lint; browser `tests/browser/nobles.spec.js` (summoned by both sides, choosing one); `node scripts/landed.js 360 3` (some factions, a rising or two; no realm in civil war more than 120 of 360 days). **Checkpoint:** the whole slow suite and the full browser suite after this task.
- **Play:** receive the warnings, then the summons from both sides, and choose.
- **Explain:** a Rebellion paragraph in "The lands"; Debug: "Faction now" (the chosen realm's unhappiest lords form one) and "Rise now".
- **Not here:** a claimant's death (P9-06), foreign backing beyond P9-02's alliance rule.

### P9-05 · Armies and campaigns (L) — Specified

**Problem.** Sieges gather two to four lords (P8-06a); there are no armies, no marches, no supply, and capitals never fall. Design §20.1–20.3: an army is several parties under a commander, with assembly, supply and objectives.

**Build.**
- **An army:** several parties (lords' households, the company, mercenaries) under one commander (the marshal, the ruler, or you), moving as one on the map at the slowest's pace, with shared food and the commander's authority. Each party's soldiers, wages and losses stay its own (§20.2).
- **Raising it:** the commander calls (P8-07's summons: each lord answers by the model, and comes in their own time), sets a rally point and a day, and marches when enough have come; mercenaries for the realm's coin (P9-01).
- **Objectives:** besiege (P8-06a's siege, now by an army), relieve, raid (an enemy village: its prosperity falls, the raiders take spoils, its lord's opinion of them sinks), pursue, defend the border, regroup. The marshal chooses by the realm's policy (P9-03).
- **Supply:** an army eats; far from friendly land it forages (the villages it passes lose prosperity) or starves (desertion, P7's rules); long campaigns wear it out (§20.7).
- **Battles of armies:** two armies meeting fight a P9-B2 battle (proportional, both sides reinforcing), or auto-resolve (the square law) off-screen; a beaten army retreats, breaks apart, or surrenders (§20.6: its lords captured and ransomed).
- **Towns change hands** (moved here from Phase 8): a capital can be besieged by an army (a long siege: walls, food, a large garrison), and taken: the ruler moves their seat; a realm with no holdings left is gone (its lords seek service elsewhere, P8-07). Anti-snowball: a realm's last holding is the hardest siege; armies cost the treasury every day.
- **You in an army:** summoned, you ride with it and fight its battles (as the marshal's vassal); as its commander you give the army's orders (an objective, a target, retreat) and fight beside it. A lord in your army obeys or not by the model.
- **The map:** an army is one banner with its size; its parties ride together. The phone's map budget kept (a Debug army test: four armies of five parties on the map at once).

**Layers.** Default: you are summoned and ride along. Expert: raise and command an army, plan a campaign, mind its supply.

**Save.** v29: armies (members, commander, objective, rally), raids' effects.

**Edges.**
- A lord who defects in an army leaves when it next halts (P8-07's rule).
- The commander captured: the next ranking lord takes over, or the army breaks up.
- An army without food: desertion from the furthest parties first.

**Tests.**
- Raising an army: who comes, when, and why not.
- Supply and foraging; a starving army.
- A battle between armies (proportional, reinforcing) and its result on every party.
- A capital taken; a realm gone; its lords placed.
- `npm run landed` with armies: wars with campaigns, capitals change hands rarely, no realm wiped out in 180 days on most seeds (tuned in P9-T); the invariants.

**Acceptance.** Realms wage wars with armies that gather, march, eat, fight and break up, and the player can ride in one or command one.

**Brief (2026-11-23).** Large: build it in two halves and check the first before starting the second (one commit at the end).
- **Start from:** `js/sieges.js` (`plan` picks a fort and gathers free lords; `begin`, `step`, `end`, `take`, `callRelief`, `relieve`), `js/nobles.js` (`summon(c, f, sid, pids, max)`, `consider`), `js/parties.js` (lords' intents and movement on the map; off-screen fights between parties; `battleDef(…, { share })`), `js/autoresolve.js` (`winChance`, the square law), `js/fiefs.js` (a village's prosperity, for raids and foraging), `js/realm.js` (`isCapital`, `capitalOf`, `locked`), `js/crowns.js` (the marshal; the treasury for upkeep), `js/render.js` and `scripts/bench-map.js` (the map's cost).
- **Decided:**
  - **A new module `js/armies.js`;** `c.armies` (`{ id, realm, commander, members: [partyId], objective, target, rally, since, food }`). A member party keeps its own troops, wages and losses, and gets `armyId`.
  - **Raising:** the marshal (else the ruler) calls up to 6 lords by `summon`; the rally is the capital, or the fort nearest the target; the army marches when half have come, or after 7 days.
  - **Moving:** members follow the commander's party at the slowest one's speed, drawn as one banner with the total.
  - **Objectives,** chosen by the marshal's policy and P9-02's state: besiege (P8-06a's siege, gathered by the army), relieve, raid (a village: prosperity −20, a week of its tax as spoils to the raiders, its lord's opinion of them −20), pursue (an enemy army within 30 map units), defend (the nearest threatened fort), regroup.
  - **Supply:** food in days (5 at the start, +1 a day in friendly land); in enemy land it forages (the nearest village −2 prosperity a day) or uses a day; at 0, the furthest member party loses a tenth of its troops a day.
  - **Upkeep:** 1 crown a soldier a week from the realm's treasury; broke, the army disbands after 7 days.
  - **Battles of armies:** off-screen by the square law on both armies' power, losses spread over the members; the loser retreats to its nearest friendly holding, or breaks up if it lost half (its lords captured at the usual chance). With you in it: the shared battle (`battleDef` with `share`).
  - **Capitals:** besieged by an army only (food and garrison ×1.5); taken, the ruler's seat moves to their next holding. A realm with no holdings is gone (a founded realm removed; a data realm marked `gone` in `c.crowns`); its lords seek service (`nobles.destination`). A realm's last holding: the siege needs twice the odds.
  - **You:** summoned, you ride with the army (follow its banner, fight its battles); as its commander (marshal or ruler), the army's card gives its orders: objective, target, retreat.
- **Save:** v29, `c.armies`; a raid's effects live on the holdings.
- **Build order:** first half: module and save → raising → moving → supply and upkeep → sieges by armies → the AI's objectives; check it (its tests, `npm test`, `node scripts/landed.js 180 3`). Second half: battles of armies → capitals and realms gone → you in an army → the map's banner and the Debug army test.
- **Write tests in:** `tests/armies.test.js` (new: who comes and why not, supply and foraging, starvation, upkeep, a battle between armies and its result on every party, a capital taken and a realm gone, the save step).
- **Run:** that file, `tests/sieges.test.js` and `tests/parties.test.js`; `npm test`, lint; browser `tests/browser/sieges.spec.js` (riding with an army when summoned) and `tests/browser/world-map.spec.js` (the banner); slow `landed`, `world-sim`, `campaign-bots` (and `battle-parity` only if `js/combat.js` or `js/autoresolve.js` change); `node scripts/landed.js 180 5` (wars with campaigns; capitals change hands rarely; no realm gone on most seeds) and `node scripts/bench-map.js` with four armies of five parties (within the phone's budget).
- **Play:** be summoned and ride with an army to a siege; the Debug army test.
- **Explain:** an Armies topic in `data/help.js`; Debug: "Four armies" (the phone test) and "Raise an army here".
- **Not here:** hiring mercenary companies into armies (P9-T if wanted).

### P9-06 · Houses, marriage and claims (M–L) — Specified

**Problem.** People have kin ties (P8-02) but no houses; nobody marries, dies or inherits. Design §19: houses as entities, marriage with real agency, and succession, the founding-house model first (§19.3).

**Build.**
- **Houses** (`c.houses`): a name, colours, members (from P8-02's kin), a head, the holdings and claims of its members, its alliances and rivalries. Opinions of a house are separate from opinions of a person (§19.1). A house can lose all its land and keep its members and name (§19.6). The player founds a house (on first holding land, or from an origin in Phase 10).
- **Marriage:** between people of two houses (the player included), proposed, negotiated and accepted or refused by the P8-07 model (relationship, the houses' interests, obligations). Terms: a dowry, a claim through the spouse, an alliance between the houses (mutual aid, P9-02's terms between houses). The spouse is a named person with goals, who can ride as a companion or run a holding as its administrator (P8-05). Never a bonus to trade: a spouse can refuse, and a marriage can end, with consequences.
- **Deaths** (D-P9g): lords can die: rarely, of wounds after a lost battle; by old age only with a setting on (off by default). The player never dies unless a later setting says so.
- **Succession** by the realm's law (P9-01): an office or fief passes to an heir among the kin (eldest child, kin by election, or the council's choice); a contested one becomes claims (P8-02) and perhaps a rebellion (P9-04). A ruler's death is the realm's crisis.
- **Claims through houses:** a house's claims outlive the member who held them; a claimant can petition a liege for restoration (§19.6).
- **No generations** by default: no births or ageing to adulthood (§19.3's founding-house model). Children may be named in data as adult heirs.

**Layers.** Default: houses and marriages happen in the world; you are asked when it concerns you. Expert: arrange marriages for alliance, plan an heir, press a house's claim.

**Save.** v30: houses, marriages, deaths (a person's `status: 'dead'`, kept for the record), heirs.

**Edges.**
- A lord dies with fiefs and no kin: the crown takes them and grants them (P8-05).
- A married couple's realms go to war: both remember it (P8-07's "kin on opposite sides").
- The player's spouse captured: a ransom offer reaches you (P8-01's flow, the other way).

**Out.** Births and ageing (backlog: generational play); the player as heir after death.

**Tests.**
- §19.6: two houses form a marriage alliance with tracked obligations; their members' opinions stay separate; a family loses all its holdings and keeps its members and name; a claimant petitions for restoration.
- A death's succession by each law; a contested one makes claims.
- A marriage proposal refused for reasons that read.
- `npm run landed` over a year: some marriages, a few deaths, successions without broken holdings (the invariants).

**Acceptance.** Design §19.6, and a lord's death passes their fiefs and office by the realm's law.

**Brief (2026-11-23).**
- **Start from:** `js/realm.js` (people and their `kin`, `TIES` with `spouse`, `person`, `addClaim`, `transfer`), `js/nobles.js` (`consider` for proposals; `opinion` per person), `js/lords.js` (`beaten`: where a death after a lost battle goes), `js/crowns.js` (the laws' `succession`; vacant offices), `js/rebellion.js` (a contested succession), `js/retinue.js` (a spouse riding as a companion), `js/fiefs.js` (`appoint`: a spouse running a holding).
- **Decided:**
  - **A new module `js/houses.js`;** `c.houses[id] = { id, name, colors, head, members, alliances, rivals }`, built in the migration from P8-02's kin (the eldest's name gives the house's). Opinion of a house: its members' average, plus a house-level `rel` moved by deeds against the house.
  - **Your house:** founded when you first hold land, named by you (your name by default), or later from an origin (Phase 10).
  - **Marriage:** proposed between unmarried adults of two houses; answered by `consider` (relationship, the houses' interests: land, an alliance against a common rival; obligations; a dowry offered). Terms: a dowry (crowns), a claim through the spouse (their claims become shared), a house alliance (each answers the other's call to war by `consider` with +20). Your spouse is a named person who may ride in the retinue or run a holding, may refuse an order (by `consider`), and may end the marriage after 90 days, with a feud deed (so may you).
  - **Deaths (D-P9g):** a lord beaten in battle dies of wounds 3% of the time; old age only with a setting (off by default); the player never dies. The dead keep their record with `status: 'dead'`.
  - **Succession** by the realm's law: eldest child (kin `child`, the eldest by id); kin by election (the kin the realm's lords think best of); council (the lord the council thinks best of). The heir gets the fiefs and the office. Contested (two kin within 10 opinion): claims, and a faction (P9-04) if three lords back the loser. No heir: the crown takes and grants (P8-05).
  - **No births or ageing.**
- **Save:** v30, `c.houses`; marriages on people (`spouse`); `status: 'dead'`; heirs computed, not stored.
- **Build order:** houses from kin → your house → deaths → succession by each law → marriages between AI houses → marriage for you → claims through houses and petitions for restoration (§19.6).
- **Write tests in:** `tests/houses.test.js` (new: §19.6's four checks, a death and each law's succession, a contested one, a refused proposal's reasons, the save step).
- **Run:** that file, `tests/nobles.test.js` and `tests/realm.test.js`; `npm test`, lint; browser `tests/browser/nobles.spec.js` (propose a marriage from the Lords tab; the answer and its reasons); `node scripts/landed.js 360 3` (some marriages, a few deaths, successions with the invariants). **Checkpoint:** the whole slow suite and the full browser suite after this task.
- **Play:** propose a marriage; see a lord's death and their heir in the news.
- **Explain:** a Houses topic in `data/help.js`; Debug: "Lord dies" (the nearest) and "Marry me" (the nearest lord's kin accepts).
- **Not here:** births, ageing, playing on as your heir.

### P9-07 · Modding: a declarative content format (M–L) — Specified

**Problem.** The world is a package of `data/*.js` files (W-04), loaded with the code. Design §23: a declarative, validated format; stable namespaced ids; safe import; saves tied to their packs.

**Build.**
- **The format:** the world package (W-04) written down as a documented JSON format (`docs/WORLD-FORMAT.md`): a manifest (id, title, author, version, engine compatibility, required packs) and the content tables (factions and their laws, settlements, map, troops, items, characters and houses, businesses, quests and dialogue, battle maps, rules).
- **Namespaced ids** (moved here from W-04): `world:id` (`border_march:stonebridge`), with today's short ids read as the official world's. Every id validator, save key and regex is audited for `:`.
- **Packs:** data-only packs that add to or change a world, loaded from JSON, validated with precise errors (which file, which entry, what is wrong), stored in IndexedDB (§23.6), listed in Settings where they can be turned on and off.
- **Safe import:** a pack imported from a file is checked (size, paths, references, no code) before it is stored; nothing executable is ever run (§23.4).
- **Saves and packs** (SC-33): a save records its world, content version and packs; loading it with a pack missing gives a precise error and changes nothing; no named soldier is silently dropped.

**Tests.**
- A sample pack adds a troop line and a settlement without code; the game plays with it; removing it gives a precise error, and the save is untouched.
- Every validator rejects a bad pack with a precise message (a table of bad packs).
- The official world loads from the format exactly as from `data/*.js`.

**Acceptance.** A sample pack adds a troop line and a settlement without code; removing it gives a precise error.

**Brief (2026-11-23).**
- **Start from:** `js/content.js` (the tables, `get`, `table`, load-time validation), `data/world_map.js` (the world package, W-04), `tests/world-package.test.js` and `tests/helpers/test-world.js` (a second package already exists for tests: the three-kingdom world), `js/save.js` (`worldId`, `knownWorld`), `js/storage.js` (saves; packs go to IndexedDB beside them), `js/settings.js` and the Settings panel in `index.html`, `js/portable.js` (the import's checks, as a pattern).
- **Decided:**
  - **The format:** `docs/WORLD-FORMAT.md` describes the tables of `data/*.js` as JSON: a manifest (`id`, `title`, `author`, `version`, `engine` (a semver range), `requires`) and the tables by name. A script (`node scripts/export-world.js`) writes the official world out as a JSON pack, and a test loads it and compares it with `data/*.js`, table by table.
  - **Ids:** `world:id`; a short id is the official world's (`border_march`). Audit every regex on ids (`/^[a-z_]+$/` and the like), the save keys and the grep tests for `:`.
  - **Packs:** data only. A pack adds entries or changes fields of existing ones (`"merge"`), never deletes. Loaded from JSON in the browser, kept in IndexedDB (a store `packs`), listed in Settings with on and off; a change takes effect on a new game or a reload.
  - **Safe import:** 2 MB at most; JSON only; strings only where strings belong; references checked; nothing evaluated.
  - **Saves:** an optional `packs: [{ id, version }]`; a save whose pack is missing fails to load with "This save needs the pack … (version …)" and changes nothing. No schema step (an optional field).
  - **The sample pack** (`packs/sample/`): a troop line of three and a settlement, used by the tests.
- **Build order:** the format document → ids → the loader and validator (in Node first) → the official world's round trip → packs in the browser (IndexedDB, Settings) → saves and packs.
- **Write tests in:** `tests/packs.test.js` (new: the sample pack plays; a table of bad packs, each with its message; the official world from JSON equals `data/*.js`; a save with a missing pack).
- **Run:** that file, `tests/content.test.js`, `tests/world-package.test.js` and `tests/save.test.js`; `npm test`, lint; browser, a new `tests/browser/packs.spec.js` (import the sample pack in Settings, start a game, see the settlement on the map); slow `test-world` (and `gate-d-campaigns`, about 27 minutes, only if story or quest ids had to change).
- **Play:** import the sample pack, turn it on, start a new game and find its settlement.
- **Explain:** a short note in Settings; no help topic.
- **Not here:** the checker command and the preview page (P9-08); packs with code (never).

### P9-08 · Creator tools and a second world (L) — Specified

**Problem.** Making a world means reading the code. Design §23.1: Crownless is a platform, and the Border March its first world.

**Build.**
- **A pack checker** (`npm run check-pack <dir>`): every rule of the format, with the same precise messages as the game.
- **A map preview** of a world package: a page that draws its map, settlements, roads and regions, and lists what the checker found.
- **A second official world,** smaller: two or three realms on its own map, its own cultures, troops and lords (the rules of Phases 8 and 9 apply as they are), and a sandbox start (no story, or a short one). It is chosen at a new game.

**Tests.** The checker against good and bad packs; the second world played end to end by the same bots (the campaign bots, `npm run landed`, Prototype G); its invariants.

**Acceptance.** The second world plays end to end with the same bots, and a new world can be checked and previewed without the game's code.

**Brief (2026-11-23).**
- **Start from:** P9-07's validator and loader; `tests/helpers/test-world.js` (start the second world from it: three kingdoms on a 150 × 120 map); `scripts/landed.js`, `scripts/prototype-g.js` and `tests/helpers/campaign-bot.js` (the bots, which take `content`); the character-creation screen in `js/ui.js` (the world's choice).
- **Decided:**
  - **The checker:** `scripts/check-pack.js` (`npm run check-pack <dir>`): the game's own validator in Node, with the same messages; exit code 1 on errors.
  - **The preview:** `tools/preview.html`, a page that loads a pack's JSON (a file input), draws its map, settlements, roads and regions on a canvas, and lists the checker's findings beside it. No game code beyond `js/content.js`'s validator.
  - **The second world:** "The Sundered Coast" (a working name in data; the owner may rename it): two realms and a free city, built from the test world's map, with their own cultures, troop lines (three a realm, reusing today's art) and 8 lords; a sandbox start (no story). Chosen at a new game ("Which world?") when more than one is installed.
  - **Art:** placeholders; an asset request list in `docs/ASSETS.md`.
- **Build order:** the checker → the preview → the second world's data → choosing a world → the bots on it.
- **Write tests in:** `tests/packs.test.js` (the checker on good and bad packs) and `tests/world-package.test.js` (the second world validates).
- **Run:** those files; `npm test`, lint; browser `tests/browser/startup.spec.js` (choosing a world at a new game); slow: all of them once, with the bots on the second world as well (`campaign-bots`, `landed` and `prototype-g` given its content).
- **Play:** a new game in the second world: ride, fight a band, meet its lords.
- **Explain:** a "Worlds" line in "Getting started"; `docs/WORLD-FORMAT.md` gains "Making a world", with the checker and the preview.
- **Not here:** a world editor; sharing packs online.

### P9-T · Phase 9 tuning and acceptance (M) — Specified

**Build.**
- **Tuning:** treasuries and the crown's share; treaty frequency; rebellion frequency; army sizes, assembly and supply; deaths and successions; the company's limit and the world's sizes (P9-B3) at play.
- **Long runs** (SC-29): the world alone with delegated rulers for 20 years in the slow suite, and 100 years in an overnight script (`npm run long-run`): no negative-money exploit, no repeated ownership collision, no endless event loop, no realm wiped out by a runaway, every invariant every day.
- **The bots:** Prototype G gains a ruler style (founds or takes a realm and delegates); forced screens counted for a ruler (SC-41).
- **The exit as a scripted campaign:** design §18.9: a player ruler commands a vassal army, negotiates a treaty, appoints a castellan and issues a land grant; a disloyal noble declines an order, forms a faction and rebels; the player loses the war and is deposed, and the same save goes on with the player as a free claimant (in one save with a reload).
- **The scenario matrix:** SC-01 to SC-44 each accounted for (a test, a slow test, or the owner's play), listed in the validation document.
- **A validation document,** `docs/PHASE-9-VALIDATION.md`, with the checks waiting on the owner's phone play.

**Version.** 4.0.0 (D-V1).

**Acceptance.** The exit holds in the bot and in the owner's play.

**Brief (2026-11-23).** Tuning and the exit. The only task allowed more than two tries at a number, and only for the targets below.
- **Start from:** every Phase 9 Done paragraph's open items (big battles' parity; the walls at a battle size of 40; whatever the kingdom tasks leave), `scripts/landed.js`, `scripts/prototype-g.js`, `scripts/parity.js`, and `tests/slow/phase8-exit.test.js` (the pattern for an exit as a scripted campaign).
- **Decided:**
  - **What is tuned, and the targets:** treasuries (no realm broke at peace over 360 days; one at long war may be); treaties (each pair signs at least one in 360 days; wars 20–50% of days); rebellions (one to three in the world a year); armies (two to six campaigns a year; a capital falls on at most one seed in three over 360 days); deaths (two to six lords a year); P9-B2's big battles (fought at most 25 points over the odds at 40 and 100); the walls at 40 (between −5 and +25).
  - **Long runs:** 20 years in a new slow file (`tests/slow/long-run.test.js`), 100 in `npm run long-run` (`scripts/long-run.js`, overnight, in no suite): every invariant every day; no negative money; no runaway realm (one holding more than half the land).
  - **Prototype G's ruler style:** founds a realm when it can (P9-03's thresholds), delegates everything, and counts forced screens (none).
  - **The exit** (`tests/slow/phase9-exit.test.js`): §18.9 as a scripted campaign with one reload. You rule, command a vassal army, make a treaty, appoint a castellan and grant land; a disloyal lord declines an order, forms a faction and rebels; you lose and are deposed; the same save goes on with you as a free claimant.
  - **The scenario matrix** and `docs/PHASE-9-VALIDATION.md` (as Phase 8's), with the owner's phone checks.
- **Run:** the whole slow suite and the full browser suite once at the end (the checkpoint); the long run once overnight, and its report.
- **Version:** 4.0.0.
- **Not here:** Phase 10.

---

## Phase 10 — Ways In (Provisional)

The owner adds to this phase after in-depth testing and players' feedback (2026-11-22). Its aim: a diverse, welcoming way into the world, and a world that feels lived in from the first hour.

### P10-01 · Onboarding (M)

**Build.**
- A first-time guide through each system as you first meet it: the map and travel, a battle, a town, a contract, the Realms screen, a siege. One step at a time, each skippable, never repeated (P7's tips grow into it).
- How to Play arranged by stage: a captain, a vassal, a lord, a ruler. What matters now first, the rest a tap away.

### P10-02 · Origin stories with their own opening quests (L)

**Build.**
- Each origin begins in its own situation, with an opening quest that leads into the world and its people. For example:
  - **thrown from your horse:** bandits ride off with it, and you stand at a town's gate; the innkeeper offers rest, and work that leads after the thieves;
  - **an impoverished noble:** a family matter (a debt, a lost seat, a sibling held for ransom) that leads into a realm's politics.
- The story's first quest (Q1) is then one way in among several, not the only one.

### P10-03 · More origins, and other ways to begin (M–L)

**Build.**
- More backgrounds, each with its standing, kin, money and first contacts: a noble house's younger child, a soldier left after a war, a merchant's heir, a pilgrim, and others from the owner's list.
- Perhaps a start inside a realm's politics (sworn already, or a household knight), once houses exist (P9-06).

### P10-04 · Women soldiers (M)

**Build.** Troop types and lines of their own where they fit the realms (promised in D-P8g, P8-02), with their own names and portraits.
