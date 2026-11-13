# Crownless 0.3.0 — Gate B: The Captain's Trial

An offline-capable *after initial asset load* single-player party-battle prototype using the source sprites supplied for Crownless. No bundler, server process, or dependencies are required on GitHub Pages.

## What is playable

- Recruit infantry (20 crowns) and archers (25 crowns), limited to 15 total
- Real-time four-direction hero movement, sword attacks and frontal shield block
- Friendly infantry and archers fight alongside the player; archers fire projectiles
- Choose infantry (1) or archers (2), then **F** Follow, **H** Hold, **C** Charge
- Two waves of Road Reavers (6 then 8 enemies), victory/defeat, gold rewards and renown
- Casualties: 35% killed / 65% wounded, wounded recover on returning to camp
- Local campaign auto-save, battle event logging, FPS, asset/error diagnostics, JSON and TXT log exports
- Landscape phone controls: joystick, Attack, Block, Orders menu

### Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | WASD / arrows | Left joystick |
| Attack | Space / left click | Attack |
| Block | Shift / right click | Hold Block |
| Orders | 1 or 2 group, F/H/C order | Orders |
| Pause | Esc | Pause |
| Diagnostics | F3 | Logs |

## Publish on GitHub Pages

1. Extract this archive. Upload the **contents** of this folder to the root of your existing repository, replacing older files. Keep `.github/`, `assets/`, `index.html`, `style.css` and `game.js` together. Old unused assets from version 0.2 can be deleted.
2. Commit to `main`.
3. Under Settings → Pages, select **GitHub Actions** as the source.
4. Open the published site and hard-refresh (Ctrl+Shift+R) if an older copy appears.

Assets use paths relative to `index.html` and work from a project URL such as `https://username.github.io/crownless-mvp/`.

## Known limits

This is **Gate B**, not the complete campaign. There is no strategic map, trading, quests, saves export/import, or cavalry yet. Ally command behavior is simple and not a formation simulator. The sprite crops are extracted from the Sprite Studio assets; some animations are not yet hand-aligned. Local browser saves can be cleared. Playtesting on your browser and phone remains necessary.
