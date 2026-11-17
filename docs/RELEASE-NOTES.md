# Crownless — Release Notes

## v1.0.0 — "The Border March" (MVP) · 2026-11-17

The first complete version of Crownless: a top-down 2D warband RPG for the browser, playable on phones (landscape, touch) and desktops (keyboard and mouse). Every gate of the MVP design is passed (Gates A–E, `docs/GATE-*-VALIDATION.md`).

### The game
- **You:**
  - A wanderer with a name, a look (presentation and cloak colour) and a background: Farmhand, Scout or Peddler.
  - Levels, attributes and eight skills.
  - Equipment in eight slots, from about 30 items, with armouries in towns.
- **Battles:**
  - Real-time top-down fights where you swing and block in person, with timed swings and a frontal shield.
  - Your company fights alongside under group orders (infantry, archers, cavalry; Follow, Hold, Charge).
  - Three battle maps with cover, enemy waves, and reserves that step in as others fall.
  - Soldiers fight shoulder to shoulder, and riders charge through.
  - Before a fight you can also auto-resolve, pay, threaten or retreat.
- **The company:**
  - 15 troop types across two kingdoms and the Reaver bands, with upgrade trees.
  - Food, weekly wages, morale and desertion.
  - Wounds and deaths; capture without game over.
  - **Mara**, a companion with her own fate.
- **The Border March:**
  - Ten settlements (two towns, two forts, six villages); Stonebridge's streets can be walked.
  - Patrols, caravans and Reaver bands moving on the map, with off-screen fights.
  - Six trade goods whose prices move with trade, caravans and raids.
  - Regional news, and frontier clashes between the kingdoms.
- **Work:** bandit hunts, caravan escorts and deliveries from the town boards.
- **Politics:** reputation with the Valedorn Crown and the Aurelian Remnant (Friendly, Neutral, Hostile), and forts that change hands.
- **The story:** four quests ("A Stranger's Wage", "The Broken Seal", "Two Banners", "The Greywall Verdict") with real choices.
  - Three endings: the Crown holds Greywall, the Remnant takes it, or the road peace.
  - The sandbox carries on afterwards.
- **Comfort:**
  - Synthesized music and sound effects.
  - Settings: volumes, battle size, health bars, reduced effects, tips, full screen.
  - First-time tips and How to Play.
  - Full screen on Android, and Add to Home Screen on any phone.
  - Phone-sized layout.
- **Saves:**
  - Autosave, including when the page is hidden, with a backup copy and a notice if it's ever needed.
  - A guard against the game being open in two tabs.
  - Export and import between devices, by file or pasted text, with a checksum and strict validation.
  - Reminders to keep an exported copy.

### Under the hood
- Plain HTML5 Canvas and classic JavaScript: no bundler, no runtime dependencies, no network use, no accounts. Hosted on GitHub Pages.
- Content lives in data files and is validated at load. Sprites are the owner's own (made with AI through Sprite Studio), and sound and map are code; see `docs/ASSETS.md`.
- **Tests:** 332 automated tests, including:
  - 60 randomized whole-story runs per test run, with no soft-locks and every ending reached
  - money and battle-result exploit probes
  - five v1.0 save fixtures that every later build must keep loading
- **Tools:** headless campaign and story simulations (`npm run simulate`, `npm run simulate:story`) and a battle benchmark (`npm run bench`).
- **Measured** on a Zenfone 10 (Chrome): 60 fps with 30 units in battle.
- The save format is frozen as schema v2 (`docs/SAVE-FORMAT.md`).

### Known limits
- Mercenaries have no upgrade path. The v2 troop tree will show "max tier" and add more paths.
- A raised shield protects only its holder; shield cover for neighbours is planned for v2 formations.
- Hairstyles in character creation wait for art.
- English only. No in-game text size setting, and pinch-zoom is off.
- Browser storage can be cleared by the browser (notably iOS Safari after about 7 days unused). Export a copy now and then.

### What's next
v2.0 "The Living Warband" (`docs/V2-PLAN.md`):
- named soldiers with service records
- a troop tree discovered as you play
- bigger battles with a camera, minimap, deployment presets and smarter units
- reinforcements arriving mid-battle
- a company chronicle
- a quartermaster and a merchant to hire
