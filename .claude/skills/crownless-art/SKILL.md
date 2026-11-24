---
name: crownless-art
description: Make Crownless sprites with the local Crownless Sprite Studio v0.7.2 CLI, through ComfyUI, using two backends. LiliPixel V1 makes native 16×16 / 32×32 sprites (small props, icons, terrain details, markers). The two-step FLUX.2 Klein pipeline (Stage 1 draws the subject, Stage 2 restyles it with a Crownless reference board) handles larger, complex or non-square sprites (about 48 px and up, buildings, fortifications, trees, characters, equipment) and is the fallback when LiliPixel can't make a small sprite readable. Every candidate gets a fixed camera prompt and a mandatory style-fit check against the owner's reference images. If both generation attempts fail, Claude hand-draws the sprite as pixel art (pixel_draw.py). Use it without asking whenever an active development task needs sprites, and whenever the user asks for game art, sprite candidates, export sizes or a contact sheet. The owner gave standing authority to approve, integrate and overwrite sprites, provided the repo is committed first so changes can be reverted.
---

# Crownless art: operating Sprite Studio (LiliPixel + FLUX)

Sprite Studio is a separate local tool. Call its CLI through the shell. Never copy its code into this repo, wrap it in an MCP server, install anything for it, or edit its files without the owner's permission. The Studio folder isn't a git repo, and its only backups are the ZIPs in `D:\Crownless Sprite generator\`.

| What | Where |
|---|---|
| Sprite Studio **v0.7.2** | `D:\Crownless Sprite generator\crownless-sprite-studio` |
| CLI (`$CLI` below) | `py "D:\Crownless Sprite generator\crownless-sprite-studio\cli.py" <command>`, using Windows Python 3.11, **not** ComfyUI's embedded Python. Set `PYTHONIOENCODING=utf-8` |
| Studio's own docs | `AGENT-CLI.md`, `FLUX-SETUP.md`, `README.md`, `REFERENCE-QUALITY.md` in the Studio folder. **Re-read them, and `cli.py`, whenever the version changes.** Never assume older commands still work |
| FLUX graph (fixed, 36 nodes) | `workflows\crownless-flux-two-step-api.json`. Stage 1 text node `204` → subject save `213`; Stage 2 text node `409`, subject in via `411`, board via `LoadImage 398`/`385`, refined save `399` |
| Style boards | `refs\boards\crownless-{props,buildings,characters,vegetation,fortifications,ui}-style-board.png`, built only from the owner's six images. Their crops are in `refs\crownless-v2\manifest.json` (74 crops) |
| Candidate library | `library\`: `<ID>-raw.png` (LiliPixel output or FLUX Stage 2), `<ID>-stage1.png` (FLUX only), `<ID>.json`, and `prepare-flux` derivatives `<ID>-processed-WxH.png(.json)` |
| Preview helper (this skill) | `.claude\skills\crownless-art\preview.py`: export-size previews, reference crops beside the candidate (`--ref`), and the game-scale sheet (see *Export sizes*). Takes `--id` (Studio candidate) or `--png` (any file) |
| Hand-drawn fallback (this skill) | `.claude\skills\crownless-art\pixel_draw.py`: renders a pixel grid I write into a PNG (see *Escalation and the hand-drawn fallback*) |
| ComfyUI | `http://127.0.0.1:8188`, started by the owner with `run_nvidia_gpu.bat`. Never start, restart or reconfigure it, and never download models |
| Owner's target look | `art-reference\` (six images plus `README.md`). Git-ignored, local only |
| Workspace (git-ignored) | `art-work\` with `recipes\`, `sheets\`, `log\`, `exports\` |

Every command prints `{"ok": true, "data": ...}`, or `{"ok": false, "error": ...}` with exit code 1. Parse the JSON; don't guess.

## Authority (owner's standing grant, 2026-11-24)

The owner said: *"you have free reign to overwrite and use whatever, just need to commit so i can revert if needed."*

- **I may start generation myself** whenever an active development task needs sprites, provided ComfyUI is already running. I say in my message which asset, which backend and why.
- **I may choose, integrate and overwrite sprites in `assets\`** and wire them into the game data (`js/assets.js`, `data/`), without asking first.
- **Before any overwrite or integration:** the working tree must be committed. I commit the current state first and push it to GitHub, since the owner said "commit to github". The art change then goes in **its own commit**. Its message names the old and new file, the candidate ID, the backend and the export method, so a single `git revert` undoes it.
- **Limits that stay in place:**
  - `assets/w0200.png` stays untouched (the owner's approved crate).
  - **No renderer change** (`js/render.js`, `js/ui.js` draw code) just to make a generated image fit, without the owner's permission. Pick an export size that works with the current draw boxes instead.
  - **Never commit experimental outputs.** Candidates, previews, logs and sheets stay in `library\` or `art-work\`. Only the chosen final PNGs go into `assets\`.
  - **The generation budget** below.
- **The Studio's `approve --human-reviewed` flag asserts that a human reviewed the image.** I don't set it, because that would put a false statement in the record. Integration doesn't need it. My choice is recorded in the log, the commit and `assets/manifest.json` instead.
- **Every batch is still reported to the owner** (*Presenting a batch*), with Stage 1, Stage 2 and the game-scale preview, even when I've already integrated it. The owner can revert.

## Hard rules

1. **Two generation backends only, both through this CLI:** LiliPixel (`generate`) and FLUX (`flux-pipeline`). The only other source is my own hand-drawn pixel art, used as the fallback after attempt 2 (*Escalation*). Never call ComfyUI directly. Never use the SDXL/IP-Adapter path or the legacy `flux-generate` / `flux-generate-two-step` commands. Their recipes point at missing workflow files and excluded `crownless-v1` crops.
2. **Be honest about conditioning.** LiliPixel is text only (`reference.used: false`). FLUX Stage 2 *is* conditioned on a style board (`reference.used: true`), but that doesn't guarantee pure style transfer. Check every Stage 2 result for objects copied from the board and for a changed silhouette, and report what I see.
3. **References:** only the owner's six images, the bundled boards built from them, or single curated crops (`ref:<id>` from the manifest). Never use generated images or web images as references.
4. **Budget:**
   - At most **4 candidates per attempt** and **2 generation attempts per asset**, unless the owner authorises more for that asset.
   - `flux-pipeline` makes **one candidate per call**, so an attempt is up to 4 calls with different seeds.
   - **Re-exporting the same image at another size, crop, palette or background tolerance is not a new attempt.**
   - One generation at a time.
5. **Record everything** in `art-work\log\<slug>.md` (*Log format*).
6. **Look at the actual PNGs**: Stage 1, Stage 2 and every export, at native size and enlarged with nearest-neighbour, plus the game-scale sheet. If I can't see an image, I say so.
7. **Validation is technical only.** PASS/WARN/FAIL say nothing about style, camera or readability.
8. **Never distort proportions.** Scale uniformly, never stretch. Pad with transparency, anchor at bottom centre, and keep the aspect ratio. See *Export sizes*.
9. **Keep the originals.** Never edit or delete `-raw.png`, `-stage1.png` or the record JSON. All processing writes new files.

## Choosing the backend

First work out the sprite's **on-screen size** from the code (the table below), then decide:

| Situation | Backend |
|---|---|
| Shown at about ≤ 40 px, simple shape (pebble, tuft, flower, coin, map pin, marker, trade-good icon, crate, barrel, sack, sign, small shrub) | **LiliPixel 32** (16 for ≤ 20 px, one-blob subjects). Native pixels, cheapest |
| Shown at about ≥ 48 px, **or** complex construction (well with crank, cart, stall, building, gate, tower, wall run, large tree, figure, weapon or equipment) | **FLUX** |
| Non-square (tall tree, tower, character, wide wall or cart) | **FLUX** (LiliPixel only makes square canvases) |
| Needs the Crownless look specifically (matching the reference sheet's outlines and palette) | **FLUX** with the matching board |
| A LiliPixel attempt came out unreadable, distorted, sideways or wrong | **FLUX as the fallback.** That counts as attempt 2 for the asset unless budget is left |
| UI art (frames, panels, icons in the navy/gold/crimson/cream language) | **FLUX** with `crownless-ui-style-board`. 16/32 icons can try LiliPixel first |

These thresholds are guides, not rules. What decides is how the sprite reads at its real draw size beside the art around it.

### Draw sizes in the current game (game units; the battle canvas is 960×540, scaled by CSS)

| Use | Drawn at (code) | Current source PNGs |
|---|---|---|
| Rock and crate obstacles | `look {w,h}` 40×30, 38×30 (`data/battle_maps.js`); canvas `crate` look 40×40, 44×38 | `w0001`–`w0012`, about 22–34 px |
| Decor | `[tile,x,y,w,h]`: 34×25 … 65×72; fences 52×37 | `w0091` 42×70, `w0121` 86×61 |
| Large tree obstacle | 92×97 | `w0132` 120×126 |
| Ground tile | 65×65 | `w0000` |
| Infantry, archers, NPCs | 37×43 (`js/render.js`, `sh = 43`) | about 26–36 × 33–50 |
| Hero / mounted | 58×74 / 42×62 | about 50–66 × 55–74 |
| Companion portrait | 56×80 (`js/ui.js`) | |
| Town buildings and stalls | canvas looks: `tavern` 220×120, `stall` 110×60, `house` 150–190 × 95–110 (`data/town_hubs.js`) | none (drawn in code) |

`drawImage(img,x,y,w,h)` **stretches any PNG to its box**, with smoothing off. So a new PNG must be **exactly** the box size, or match the box's aspect ratio exactly, or it gets distorted. Otherwise the box in `data/` must change to the PNG's size. That's a data change I may make; a renderer change is not.

## LiliPixel (native 16/32)

```powershell
$CLI status                                   # data.connected and data.lilipixel.ready must be true
$CLI generate --dry-run --spec <recipe.json>  # format check only
$CLI generate --spec <recipe.json>            # blocking, 10-minute timeout; returns ids, source_png, metadata_json, sha256
$CLI prepare-native --id <ID>                 # native-size RGBA export into library\, validated vs native_<category>_<res>
$CLI validate --id <ID>                       # re-validate the prepared export (read-only)
$CLI contact-sheet --ids <IDs> --output art-work\sheets\<slug>-a<N>.png --tile 256
```

Recipe (`art-work\recipes\<slug>-a<N>.json`; unknown fields are rejected):
- Fields: `name`, `category` (`character|building|prop|vegetation|fortification|terrain|banner`) and `description` (the prompt, under about 96 tokens), plus optional `extra`, `profile`, `facing` (metadata only), `resolution` (16|32|64), `batch_size` (≤ 4 for me), `seed`, `mode` (`auto|sprite|scene|realistic|raw`), `steps` (30 for 16/32, 50 for 64), `cfg` (3.0), `background` and `alpha_cutoff` (0.5).
- Prompts are short free text, written fresh for each asset.

**64 px is not LiliPixel territory.** Its 64 output is opaque and blurry. Use FLUX for anything that needs 64.

**Palette check in v0.7.2:** the v0.5.3 effective-palette REVIEW status is **not installed** (see *Known Studio limitations*). LiliPixel output carries invisible ±1–8 RGB jitter, so 32 px candidates usually show 300+ raw colours and `prepare-native` reports **FAIL `PALETTE`**. I report that as "palette FAIL (raw count, probably jitter)", not as a broken sprite. To ship one, I make a palette-reduced derivative with `preview.py --method nearest --bg-tolerance 0 --colors 32 --sizes 32x32`. That's an exact-size copy with merged colours, so I compare it against the raw image before using it.

## FLUX two-step pipeline

```powershell
$CLI status                                                    # ComfyUI connected
py -c "import sys;sys.path.insert(0,r'D:\Crownless Sprite generator\crownless-sprite-studio');import flux_two_step,json;print(json.dumps(flux_two_step.status(True)))"   # FLUX ready: workflow_ready, missing_models == []
$CLI flux-pipeline --dry-run --spec <recipe.json>              # validates graph, prompts, board and sizes; no GPU
$CLI flux-pipeline --spec <recipe.json>                        # blocking (allow 30 min); ONE candidate
$CLI inspect --id <ID>                                         # record.pipeline.stage1 / stage2, generation settings
```

Recipe (`art-work\recipes\<slug>-a<N>-s<k>.json`). The allowed fields are exactly these:

| Field | Rules |
|---|---|
| `name`, `category` | Required. The category picks the validator defaults only |
| `draw_prompt` | **Stage 1, WHAT to draw.** 5–2500 characters |
| `style_prompt` | **Stage 2, HOW to draw it.** 5–2500 characters |
| `style_board` | One of the six board IDs, `board:<id>`, or `ref:<crop id>` for a single curated crop. Default props |
| `width`, `height` | Each of 384, 512, 640 or 768 (the **source** size, not the sprite size). Use 512×512 for square props. Portrait 512×768 for tall subjects (trees, towers, characters), landscape 768×512 for wide ones (walls, carts, stalls) |
| `seed`, `style_seed` | 0 … 2^64−1. Independent. Default 42 |
| `facing` | Metadata only |

**Stage 1 prompt (what).** Build it from three parts, in this order:
1. **Subject:** one isolated object, unless a scene is asked for. Its silhouette, construction, materials, colours and any equipment.
2. **The camera block for its shape**, copied word for word from *Camera prompt blocks*. Never improvise the angle.
3. **The background block:** "Centered on a plain flat light-grey background, no ground, no grass base, no cast shadow, no other objects."

Stage 1 never uses a reference image.

**Stage 2 prompt (how).** Start from the base text below and adapt it per asset. Always keep the camera and light sentence. Name the colours the references use for its materials (see *Style-fit check*). For example, "weathered grey-brown timber, not uniform red-brown", "iron fittings dark grey, not black".

> Image 1 is the only subject. Keep its exact silhouette, proportions, construction, position and camera angle: the raised game camera looking down at about 35 degrees, front face toward the viewer, top surfaces visible. Light comes from the upper left: top surfaces lightest, the front mid-tone, undersides and the right edge darkest. Image 2 is a Crownless pixel-art style reference only. Redraw image 1 as rugged Western medieval pixel art like image 2: chunky readable pixel clusters, a 1-pixel near-black dark-brown outline, two to four shading steps per material, muted earthy colours, no smooth photographic texture, no gradients. Keep the plain flat background. Do not copy, add or merge any object, label, frame or scenery from image 2.

Add per-asset guards, for example "no barrels, no sacks, no signpost" when the props board holds them.

**Picking the board:**

| Asset | Board |
|---|---|
| Wells, troughs, barrels, crates, carts, rubble, camp and market props | `crownless-props-style-board` |
| Houses, inns, smithies, stalls, roofs | `crownless-buildings-style-board` |
| Walls, gates, towers, palisades | `crownless-fortifications-style-board` |
| Trees, bushes, shrubs | `crownless-vegetation-style-board` |
| Soldiers, NPCs, figures, equipment on a figure | `crownless-characters-style-board` |
| UI frames, panels, buttons, portraits frames | `crownless-ui-style-board` |
| A near match exists as one crop | `ref:<id>` (for example `ref:prop-stone-well`). Stronger guidance, higher copy risk |

**Seeds:** within one attempt, vary `seed` (for example 4101, 4102, …) and keep `style_seed` fixed, so the candidates differ in subject but not in styling. To restyle a good subject, a later attempt can keep `seed` and change only `style_seed` or the Stage 2 prompt. Since the graph runs both stages, that regenerates Stage 1 with the same seed. Check that its hash matches the earlier `pipeline.stage1.sha256`.

**Check each candidate separately, stage by stage:**
- **Stage 1:** is it the right subject, silhouette and camera?
- **Stage 2:** compared with Stage 1, is the geometry kept? Did it gain board content (objects, labels, navy panel background)? Is the style closer to `art-reference\`?

Diagnose by stage. A wrong subject or camera is a Stage 1 problem: fix `draw_prompt` or `seed`. Lost geometry, copied objects or wrong style is a Stage 2 problem: fix `style_prompt`, `style_board` or `style_seed`.

## Export sizes (FLUX, and LiliPixel derivatives)

Never assume 32 or 64. Pick candidate sizes from where the sprite is drawn (*Draw sizes*) and what's around it, then compare them **from the same source image**:

1. **Candidate sizes:**
   - The real draw box, if a PNG of exactly that size fits it: 40×30 obstacle, 37×43 unit, 52×37 fence.
   - The neighbouring source sizes (32, 40, 48, 64; trees 92×97 or about 120).
   - For non-square subjects, a box with the subject's own aspect ratio.
2. **Make the previews** (non-destructive; reads `library\`, writes only to `art-work\`):
   ```powershell
   py .claude\skills\crownless-art\preview.py --id <ID> --sizes 32x32 48x48 64x64 --out "D:\Crownless-MVP\crownless-mvp\art-work\sheets\<slug>"
   ```
   It removes the flat background (`--bg-tolerance 24`; 0 keeps it) and trims to the subject. It then scales **uniformly** with an area filter (`--method box`, much cleaner than nearest at 512 → 64), makes alpha binary, merges the palette (`--colors 32`; 0 keeps it) and places the sprite bottom-centre with `--padding 1`. Use `--crop L T R B` (0–1) to cut stray content first, and `--neighbors w0012:40x30 w0132:92x97` to choose the art compared on the game sheet. Output:
   - `<ID>-WxH.png`: the candidate production files.
   - `<ID>-compare.png`: Stage 1 | Stage 2 | each size at 1× and enlarged.
   - `<ID>-game.png`: every size on the battle ground tile beside current art, at 1:1 game units, ×3.
   - `<ID>-preview.json`: method, hashes, and a validation per size against a profile for **that** size.
3. **The Studio's own derivative** (`$CLI prepare-flux --id <ID> --width W --height H --remove-background [--tolerance 12] [--padding N] [--colors N] [--crop L T R B]`) uses nearest-neighbour from 512 px. It gives speckled pixels and hundreds of colours unless `--colors` is set, and it **always FAILs `DIMENSIONS` unless the size equals the category default** (prop/building/vegetation/fortification/banner 96×96, character 48×64, terrain 32×32). Use it only to cross-check, and say why its FAIL is expected.
4. **Compare and choose:**
   - Is the critical detail still there (crank, door, weapon)?
   - Are the pixel clusters clean?
   - Does the size match its neighbours (not oversized next to `w0012` rocks or 37×43 units)?
   - Is the outline weight consistent?
   - Is the foot or contact line clear?

   If 32 loses critical detail, try 40/48/64 **from the same source** before generating again. Don't go larger than the surroundings justify.
5. **Non-square:**
   - Pick W×H from the subject's trimmed aspect and its draw box.
   - The sprite is scaled to fit inside, never stretched, with transparent padding on the short axis.
   - For characters, keep the 37×43 box (or 58×74 hero) and the shared foot line.
   - Several frames of one character need the **same** size, scale and anchor. Run `preview.py` with identical settings for each, and check the foot lines line up.
6. **Background removal keys on flat, edge-connected colour.** Background *enclosed* by the subject (inside a frame or rack, between legs) stays as a solid panel. Add `--key-holes` to also clear pixels within tolerance of the corner colour anywhere, then check it didn't eat parts of the subject in a similar colour. It keeps cast shadows and textured or gradient backgrounds, and can eat parts of the object that match the background. If the shadow survives, either accept it (the reference sheet has none, so it's usually unwanted) or crop or regenerate with "no cast shadow" in Stage 1. A shadow is a background-removal problem, not a style problem.

## Diagnosing problems: fix the cheapest layer first

| Problem | Where it comes from | Fix (no new generation unless stated) |
|---|---|---|
| Wrong subject, extra objects, wrong camera in Stage 1 | Generation | New Stage 1 prompt or seed (an attempt) |
| Stage 2 copied board objects or changed the silhouette | Style transfer | Stricter `style_prompt`, other board or `ref:`, new `style_seed` (an attempt) |
| Style far from `art-reference\` | Style mismatch | Board choice or Stage 2 wording (an attempt) |
| Background or shadow left, edges eaten | Background removal | `--bg-tolerance`, `--crop` (re-export) |
| Speckle, hundreds of colours, palette FAIL | Palette / pixel clusters | `--method box`, `--colors 16–48` (re-export) |
| Detail lost or too big beside neighbours | Scaling / export | Another size from the same source (re-export) |
| Reads poorly in play (blends with ground, mistaken for another object, unclear footprint) | Gameplay readability | Size, palette contrast or crop first; a new generation only if the subject itself is wrong |

Don't reject a good FLUX result because its first downscale looks bad. Try the other sizes and settings first.

## Camera convention

The Crownless view is the classic GBA/JRPG oblique, measured from `art-reference\01-sprite-reference-sheet.webp`:
- **The camera is raised about 35° above the ground and looks north.** The front face dominates, and **the top surface is always visible**.
  - Box props (crates, the trough, the well roof) show a top band about **⅓ of the front face's height**.
  - Round tops (barrels, the well, stumps) are ellipses about **⅓ as tall as they are wide**.
  - Post and log ends show their cut tops.
- **Square to the screen:** walls, gates, fences, the well, banners and signs. **A sliver of the right side** is allowed only on buildings, the crate stack and the cart.
- **Never:**
  - a corner pointing at the camera (isometric diamond)
  - a flat side or front elevation with no top visible
  - a view from straight above
  - perspective convergence or a fisheye look
- **Light from the upper left.** Outline near-black brown, not pure black.
- **Props have no ground base.** Buildings stand on a small grassy footprint.

The existing game art follows the same view: the `w0121`/`w0174` fences, the `w0132` tree, the `w0110` cliff, the `u####` units, and the renderer's "front face + lighter top" canvas looks.

**Known failures and their cause:**

| What happened | Prompt that caused it |
|---|---|
| Crate turned to a corner | "three-quarter top-down" |
| Steep overhead well | "three-quarter overhead game camera" |
| Flat elevation with no visible top (the weapon rack, 2026-11-24) | "seen from the front and slightly above": too weak |

That's why prompts use the fixed blocks below and never the words "three-quarter", "3/4", "isometric", "overhead" or "top-down".

### Camera prompt blocks (copy word for word)

| Subject shape | FLUX Stage 1 camera block |
|---|---|
| **Box or frame** (crate, chest, rack, cart, stall, trough, sign, bench, table) | "Classic 16-bit role-playing game camera: viewed from the front and above, the camera raised about 35 degrees and looking down at the object. The front face points straight at the viewer and fills most of the image; the top surface is clearly visible as a band about one third of the front's height. The object is square to the viewer, not rotated; no corner points at the viewer. Orthographic, no perspective distortion." |
| **Round** (barrel, well, stump, pot, haystack, tent) | "Classic 16-bit role-playing game camera: viewed from the front and above, the camera raised about 35 degrees and looking down. The round top is visible as a flattened ellipse about one third as tall as it is wide. Orthographic, no perspective distortion." |
| **Tall** (tree, tower, post, banner on a pole, statue) | "Classic 16-bit role-playing game camera: viewed from the front and slightly above, the camera raised about 35 degrees. Upright and facing the viewer; any top surface (cut log ends, tower top) visible as a narrow band. Orthographic, no perspective distortion." |
| **Long or wall** (wall run, fence, palisade, hedge) | "Classic 16-bit role-playing game camera: viewed from the front and above, the camera raised about 35 degrees. The run is parallel to the image, its front face toward the viewer and the top of the wall visible as a narrow band. Not angled away; orthographic, no perspective distortion." |
| **Building** | "Classic 16-bit role-playing game camera: viewed from the front and above, the camera raised about 35 degrees. The front wall with the door faces the viewer, the roof slopes are clearly visible from above, and a small part of the right side wall is visible. Not a corner view; orthographic, no perspective distortion." |
| **Flat on the ground** (rug, puddle, path stones, fire pit) | "Classic 16-bit role-playing game camera: the camera raised about 35 degrees looking down, so the flat object is seen mostly from above, foreshortened to about half its depth. Orthographic." |
| **Figure** (soldier, NPC, animal) | "Classic 16-bit role-playing game character: standing upright, facing the viewer, full body from head to feet, about three heads tall (not chibi, not realistic), seen from the front and slightly above. Feet at the bottom of the figure; arms and equipment readable. Orthographic." For other directions, replace "facing the viewer" with "seen in true side profile facing left/right" or "seen from behind". |

**LiliPixel (about 96 tokens, so keep it short):** add "front view from above, top surface visible, facing the camera" for box, round and flat shapes, or "front view, upright, facing the camera" for tall ones and figures.

**After generating, always check the angle on Stage 1 *and* the final export.** Is the top visible in the right proportion, is the front square to the viewer, and is there no corner, overhead view or flat elevation? A camera mismatch is a **Stage 1 generation problem**. Stage 2 can't fix it, and no export fixes it.

## Target look

**Read `art-reference\README.md` and look at the images before writing prompts or reviewing.** They set the target for **battles, town scenes, buildings and props, characters and NPCs, and later UI**. They are **not** the overworld map's final style yet, so don't restyle world-map art toward them unasked.

## Style-fit check (mandatory for every candidate)

**No candidate is integrated, or called good, before this check passes.** It applies to every backend, including the hand-drawn fallback.

1. **Put the owner's examples beside it.** Run `preview.py` with `--ref <crop ids>` (two or three crops from `refs\crownless-v2\manifest.json`) so the compare sheet shows them next to Stage 1, Stage 2 and the exports. Also look at `art-reference\01-sprite-reference-sheet.webp` itself (and `02`/`03` for characters and town art).

   | Asset | `--ref` crops |
   |---|---|
   | Wooden props, racks, crates, carts | `prop-crate-stack prop-wood-fence prop-supply-cart` |
   | Stone props, wells, troughs, rubble | `prop-stone-well prop-stone-trough prop-rubble-large` |
   | Barrels, sacks, hay, logs | `prop-barrel-left prop-supply-sack prop-haystack` |
   | Buildings | `building-cottage building-smithy building-market-stall` |
   | Walls and fortifications | `wall-section-front fortification-gate fortification-tower` |
   | Trees and bushes | `vegetation-medium-tree vegetation-berry-bush prop-shrub-a` |
   | Soldiers | `character-soldier character-spearman character-archer` |
   | Town NPCs | `npc-<role>-front npc-<role>-back` (the closest role) |
   | Banners and signs | `banner-gold-lion prop-signpost` |
   | Ground tiles | `tile-grass tile-earth tile-stone-paving` |
2. **Check the game-scale sheet** (`<ID>-game.png`) beside the current art it will stand next to. Use `--neighbors` to pick that art: rocks `w0012:40x30`, fence `w0174:52x37`, tree `w0132:92x97`, and a unit frame at 37×43 for anything near people.
3. **Score each item** as fits, minor or doesn't fit, and write the scores into the log and the presentation:

   | # | Check | Matches the references when… |
   |---|---|---|
   | 1 | **Camera** | Raised about 35°, front square to the viewer, top visible in the proportions above (*Camera convention*) |
   | 2 | **Proportions** | Props are believable sizes relative to the reference sheet and the neighbours. Figures are about 3 heads tall, not chibi |
   | 3 | **Outline** | Near-black dark brown, about 1 px at the final size, closed around the silhouette |
   | 4 | **Shading and light** | Light from the upper left. 2–4 steps per material. No gradients or photographic texture |
   | 5 | **Palette** | Earthy, muted: brown and weathered wood, grey stone, olive and moss greens, terracotta roofs, cream walls. Heraldic navy, gold and crimson only as accents. No saturated or uniform single-hue blocks |
   | 6 | **Pixel clusters** | Clean clusters that read at 1×. No speckle, no broken lines, no single-pixel noise in flat areas |
   | 7 | **Silhouette and readability** | Identifiable at its draw size on the ground. It doesn't blend into the grass and can't be mistaken for another object |
   | 8 | **Scale beside game art** | Not oversized next to `w0012` rocks, fences or 37×43 units. The foot or contact line is clear |
   | 9 | **Content** | Nothing copied from the board, no ground base on props, no text, frames or panels |
4. **Verdict:**
   - **Fits:** all items fit, or at most one is minor.
   - **Usable with fixes:** a minor that an export can fix (palette, crop, size). Re-export and re-check.
   - **Doesn't fit:** any item doesn't fit, or two or more are minor. **It isn't integrated.** Fix by layer (*Diagnosing problems*), or move to the next step in the escalation.

Being technically valid (PASS/WARN) never replaces this check, and this check never replaces looking at the images.

## Escalation and the hand-drawn fallback

The order for every asset:
1. **Attempt 1** with the chosen backend.
2. **Export fixes** (free).
3. **Attempt 2** with the cheapest layer changed.
4. **Export fixes** again.
5. **Fallback: I hand-draw the sprite myself.**

Step 5 applies when the best candidate after attempt 2 is still **Doesn't fit**, or when nothing is readable. A third generation still needs the owner's OK, but the fallback doesn't.

**What the fallback is:** Claude Code has **no image-generation model**, and there is no "Claude image generation" tool in this environment. I never claim otherwise. So the fallback is **pixel art I author myself, pixel by pixel, at native size**:
1. Choose the final size from *Draw sizes* (for example 34×40 for a camp prop). Pick a palette of **8–20 colours** taken from the reference crops, with the outline `#2a1a12`-ish dark brown and 2–4 steps per material lit from the upper left. Follow the *Camera convention* exactly. Hand-drawing makes the camera easy to get right, so get it right.
2. Write the sprite as a text grid (one character per pixel plus a palette), or as a short drawing script in the scratchpad that emits that grid, into `art-work\recipes\<slug>-hand-v<N>.json`:
   ```json
   {"name": "...", "category": "prop", "palette": {"o": "#2a1a12", "w": "#7d5434"}, "rows": ["..oo..", ".owwo."]}
   ```
3. Render it, without overwriting: `py .claude\skills\crownless-art\pixel_draw.py --spec art-work\recipes\<slug>-hand-v<N>.json --out art-work\sheets\<slug>\hand\<slug>-hand-v<N>.png`. It writes the PNG at exactly the grid size, an 8× view and a JSON with hashes.
4. Review it like any candidate: `py .claude\skills\crownless-art\preview.py --png <that png> --category <cat> --bg-tolerance 0 --method nearest --colors 0 --padding 0 --sizes <W>x<H> --ref <crops> --neighbors <...> --out art-work\sheets\<slug>\hand`. View the 8× image and both sheets, then run the **Style-fit check**.
5. Revise up to **3 versions** (`-hand-v1`…`v3`). Each fixes what the check found. If v3 still doesn't fit, stop and report to the owner with the best version.
6. Integrate as usual. The manifest source is `claude_hand_drawn`: "pixel art drawn by Claude (Anthropic) as a text grid in this repo's art workflow, rendered with `pixel_draw.py`; no image model". Rights: owned by the owner. Add the source to `docs/ASSETS.md` the first time.

What hand-drawing is good at: camera, outline and palette discipline, exact sizes, clean clusters. What it's weak at: organic texture (foliage, cloth folds, faces), which reads flatter than the references, and detail above about 48 px. Say so in the presentation.
- **World art:** rugged Western medieval; slightly raised, mostly front-facing camera; top surfaces visible; restrained side faces; earthy muted colours; clear pixel clusters; readable silhouettes; strong outlines; simple material shading; no chibi proportions; no smooth photographic texture.
- **Characters:** keep the intended proportions and use the NPC turnarounds (front, side, back) for consistency.
- **UI:** navy, gold, crimson and cream.

## Presenting a batch

After every batch, whether or not I integrated it:

```markdown
**<asset> — attempt <N> — <backend>** · why this backend: <draw size, complexity>
Stage 1 prompt: "<exact>" · Stage 2 prompt: "<exact>" · board <id> · seeds <seed>/<style_seed> · source <W×H>
(LiliPixel: prompt, seed, steps, cfg, mode, resolution)

| # | Candidate ID | Stage 1 (subject, camera) | Stage 2 (kept geometry? copied board content? style) | Best export | Validation |
|---|---|---|---|---|---|

- Sheets: <ID>-compare.png and <ID>-game.png (absolute paths), plus the contact sheet
- Export sizes tried: <W×H list> → chosen <W×H> because <detail / neighbours / box>
- Problems by layer: generation / style / background / palette / scaling / readability
- Style-fit check (refs: <crop ids>): camera ✓/~/✗ · proportions · outline · shading and light · palette · clusters · silhouette · scale · content → **Fits / Usable with fixes / Doesn't fit**
- Next step if it doesn't fit: <fix by layer | attempt 2 | hand-drawn fallback>
- Fit with art-reference\: camera, proportions, outline, palette, shading
- Readability in game: <against ground and neighbours, at 1:1>
- Action taken: nothing integrated | integrated as assets\<file> in commit <hash> (revert with `git revert <hash>`)
- Log: art-work\log\<slug>.md
```

I show the compare and game sheets in the reply (`SendUserFile` when available). If I couldn't view an image, I say so.

## Integrating a sprite

1. `git status` must be clean. Otherwise commit the pending work first. Then push.
2. Copy the chosen `art-work\sheets\<slug>\<ID>-WxH.png` into `assets\`:
   - **New art:** the next free `w####` / `u####` name.
   - **Replacement:** overwrite the existing file, since the owner allows it. Never `w0200.png`.
3. Update the draw box in `data/` if needed so it equals the PNG size (data only, never the renderer). Point `js/assets.js` at a new file if needed.
4. Run `node scripts/asset-manifest.js`, then set the file's `source` in `assets/manifest.json`:
   - `sprite_studio_lilipixel` already exists.
   - For FLUX, add a `sprite_studio_flux` source the first time: FLUX.2 Klein 4B (`flux-2-klein-4b-fp8`), run locally in ComfyUI in two stages, with Stage 2 conditioned on the owner's own Crownless reference board, and the candidate ID recorded. Rights: owned by the owner, but **check the FLUX.2 Klein licence before selling** (not verified yet).
   - Add a row to `docs/ASSETS.md` for any new source.
5. Run `npm test` (at least `tests/assets.test.js`) and look at it in the game if it's drawn.
6. Commit with a message like "Art: replace w0012 rock with FLUX well (candidate <ID>, 40×30 box export)". Include the old and new hashes in the body.
7. Report the commit hash and the revert command in the batch presentation.

## Log format (`art-work\log\<slug>.md`)

One section per attempt. Copy values from the CLI JSON; never retype them.

```markdown
## <asset> — attempt <N> — <backend> — <UTC timestamp>
- Brief: use, draw box, category, backend reason
- Recipe(s): paths, with the full JSON
- LiliPixel: prompt, resolution, mode, steps, cfg, seed, batch positions, ComfyUI job
- FLUX: draw_prompt, style_prompt, board id + path + sha256, width×height, seed, style_seed,
  workflow + graph_sha256, model/encoder/VAE files, ComfyUI job
| Candidate ID | Stage 1 png + sha256 (verified) | Stage 2/raw png + sha256 (verified) | Exports (size, method, settings, sha256, validation) | Notes by stage |
- Sheets: compare / game / contact paths
- Outcome: chosen ID + size, or the next step by layer; any integration commit hash
```

Verify hashes with `py -c "import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" <png>` against `pipeline.stage1.sha256`, `pipeline.stage2.refined_sha256` or the LiliPixel `sha256`. The model revision and RNG state aren't recorded, so don't claim exact reproducibility.

## Example: a 64×64 world prop (Stonebridge stone well) with FLUX

1. Brief: decor beside the square, drawn at about 64×64. It has construction detail (rim and crank) → FLUX, props board.
2. `$CLI status`, then the FLUX readiness one-liner. Stop if ComfyUI isn't connected.
3. Write `art-work\recipes\stone-well-a1-s1.json`:
   ```json
   {"name": "Stonebridge stone well", "category": "prop",
    "draw_prompt": "A single isolated round medieval stone water well, low rim of grey fitted stones, dark water inside, a wooden hand-crank on two posts. Classic 16-bit role-playing game camera: viewed from the front and above, the camera raised about 35 degrees and looking down. The round top is visible as a flattened ellipse about one third as tall as it is wide. Orthographic, no perspective distortion. Centered on a plain flat light-grey background, no ground, no grass base, no cast shadow, no other objects.",
    "style_prompt": "Image 1 is the only subject. Keep its exact silhouette, proportions, construction, position and camera angle: the raised game camera looking down at about 35 degrees, front face toward the viewer, top surfaces visible. Light comes from the upper left: top surfaces lightest, the front mid-tone, undersides and the right edge darkest. Image 2 is a Crownless pixel-art style reference only. Redraw image 1 as rugged Western medieval pixel art like image 2: chunky readable pixel clusters, a 1-pixel near-black dark-brown outline, two to four shading steps per material, muted earthy colours (cool grey stone, weathered grey-brown wood), no smooth photographic texture, no gradients. Keep the plain flat background. Do not copy, add or merge any object, label, frame or scenery from image 2; no barrels, crates, cart, trough or rubble.",
    "style_board": "crownless-props-style-board", "width": 512, "height": 512, "seed": 4101, "style_seed": 42}
   ```
4. Run:
   ```powershell
   $env:PYTHONIOENCODING='utf-8'
   py "D:\Crownless Sprite generator\crownless-sprite-studio\cli.py" flux-pipeline --dry-run --spec "D:\Crownless-MVP\crownless-mvp\art-work\recipes\stone-well-a1-s1.json"
   py "D:\Crownless Sprite generator\crownless-sprite-studio\cli.py" flux-pipeline --spec "D:\Crownless-MVP\crownless-mvp\art-work\recipes\stone-well-a1-s1.json"
   py "D:\Crownless Sprite generator\crownless-sprite-studio\cli.py" inspect --id <candidate_id>
   py .claude\skills\crownless-art\preview.py --id <candidate_id> --sizes 32x32 48x48 64x64 --ref prop-stone-well prop-stone-trough --out "D:\Crownless-MVP\crownless-mvp\art-work\sheets\stone-well"
   ```
   For up to 3 more candidates, copy the recipe as `-s2`…`-s4` with `seed` 4102…4104.
5. Verify both hashes, then view `-stage1.png`, `-raw.png`, `<ID>-compare.png` and `<ID>-game.png`. Run the **Style-fit check**, write the log and present the batch.
6. If it fits: run *Integrating a sprite*. Otherwise fix the cheapest layer (*Diagnosing problems*); attempt 2 is only for generation or style problems. If it still doesn't fit after attempt 2, use the hand-drawn fallback (*Escalation*).

## Known Studio limitations (v0.7.2, checked 2026-11-24)

- **The v0.5.3 palette work is gone.** `validator.py` and `sprite-rules.json` are byte-identical to v0.5.2. There's no effective-palette analysis, no `REVIEW` status, no `palette-preview` command and no `tests/test_palette.py`. Restoring it means editing Studio code, which needs the owner's permission. The code survives only in the 2026-11-24 session transcript.
- `prepare-flux` validates against the category default size, and nearest-downscales from the source (see *Export sizes*).
- `validate --id` errors on FLUX candidates ("Prepare export before validating"): `prepare-flux` doesn't set the record's export. The v0.7.2 `AGENT-CLI.md` lists that command anyway. Use the validation in `prepare-flux`'s output or in `preview.py`'s JSON.
- `status` reports LiliPixel and SDXL only. FLUX readiness comes from `flux_two_step.status(True)` (the one-liner above).
- `contact-sheet` reads `-raw.png` only (Stage 2 for FLUX). Use `preview.py`'s compare sheet for Stage 1 next to Stage 2.
- The library was replaced with v0.7.2. The earlier crate candidates (including `stonebridge-supply-crate-76ef81f5`) and their records are gone. `assets/w0200.png` is intact (sha256 `5a13d70e…`).
- The Studio's `AGENT-CLI.md` still says never to approve or overwrite without human approval. For this repo, the owner's later standing grant (*Authority*) takes precedence. Its other rules (budget, checking stages, honesty about conditioning) agree with this skill.

## Troubleshooting

- `ok:false` "Width/height must be 384, 512, 640 or 768": a source size outside that set was used. The sprite size is set at export, not here.
- "Choose a Crownless style board" / "Missing Crownless style image": use one of the six IDs or a valid `ref:<id>` (`$CLI references` lists them).
- "ComfyUI rejected workflow" or missing models: report it to the owner. Don't edit the graph, and don't download anything.
- `TimeoutError` (30 minutes): the job may still be running in ComfyUI and nothing was cancelled. Check the ComfyUI console or `http://127.0.0.1:8188/history` before trying again, so it doesn't run twice.
- GPU out of memory: stay at 512×512 and one candidate per call. Tell the owner rather than changing ComfyUI flags.
- UnicodeDecodeError on records: they're cp1252. Read with `encoding='cp1252'`, or set `PYTHONIOENCODING=utf-8` for CLI output.
