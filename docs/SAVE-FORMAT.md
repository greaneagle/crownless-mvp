# Crownless — Save Format

_Current: **schema v6**, from build 1.5.0 (V2-03b); v5 came with 1.4.0 (V2-03), v4 with 1.3.0 (V2-02), v3 with 1.2.0 (V2-01). Schema v2 was frozen with the v1.0 release (build 1.0.0, 2026-11-17); its full field list is kept below as the reference, because v3 to v6 only add fields to it. Saves from every older build still load: see "Loading" and the fixtures._

## Where saves live
All save keys are read and written through the storage layer (`CL.storage`, `js/storage.js`). In the browser that is localStorage; a packaged build can swap in another backend (IndexedDB, a desktop app's files) with `CL.storage.use(backend)`.

| Key | What |
|---|---|
| `crownless_save` | The current campaign (the JSON below) |
| `crownless_save_backup` | The last known good save: the previous save, copied before each write **only if it is complete**. Loaded, with a notice, if the current one can't be read |
| `crownless_save_pre_import` | The save that was replaced by the last import (Save & export → Restore). Removed only once a restore is stored |
| `crownless_save_v2` … `crownless_save_v5` | From 1.2.0: a save of that older schema exactly as it was when a later build first migrated it (`crownless_save_v<n>`). Written once, never replaced (a further way back if a migration ever goes wrong) |
| `crownless_v03_party` | A 0.3.x save (schema v1), migrated on first load and left as a further backup |

These live in their own keys and are **not part of a save**: `crownless_settings` (device settings), `crownless_tips_seen` (tips already shown), `crownless_last_export` (export reminders), `crownless_dev` (developer tools).

## Exported file
`Save & export` writes JSON:

| Field | Meaning |
|---|---|
| `format` | Always `"crownless-save"` |
| `version` | The save schema version: `6` from build 1.5.0, `5` in 1.4.0, `4` in 1.3.0, `3` in 1.2.0, `2` from 0.5.0 to 1.1.0 |
| `game` | The build that wrote it, for example `"1.2.0"` |
| `exportedAt` | An ISO timestamp |
| `checksum` | FNV-1a (8 hex digits) of `JSON.stringify(campaign)`, which catches damage and hand edits (integrity, not security) |
| `campaign` | The campaign object below |

**Import is strict:** it rejects malformed files, checksum mismatches, newer schema versions, saves from another world, **partial saves** (see "Loading") and any unknown ID (troops, items, settlements, factions, quests, goods, contracts, news kinds), listing what is wrong. The current save is never touched by a failed import. **An import only reports success once the imported game is stored**; if storage is full or the game is open in another tab, it reports failure and puts the current game and the earlier pre-import copy back exactly as they were. Text pasted from chat apps may carry a BOM, code fences or a note around the JSON; only the JSON object is kept.

## Loading (from 1.2.0)
Everything read back, from storage, a file or the pre-import slot, goes through `CL.save.fromRaw` (imports run the same steps in `CL.portable.parse`):
1. **Structure** (`CL.save.check`): the save must have every field its own schema version always had, with the right kind of value. Otherwise it is rejected with a list such as `"news" is missing`. A near-empty `{ "version": 2 }` is no longer accepted and filled with defaults.
   - v1: `gold`.
   - v2: `gold`, `renown`, `battles`, `victories`, `day`, `nextSoldierId`, `roster`, `inventory`, `lastResolvedBattle` (what v2 had from 0.5.0; fields added later in v2 still get their defaults).
   - v3: all of v2, plus `worldId`, `contentVersion`, `world`, `character` (or null), `equipment`, `food`, `morale`, `nextWagesDay`, `markets`, `cargo`, `rngSeed`, `parties`, `partySpawns`, `nextPartyId`, `contract` (or null), `contractOffers`, `reputation`, `owners`, `story`, `companion` (or null), `news`.
   - v4: all of v3, plus `rng`, `nextResultId`, `nextEventId`.
   - v5: the same top-level fields as v4 (the new soldier fields are repaired one by one, see below).
   - v6: all of v5, plus `troopKnowledge`.
2. **World:** a v3 save must belong to this world (`worldId`).
3. **Migrations** (`CL.save.MIGRATIONS`): pure steps from schema n to n + 1, applied in order. v1 → current is `migrateV1` (it builds soldiers from the old counts).
   - **2 → 3 (1.2.0):** adds `worldId: "border_march"` and `contentVersion: "unknown"` (which build wrote a v2 save was never recorded). Nothing else changes.
   - **3 → 4 (1.3.0):** adds `rng`, the named random streams, each seeded from `rngSeed` and the stream's name (so the same save always gets the same streams), and `nextResultId: 1` and `nextEventId: 1`. Nothing used them before. Nothing else changes.
   - **4 → 5 (1.4.0):** every soldier becomes a named person: a name and culture (from the troop's faction, drawn from a `names` stream seeded by the save's own seed, so the same save always gets the same names), `origin: null` and `joined: null` (never recorded), `portrait: null`, an empty record and one note, `veteran` ("served before the company kept records"). Adds `rng.names`. Nothing else changes.
   - **5 → 6 (1.5.0):** adds `troopKnowledge`: every troop in the roster, and the troops they were trained from, as `owned`, and what those can be trained into as `seen`. Nothing else changes.
4. **Repair** (`CL.save.sanitize`): field by field, as in v2. Unknown or out-of-range values fall back to safe defaults.

If the main save fails any step, the backup is tried, then the 0.3 key, then a new game.

## Writing (from 1.2.0)
- The previous save is copied to the backup only if it passes the structure check, so a damaged save can never replace a good backup.
- A write counts only when the stored text reads back unchanged. A full or failing store reports failure (and the player is told to export).
- `contentVersion` is stamped with the build on every write.
- **Autosave:** after battles, in settlements, when the page is hidden or closed, and, from 1.2.0, once per game day while time passes on the map (travelling or waiting).

## Fixtures
Saves written by real builds, loaded by every later build:

| Folder | Build | Schema | Made by | Checked in |
|---|---|---|---|---|
| `tests/fixtures/saves-0.3/` | 0.3.x | v1 | Hand-written from `docs/BASELINE.md` §6 (that build had no bots) | `tests/save-migration.test.js` |
| `tests/fixtures/saves-0.14/` | 0.14.0 (Gate C) | v2 | That build's own campaign bot and Save & export (`scripts/make-legacy-save-fixtures.js`) | `tests/save-migration.test.js` |
| `tests/fixtures/saves-0.28/` | 0.28.0 (Gate D) | v2 | That build's campaign and story bots (`scripts/make-legacy-save-fixtures.js`) | `tests/save-migration.test.js` |
| `tests/fixtures/saves-v1.0/` | 1.0.0 | v2 | `scripts/make-save-fixtures.js` | `tests/save-fixtures.test.js` |
| `tests/fixtures/saves-1.2/` | 1.2.0 | v3 | That build's campaign and story bots (`scripts/make-legacy-save-fixtures.js`) | `tests/save-migration.test.js` |
| `tests/fixtures/saves-1.3/` | 1.3.0 | v4 | The same way | `tests/save-migration.test.js` |
| `tests/fixtures/saves-1.4/` | 1.4.0 | v5 | The same way | `tests/save-migration.test.js` |

Each is imported as a file and, for v2 to v5, also left in storage as the old build would have, then checked against what the old build recorded about it (soldier IDs, troops, XP, gold, day, quests), re-exported, and played on. Never regenerate them casually; they stand for real players' saves.

## The campaign object (schema v6)
Schema v6 is schema v2 (below) plus these fields (v3 added the first two, v4 the next three, v6 the last), and every `roster` entry is a named soldier (v5, next section).

| Field | Type | Owner module | Notes |
|---|---|---|---|
| `version` | `6` | save | |
| `worldId` | string | save | The world (content package) the campaign belongs to: `"border_march"`. A save from another world is refused |
| `contentVersion` | string | save | The build that last wrote the save, for example `"1.2.0"`; `"unknown"` right after migrating a v2 save. Later content migrations can key off it |
| `rng` | `{ casualties, loot, upkeep, names }`, integers | autoresolve | v4. The named random streams' states (mulberry32). `casualties`: who dies or is wounded after a fought battle (auto-resolve rolls its whole outcome, casualties included, on the world stream, as before); `loot`: battle loot and the item taken on capture; `upkeep`: desertion; `names` (v5): soldiers' names. The world stream stays in `rngSeed` (world parties, contract offers, auto-resolve, retreat). Moment-to-moment rolls inside a fought battle are not seeded |
| `nextResultId` | integer ≥ 1 | encounter | v4. The ID the next encounter result commits under. Each encounter takes it when it opens; the commit goes through only for that ID and then moves it on, so a result is applied exactly once |
| `nextEventId` | integer ≥ 1 | events | v4. The next domain event's ID; event IDs never repeat within a campaign |
| `troopKnowledge` | `{ troopId: 'seen' or 'owned' }` | troops | v6. The troop tree as discovered. `seen`: met in battle or offered for hire (name only); `owned`: hired, trained or upgraded into (full details); its upgrade targets are then at least `seen`. Only grows. Unknown troops and values are dropped on load |

### A soldier (`roster` entry, schema v5)
`{ id, troop, xp, woundedUntil, name, culture, origin, joined, portrait, record, notes }`. Each field is repaired on load by `CL.soldiers.sanitize`; a soldier is never dropped for a bad person field (a missing name is drawn again).

| Field | Type | Notes |
|---|---|---|
| `id`, `troop`, `xp`, `woundedUntil` | as in v2 | |
| `name` | string, 1–24 characters | From the culture (`data/names.js`), or as the player renamed them. No control characters or angle brackets |
| `culture` | culture ID | The troop's culture, else the origin's, else the origin owner's faction's |
| `origin` | settlement ID or `null` | Where they joined; `null` on the open road or before records were kept |
| `joined` | number or `null` | Campaign day they joined; `null` before records were kept |
| `portrait` | string or `null` | An art slot for a later portrait (an asset file name); `null` today |
| `record` | `{ battles, victories, kills, assists, wounds, captures, wagesPaid }`, integers ≥ 0 | Kept by listening to events (js/soldiers.js). `wagesPaid` counts crowns actually received |
| `notes` | up to 8 `{ day, kind, … }` | `kind` is `joined` (`place`), `veteran`, `wounded` (`foe`), `promoted` (`to`), `captured` or `notable` (`kills`, `foe`). The joining note stays; the oldest of the rest go first |

## The campaign object (schema v2, frozen at v1.0)
Every field is validated on load by `CL.save.sanitize` and the modules it calls, so unknown or out-of-range values fall back to safe defaults. Older v2 saves that lack later fields get their defaults; there is no separate migration step inside v2.

| Field | Type | Owner module | Notes |
|---|---|---|---|
| `version` | `2` | save | |
| `gold`, `renown`, `battles`, `victories` | integers ≥ 0 | save, party | Capped at 99,999 |
| `day` | number | party, clock | Campaign days elapsed (fractional); 6 game hours = 0.25. Moved only by `js/clock.js` (from 1.6.0) |
| `nextSoldierId` | integer | save | Soldier IDs are never reused |
| `roster` | `[{ id, troop, xp, woundedUntil }]` | save, party | `troop` is a troop ID; `woundedUntil` is a day or `null`; at most 200 |
| `inventory` | `{ itemId: count }` | save, character | The pack; quest items included |
| `lastResolvedBattle` | integer | party | Battle IDs at or below it are already applied (exactly once) |
| `world` | `{ x, y, location, sites }` | world | Map position; `location` is a settlement ID or `null`; `sites[id].clearedUntil` |
| `character` | `{ name, gender, cloak, background, attributes, skills, level, xp, skillPoints, attributePoints }` | character | `null` before character creation |
| `equipment` | `{ weapon, offhand, head, body, hands, feet, horse, ring }` | character | Item IDs or `null`, checked against each slot |
| `food`, `morale`, `nextWagesDay`, `starving` | numbers / boolean | upkeep | Rations; morale 0–100 |
| `markets` | `{ settlementId: { good: scarcity } }` | trade | Scarcity clamped to 0.8–1.4 |
| `cargo` | `{ good: count }` | trade | Trade goods carried |
| `rngSeed` | integer | parties / autoresolve | The seeded world and auto-resolve randomness |
| `parties` | `[{ id, template, x, y, troops, tx, ty, ignoreUntil, alerted, … }]` | parties | Optional per kind: `lair`, `routeIndex`, `good`, `contractId`, `questTag`, `camp`, `anchor`, `ambush`, `escortTo` |
| `partySpawns` | `{ templateId: day }` | parties | Respawn timers |
| `nextPartyId` | integer | parties | |
| `contract` | object or `null` | contracts | Fields in fixed order: `id, template, giver, days, offeredUntil, to, letter / good, qty, deposit, troops, x, y, reward, status, deadline, partyId, ambushId, payAt` |
| `contractOffers` | `{ settlementId: { templateId: offer, "<template>_until": day } }` | contracts | One offer per template; a taken offer is `null` until the board refills |
| `nextContractId`, `contractsDone` | integers | contracts | |
| `reputation` | `{ valedorn, aurelian }` | realm | −100 … 100 |
| `owners` | `{ fortId: factionId }` | realm | Only the forts; every other place keeps its content owner |
| `story` | `{ flags, quests, visits }` | story | `quests[id] = { status, stage, notes, startedDay, stageDay?, endedDay?, expired? }` (`expired` is the ID of the stage whose deadline already ran out); `flags` hold booleans, strings or numbers (for example `ending`, `q2_choice`, `mara_saved`) |
| `companion` | `{ id, woundedUntil, equipment, away? }` or `null` | companion | Mara, once she joins |
| `news` | `{ events, lines, next, clashUntil, turns? }` | news | Recent world events (≤ 24), bulletins (≤ 8), the next bulletin day, the frontier-clash timer, line rotation |

## Schema steps still to come (from the v2 plan)
Each task that changes the save's shape adds the next schema version and its migration step (v4, v5, …), with fixtures.
- ✅ v3 (1.2.0, V2-01): `worldId` and `contentVersion`; structural validation that rejects partial saves; migration framework; storage layer.
- ✅ v4 (1.3.0, V2-02): named random streams (`rng`), the encounter result counter (`nextResultId`) and the event ID counter (`nextEventId`).
- ✅ v5 (1.4.0, V2-03): named soldiers with origin, joining day, portrait slot, service record and notes; existing soldiers get names on load.
- ✅ v6 (1.5.0, V2-03b): what the company knows of each troop (`troopKnowledge`).
- A canonical clock (V2-04): the flat 6-hour battle charge goes away, and saved timers stay valid.
- Accounts (V2-11): split `gold` into the player's purse, the company chest and follower budgets.
- Holdings (Phase 8): `owners` grows into sovereign, holder, occupier and administrator.
