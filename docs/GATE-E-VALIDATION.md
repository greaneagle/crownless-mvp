# Gate E — Public-Release Quality: Progress & Validation

_Spec: GDD §6 (scaling), §12 (performance targets), §13 (saves), §14 Gate E, §15 definition of done._

**Gate E pass criteria (GDD §14):** UX on landscape phones and web; export/import cross-platform; performance scaling, audio, tutorial, device QA, original/licensed art. **Pass:** complete core loop with no critical data loss or unavoidable progression blocker.

| Roadmap step | Status |
|---|---|
| 5.1 Battle scaling: active-unit cap with reserves, stress test, measured costs | ✅ 0.29.0 |
| 5.2 Landscape UX pass (the phone-size notes from Gate D; touch targets; dev buttons out of release builds) | ✅ 0.30.0 |
| 5.3 Settings and audio (battle size, volume, sound effects) | ✅ 0.31.0 |
| 5.4 Tutorial and help | ✅ 0.32.0 |
| 5.5 Save safety and cross-platform export/import QA | ✅ 0.33.0 |
| 5.6 Asset provenance (original or licensed art, GDD §11) | ✅ 0.34.0 — see `docs/ASSETS.md` |
| Owner request: full screen on phones | ✅ 0.35.0 |
| 5.7 Device QA and Gate E acceptance | 🟡 In progress. Zenfone 10 (Chrome): stress test at size 30 at 60 fps, 0.6 ms simulation and 1.7 ms drawing; full screen, home screen and play all work. F-3 (towns open on their menu) done in 0.37.0. Still to do: iPhone if available, the §15 checklist |

---

## Step 5.7b — 0.37.0: Towns open on their menu (2026-11-17, owner playtest finding F-3)

The owner's verdict after phone testing was "it all felt pretty good", with one change asked for: walkable towns should open on the settlement menu rather than the streets.

### What changed
- **Arriving opens the menu.** Arriving at a walkable place (Stonebridge today), or starting a new game there, opens the settlement menu. The streets are opt-in: **Walk the streets** (the menu's second button) opens them, and **Leave** goes back to the map. Inside the streets, Town menu and the road out work as before, and screens opened from the streets return to the streets.
- **The menu reaches the street people.** With the menu first, the Elder (who starts Q1), the Captain, the Sergeant and Mara would otherwise be hidden behind a walk. They now also appear as **Talk to …** buttons, following the same story rules (for example, Mara only once Q2 brings her), and a conversation started from the menu returns to the menu.
- **A content flag for each place.** `entry: 'menu'` (the default) or `'streets'` on the town hub, so a future walkable town or a mod can choose. It's validated at load.
- How to Play's "Towns and villages" topic now describes menu first, then the streets.

### Checks
- Two tests that encoded the old behaviour were updated: arriving at Stonebridge, and starting a new game, now expect the menu.
- A new test covers the street people listed on the menu (Mara only when the story allows), talking from the menu and returning to it, the `entry: 'streets'` option (sub-screens returning to the streets), and validation of a bad value.
- 321 tests pass; lint clean.
- Browser at 844×390, with real taps:
  - Rode to Stonebridge and the menu opened, with "Talk to Sergeant Brun / Elder Maren / Captain Aldric", **Walk the streets** and **Leave**.
  - Talked to the Elder from the menu and came back to the menu.
  - Walk the streets opened Stonebridge, with the Town menu button there.
  - No errors. The preview save was restored afterwards.

---

## Patch — 0.36.1: Shoulder to shoulder (2026-11-17, owner request)

The owner asked for more allowed overlap after 0.36.0, for a shoulder-to-shoulder feel.

- **Spacing:** from 0.7 to **0.5 × two footprints**, so from about 17 px to **12 px** (one body width).
  - In 40-unit battles soldiers now average **10.6–11.2 px** from their nearest neighbour (14–15 px before).
  - In a deep scrum two soldiers on foot may briefly come **4.3–5.5 px** apart, and no two are ever closer than 3 px. Still no stacking.
- **Cost:** unchanged, at 0.33–0.53 ms per frame at 40 units.
- **Test:** the real-battle test now asserts that no two soldiers on foot come within a third of a body (4 px). It was tied to the old spacing.
- 320 tests pass; lint clean.
- **Browser:** a 40-unit stress battle shows tight blocks around the hero and in the melee. The preview save was untouched.

**Not changed, and planned:** a raised shield still protects only the person holding it. **Shield cover for the ally beside you**, so the hero can cover a companion and a shield wall works, is now part of v2's formation work (`docs/V2-PLAN.md` V2-08).

---

## Patch — 0.36.0: Soldiers have bodies (2026-11-17, owner playtest finding F-2)

### The problem
In battle, soldiers had no size against each other. Their 12 px footprint only collided with trees, walls and crates, so a group following the hero, or a crowd chasing one enemy, collapsed onto a single point. In 40-unit battles the nearest pair averaged **1.3–4.1 px apart**, and on 273–1045 frames per battle two units stood within 4 px (stacked).

### What changed (`js/units.js` `separate`, called every battle frame after the AI moves)
- **How it works:** two living units closer than **16.8 px** (0.7 × two 12 px footprints) push apart by half the overlap each frame.
  - Soldiers can crowd and overlap a little in a melee, but can't stack.
  - The push is smooth rather than jumpy, and the fallen don't push anyone.
- **Weight:** the hero counts as 3, riders as 2 and soldiers on foot as 1. So your own soldiers step aside rather than shoving you, and riders give way less than footmen.
- **Cavalry still charges through:** a rider at charge speed, or riding on after a pass, goes through *enemy* bodies (GDD §7: "pass through, and turn for another run"), while staying clear of its own side.
- **Pushed units stay out of walls and inside the arena.** Units on exactly the same point are split in a fixed direction, so a battle replays identically from the same seed.
- **Cost stays low:** a simple grid of cells the size of the spacing means each unit only checks its neighbours, so the cost grows with the number of units, not with every pair (this is the "proximity grid" the GDD asks for).

### Measurements (40-unit battles, 15–20 s, every map)

| | Average nearest pair | Closest pair on foot | Frames with two units under 4 px |
|---|---|---|---|
| Before | 1.3–4.1 px | 0.0 px | 273–1045 |
| After | 13.8–14.8 px | 8.3–10.2 px | only riders passing through enemies (9–17 frames) |

- **Simulation cost:** at 40 units it went from about 0.2 ms to **0.3–0.6 ms** per frame on desktop (`npm run bench`), still a small fraction of the 16.7 ms frame budget.
- **Browser:** in a 40-unit stress battle the closest pair on foot over 3 s was **15.0 px**, with no errors.

### Checks
- `tests/spacing.test.js` (5 tests) covers:
  - 20 soldiers on one spot spreading into a crowd, deterministically
  - a little overlap eased out softly, units already apart left alone, the fallen ignored
  - the hero not being shoved by their own soldiers
  - a crowd never pushed into a wall or out of the arena
  - real 40-unit battles on all three maps never stacking soldiers on foot
- The cavalry test "riders pass through their target and wheel round for another run" first **failed**, because the new bodies stopped the charge. That led to the charge-through rule above, and it passes again.
- 320 tests pass; lint clean; the 30-day campaign simulation is unchanged (it auto-resolves battles).
- Browser: a 40-unit stress battle shows a readable crowd instead of a pile, with the measurement above. The preview save was untouched.

### Playtest finding F-1 (troops with XP but no upgrade)
Confirmed by the owner: the stuck soldiers were Mercenaries, which have no upgrade path while the Party screen showed an XP target. **Not changed now.** It is planned for v2 as a troop tree discovered as you play (`docs/V2-PLAN.md` V2-03b): end-of-path troops will show "max tier", and there will be an "Upgrade all ready" action.

---

## Slice 7 — 0.35.0: Full screen on phones (2026-11-17, from the owner's phone testing)

### The request
The owner tested on phones and confirmed the game works. One issue remained: in Chrome on a phone the address bar takes room at the top. The owner asked for full screen, or a setting for it.

### What's in
- **Settings → Full screen (hide the browser's address bar):** on by default on phones (`pointer: coarse`), off on desktops, and kept on the device like the other settings.
  - Browsers allow full screen only from a tap or key press. With the setting on, the game goes full screen on the first tap of a session. If you swipe out of it, the next tap brings it back.
  - Ticking the box enters full screen at once; unticking it leaves.
  - Esc never re-enters, because that's how you leave on a desktop.
  - While in full screen it asks to **lock landscape**, which works on Android and is ignored where it isn't supported.
- **iPhone:** no iPhone browser lets a web page go full screen (they're all Safari underneath). There, the switch is replaced by instructions: Share → Add to Home Screen.
- **Add to Home Screen (iPhone and Android):** a web app manifest (`manifest.webmanifest`: `display: fullscreen`, landscape, the game's colours) plus the Apple meta tags.
  - Launched from the home screen, the game runs with no browser bars at all.
  - Settings then says "Running from your home screen, so there are no browser bars", and the game doesn't ask for full screen.
- **Icons:** 192, 512 (also "maskable") and the 180 px Apple icon, made by `npm run icons` (`scripts/make-icons.js`, no dependencies) from the owner's hero sprite. The figure is cropped, scaled up pixel for pixel, and centred on the game's background inside Android's mask safe zone. They're recorded in `docs/ASSETS.md`.

### Found while checking
- **Phones would have refused the first tap.** The first version listened for `pointerdown`, but on a phone Chrome only grants full screen at the end of a tap (`pointerup`); a pressed finger doesn't count. It now listens for `pointerup` and key presses.

### Checks
- `tests/fullscreen.test.js` (5 tests, with a stand-in document) covers:
  - the first tap going full screen with the bar hidden and landscape locked, later taps leaving it be, and swiping out then tapping going back in
  - the setting off doing nothing, and the switch entering and leaving at once
  - home-screen launches and browsers without full screen (iPhone) making no requests, and no document at all (Node) not throwing
  - phones defaulting to on and desktops to off
  - the manifest being full screen and landscape with real icons of the stated sizes (including a maskable one), linked from `index.html` with the Apple tags, and recorded in the provenance doc
- 315 tests pass; lint clean.
- Browser:
  - The manifest and icons are served (200, image/png), and Settings shows the new switch and its note.
  - **Not verifiable here:** the Claude preview pane never grants full screen. A real click left the request pending; without a click it's refused with "Permissions check failed", as browsers do. The real check is on a phone.

### For the owner (on your phone)
- [ ] **Android Chrome:** open the game. Your first tap should hide the address bar and lock landscape. Swipe out, tap again, and it's back. Settings → Full screen off should keep the bar.
- [ ] **Add to Home Screen** on Android (⋮ → Add to Home screen) and on an iPhone if you have one (Share → Add to Home Screen). It should open from the icon with no browser bars, and the icon should be the hero.

---

## Slice 6 — 0.34.0: Asset provenance (2026-11-17)

### What's in (GDD §14 Gate E "original/licensed art"; §11 art bible "No real Pokémon sprites, tiles, trademarks, or assets")
- **Where the art comes from, confirmed by the owner:** the 169 sprite PNGs (character frames `u####`, world tiles `w####`) were made with AI by the project owner using **Sprite Studio**, the owner's own AI-built sprite tool, and are owned by the owner. There is no third-party art.
- **Everything else is written for this project or generated in code:**
  - the world map and its icons are canvas shapes
  - the interface is CSS
  - the sound and music are synthesized (5.3)
  - the hero's cloak colours are a runtime recolour
  - the text was written for the game
  - the font is the device's own Georgia, and the page icon is a ⚔️ emoji, so neither is distributed
- **No runtime dependencies:** the page loads only its own files: no CDN, web fonts or trackers. Lint and the local server run through `npx` and are not shipped.
- **`docs/ASSETS.md`:** the provenance record, covering what ships, its origin and rights, the unused files, and things to keep in mind:
  - how copyright treats AI-generated images varies by country, and the image model's terms may matter, so note which model Sprite Studio used
  - the sprites are a generic 16-bit fantasy style, not copies from any existing game
  - how to add art later
- **`assets/manifest.json`** (`npm run assets` rebuilds it) lists every image with its source and whether the game uses it: 85 of the 169 are loaded.
  - **Unused files:** the other 84 are unused unit frames from the same sheets. The owner chose to keep them. They're published with the site but never downloaded by players.
- **Credits:** a ninth How to Play topic says the sprites were made with AI using Sprite Studio, the sound is synthesized, and no third-party art, music, fonts or libraries are used.

### Checks
- `tests/assets.test.js` (3 tests) covers:
  - every PNG listed in the manifest with a documented source, and no stale entries
  - the "used" flags matching what the game's own preload asks for, with nothing it asks for missing
  - no external resources in `index.html`, and no other-site URLs or web fonts in any shipped script, data file or stylesheet
- 310 tests pass; lint clean.
- Browser: How to Play → Credits shows the new topic.

### For the owner
- [ ] For the record in `docs/ASSETS.md`: which image model or service did Sprite Studio use to generate the sheets, and do its terms allow commercial use if Crownless is ever sold?

---

## Slice 5 — 0.33.0: Save safety and cross-device saves (2026-11-17)

### Audit (GDD §13 save model; §14 Gate E "export/import cross-platform … no critical data loss")
**Already in place:**
- an autosave after battles and on entering a settlement
- a backup copy kept on every write, with fallback to it
- a checksummed export, and a strict import that rejects unknown IDs, damaged files and newer versions without touching the current save
- a copy of the current save kept before every import
- a warning shown when the browser refuses a save

Saves are small, about 9 KB after 60 game days, so storage quota is no concern. The audit found five ways progress could still be lost.

| Gap | Fix |
|---|---|
| **Closing or switching away didn't save.** Phones close background tabs without warning, losing travel, waiting and trading done on the map since the last settlement. | The game now saves when the page is hidden or closed (`visibilitychange`, `pagehide`), except mid-battle: a battle in progress isn't part of the save and is fought again on return, as before. |
| **Two tabs overwrote each other.** An older tab left open quietly overwrote progress made in a newer one. | When another tab writes the save, this tab stops saving and says so ("open in another tab — reload to carry on here"), and Save & export explains it. The newer save is never overwritten. |
| **Browsers can clear site storage**, and iOS Safari does after about 7 days unused. The game gave no reminder. | Save & export shows when you last exported a copy ("No copy exported from this browser yet"). Once a session, on entering a settlement, a reminder appears if you've never exported by game day 3, or not for a week. Save now and Export also ask the browser to keep the game's storage (`navigator.storage.persist`); most grant it quietly, and the screen says so when granted. |
| **Falling back to the backup was silent.** | The title screen now says: "Your latest save could not be read, so the one before it was loaded. You may have lost a few minutes." |
| **Save text sent through a chat app, email or notes** can arrive with a byte-order mark, blank lines, ```json fences or a note around it, and was rejected. | Import keeps just the JSON object. Damage inside it is still caught by the checksum. |

### Checks
- `tests/save-safety.test.js` (6 tests) covers:
  - the two-tab guard (the newer save untouched, the message shown)
  - the backup loading with the notice
  - four kinds of wrapped paste importing, with in-save damage still rejected
  - the reminder timing
  - **cross-device:** five campaigns at different stages (early Q1, mid-story, two finished stories, one mid-Q2), played by the story bot, exported on one "device" and imported on another fresh one, each identical
  - **older builds:** a save without reputation, quests, Mara, news, fort owners or the per-template contract boards (as exported by 0.14.0) imports and plays, with the Elder offering Q1
- 307 tests pass; lint clean.
- Browser, with real clicks:
  - **Two real tabs:** the second tab saved (1111 crowns), the first switched to "stopped saving" at once, and its Save now was refused with the reason while the newer save stayed.
  - **Page hide mid-journey:** the save moved from day 3.35 to the live 3.51, with the new position.
  - **A pasted save** wrapped in a note, a code fence and a BOM imported through the real paste box (4,242 crowns, mid-journey).
  - **A corrupted main save:** the previous one loaded, and the title screen showed the notice.
  - Export and Copy weren't pressed: one downloads a file and the other overwrites the clipboard. They're unchanged apart from recording the export time.
  - No console errors. The preview save, its backup and storage were restored afterwards.

### For the owner (real devices — the part only you can check)
- [ ] **Phone → desktop:** Save & export → Export save file on the phone, then import that file on desktop. Then the reverse.
- [ ] **Phone → phone (or desktop) by text:** Copy save text, send it to yourself in a chat app or email, paste it on the other device.
- [ ] **On the phone, switch apps mid-journey:** leave the browser while travelling on the map, swipe it closed, reopen. You should be roughly where you were, not back at the last town.
- [ ] **iPhone:** after Export, check the file landed in Files, and that Import from file can pick it.

---

## Slice 4 — 0.32.0: Tips and How to Play (2026-11-17)

### What's in (GDD §14 Gate E "tutorial"; §11 "initial mappings are documented in Help"; §4 Q1 is the onboarding quest that "introduces movement, settlement menu, first battle, money and recruitment")
- **Q1 stays the tutorial you play.** The new pieces explain the screens around it rather than adding a separate scripted tutorial.
- **First-time tips:** 15 short cards (`data/help.js`), each shown once, the first time its moment comes:
  - **Screens:** the map, Stonebridge, a settlement menu, an encounter, the first battle, the market, the contract board, the Party screen, the Journal, Save & export.
  - **Situations:** reserves in a battle, the first capture, food running low (under 2 days with soldiers), points to spend, wounded soldiers.
- **How the cards behave:**
  - **First battle:** it waits on its controls card until "Got it". There are separate touch and keyboard wordings, chosen by the device.
  - **One at a time.** Moving to another screen closes the card. "More help" opens How to Play at that card's topic.
  - **Placement:** on the map, in town and in battle the card sits low between the joystick and the action buttons (or mid-screen in battle). Over a menu it sits at the top, so it never covers the menu's buttons.
  - **Remembered per device**, so a second campaign on the same phone isn't lectured again. Like the settings, this lives in its own storage key, never in the save.
  - **Settings** has "Tips the first time something comes up" (on by default) and "Show all tips again".
  - Stress battles show no tips.
- **How to Play** (title screen, Settings, or a tip's More help): eight topics:
  - getting started
  - the map
  - towns and villages
  - battle
  - your company
  - trade and contracts
  - story, reputation and news
  - saving and settings

  The map, town and battle topics list their controls as Touch, Keyboard / mouse, and Action. Battle covers every mapping the GDD lists: WASD, Space and left click, Shift and right click, 1–3, F/H/C, and Esc. A battle pauses while How to Play is open.
- Content is validated at load: every tip needs a title and text (or both touch and keyboard wordings), a known help topic and a known situation; help rows have three columns.

### Found in the browser run and fixed
- Over a settlement menu the card covered Rest, Save & export and Leave, and a tap meant for Leave landed on the card. Over menus it now sits at the top.
- The card was 70% wide and touched the joystick and TALK button in town. It's now 56%.
- "More help" opened the right topic but kept the panel's old scroll position, so the topic started off-screen. It now scrolls to the topic.
- The first battle ran 0.4 s before its card appeared. Battle tips now show at once.
- The map tip said "Start in Stonebridge" just as you leave it. It now says "Elder Maren in Stonebridge has work for a stranger."

### Checks
- `tests/tips.test.js` (6 tests) covers:
  - every GDD control documented, and every tip pointing at a real topic
  - a tip showing once, one at a time, remembered on the device across campaigns and not stored in the save
  - turning tips off and showing them again
  - the situation tips waiting for their moment
  - the first battle pausing on its card and resuming, then the reserves and capture tips
  - no tips in stress battles
- 301 tests pass; lint clean.
- Browser, with real taps at 667×375 (phone emulation, so the touch wording):
  - How to Play from the title (Battle's controls table readable at phone width).
  - A new game: the Stonebridge tip, and "More help" opening Towns.
  - The settlement-menu tip, the map tip, the encounter tip over the choices, and the first battle frozen on its controls card until "Got it".
  - A lost battle with the Captured tip.
  - No console errors. The preview save was restored and the seen tips cleared afterwards.

### For the owner to try
- [ ] Start a new game on the phone and play to the end of Q1. Do the tips come at useful moments, and does any feel like nagging or arrive too late?
- [ ] Is anything you had to figure out yourself missing from How to Play?

---

## Slice 3 — 0.31.0: Settings and audio (2026-11-17)

### What's in (GDD §11 "Separate Music/SFX volumes; toggle screen shake/reduced particles", "ally/enemy HP bars optional for low-clutter mode"; §12 "12–18 reusable SFX … and 3 music loops (menu, world/town, battle). Audio can use suitably licensed placeholders until final polishing"; screen 12 "Settings/Save/Import/Export")
- **Settings panel:** open it from the ⚙ button (on the map, in town and in battle, where the battle pauses while it's open) or the title screen's Settings button. It has:
  - Music volume and sound-effects volume, as separate sliders.
  - Battle size: 20, 30 or 40 units at once (5.1), with a line explaining reserves.
  - Health bars over soldiers, which can be turned off for less clutter; the hero's HP stays in the HUD.
  - Reduced effects: no hit, block and arrow rings. (The game has no screen shake to turn off.)
- **Settings belong to the device.**
  - They're kept in their own storage key, never in the save, so exporting a save to another phone doesn't carry this phone's volume or battle size with it, and an import doesn't change them.
  - Junk values fall back to the defaults, setting by setting.
  - Defaults: music 50%, effects 70%, health bars on, full effects. Battle size starts at **30 on touch phones** (every current battle still fits: a full company of 20 plus the hero and Mara against an 8-man wave) and 40 elsewhere.
- **Sound** (`js/audio.js`) is all synthesized with the Web Audio API, from oscillators, filtered noise and envelopes. There are **no sound files**, so it's original by construction and adds nothing to download.
  - **14 effects** (GDD list):
    - in battle: swing, hit, block, down, bow, arrow thunk, horse (when riders reach full gallop)
    - in trade and contracts: coin
    - for buttons and announcements: select, notification
    - for story and the hero: quest complete, level up
    - after a battle: victory, capture
  - **3 music loops:** menu (title and character creation), world (the map, towns and menus) and battle. They're short modal tunes over a soft drone, with a drum line in battle, fading in and out as the screen changes. After a battle, the battle loop fades under the victory or capture sting.
  - **A crowded melee stays readable.** Each sound has a minimum gap before it can play again, and at most 10 sound at once. The hero's own swings and hits are full volume; everyone else's are at 40%.
  - Browsers only allow sound after a gesture, so audio starts on the first tap or key press. It suspends while the page is hidden. Where Web Audio is missing (old browsers, Node tests) everything is silent and nothing breaks.
- **Bug found in the browser check:** battles start without going through the usual screen change, so the world loop kept playing in battle. `startBattle` now switches the music itself, and a test covers it.

### Checks
- `tests/settings-audio.test.js` (6 tests) covers:
  - defaults, validation and fallbacks; the battle size applying at once
  - settings not appearing in the save, and an import not touching them
  - silence without Web Audio
  - against a stand-in AudioContext: 14 effects built from oscillators and noise (no files), the per-sound rate limit, the 10-voice cap, mute
  - the three loops following the screen, including the result sting
  - a full battle making swing, hit and down sounds, with the hero loud and the rest quieter, and the battle loop starting with the battle
- 295 tests pass; lint clean.
- Browser, with real clicks:
  - The title screen's Settings started the menu loop (audio unlocked by that tap).
  - Set music to 30%, battle size to 20, health bars off and reduced effects on. The battle cap became 20 at once, and all of it survived a page reload.
  - Continue switched to the world loop. A stress battle switched to the battle loop (after the fix above) and showed no health bars.
  - ⚙ mid-battle froze the battle clock for 2 s; Done resumed it.
  - No console errors. The save was untouched, and the test settings were cleared afterwards.
- **Not checkable here:** how it actually sounds. The browser pane can't be listened to, so the mix (levels, how busy a big melee sounds, whether the loops get tiresome) needs your ears.

### For the owner to try
- [ ] Play a few minutes with sound on (phone and desktop). Are the effects too loud or too busy against the music? Does a loop get tiresome? Are any effects missing or annoying?
- [ ] Settings → set battle size and volumes, close the browser, reopen: they should be as you left them.

---

## Slice 2 — 0.30.0: Phone layout pass (2026-11-17)

### What's in (GDD §14 Gate E "UX on landscape phones and web"; the phone-size notes from Gate D acceptance)
- **The HUD fits beside the buttons.**
  - Before: the status panel ran under the top-right buttons, cutting off the quest name ("• A Strange…").
  - Now: the panel is limited to the room the buttons leave (measured on every mode change and resize), so its text wraps to a second line instead.
- **Announcements sit below the HUD.**
  - Before: messages such as "New quest…", "Quest complete…" and "Enemy wave…" drew over the status panel.
  - Now: they appear just below it, centred on a dark backing that reads over the map, the streets or a battle.
- **Map labels no longer pile up.**
  - Labels are placed after everything else, most important first: quest, contract and escort marks, then settlements, sites, hostile bands and other parties.
  - Each label tries below its icon, then above, right and left, and avoids labels already placed and the hero sprite.
  - Settlement, site and quest names always appear. A patrol or caravan with no room shows its troop count as a badge on its icon instead.
  - At 667×375: Stonebridge moved above its icon (the caravan beside it shows a badge), Highmere moved clear of the hero, and Greywall, Oakford and the quest band no longer cover each other.
- **Tap-to-walk in Stonebridge steers** round the well and buildings the way soldiers do. Before, the hero ground slowly along the well's edge on the way to the Elder.
- **Developer tools are out of release builds.**
  - The Logs and Debug buttons show on a local dev server, or with `?dev` in the address (remembered on that device; `?dev=0` turns them off).
  - On the published site they are hidden, which frees the top bar and stops them overlapping menus.
  - F3 still opens the diagnostics panel, so a desktop player can export a report.

### Not changed (checked, fine)
- Touch targets were already at least 44–48 px (Gate A).
- The battle HUD, joystick, Orders, Block and Attack buttons fit at 667×375 and 740×360.
- With `?dev` on, the Logs and Debug buttons still overlap a menu's top-right corner on small phones. That's developer-only, so it stays.

### Checks
- `tests/town.test.js`: a new test walks from where you arrive to the Elder and must beat the straight-line time. It fails without the steering fix (4.85 s sliding along the well, against 4.60 s).
- Label placement and HUD fitting draw to the canvas and page, so they're checked in the browser rather than in Node.
- 289 tests pass; lint clean.
- Browser, with real clicks, at 667×375 (iPhone SE landscape) and 740×360 (small Android):
  - Map as a release build: the full HUD line, the toast below it, and labels apart.
  - Map with `?dev`: the HUD wraps to two lines beside five buttons.
  - Then, at 667×375: the quest ambush's encounter screen, the battle HUD and controls, and the Stonebridge streets.
  - At 740×360: the town menu.
  - No console errors. The preview save and the dev setting were restored afterwards.

---

## Slice 1 — 0.29.0: Battle scaling (2026-11-17)

### What's in (GDD §6 "Scaling: initially profile 20 active units, then 30, then 40. If a battle has 60 total troops, reserve stacks enter as others fall"; §12 "battle wave cap configurable … use proximity grid, simple steering and staggered targeting")
- **Battle size (active-unit cap):**
  - At most 40 units fight at once by default: the hero, Mara, soldiers and enemies together. The size can be set to 20 or 30 for slower phones. For now it's in the Debug panel, and only for the session; it moves to Settings, saved, in 5.3.
  - Each side's share is fixed when the battle starts. The enemies get room for their biggest wave, up to half the field (at least 6). The company gets the rest.
- **Reserves:**
  - Anyone beyond their side's share waits in reserve and steps in as others fall, a stack of three at a time (or the last few). An announcement says how many joined and how many still wait, and the HUD shows "Reserves yours/theirs".
  - Your reinforcements are real roster soldiers: they earn XP and can be wounded like anyone deployed.
  - Soldiers beyond their formation slots (more than 12 infantry, 8 archers or 6 riders) now fight as reserves instead of sitting the battle out.
- **Waves** still come in order as authored. Each wave can hold some of its troops back as reserves.
- **GDD §15 edge case "battle ends during reinforcement spawn":** a battle is won only when the last wave and its reserves are spent. It is lost only when the hero, the field and the company's reserves are all down. "Win now" credits the enemies still waiting.
- **Unchanged at the default size:** a full company of 20 against an 8-man wave fits on the field, so nobody waits.
- **Stress test** (Debug panel → "Battle size & stress test"):
  - A practice battle of 20, 30, 40 or 60 units on the courtyard map: half yours, half Reavers, mixed infantry, archers and riders.
  - The result screen reports the average fps, the most units on the field, the simulation and drawing time per frame, and the slowest frame.
  - It changes nothing in the campaign and saves nothing.
- **Frame timing:** the diagnostics panel (Logs · F3) now shows smoothed simulation and drawing milliseconds per frame, plus the battle size.
- **Fix:** when a fought battle ended, the HUD still showed the counts from the frame before the last blow ("Enemies 1" on a victory). It now shows the final tally.

### Measurements
**Simulation, headless** (`npm run bench`, `scripts/bench-battle.js`): real battles at a fixed 60 Hz step, mean per-frame cost over 20 s on a desktop CPU.

| Units in the battle | Grass field | Forest clearing | Greywall courtyard | p95, worst map |
|---|---|---|---|---|
| 20 | 0.09 ms | 0.09 ms | 0.10 ms | 0.29 ms |
| 30 | 0.08 ms | 0.24 ms | 0.14 ms | 0.42 ms |
| 40 | 0.21 ms | 0.20 ms | 0.20 ms | 0.54 ms |
| 60 (40 on the field, 20 in reserve) | 0.16 ms | 0.22 ms | 0.26 ms | 0.58 ms |

Before the cap, a 60-unit battle put 54 on the field at up to 0.44 ms per frame.

**In the browser** (desktop, the Claude preview pane): the 40-unit stress test took 0.1 ms simulation and 0.5 ms drawing per frame; the 20-size battle with 60 units took 0.1 ms and 0.4 ms. The pane reported 30 fps, but a bare animation loop there also runs at 31 fps because the pane was in the background, so that is the pane's cap, not the game's.

**Conclusions:**
- At 40 units the game uses well under 1 ms of the 16.7 ms frame budget on desktop. Even a phone 10–20× slower would have plenty of room, but only a real phone can show that (GDD §12: "after actual device tests").
- **No proximity grid yet.** Targeting is already staggered (each unit re-picks a target every 0.17–0.41 s, not every frame), and nothing does per-frame all-pairs searches except swing hit checks against a few dozen opponents. The measurements show no need for a grid at MVP scale; it stays the first lever if a device test shows the simulation costing too much.
- The GDD's fallback order holds: lower the battle size, or stagger reinforcements, before simplifying AI.

### Checks
- `tests/scaling.test.js` (8 tests) covers:
  - today's battles fitting at size 40
  - a size-20 battle holding the field at 20, with reserves stepping in three at a time (real roster soldiers)
  - formation overflow fighting as reserves
  - a big wave holding some back, and the battle not ending until its reserves are spent
  - the company not being beaten while its reserves wait
  - waves in order with their own reserves
  - "Win now" crediting waiting enemies, and only the offered sizes being accepted
  - the stress test leaving the campaign and the save untouched
- 288 tests pass; lint clean.
- Browser, with real clicks:
  - Stress 40 at size 40: 40 on the field, won, and the result screen showed the numbers above.
  - Stress 60 at size 20: the field held at 20 (hero, 9 soldiers, 10 Reavers), with "Enemy wave 1/1 · 20 more waiting" and "Reserves 20/20" on the HUD. Six reinforcement stacks arrived during the fight, and the field stayed at exactly 20.
  - The preview save was byte-identical after both stress battles. No console errors.

### For the owner to try on a phone
- [ ] Open the game with `?dev` added to the address (the Debug button is hidden on the published site since 0.30.0), then Debug → Battle size & stress test → **Stress 40** at size 40. Write down the fps, simulation ms and drawing ms on the result screen.
- [ ] If it's under about 30 fps, try **Stress 40** at size 30 and at size 20, and note which size feels smooth. Since 5.3, phones start at size 30; the measurement decides whether that stays.
