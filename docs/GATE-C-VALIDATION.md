# Gate C — Campaign Loop: Progress & Validation

_Spec: GDD §3 (map, travel), §8 (encounters, settlements), §14 Gate C._

**Gate C pass criteria (GDD §14):** a player can complete a contract, buy food, recruit, fight, level and reload with all state intact.

Gate C is delivered in slices. This file records each one.

| Roadmap step | Status |
|---|---|
| 1. World map, click/tap travel, time advancing | ✅ 0.6.0 |
| 2. Settlement menu (Recruit / Trade / Rest / Contracts / Leave) | 🟡 0.6.0: Recruit, Rest and Leave work. Trade (step 5) and Contracts (step 9) are still to come. |
| 3. Character creation + inventory/equipment | ⬜ |
| 4. Food & weekly wages, morale/desertion | ⬜ |
| 5. Trading (6 goods, scarcity) | ⬜ |
| 6. World parties + encounter options (Attack / Negotiate / Retreat / Auto-resolve) | ⬜ The static Reaver hideout stands in for now |
| 7. Capture on defeat | 🟡 0.6.0: released near a settlement after half a day. Loss of crowns and an item came in Gate B. |
| 8. Player XP/levels/skills; troop upgrades; party-cap formula | ⬜ |
| 9. Bandit-hunt contract | ⬜ |
| 10. Save export/import | ⬜ |
| 11. Gate C acceptance | ⬜ |

---

## Slice 1 — 0.6.0: The Border March map (2026-11-16)

Closes Gate B's deferred "return to map".

### What's in
- **New flow:** Title → **world map** ↔ **settlement** menus. A map **site** leads to an **encounter**, then the battle, the result, and back to the map. The camp screen is gone.
- **`data/world_map.js`**:
  - The Border March: two roads (west–east trade road, north–south fort road) and a river splitting Valedorn (west) from Aurelian (east).
  - Two forest areas and some hills.
  - One **Reaver Hideout** site linked to the `captains_trial` encounter.
  - It's validated at boot along with the rest of the content.
- **Travel (`js/world.js`):**
  - Click or tap a settlement, the hideout or open ground to travel there.
  - Speed = 4 map-units/hour × terrain (road 1.2, grass 1.0, forest 0.75), per GDD §3. The party-load factor stays 1.0 until there's cargo to carry.
  - Distance is measured in screen proportions, so a journey takes as long as it looks. Stonebridge → Eastwatch is about 3 h on the road; crossing the map is about a day.
  - Time passes while travelling (4 game hours per real second), and wounded soldiers heal along the way. Space halts the party.
- **Settlements:**
  - All 10 are on the map, with an icon shape for each type (town, fort, village) and a **faction-colour banner with a letter emblem** (GDD §11: not colour alone).
  - Each menu only shows services that work today.
  - Recruits depend on the settlement's owner: Valedorn offers Levy and Hunter, Aurelian offers Recruit and Skirmisher (`recruits` in `data/factions.js`).
  - Rest is only possible in settlements that offer it. Entering a settlement autosaves (GDD §13).
- **Hideout:**
  - Arriving opens an encounter screen with **Attack** or **Leave**.
  - Victory clears the hideout for **3 days**. It shows as "(cleared)", and visiting it then just shows a message.
  - The party returns to the map where the battle was fought.
- **Capture:** half a day in captivity, then release at the nearest kingdom-owned settlement (GDD §6). This is applied inside the exactly-once battle-result transaction.
- **Save:**
  - `campaign.world` stores position, current settlement and site timers. It's sanitized on load (bad coordinates clamped, unknown places dropped).
  - Older saves start inside Stonebridge.
- **Phone readability:** map labels are 14 px and settlements have a 28 px tap radius, about 38 CSS px across on an 812×375 screen. Battle-only controls (joystick, Attack/Block, Orders, Pause) are hidden outside battle.
- **Content fix:** the faction descriptions said north/south; they now say west/east, matching the GDD.

### Verification
- **Automated:** `npm test` → 62/62. The new `tests/world.test.js` covers:
  - **Terrain:** terrain types and speeds, and forest being slower than grass.
  - **Travel:** Stonebridge → Eastwatch time matches the estimate, the clock advances, arrival opens the menu and autosaves, wounded heal while travelling, and click hit-testing.
  - **Settlements:** faction recruits, and no rest on the open map.
  - **Hideout:** encounter → battle → cleared for 3 days → returns.
  - **Capture:** the time skip and release point.
  - **Save:** sanitizing the world state, and the clock label.
- **Browser:**
  - **Desktop:**
    - Title → Stonebridge menu → Leave → **a real mouse click** on Eastwatch. The party walked the road and arrived at Day 1, 03:00.
    - The Aurelian recruits were offered there, and I hired one.
    - Travelled to the hideout, attacked and won a full battle. Continue returned the party to the hideout, now shown as "(cleared)", and the HUD showed the time and wounded.
  - **Phone-sized (812×375):**
    - After a reload, the save restored the position, site timer and loot.
    - **A real tap** just off Stonebridge's icon travelled there and opened its menu.
    - No errors were logged.

### Known limits of this slice
- The river doesn't block travel and has no fords or bridges yet. Roads only make travel faster.
- The hideout is the only fight on the map. Moving bandits, patrols and caravans (step 6) will replace it as the main source of battles.
- Nothing costs anything over time yet (food and wages are step 4), so waiting and resting are free.
- The battle is always fought on the grass arena. The other two battle maps come in Gate D.
