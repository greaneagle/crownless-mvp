---
name: crownless-art
description: Generate, inspect, validate and prepare Crownless pixel-art sprite candidates with the local Crownless Sprite Studio CLI (ComfyUI + LiliPixel V1). Approved toolchain for small native 16×16 / 32×32 sprites (props, wells, barrels, crates, sacks, signs, market and camp props, small ruins, shrubs, saplings, simple trees, terrain details, icons and markers). Use it, without asking first, whenever such sprites are needed for prototypes, updates or asset exploration, and whenever the user asks for new game art, sprite candidates or a contact sheet. 64×64 is experimental. Not for hero, cavalry or final character integration. Never approves, overwrites or integrates art without the user's explicit approval of specific candidates.
---

# Crownless art: operating Sprite Studio

Sprite Studio is a separate local tool. Call its CLI through the shell. Do not copy its code into this repo, wrap it in an MCP server, or install anything for it.

| What | Where |
|---|---|
| Sprite Studio (v0.5.3: palette REVIEW status) | `D:\Crownless Sprite generator\crownless-sprite-studio` |
| CLI | `py "D:\Crownless Sprite generator\crownless-sprite-studio\cli.py" <command>` (Windows Python 3.10+, **not** ComfyUI's embedded Python) |
| Its own guide | `D:\Crownless Sprite generator\crownless-sprite-studio\AGENT-CLI.md`. Re-read it if the version changes |
| Validator rules | `D:\Crownless Sprite generator\crownless-sprite-studio\sprite-rules.json` |
| Example recipe | `D:\Crownless Sprite generator\crownless-sprite-studio\recipes\stone-well.json` |
| Candidate library (raw PNG + JSON per candidate) | `D:\Crownless Sprite generator\crownless-sprite-studio\library\` |
| ComfyUI | `http://127.0.0.1:8188`, started by the user with `run_nvidia_gpu.bat`. Keep it on localhost |
| Local workspace in this repo (git-ignored) | `art-work\` with `recipes\`, `sheets\`, `log\`, `exports\` |

Below, `$CLI` means `py "D:\Crownless Sprite generator\crownless-sprite-studio\cli.py"`. The CLI works from any folder because it resolves its library from its own location. Every command prints `{"ok": true, "data": ...}`, or `{"ok": false, "error": ...}` with exit code 1. Parse the JSON; don't guess.

## Hard rules

1. **Generate only with LiliPixel through this CLI** (`generate --spec`). Don't call ComfyUI directly, and don't use the Studio's SDXL path.
2. **Text only.** LiliPixel V1 generates from text. No reference image conditions it. `status` reports `adapter.ready: true`, but that is the SDXL IP-Adapter path, which LiliPixel doesn't use. Every candidate's metadata records `reference.used: false`. Never say a reference image shaped a result.
3. **Prompts are short, editable free text**, written for the asset at hand. Don't make reusable per-object prompt templates, and don't add long art-bible text. The node allows about 96 tokens, and the CLI rejects more than 1000 characters.
4. **Budget: at most 4 candidates per attempt (`batch_size` ≤ 4), and at most 2 attempts per asset.** Going over needs the user's explicit authorisation for that asset. Run one generation at a time.
5. **Record everything** in `art-work\log\<asset-slug>.md` (see the log format below).
6. **Look at the actual PNGs**, at native size and enlarged with nearest-neighbour. If you can't see an image, say so. Don't invent an assessment.
7. **Technical validation is not artistic approval.** PASS means only that no deterministic check failed. It says nothing about style, camera angle, readability or fit with Crownless. **REVIEW is not PASS**: it is a technical exception the user must see and confirm. Always report it as REVIEW, never round it up to PASS. See *Validation statuses*.
8. **No approval, overwrite or integration without the user's explicit approval of the specific candidate IDs.** Never run `approve --human-reviewed` on your own. Run it only after the user names the exact candidates in chat, and the browser Studio's approve button is preferred. Never write to `assets\`, `assets\manifest.json`, `js\assets.js`, `data\` or the renderer unless the user asks for integration. **Every batch is presented to the user for review** before anything else happens to it.
9. **Leave existing game art and logic alone** until the user asks for integration. No `--dry-run` "quality tests": a dry run only checks the recipe format.
10. **Never distort proportions.** Never stretch a square native image into a rectangular display box. Keep the aspect ratio and the pixel grid, scale uniformly (integer where possible), pad with transparency, and keep foot anchors consistent. See *Proportions and display boxes*.
11. **32×32 is the default for first candidates. 64×64 is experimental.** In our tests, 32 px results were recognisable, while 64 px results came out blurry, opaque and poorly composed. A higher native resolution doesn't mean a better sprite. Use 64 only when an asset-specific test justifies it. See *64×64 is experimental*.
12. **File safety.** Candidates, prepared exports, logs, contact sheets, previews, draft recipes and ZIPs stay in the Studio's `library\` or in this repo's git-ignored `art-work\`. **Never overwrite an existing file in `assets\`** (`u####.png`, `w####.png`, `manifest.json`), even with approval. Approved files go in under a new, unused name, and only when the user explicitly tells me to copy those specific files. Keep the `.gitignore` rules for `art-work/` and generated material in place, and check `git status` after a batch to confirm nothing generated shows up as untracked.

## Approved toolchain and scope

The user approved this pipeline (Sprite Studio CLI → ComfyUI → LiliPixel V1, at native 16×16 and 32×32) as a toolchain for Crownless development on 2026-11-24. **Within the scope below, I may generate candidate batches on my own initiative**, without asking first, whenever small native sprites would help a prototype, an update or asset exploration. The budget (rule 4) and every review and approval rule still apply. Generating is allowed; approving, copying or integrating is not.

Before using it on my own initiative:
- ComfyUI must already be running (`status` → `connected` and `lilipixel.ready`). I never start, restart or reconfigure ComfyUI, and I never download models.
- In my message, say that I'm starting a batch, for which asset, and at what resolution.
- Every batch ends with a review that I present to the user (*Presenting a batch*). Batches are never left unreported.

### In scope (16×16 / 32×32)

| Allowed asset types | Category | Default size |
|---|---|---|
| Wells, barrels, crates, sacks, signs, small market props, camp props (tents' small gear, fire pits, bedrolls, racks) | `prop` | 32 |
| Small stone ruins, standing stones, low walls in pieces | `prop` or `fortification` | 32 |
| Shrubs, saplings, simple trees that read clearly at 32 px | `vegetation` | 32 (16 for tufts and flowers) |
| Simple terrain details: pebbles, puddles, grass tufts, path stones, simple tiles | `terrain` (full tile) or `prop` (a detail with transparency) | 16 or 32 |
| Icons, markers, simple UI-adjacent world symbols: map pins, quest marks, trade-good icons, small banners and emblems | `banner` or `prop` | 16 or 32 |
| Other small square subjects that fit naturally into 16×16 or 32×32 | closest category | 32 |

### Out of scope (don't use this workflow, or ask first)

- **Hero sprites and cavalry**: not at all, at any size.
- **Final character integration** (troops, NPCs, companions, walk cycles): not yet. These depend on non-square export handling and frame sets that Sprite Studio v0.5.2 lacks (see *Proportions and display boxes*). Character candidates only when the user explicitly asks for exploration, and labelled as such.
- **Anything that needs non-square production or export handling**: tall trees or towers drawn into a portrait box, multi-tile buildings, wide or tall decor.
- **Anything that clearly fails at 16 or 32 px**: if attempt 1 shows the subject can't read at 32 px, stop and report. Don't escalate to 64 on my own.
- **64×64**: experimental only, never a default. Only on an asset-specific test the user agreed to (*64×64 is experimental*).

### 16×16 or 32×32: decision logic

1. **Out of scope?** (Hero, cavalry, final character art, non-square, or the subject clearly needs more than 32 px to read.) → Don't generate. Say why.
2. **Is it tiny in the game?** Its display footprint is about 20 px or less on its longest side (a pebble, flower, coin, tuft, map pin or small marker), **and** its identity is one simple shape with 1–3 colour masses. → **16**.
3. **Otherwise** (wells, barrels, crates, sacks, signs, market and camp props, ruins, shrubs, saplings, simple trees, emblems with a symbol, any icon that needs an inner detail to read) → **32**.
4. **When unsure, pick 32.** Drop to 16 only for a subject that reads as a single blob at 32 or would be shown at 20 px or less anyway.
5. **Never 64 by default.** If 32 fails because of size, report it. 64 is a separate, experimental test.
6. **Keep the size from attempt 1 to attempt 2** unless the size itself was the reason attempt 1 failed (a tiny subject drawn with too much detail → try 16). That counts as attempt 2's one changed factor.

## Commands

| Command | Purpose |
|---|---|
| `$CLI status` | Is ComfyUI up and LiliPixel ready? Check for `data.connected` and `data.lilipixel.ready` |
| `$CLI generate --dry-run --spec <recipe.json>` | Check the recipe's format only. No GPU |
| `$CLI generate --spec <recipe.json>` | **Blocking.** Generates `batch_size` unapproved candidates. Returns `ids`, plus each candidate's `source_png`, `metadata_json` and `sha256`. Can take minutes; use a long timeout (10 minutes) |
| `$CLI list --limit N` | Newest candidates first |
| `$CLI inspect --id <ID>` | Full record and `generation` provenance, `raw_png` and `export_png` paths |
| `$CLI prepare-native --id <ID>` | Native-size RGBA export: no resizing, trimming, palette change or background removal. Validates it |
| `$CLI validate --id <ID>` | Re-runs the validator on the prepared export (run `prepare-native` first). Read-only: it doesn't update the stored record |
| `$CLI palette-preview --id <ID> --output <png> [--tolerance N] [--replace]` | Optional. Writes a **separate** PNG with near-duplicate colours merged into their representatives. Refuses paths inside `library\` and existing files unless `--replace`. Never touches the raw PNG, export, record or approval. Write it to `art-work\sheets\`. **Never an export or an approval candidate** |
| `$CLI contact-sheet --ids <ID...> --output <png> [--tile 64..512]` | Nearest-neighbour comparison sheet: up to 4 per row, integer scale, checkerboard behind. Write it to `art-work\sheets\` |
| `$CLI audit` | Checks every prepared library export |
| `$CLI approve --id <ID> --human-reviewed` / `--unapprove` | **Only after the user's explicit approval of that ID** |
| `$CLI export-approved --output <zip>` | ZIP of approved, technically valid sprites. Write it to `art-work\exports\`, never to `assets\` |

## Validation statuses

`prepare-native` and `validate` print `technical_status`, `palette_status`, `raw_colors`, `effective_colors` and `palette_limit`. The full report is in `validation` (`errors`, `reviews`, `warnings`, `palette`, `metrics`).

| Overall `technical_status` | Meaning | How I report it |
|---|---|---|
| `FAIL` | A check failed | Not technically valid. Ruled out |
| `REVIEW` | Nothing failed, but there is a technical exception (today only `PALETTE_REVIEW`) | **Technically valid only pending review.** Listed separately and named as REVIEW. The user decides |
| `WARN` | Nothing failed; warnings need judgment | Technically valid, with the warnings listed |
| `PASS` | Nothing failed | Technically valid (technical only) |

Palette status (`validation.palette.status`):
- **PASS:** raw colours ≤ `max_colors` (64 for native profiles).
- **REVIEW:** raw > 64, but effective ≤ 64. This applies only to `native_*` profiles, which set `palette_review: true`.
- **FAIL:** effective > 64. Non-native profiles still FAIL on the raw count alone.

**Effective colours** (`greedy-chebyshev-rgb/v1`, tolerance 8, from `sprite-rules.json` → `palette_analysis`): opaque pixels only (alpha 0 excluded). Distinct RGB colours are sorted by pixel count, descending, then by RGB. Each colour joins the first representative within `max(|dR|,|dG|,|dB|) ≤ 8`, or else becomes a representative. The effective count is the number of representatives. The PNG is never recoloured. Both counts and `max_member_deviation` and `pixels_off_representative_fraction` are in `validation.palette`. Put all of these in the log.

LiliPixel 16/32 px output carries invisible ±1–8 RGB jitter, so palette REVIEW is the normal case for it. For a REVIEW candidate, a `palette-preview` beside the raw image on a contact sheet lets the user see that merging changes nothing visible. The noise and density warnings (`PIXEL_NOISE`, `PIXEL_DENSITY`) still count exact RGB equality, so the same jitter inflates them. Read them as weak evidence for LiliPixel output.

## Recipe format (JSON object; unknown fields are rejected)

```json
{
  "name": "Border March stone well",
  "category": "prop",
  "description": "small circular stone water well, grey stone rim, visible dark blue water, top-down pixel art",
  "extra": "",
  "profile": "default",
  "facing": "none",
  "resolution": 32,
  "batch_size": 4,
  "seed": 42,
  "mode": "auto",
  "steps": 30,
  "cfg": 3.0,
  "background": "gray",
  "alpha_cutoff": 0.5
}
```

| Field | Rules |
|---|---|
| `name` *(required)* | Short label. Candidate IDs become `<slug>-<8 hex>`, named "name · 1..4" |
| `category` *(required)* | `character`, `building`, `prop`, `vegetation`, `fortification`, `terrain` or `banner`. Chooses validator rules. It is **not** added to the prompt |
| `description` *(required)* | The prompt. The model receives exactly `description` (plus `. extra` if `extra` isn't empty) |
| `extra` | Optional short addition to the prompt. Usually leave it empty |
| `profile` | `default`, or a profile from `sprite-rules.json` whose `category` matches. `prepare-native` always validates against `native_<category>_<resolution>` |
| `facing` | Stored as metadata only: `none`, `down`, `up`, `left` or `right`. It does not change the prompt, so put the direction in `description` |
| `resolution` | `16`, `32` or `64` |
| `batch_size` | The CLI allows 1–8. **This skill caps it at 4** |
| `seed` | 0 to 2^64−1. The node says each image uses `seed + i`. The Studio records the base seed and batch position, not the separate per-image RNG state |
| `mode` | `auto` (adds ", transparent background" at 16/32), `sprite`, `scene`, `realistic` (64 only) or `raw` (the prompt goes in untouched) |
| `steps` | The CLI requires 1–80. Use 30 for 16/32 and 50 for 64 (the node's "auto" values; the CLI can't send 0) |
| `cfg` | 1–10 in practice (the node's limit). 3.0 is the default; 3.5 or more for specific prompts |
| `background` | `gray`, `white`, `black`, `magenta` or `green`. It flattens only the RGB preview output; the saved RGBA is unaffected |
| `alpha_cutoff` | 0–1. 0.5 makes alpha binary for crisp edges; 0 keeps soft alpha |

Write recipes to `art-work\recipes\<asset-slug>-a<attempt>.json` in this repo, and pass them by absolute path. Never edit `recipes\stone-well.json` in the Studio.

## Choosing the resolution

LiliPixel outputs a **square native canvas**. The game draws its sprites at fixed **display** sizes with smoothing off. The display size is not the source size. Use the decision logic in *Approved toolchain and scope*. The table shows how each game use relates to the workflow.

| Game use | Display box (code) | Existing source PNGs | This workflow |
|---|---|---|---|
| Small obstacles: rocks, crates, flowers (`data/battle_maps.js`) | for example 40×30, 38×30 | `w0001`–`w0012`, about 22–34 × 24–25 | **In scope: 32** (16 for very small ones) |
| Icons: trade goods, fief marks, map markers | UI-sized | none yet | **In scope: 16 or 32** |
| Small vegetation, simple trees that read at 32 | for example 49×57–65×72 | `w0091` 42×70, `w0121` 86×61 | **In scope: 32**, shown at an integer scale. Integration needs a box that keeps the aspect |
| Ground details and simple tiles (64 grid, drawn 65×65 at 24% opacity) | 65×65 | `w0000` 59×69 | **In scope: 16 or 32**, category `terrain` (opaque is expected here) |
| Banners and emblems as small world symbols | canvas shapes today | none yet | **In scope: 32** |
| Large trees and decor | for example 92×97 | `w0132` 120×126 | Out of scope (needs non-square or large export) |
| Infantry, archers, town NPCs | 37×43 (`js/render.js`, `sh = 43`) | about 26–36 × 33–50, cropped | Out of scope for integration. Exploration only on explicit request, at 32 |
| Hero | 58×74 | about 50–66 × 55–74 | **Out of scope** |
| Mounted troops | 42×62 | about 50–60 × 55–70 | **Out of scope** |
| World-map settlement icons | canvas shapes today | none yet | 32 if it reads as a simple icon; otherwise out of scope |

The art bible (GDD §12) asks for a top-down 3/4 GBA-era look, consistent proportions and four orientations. The open art requests are in `docs/ASSETS.md`, rows 1–20. Current sprites are a 16-bit fantasy style made with ChatGPT image generation and cropped from sheets. LiliPixel output will look different, so call out any mismatch in style.

## Target look: the owner's reference images

**Read `D:\Crownless-MVP\crownless-mvp\art-reference\README.md` and look at the images in that folder before writing a prompt or reviewing a batch.** These are the owner's target look for **battles and scenes** (town hubs). They are **not yet for the overworld map**. The folder has six images: a sprite sheet (characters, buildings, props, vegetation, walls, ground, banners), NPC turnarounds, a Stonebridge town mock-up, and three UI screens. It's local only and git-ignored. Never copy the images into `assets\` or describe them as a model input (LiliPixel is text-only). In every batch review, add a line comparing the candidates with them (camera, proportions, outline, palette).

## Camera convention: front-dominant, at most a slight side

In Crownless, "top-down 3/4" means the **classic GBA/JRPG oblique view** from a raised camera: the **front face dominates** and the **top surface is visible**. In the owner's reference sheet, buildings and a few props (the crate stack, the cart) show **a little of one side**; walls, gates, the well and banners are square to the screen. **A slight side face is acceptable. A corner pointing at the camera, with two equal side faces (an isometric diamond), is not.** When in doubt, prefer square-on. The existing art is square-on:
- The `w0121` and `w0174` fences run left to right, with post tops showing as ovals.
- The `w0132` tree faces front, and the `w0110` cliff shows its front face under a grass top.
- Ground patches (`w0000`, `w0050`, `w0061`) are flat squares seen from above.
- Units in `u####` face the camera directly.

The renderer is built the same way. Its canvas stand-ins draw "front face plus a lighter top edge" (the `crate`/`wall` looks in `js/render.js`); buildings and stalls are axis-aligned front faces with a roof or awning above. Obstacles are axis-aligned rectangles or circles.

- **Don't write "3/4", "three-quarter" or "isometric" in LiliPixel prompts.** LiliPixel reads them as an object turned to show its corner and two sides (this happened with the supply-crate attempt 1). Instead, say what the view is: for example "front view from slightly above, facing the camera, top visible".
- A candidate turned so a corner points at the camera (two roughly equal side faces) is a **camera-angle mismatch**. Report it as such, even if the sprite is otherwise good. A small side face, as on the reference crate stack, is fine; note it as "slight side".
- Round or symmetrical subjects (wells, barrels, sacks, shrubs, round trees) hide the angle, so they're less at risk. Box-shaped subjects (crates, chests, signs, stalls, walls, buildings) show it clearly.

## 64×64 is experimental

What we've seen: **32×32 candidates were recognisable; 64×64 candidates were blurry, opaque and poorly composed.** The node itself documents 64 as "opaque scenes (RGB)", while 16 and 32 are transparent RGBA. Its `auto` mode adds ", transparent background" only at 16 and 32.

- **Don't use 64 for first candidates**, and don't propose it on the assumption that it's "more detail".
- **When 64 may be justified:** a 32 px attempt was reviewed and failed *because of size* (detail that 32 px can't hold, such as a building with a readable door and roof), the asset's display box is at least about 64 px tall, **and the user agreed to the 64 test for that asset**. That's not part of the standing approval. Write that reason in the log before you run it, and label the batch **experimental** in the log and the presentation.
- **How to test 64:** run one bounded attempt that counts against the 2-attempt budget: `batch_size` ≤ 4, `steps` 50, the same prompt as the best 32 attempt, `mode` `sprite` or `auto`. Put both results on one contact sheet with the 32 candidates, at the same on-screen size, and compare.
- **Check every 64 px candidate, and every candidate at any size, for:**
  - **Unwanted background:** `inspect` → `record.diagnostics.has_transparency` / `opaque_fraction`. If `opaque_fraction` is 1.0 or `has_transparency` is false, there is no transparency. `prepare-native` also FAILs `NO_TRANSPARENCY` for non-terrain categories. Look for a flat grey, white or scenic backdrop in the image itself.
  - **Blurred pixel clusters:** soft gradients, smeared edges and anti-aliased mush instead of deliberate single-colour pixel runs. The metrics `opaque_neighbor_color_transition_rate`, `isolated_interior_color_pixel_fraction` and `unique_opaque_colors` (near the 64-colour cap) are hints, not proof. Look at the enlarged sheet.
  - **Wrong silhouette:** cropped at the canvas edge (`EDGE_CONTACT`), several objects or a whole scene instead of one asset, the wrong camera angle (side view, perspective, or turned to a corner instead of front-on from slightly above; see *Camera convention*), or a subject that doesn't read at its display box.
- If 64 doesn't clearly beat 32 on the same sheet, stay at 32 and say so.

## Proportions and display boxes

**Requirement:** never change a sprite's aspect ratio or pixel grid to make it fit a box. A game-ready frame is the native sprite, **trimmed to its opaque bounds**, **scaled by the same factor on both axes** (integer where possible: 1×, 2×, 3×), **placed on a transparent canvas** of the box size, **centred horizontally**, with its **foot or contact line at a fixed bottom offset** shared by every frame and every unit of that role.

What happens today:
- **The game stretches every image to a fixed box.** `drawImage(img, x, y, w, h)` in `js/render.js` (units: hero 58×74, mounted 42×62, others 37×43; NPCs 37×43; obstacles and decor use `look.w/h` or decor `w, h`). `imageSmoothingEnabled` is false. Any PNG whose size isn't exactly the box gets non-uniform scaling, **including today's cropped sprites** (for example a 28×37 infantry frame drawn at 37×43 is about 14% wider, relative to its height, than its source).
- **The only distortion-free option without renderer changes:** a PNG whose size is **exactly** the display box, with the art inside at an integer scale and padded with transparency. The renderer then draws it 1:1 in game units.
- **Integer fit for 32 px native** (trimmed bounds of roughly 18–30 px): 37×43 → 1× only, so the figure looks smaller than today's frames, which fill the box. Hero 58×74 → 2× when the trimmed sprite is ≤ 29×37. Mounted 42×62 → 1× for a horse wider than 21 px, because the box is portrait while riders are usually landscape. The box shape itself is the problem; flag it rather than squeeze the art.
- **The screen adds another scale:** the battle canvas is 960×540 game units, scaled by CSS (and by the camera on larger arenas), so on-screen pixels are uniform only at integer canvas scales. That's a renderer decision (see `backing`, decision D-R1). Don't treat it as a sprite problem.

What I may do now, before integration is requested:
- Generate at native size and review the native PNG. In the review, give each candidate's trimmed bounds (the validator's `metrics.bounding_box`), the integer scale that fits its target box, and the leftover padding.
- To *preview* a candidate in its box, I may write a throwaway nearest-neighbour composite into `art-work\sheets\` with a one-line Pillow command (trim to alpha bounds, integer scale, bottom-centre on a transparent box-sized canvas). Label it **preview, not an export**. Never feed it to `approve`, `export-approved` or `assets\`.

**Changes needed in Sprite Studio v0.5.2's export pipeline** (code changes in the Studio; don't implement them from this repo):
1. **A CLI export to a game box.** `prepare-native` hard-codes native size, `trim: false`, `padding: 0` and `remove_bg: false`. The CLI can't call `export_asset` with a width, height, trim or padding. Needed: something like `prepare-game --id <ID> --profile infantry`, which takes the box from `sprite-rules.json`.
2. **Integer scale mode.** `engine.transform` uses `scale = min(iw/w, ih/h)`, which keeps the aspect ratio but is **fractional**, so nearest-neighbour gives uneven pixel widths. Needed: an `integer_scale` option (the largest integer k ≥ 1 that fits, and refuse when even 1× doesn't fit, instead of downscaling), with the chosen `k` recorded in `record.export`.
3. **Separate foot anchor from padding.** `transform` uses one `padding` for all four sides, and `bottom_padding` exists only in the validator. Needed: a separate `bottom_offset` (the foot line) and side/top padding, and an anchor that is the same across a frame set rather than per-image bounds.
4. **More than one export per candidate.** A record holds one `export`. `prepare-native` and a game-box export overwrite each other and reset `approved`. Needed: native and per-profile exports kept side by side.
5. **Validator checks for proportion.** The validator checks only the final dimensions, palette, alpha, transparency, anchor and edge contact. It can't tell that art was stretched. Needed: record the source bounds and scale per axis, FAIL when x-scale ≠ y-scale, and WARN on a non-integer scale.
6. **Contact sheets of exports.** `contact-sheet` always reads `-raw.png`. Needed: an option to show the prepared export, or the sprite in its game box, at the same scale as the raw image.
7. **Background removal through the CLI.** `remove_flat_background` (keys on the corner colours, not semantic) exists in `transform` but isn't exposed by `prepare-native`. It only removes flat, edge-connected colours, so it won't fix 64 px scenic backgrounds.
8. **Frame sets.** Nothing groups the frames of one animation (4-direction walk cycles) so they share a canvas size, scale and anchor. Needed before any troop sprite set can be integrated.

**Changes the game renderer will eventually need** (document only; **don't change `js/render.js`, `js/assets.js` or data until the user asks for integration**):
1. **Draw by natural size times an integer scale**, anchored at the feet (`u.x`, `u.y + offset`). The unit box (37×43 and the others) stays for layout, shadows and name plates, not as a stretch target. This applies to `drawUnit`, the hero cloak path (`drawHeroFrame`), town NPCs and the companion portrait in `js/ui.js` (56×80).
2. **Per-sprite metadata** for scale and anchor (in `js/assets.js` beside `troopArt`/`allyArt`, or in `assets/manifest.json`), so old cropped frames and new native frames can coexist.
3. **Obstacles and decor** (`look.w/h`, decor `w, h` in `data/battle_maps.js`): give an integer scale and a bottom-centre anchor instead of an arbitrary w×h.
4. **Note that this also changes how today's sprites look**, because they're currently stretched to their boxes. It needs a side-by-side check and the user's decision, and possibly the visual tests updated.
5. **Optional:** integer canvas scaling (the D-R1 backing store) so on-screen pixels stay uniform.

## Procedure

1. **Read the brief.** The asset (from `docs/ASSETS.md` if it's there), where it shows, its display box, and the category and resolution, with the reason (the 16/32 decision logic). Check it against *Out of scope* first. Tell the user what you plan if anything is unclear.
2. **Check the service:** `$CLI status`. If `connected` or `lilipixel.ready` is false, stop and tell the user to start ComfyUI. Don't try to start it yourself.
3. **Write the attempt-1 recipe** at `resolution: 32` (or 16 for tiny icons), never 64 for a first attempt: a short prompt naming the subject, its key colours and materials, and the view in plain words, front-on per *Camera convention* (for example "front view from slightly above, facing the camera, top visible"; never "3/4", "three-quarter" or "isometric"). Use `batch_size` ≤ 4. Run `generate --dry-run`, then `generate` (with a 10-minute timeout).
4. **Verify the files:** for each candidate, check the SHA-256 of the raw PNG against `sha256` in the result:
   `py -c "import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "<source_png>"`
   Then `$CLI inspect --id <ID>` to get the full `generation` block.
5. **Look at the images.**
   - Native size: open each `...-raw.png` with the Read tool. It is 16, 32 or 64 px, so judge silhouette and readability at that size.
   - Enlarged: `$CLI contact-sheet --ids <all IDs of the attempt> --output "D:\Crownless-MVP\crownless-mvp\art-work\sheets\<asset-slug>-a<N>.png" --tile 256`, then read the sheet. Make one for every batch of more than one candidate, and one across attempts when comparing them. Tile 256 gives 8× for 32 px and 16× for 16 px, both integer.
   - Write down what you see in each: the subject, the camera angle (front-on from slightly above, or turned to a corner?), the silhouette, stray pixels, any unwanted background (also check `diagnostics.has_transparency` and `opaque_fraction`), blurred pixel clusters, how well it fits Crownless, and how it would read at its display box: trimmed bounds, the integer scale that fits, the padding left over, and whether the foot line can be anchored. Separate what you observed from what you guess.
6. **Validate every candidate in the batch:** `$CLI prepare-native --id <ID>` (a native-size export: no resize, trim or palette change; it is written only to the Studio library), then read `technical_status`, `palette_status`, the raw and effective colours, and `validation` (errors, reviews, warnings, metrics). `validate --id <ID>` re-runs it. A FAIL rules a candidate out. A REVIEW goes to the user as REVIEW. A WARN needs judgment. A PASS is technical only. Afterwards, check that the export is still the native size (`metrics.width/height` = the resolution).
7. **Attempt 2, only if needed:** change **one** thing (the wording, or cfg, or mode, or the seed, or 32 → 64 when the conditions in *64×64 is experimental* hold) and give the reason. Use a base seed that doesn't overlap attempt 1's `seed`…`seed+3` (for example seed + 100). After two attempts, stop and report, even if nothing is good. Ask before a third.
8. **Present the batch to the user** (see *Presenting a batch*). Ask which IDs, if any, they approve. Generation may continue to attempt 2 within budget before presenting only when attempt 1 clearly failed (all FAIL, or none recognisable), and both attempts are then presented together.
9. **Only after the user approves specific IDs:** run `approve --id <ID> --human-reviewed` for exactly those IDs (or have the user click approve in the browser Studio, at `start-windows.bat` → `http://127.0.0.1:8765`). Optionally run `export-approved` into `art-work\exports\`. **Approval in the Studio is not permission to copy into the game.** Copying into `assets\` needs a separate, explicit instruction naming the files. Then use a new filename, never overwrite, and follow `docs/ASSETS.md` (add the file, point `js/assets.js` at it, run `node scripts/asset-manifest.js`, run `tests/assets.test.js`). Wiring it into gameplay or rendering is a further request.

## Presenting a batch

Every batch goes to the user in this shape, before anything else happens to it:

```markdown
**<asset> — attempt <N> — <resolution> px<, EXPERIMENTAL if 64>** · prompt: "<exact prompt>" · seed <base> · steps <s> · cfg <c> · mode <m>
Contact sheet: <absolute path>

| # | Candidate ID | Validation | Visual notes |
|---|---|---|---|
| 1 | <id> | PASS / WARN (codes) / REVIEW (palette raw R → effective E of 64) / FAIL (codes) | <what it shows, silhouette, readability> |

- Technically valid (PASS or WARN): <IDs>, or none
- REVIEW, needs your confirmation: <IDs with raw → effective colours>, or none
- Technically failed: <IDs and codes>, or none
- Strongest visually: <ID> because <reason>, or "none is usable" (validity and visual strength are judged separately; the strongest may carry a WARN)
- Fit with the target look (art-reference\): <camera, proportions, outline, palette, shading against the owner's reference images>
- Style mismatch vs current Crownless art: <palette, outline, shading, camera angle, detail level against the existing w#### tiles>
- Gameplay readability: <reads at its display box? clashes with ground colours? mistakable for another object? foot or contact line clear?>
- Status: nothing approved, nothing copied into the game. Log: art-work\log\<slug>.md
```

If I couldn't view an image, I say so in its row instead of describing it.

## Log format (`art-work\log\<asset-slug>.md`)

Add one section per attempt. Copy values from the CLI's JSON output; never retype them from memory.

```markdown
## <asset> — attempt <N> — <UTC timestamp>
- Recipe: art-work\recipes\<slug>-a<N>.json (copy the full JSON below)
- Exact prompt sent: "<generation.prompt from inspect>"
- Settings: resolution, mode, steps, cfg, base seed, background, alpha_cutoff, batch_size
- Resolution reason: 32 default / 16 tiny / 64 because <failed 32 attempt + reason> (experimental)
- Target display box: <e.g. infantry 37×43>; per candidate: trimmed bounds, integer scale that fits, padding left
- ComfyUI job: <generation job id>
- Reference used: false (LiliPixel V1 is text-only)
| Batch pos | Candidate ID | Seed (base + pos, per node) | Raw PNG path | Metadata JSON path | SHA-256 (verified y/n) | Prepared export path | Validation (technical status; palette status raw → effective at tolerance; errors, reviews, warnings) | Visual notes |
|---|---|---|---|---|---|---|---|---|
- Contact sheet: art-work\sheets\<slug>-a<N>.png
- Outcome: shortlisted IDs / rejected / attempt 2 because <one changed factor>
- User decision: <pending | approved IDs quoted from the user's message | rejected>
```

The model revision and per-image RNG state are unknown. The metadata says so. Don't claim exact reproducibility.

## Example: a small prop batch

The request is something like "a market crate for Stonebridge". It's in scope (a crate, small market prop), and the decision logic gives 32.

1. `$CLI status`. Confirm `connected` and `lilipixel.ready`.
2. Write `art-work\recipes\market-crate-a1.json`:
   ```json
   {"name": "Stonebridge market crate", "category": "prop",
    "description": "wooden market crate full of red apples, front view from slightly above, facing the camera, top visible",
    "resolution": 32, "batch_size": 4, "seed": 1201, "mode": "auto",
    "steps": 30, "cfg": 3.0, "background": "gray", "alpha_cutoff": 0.5}
   ```
3. Run these:
   ```powershell
   py "D:\Crownless Sprite generator\crownless-sprite-studio\cli.py" generate --dry-run --spec "D:\Crownless-MVP\crownless-mvp\art-work\recipes\market-crate-a1.json"
   py "D:\Crownless Sprite generator\crownless-sprite-studio\cli.py" generate --spec "D:\Crownless-MVP\crownless-mvp\art-work\recipes\market-crate-a1.json"
   ```
4. For each returned ID: check the hash, run `inspect --id`, run `prepare-native --id` (validation), and view the raw PNG at native size.
5. Run `contact-sheet --ids <4 IDs> --output "D:\Crownless-MVP\crownless-mvp\art-work\sheets\market-crate-a1.png" --tile 256` and view the sheet.
6. Write `art-work\log\market-crate.md`, run `git status` (no generated files listed), and present the batch. If needed, attempt 2 changes one factor (for example the wording, or seed 1301). Then stop.
