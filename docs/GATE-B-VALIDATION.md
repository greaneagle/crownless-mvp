# Gate B — Party Battle Slice: Validation (Build 0.5.0)

_2026-11-16. Spec: GDD §7 (troops, casualties), §9 (loot), §13 (data, saves) and §14 Gate B._

**Gate B pass criteria (GDD §14):** soldiers obey orders; battles resolve; no duplicate loot or trapped units. Scope: recruit 3–5 soldiers, use infantry and archer commands, fight 10–20 enemies, process wounded and dead, collect loot, return to map.

| Criterion | Status |
|---|---|
| Recruit, command infantry/archers, fight 10–20 enemies | **Pass.** Camp hires Levies and Hunters. Follow/Hold/Charge are unchanged from Gate A. The encounter has 14 enemies over two waves. |
| Battles resolve; wounded and dead processed | **Pass.** Each fallen soldier rolls 35% killed, otherwise wounded for 2 campaign days. Results are saved in one transaction. |
| No duplicate loot | **Pass.** The result is guarded by `battleId` against `lastResolvedBattle`, so the same battle can't pay twice even if `endBattle` runs again. Covered by tests. |
| No trapped units | **Pass (as far as this arena goes).** It's open ground with bounds clamping and no obstacles. Retest once the forest and courtyard maps add collision (Gate D). |
| Return to map | **Deferred to Gate C.** There's no world map yet, so "Return to Camp" stands in. It is the first step of Gate C. |

---

## What changed from 0.4.0

### Content is the source of truth
- `index.html` now loads all `data/*.js` files. **`js/content.js` (ContentDB)** gives typed lookups that throw on unknown IDs, and it validates every cross-reference at boot. Problems are logged to the diagnostics panel (F3).
- New **`data/encounters.js`** holds the battle definition: map, waves (troop id → count), reward and loot table. It replaces the 0.4 hardcoded wave sizes and "every 5th is a brute" rule.
- **Units are built from `data/troops.js`.** Each unit takes its HP, damage, armor, speed and reach from data, and archers get `ranged {range, projectileSpeed, cooldown, accuracy}`. The `legacy_*` troops and hardcoded stat tables are gone.
- **Troop changes (balance shift):**
  - Your camp hires Valedorn **Levies** (T1, 45 HP, 7 damage, armor 1, 15 crowns) and **Hunters** (T2 archer, 60 HP, 10 damage, armor 2, 25 crowns).
  - Enemies are **Looters** (T1) and **Reavers** (T2, 60 HP, armor 3).
  - The 0.4 soldiers had 70 HP, so troops are now squishier. The hero is unchanged at 85 HP and 18 damage.

### Combat rules
- **Armor:** `Damage = max(1, round(Raw × 100 / (100 + 4 × Armor)))` (GDD §6). For example, the hero's sword does 16 damage to a Reaver instead of 18.
- **Archers:** 60% accuracy, so a missed shot is thrown 0.12–0.25 rad off line. They shoot every 1.6 s (was 1.2 s) and fire from 225 px. The GDD's 110 px range and 180 px/s arrow speed assume sprites about 3× smaller, so we rescaled them, the same call as melee reach in Gate A. The note in `data/troops.js` documents this.
- **Melee:** each unit's reach comes from data (Levy 48, hero 67, Spearman 70), and AI soldiers start a swing just inside their reach.

### Campaign state (save v2)
- **The roster is now individual soldiers** `{id, troop, xp, woundedUntil}`, ready for troop XP and upgrades in Gate C. The party cap of 15 counts wounded soldiers (GDD §7).
- **Campaign day clock:** a battle takes ¼ day, and **Rest one day** at camp advances the clock. Wounded soldiers return after 2 days; they no longer heal instantly on "Return to Camp". The camp shows each troop type's ready and wounded counts, plus the day the wounded return.
- **Loot:** each kill gives a 30% chance of one weighted roll on the encounter table (food, clothing, boots, gloves, worn sword, leather chest, and rarely iron helm or oak shield). Loot goes into the **pack**, which is listed at camp. A 2,000-battle sample in the browser averaged 4.18 drops per 14 kills, against 4.2 expected.
- **Capture:** you keep 80% of your crowns, and **one random non-quest item is taken**. Quest items are never taken (GDD §6).
- **Save safety:**
  - Saves now use the key `crownless_save`.
  - Every write first copies the previous save to `crownless_save_backup`. If the main save is corrupt, the game loads the backup.
  - Unknown troop or item IDs, duplicate soldier IDs and malformed numbers are dropped when loading.
  - Future save versions are ignored rather than misread.
- **Migration from 0.3/0.4:**
  - The old `crownless_v03_party` save converts automatically on first load: infantry → Levy and archers → Hunter.
  - Old wounded soldiers return on day 3.
  - The old save is left untouched as an extra backup.

## Verification done

- **Automated:** `npm test` → 51/51. New and updated tests cover:
  - **Units and combat:** units built from troop data, armor mitigation, archer range and cooldown, archer accuracy hits and misses, deployment (healthy soldiers only, capped), and waves taken from the encounter.
  - **Save:** the v2 starter, round-trip with backup, corrupt main save → backup, v1 migration, sanitizing bad entries, and future-version rejection.
  - **Party:** recruit costs and cap, casualty rolls, payout exactly once, loot rolls and weights, capture item loss (never quest items), wounded recovery timing, rest, and `endBattle` linking casualties to roster soldiers.
  - **Content:** the ContentDB validator reports a clean result, and catches injected broken references.
- **Browser (desktop, plus an 812×375 landscape phone size):**
  - A seeded 0.3 save migrated correctly (5 Levies ready and 1 wounded until day 3; 2 Hunters).
  - I recruited one of each, then ran a full scripted battle: victory in 10.4 s of game time with 9 loot drops (unusually lucky).
  - Casualties showed up as wounded until day 3. Resting twice healed them, the save and backup were written, and no errors were logged.
  - The camp screen fits at phone size.

## Still to check (owner playtest)
- [ ] Balance with the GDD tier stats. Can 3 Levies and 2 Hunters plus the hero still win the trial without heavy losses? If it's too hard, tune `data/encounters.js` waves or the T1 stats.
- [ ] Does resting feel like a chore before food and wages exist? Resting is free until the Gate C upkeep arrives.
- [ ] Is the camp roster readable on a phone once the party has three or more troop types (after Gate C upgrades)?
