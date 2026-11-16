# Gate D — Full Regional Content: Progress & Validation

_Spec: GDD §3–§10 and §14 Gate D._

**Gate D pass criteria (GDD §14):** expand to 10 settlements, 15 troop types, 3 battle maps, 4 story quests, 3 repeatable contracts, a companion, reputation and ending flags. **Pass:** each ending is reachable, no quest soft-locks, and the sandbox continues.

| Roadmap step | Status |
|---|---|
| 4.1 All ten settlements with their services | ✅ All 10 enterable since 0.6.0 (recruit, trade, rest, contracts where listed); **fort garrisons** shown since 0.15.0 |
| 4.2 Stonebridge walkable town hub | ⬜ |
| 4.3 Three battle maps as distinct environments | ✅ 0.15.0 |
| 4.4 Complete the item catalogue (~30) | ⬜ |
| 4.5 AI cavalry; all 15 troop roles | ⬜ |
| 4.6 Faction reputation and fort ownership | ⬜ |
| 4.7 Quest and dialogue interpreter | ⬜ |
| 4.8–4.12 Q1–Q4 and the companion Mara | ⬜ |
| 4.13 Escort and delivery contracts | ⬜ |
| 4.14 Trade-world interactions and regional news | ⬜ |
| 4.15 Gate D acceptance | ⬜ |

---

## Slice 1 — 0.15.0: Three battle maps and fort garrisons (2026-11-16)

### What's in (GDD §8)
- **The three scenes** in `data/battle_maps.js` share one tile palette, collision system and spawn-anchor format:
  - **Grass Field:** the familiar arena, now with three rocks for light cover.
  - **Forest Clearing:** nine trees and four bushes that make lanes and cover, on darker ground with flowers.
  - **Greywall Courtyard:** a walled yard with a gate gap, flagstones and two crates. The enemy holds the yard and you come in from the dirt approach.
- **Which map you fight on:**
  - In woodland, the Forest Clearing.
  - Within 6 leagues of Greywall or Ashgate, the Courtyard.
  - Otherwise, the Grass Field.
  - This applies to bands, contract targets and ambushes. The Reaver Hideout ("dug in among the stones") now uses the Forest Clearing; the Looter Camp stays on the Grass Field.
- **Collision (`js/units.js`):**
  - Units have a 12 px footprint. Circles (trees, rocks, bushes) and rectangles (walls, crates) push units out, so the hero slides along edges.
  - Push-out repeats for corners where walls meet.
  - Padded rectangles use rounded corners, matching collision. A test caught the old square-padding version flagging "phantom" overlaps.
- **AI steering:** soldiers feel 34 px ahead and turn by increasing angles toward the free side, keeping that side so they don't dither. The player steers the hero.
- **Cover:** trees, walls and crates **stop arrows** (GDD §6 "collision against terrain"), with a small hit puff. Rocks, bushes and fences are low cover and don't.
- **Spawns:** the hero stands at the map's anchor and allies form up around it, pushed clear of obstacles. Enemies are placed in the map's spawn box, never inside an obstacle.
- **Depth:** units and obstacles are drawn in one depth order, so soldiers pass behind trees and walls.
- **Fort garrisons:** Greywall (10 Footmen, 4 Guards, 6 Hunters, 2 Longbowmen) and Ashgate (Aurelian equivalents) show their garrison in the fort menu. Sieges come later; this is the GDD's "fort garrison info".
- **Content validation:** every map needs ground and spawns, and valid obstacle shapes; forts need valid garrisons. A content test checks every map sprite exists.

### Verification
- **Automated:** `npm test` → 167/167. The new `tests/battlemaps.test.js` (11 tests) covers:
  - map choice by terrain and near forts
  - push-out from circles and rectangles, including a centre inside a wall
  - the hero sliding past a tree, and an AI soldier steering around a tree to a goal behind it
  - which obstacles stop arrows, and a flying arrow stopped by a tree
  - on each map, nobody spawning inside an obstacle (10 seeded spawns each)
  - **no trapped units:** 6 full seeded battles per map (hero, 4 Footmen, 7 + 4 enemies) all resolve, with no living unit inside an obstacle at any check
  - fort garrisons
- **Browser:**
  - Screenshots of all three maps mid-battle: forest depth with enemies behind trees; the courtyard walls, gate, flagstones and crates; the grass field with rocks.
  - A band met at forest terrain (20, 30) was fought on the Forest Clearing.
  - Travelling to Greywall showed "Garrison: 22 (10 Footmen, 4 Guards, 6 Hunters, 2 Longbowmen)", after fixing the plurals.
  - No errors were logged.

### For the owner's playtest
- [ ] Do the trees and walls make fights more interesting, or just more fiddly on a phone?
- [ ] Does sliding along walls feel natural with the joystick?
