# Crownless — integrating the storybook look (P11-12, D-P11m)

_Written in P11-12a (5.11.1), 2026-11-27, against 5.11.0 (commit ff54781). The analysis behind the expanded P11-12 (NEXT-TASKS "P11-12"): what the owner's developer handoff contains, what of it is a requirement, which native contracts must not move, how the prototype maps onto the game's renderer, and what the prototype leaves undone._

## 1. The handoff

`crownless-developer-handoff-v07.zip` (the owner's, 27 November 2026, prepared against 5.8.0, commit a4bc297) sits in the repository root, git-ignored; P11-12a unpacked its references to `art-reference/storybook-v07/` (local only, like the rest of `art-reference/`).

| Part | What it is | Status for the game |
|---|---|---|
| `reference/approved-stonebridge-target.png` | A generated concept of Stonebridge's streets | **Definitive environmental direction** (D-P11m). Its HUD numbers and positions are illustrative |
| `character-workshop.html`, `code/character/characters.js` (`CLStorybook`) | The approved v0.7 character prototype: 8 presets, 11 preview animations, portraits | **Definitive character design.** Its 100-unit canvas, its preview timings and its Path2D strings are not the game's |
| `art-gallery.html`, `previews/*.png`, `walk-combat.gif` | Standalone studies of eight towns, eight battlefields, the map, an asset sheet | Illustrative; the target is stronger than the studies (their own README says so). Layouts are not the game's |
| `code/environment/js/indie-art.js`, `indie-icons.js`, `icons/*.svg`, `css/indie.css` | Environment, icon and UI prototypes, installed by monkey-patching `CL.gfx` | Geometry and palette ported by hand into the native functions; **the installer and the patches are not used** (they stack overrides, compute palettes too late and are untested on newer builds) |
| `code/integration/civilian-adapter.example.js` | A civilian-only adapter keyed by display names | Not used: identity comes from stable ids and the look data |
| `docs/ART-DIRECTION.md`, `IMPLEMENTATION.md`, `ACCEPTANCE.md` | The visual rules, a file-level brief, the review checklist | Folded into P11-12's subtasks and this document; ACCEPTANCE's checklist is the review list for P11-12b–e |

## 2. What is required (from the references)

**Characters (v0.7):**
1. Full-body figures, never a portrait on legs: neck, rounded shoulders, two-segment arms ending in hands, hips, separate legs and boots; garments overlapping the joints; a few seams, a belt, a collar.
2. Slightly oversized, soft heads; tiny clear features: eyes with a light iris and a catch-light, short brows, a small nose, a short mouth line; facial hair as shapes of their own.
3. **Profiles:** one eye, the nose in the outer contour, a clean jaw, **no ear**; the west view is the whole east view mirrored; the rear view shows the back of the hair or helmet.
4. **A slightly raised view:** crowns, shoulders and feet seen a little from above; the far foot and far shoulder higher on the screen in profile; the 0.875 vertical foreshortening of v0.7 applies to the drawing, never to a position, hitbox or aim.
5. **Modular and data-driven:** face shape (round, oval, broad), eyes, brows, nose, mouth, facial hair, hair, skin, hats, helmets, clothes, cloak, boots and equipment are interchangeable layers; the same person has the same features from every side and in the portrait; actual items decide the weapon, shield, armour and helmet.
6. Warm outlines (`#403025` for people), never black; base, one shade on the lower right, an optional small highlight on the upper left.

**Environment (the concept):** the meadow palette (meadow `#96ad79`, tree crown `#668c43`, road `#d9bf92`, cobble `#d8c6a2`, plaster `#f0d9aa`, timber `#65472f`, stone `#b8b0a0`, terracotta `#bd7655`, slate `#75849a`, thatch `#d5ad60`, water `#76a9bb`; outline `#49352a`); buildings from wall, roof, door, window, chimney, trim and sign planes with tile rows, stone courses, beams and braces; framed four-pane windows, plank doors with round heads, a curved awning; cobbles as individual stones; rounded organic tree crowns; restrained props.

**Interface:** navy (`#152638`), warm gold (`#e5bd67`) and cream (`#f1e2c1`), serif headings; a compact HUD; smaller, quieter touch controls with 44–48 px targets; debug tools in their own layer.

**Rejected:** portraits on legs; ears (large or any) in profile; flat horizontal side views; geometric silhouettes; complex illustration; images.

## 3. The native contracts that do not move

| Contract | Where | Why it matters |
|---|---|---|
| `G.fig.figure(ctx, x, y, look, pose)`, `horse(ctx, x, y, H, P, rider)`, `fallen(ctx, x, y, L, alpha, dir)` | `js/art/figures.js` | Every scene, the gallery, the creator and the map call them (33 call sites) |
| The pose vocabulary: `face`, `walk`, `move`, `t`, `atk {phase, k}`, `guard`, `press`, `broken`, `stagger`, `draw`, `shot`, `hit`, `mounted`, `hface`, `aim`, `work`, `talk`, `reduced`, `scale` | `js/art/battle.js` `poseOf`, `js/art/town.js` | The only path from the simulation to the drawing; `atk` comes from `CL.profile.attackProgress(u)` (each weapon's own timing) |
| `weaponArm(L, P, face)` → hand and angle; `weaponTip(L, P)`; `shieldPos` | `figures.js` | The glint is drawn at `weaponTip`; the hand, the weapon and the glint must agree |
| The anchor: (x, y) between the feet; about 38 px tall at scale 1 (`BODY`); the mounted seat 13 px up | `figures.js` | Sorting by y, rings, health bars (`marks`, 46 px above the feet), the bake boxes (40×58 foot, 52×70 mounted, ×1.12) |
| The look vocabulary (`CL.content.LOOK`) and its checks (`lookAgrees`, `checkItemLook`) | `js/content.js` | Packs and content tests; a new part is a vocabulary change |
| Look keys and signatures (`L.key`, `L.sig`), the bake LRU (3,000) | `battle.js`, `kit.js` `cached` | The bake-key bound (`tests/art-gear.test.js`) |
| Building specs inside footprints (`specOf`, `G.building(ctx, b, t, night)`), town footprints, spawns, exits, NPC anchors | `js/art/town.js`, `data/town_hubs.js` | Collision is the footprint; nothing art adds may block |
| `portrait(ctx, x, y, w, L, opts)`, `portraitUrl`, `soldierLook`, `lordLook`, `speakerLook`, `heroLook` | `js/art/ui.js` | Every screen's faces, cached by look |
| `G.ui` icons and `itemIcon` | `js/art/ui.js` | The sheet, armoury, blacksmith, Prepare and market |

## 4. Mapping v0.7 onto the rig

- **Units.** v0.7 draws a 100-unit person (feet at 0, the crown of the head near −96) and then squashes it by 0.875. The rig is about 38 px tall, so the storybook layers are drawn in v0.7's units inside `ctx.scale(K, K × 0.875)` with **K = 0.45** (100 → 45; 96 × 0.875 × 0.45 ≈ 38 px). The shoulders land at about −22 px and the hands at rest at about −13 px, where the rig's already are.
- **Hands are the rig's.** The hand positions and weapon angles stay `weaponArm`'s (rig pixels, from the real phase); the storybook arm is drawn from its shoulder to that hand with a bent elbow, so the weapon, `weaponTip` and the glint stay together. The weapons keep their rig lengths (reach is drawn as before) and get the storybook's shapes and outline.
- **Paths.** v0.7's SVG path strings become direct canvas path calls (no `Path2D` parsing per frame; the Node tests' counting context records them), with the same curves.
- **Directional parts.** Three views are drawn (front, back, east profile); west mirrors east (the rig already mirrors the whole figure for `left`).
- **Faces and portraits.** One `features(L)` gives face shape, eyes, brows, nose, mouth and facial hair from the look (its seed, or a portrait's explicit `face` and `beardKind`), so the street, the battle and the portrait agree. The portrait is the same parts at bust framing.
- **Environment.** The palette and the building, cobble, tree and prop shapes go into `kit.js`'s own functions (no overrides); a town's `art: 'storybook'` flag selects the new building drawing in P11-12b, and the flag goes in P11-12c.

## 5. What the prototype leaves to the integration

| Gap | Resolved in |
|---|---|
| Native combat timing (windup, active, recovery from each weapon's profile); the prototype's preview curves are not used | P11-12b (the rig's `weaponArm` and `attackProgress`) |
| Every weapon family and item: the prototype draws only a sword, a spear and a bow | P11-12b (sword, greatsword, axe, greataxe, mace, club, hammer, spear, pike, lance, staff, bow, recurve, crossbow, arbalest) |
| Every helmet and hat in all three views: the prototype draws six | P11-12b (nasal, plumed, crest, spangen, kettle, great, bascinet, sallet, cap, hood, furhat; brim, cap, kerchief, coif; a ruler's crown) |
| Shields of every shape on the arm, guarded, pressed, broken, slung on the back; quivers; two-handed grips; gloves | P11-12b |
| Mounted riders and horses (none in the prototype) | P11-12b (a storybook horse in profile, the rider's seat and weapons) |
| The fallen; stagger; hit; the smith's work; talk; reduced motion | P11-12b |
| Rear-facing dress and cloak motion | P11-12b |
| Large-battle cost: per-frame path work for hundreds of fighters | P11-12b (baked frames as now), P11-12e (measured and fixed) |
| The other seven towns, every battlefield and siege, the map, miniatures | P11-12c |
| The UI language on every screen; icons by item look; landscape phones | P11-12d |
| Visual regression baselines and real-device performance | P11-12e |

## 6. The review list (each subtask)

ACCEPTANCE.md's design gate, game-parity gate, screenshot matrix and technical gates, applied to the subtask's scope: the real game's screenshots beside the references (960×540 and 812×375); the same person recognisable front, east, west, rear and in dialogue; no ear in profile, no disconnected hand or leg, no facing mismatch; feet on the ground and shadows aligned; readable at about 40 px; identical seeded results (`tests/sharpness-parity.test.js`, the golden battles); footprints, exits and anchors unchanged; no image, no new dependency; frame-time percentiles against P11-12a's baseline.
