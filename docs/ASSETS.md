# Crownless — Asset Provenance

_GDD §11–§12 art bible ("No real Pokémon sprites, tiles, trademarks, or assets") and §14 Gate E ("original/licensed art"). Rewritten for P10-G6, build 4.15.0 (2026-11-26)._

**In one line:** everything the game shows is drawn in code, written for this project. The only image files are the three home-screen icons, and a script draws those with the same code. There is no third-party art, sound, music, font or runtime library.

## What ships, and where it came from

| What | Files | Origin | Rights |
|---|---|---|---|
| **Everything drawn in play:** troops, the hero, companions, lords, townsfolk, horses, buildings, towns, battle maps, the world map, banners, house arms, portraits, small troop figures, icons (P11-04: every item drawn on whoever wears it, and its icon) | `js/art/` (`kit.js`, `figures.js`, `battle.js`, `town.js`, `worldmap.js`, `ui.js`) | Canvas drawing code, from the owner's adopted art direction (D-P10k, 2026-11-25; `docs/ART-STYLE.md`) | Code, written for this project |
| **Looks** (what each troop, companion and building is drawn as) | `data/troops.js` (`LOOKS`), `data/companions.js`, `data/town_hubs.js` (`spec`) | Plain data the art kit reads | Written for this project |
| **Home-screen icons** (Add to Home Screen, the web app manifest) | `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png` | Drawn by `scripts/make-icons.js` (`npm run icons`): the art kit's hero by their banner, rendered in headless Chromium (Playwright, a development tool) | Code output, owned by the project owner |
| **Interface** (panels, buttons, HUD, cards) | `style.css` | CSS | Written for this project |
| **Sound effects and music** (14 effects, 3 loops) | none | Synthesized live with the Web Audio API in `js/audio.js` | Code, written for this project |
| **Text** (story, dialogue, quests, help, news) | `data/*.js` | Written for this project | Project owner |
| **Font** | none shipped | The device's own Georgia (serif fallback) and system UI fonts | Not distributed |
| **Page icon** | inline in `index.html` | The ⚔️ emoji, drawn by the device's emoji font | Not distributed |

**The guard.** `tests/assets.test.js` fails if the repository ships any image but the three icons, if code or data names an image file, a sprite id or a sprite tile, or if the page reaches another site. `tests/browser/art.spec.js` walks the menus, the party sheet, the Realm screen, a town, a conversation, the map and a battle, and fails if any of them requests an image.

**Runtime dependencies:** none. The page loads only its own files: no CDN, web fonts, analytics or trackers. Development tools (`@biomejs/biome` for lint, Playwright for the browser tests and the icons) run on the developer's machine and are not shipped.

## Adding art

Art is code. To add a troop's look, a building, a prop, a part or a culture, follow `docs/ART-STYLE.md` and check it in **Debug → Art gallery**. To change the home-screen icons, change `scripts/make-icons.js` and run `npm run icons`.

## History

Until 4.14.0 the game drew characters and battle tiles from sprite sheets in `assets/`. The project owner generated them with AI through Sprite Studio, their own tool, using ChatGPT's image generation and, from 2026-11-24, the local LiliPixel V1 model. The owner adopted the code-drawn art on 2026-11-25 (D-P10k). P10-G1 to P10-G5 replaced the sprites scene by scene. P10-G6 (4.15.0) deleted all 170 images, `assets/manifest.json`, `js/assets.js` and `scripts/asset-manifest.js`.

The art requests that earlier phases listed here are all drawn by the kit now:
- rows 1, 2, 15, 16 and 17: realm troops;
- rows 3, 18 and 20: settlement icons and terrain;
- rows 5 and 14: battle ground and the assault;
- rows 6, 8, 10 and 19: banners, house arms and lords' banners;
- row 7: the trade goods;
- rows 9 and 13: holding pennants and siege camps;
- row 11: lords in battle;
- row 12 (Fief tab icons): still words, a candidate for later.

## Things to keep in mind (not legal advice)
- **Nothing generated ships.** No AI-generated image is in the game any more, so the notes this file kept on ChatGPT's and LiliPixel's terms no longer apply to a release. The old sheets are still in the repository's history, before 4.15.0.
- **The GDD's "no Pokémon" rule.** The art is a generic, warm, low-detail medieval miniature style drawn from simple shapes. It copies no character, tile or logo from an existing game.

## Credits shown in the game
How to Play → **Credits** says that the art, the map and the interface are drawn in code, that the sound is synthesized in code, and that the game uses no third-party art, music, fonts or libraries.
