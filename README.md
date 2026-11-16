# Crownless 0.4.0 — Gate B: The Captain's Trial

A single-player, top-down party-battle prototype in plain HTML5 Canvas and classic JavaScript. There's no bundler, no runtime dependencies and no server. It's published to GitHub Pages straight from `main`.

- **Design spec:** [`Crownless_MVP_GDD_v1.md`](Crownless_MVP_GDD_v1.md). The engine is HTML5 Canvas, not the Godot the spec recommends.
- **Current behavior (regression reference):** [`docs/BASELINE.md`](docs/BASELINE.md)
- **Status and plan:** [`docs/ROADMAP.md`](docs/ROADMAP.md)

## What is playable

- Recruit infantry (20 crowns) and archers (25 crowns), up to 15 troops in total.
- Real-time four-direction hero movement. Sword swings have a visible windup, a strike window and a recovery, and hit everything in a 90° arc in front of you.
- A frontal shield block that covers 120°. It can't cancel a swing you've already started, and enemy windups are drawn in red so you know when to block.
- Allied infantry and archers fight alongside you, and archers fire arrows.
- Pick a group with **1** (infantry) or **2** (archers), then give an order: **F** Follow, **H** Hold or **C** Charge.
- Two waves of Road Reavers (6, then 8), ending in victory or capture, with gold and renown rewards.
- Casualties: 35% of fallen troops are killed and 65% are wounded. Wounded troops recover when you return to camp.
- The game auto-saves in the browser. A diagnostics panel (F3) shows logs and can export them as JSON or TXT.
- Landscape phone controls: joystick, Attack, Block and an Orders menu above them. The game pauses when you switch away and asks you to rotate in portrait.
- Gate A details and phone-test checklist: [`docs/GATE-A-VALIDATION.md`](docs/GATE-A-VALIDATION.md)

| Action | Desktop | Touch |
|---|---|---|
| Move | WASD / arrows | Left joystick |
| Attack | Space / left click | Attack |
| Block | Shift / right click | Hold Block |
| Orders | 1 or 2 group, F/H/C order | Orders |
| Pause | Esc | Pause |
| Diagnostics | F3 | Logs |

## Project layout

```
index.html        page shell; loads data/ (later) and js/ as classic deferred scripts
style.css         layout, HUD and touch controls
js/               game runtime, attached to window.Crownless
  core.js         constants, math helpers, diagnostics log
  state.js        live game state (CL.game)
  save.js         localStorage save (schema v1)
  assets.js       sprite preloading and frame tables
  units.js        unit stats, facing, movement
  combat.js       waves, attacks, AI, arrows, win/loss
  party.js        recruiting, battle results, recovery
  ui.js           overlays, roster, pause, diagnostics panel
  render.js       canvas drawing and HUD
  input.js        keyboard, mouse, touch buttons, joystick
  main.js         boot and main loop (loads last)
data/             content definitions (window.CROWNLESS_CONTENT), not yet used by the runtime
assets/           sprite PNGs (u#### units, w#### world tiles)
tests/            node:test suite (no dependencies)
```

Script order in `index.html` matters, because each module uses the ones loaded before it.

## Develop

You need Node 22 or later, and only for the dev tools. The game itself needs nothing.

```bash
npm run serve
```

Then open http://localhost:8123. Opening `index.html` directly from disk also works.

```bash
npm test
```

```bash
npm run lint
```

The tests load the logic modules (`core` → `party`) and the `data/` files into a Node `vm` sandbox with the UI stubbed out, so no browser is needed. The rendering and input code is checked by playing the game.

## Deploy

On every push to `main`, [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs the tests and lint, then publishes the repository root to GitHub Pages. Pull requests run the checks only. In the repository settings, under **Pages**, set the source to **GitHub Actions**. If the browser shows an old copy after a deploy, hard-refresh with Ctrl+Shift+R.

## Known limits

This is Gate B, not the full campaign. There is no strategic map, trading, quests or save export/import yet, and no cavalry. Ally commands are simple, not a formation system. The sprite crops come from the Sprite Studio assets, and some animations are not yet hand-aligned. Browser saves can be cleared by the browser.
