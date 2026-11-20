# Crownless — Task specifications after 2.0

_Written 2026-11-18 at build 2.0.0; **reviewed and corrected the same day against commit c66d94c** (NEXT-PLAN §11). The detailed companion to [`NEXT-PLAN.md`](NEXT-PLAN.md): one specification per task, in the design's ticket format (design Part 2 §26.8), shortened to what a developer needs. NEXT-PLAN gives the order, readiness, schema steps and the owner's decisions; this file gives what each task is._

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

### P7-11 · Battle extras (M) — Specified (needs B-01, W-05a)

**Build.**
- **Formations:** shield wall (infantry on Hold close up, more shields, slower) and wedge.
- **One objective:** protect a wagon (escort ambushes) or hold a point (militia requests).
- **Terrain:** hills give archers range; fords slow everyone and break formations (W-05a's ford map).

**Layers.** Default: Balanced does the right thing. Expert: pick a formation in Orders.

**Save.** None.

**Tests.** Each effect measured under the same rules (SC-42); objectives win and lose; browser test of the formation buttons.

**Acceptance.** Each makes a measurable difference; none is required.

### P7-T · Phase 7 tuning and acceptance (S) — Specified

**Build.** Prototype G across the bigger world with followers and officers; the design exit as a scripted 90-day scenario; economy and battle passes (parity script); a validation section.

**Acceptance.** The exit holds in the bot and in the owner's play.

---

## Phase 8 — The Landed World (Provisional: re-specified at the phase's start)

### P8-01 · Lords on the map (M–L)

**Build.**
- Named lords (persons with ids, culture names, a home holding) lead kingdoms' parties: patrol, hunt, escort, gather for war.
- Intentions are shown on tap.
- Lords can be met, fought, captured and ransomed.
- **Integration:** a new party kind (`lord`) handled everywhere parties are:
  - encounters (`parties.current`);
  - auto-resolve;
  - reinforcements (`reinforce.sideOf` today only knows bandit, patrol and caravan);
  - contracts (as targets or not);
  - news;
  - the V2-09 lock.
- Patrols remain for small fry.

**Save.** Yes.

**Tests.** Intentions consistent; capture and ransom once; no lord in two battles; reinforcement sides for lords.

### P8-02 · Holdings model (L)

**Build.**
- **Per holding:** sovereign realm, legal holder (a person), occupier, administrator, private owners (design §17.1, §24.2), replacing `c.owners`.
- **Touches:**
  - `realm.js` (owner, garrison, holdings, welcomes);
  - the story's `owner` conditions and effects (Q4 sets Greywall's owner);
  - recruiting;
  - news;
  - contracts;
  - debug.
- **A save migration:** the sovereign is the old owner; the holder is a lord of that kingdom.

**Save.** Yes.

**Tests.** Every transition without duplicates; story conditions unchanged in meaning; fixtures from the build before.

### P8-03 · Permissions (S)

**Build.** `may(person, action, place)` from oaths, offices and ownership (design §4.3), used by every right-based action.

**Tests.** A case table.

### P8-04 · Allegiance (M)

**Build.**
- Independent, mercenary contract, sworn vassal, rebel, sovereign, deposed (design §16).
- A consequence preview before confirming (design §22.5).
- Obligations: muster, service days.

**Edges.** Personal property and the warband are never lost by switching.

### P8-05 · Fiefs and castellans (M)

**Build.**
- **Getting a holding:** granted or conquered.
- **Administration:** a castellan or steward with policies (garrison, tax stance, reserves, repairs) and a default steward.
- **Money:** revenue and costs through the holding's own budget account; weekly report.

**Edges.** Unpaid garrisons desert; high taxes cause unrest, with warnings first.

### P8-06 · Sieges (L)

**Build.**
- **Phases:** encirclement, preparation (ladders, ram, food), one assault map (walls, gate, ladders), resolution (capture, surrender, lifted) (design §20.4–20.6).
- **Relief armies** come by the reinforcement rules.
- **Afterwards:** capture and ransom.
- A Debug-panel siege test for the phone.

**Edges.** Anti-snowball (design §20.7); the phone budget on the assault map.

### P8-07 · Named nobles (M)

**Build.**
- A handful per kingdom with four factors: relationship, interest, obligation, fear.
- Obey, negotiate or refuse, with readable reasons (Prototype F).
- Their own petitions.

### P8-08 · Losing and retaking land (M)

**Build.**
- Losing a holding while away; claims that persist.
- The landless captain carries on (SC-20–23).
- Retaking by siege or petition.
- **Prototype D** as a scripted scenario and a debug start.

**Acceptance.** Prototype D passes.

### P8-T · Phase 8 tuning and acceptance (S–M)

**Build.** Revenue and war pace, anti-snowball, 90-day bots, Prototype G with a landed player, a validation section.

**Version.** 3.0.0 (proposed, D-V1).

---

## Phase 9 — Kingdoms & Houses (Provisional)

### P9-01 · Realms as organisations (M)

**Build.** Realm treasury, laws and offices; the ruler's wealth separate from the realm's (Part 2 §18.1).

### P9-02 · Diplomacy and treaties (M)

**Build.**
- War, peace, truce, alliance and trade access, with durations and breach rules.
- AI kingdoms treat among themselves.
- Grows from W-07's relations.

**Acceptance.** SC-25.

### P9-03 · Founding or taking a kingdom (M)

**Build.**
- Declaring a realm from held land; recognition and enforcement separate from the claim.
- Vassals by grant; delegated authority (SC-41).

### P9-04 · Rebellion and deposition (L)

**Build.**
- Ambitions, claimants, escalating uncertain warnings, civil war.
- The deposed keep person and warband (SC-26, SC-27).

### P9-05 · Armies and campaigns (L)

**Build.**
- Armies from lords' retinues and the company: muster, march and supply.
- Sieges and field battles at scale through the battle-size cap and reserves.
- The phone budget kept; a Debug-panel army test.

### P9-06 · Houses, marriage and claims (M)

**Build.**
- The founding house; marriages as alliances; rival houses.
- Generational play optional and later (Part 2 §19).

### P9-07 · Modding: a declarative content format (M–L)

**Build.**
- **The format:** the world package (W-04) published as a format.
- **Namespaced ids** (moved here from W-04): every id validator, save key and regex audited for `:`.
- **Packs:** data-only packs, validation, safe import, a pack list in Settings.
- **Compatibility:** SC-33's protections extended to packs.

**Acceptance.** A sample pack adds a troop line and a settlement without code; removing it gives a precise error.

### P9-08 · Creator tools and a second world (L)

**Build.** A pack checker (CLI), a map preview of a world package, and a smaller second official world.

**Acceptance.** It plays end to end with the same bots.

### P9-T · Phase 9 tuning and acceptance (M)

**Build.**
- Long runs: SC-29, 100 simulated years with no exploits or loops.
- Ruler fatigue (SC-41).
- The full scenario matrix SC-01–42.

**Version.** 4.0.0 (proposed).
