# Crownless — Save Format

_Current: **schema v20**, from build 2.26.0 (P8-01); v19 came with 2.24.0 (P8-02); v18 came with 2.21.0 (P7-10); v17 came with 2.20.0 (P7-09); v16 came with 2.19.0 (P7-08); v9 came with build 1.16.0 (V2-12); v8 came with 1.15.0 (V2-11), v7 with 1.14.0 (V2-10), v6 with 1.5.0 (V2-03b), v5 with 1.4.0 (V2-03), v4 with 1.3.0 (V2-02), v3 with 1.2.0 (V2-01). Schema v2 was frozen with the v1.0 release (build 1.0.0, 2026-11-17); its full field list is kept below as the reference, because v3 to v9 only add fields to it. Saves from every older build still load: see "Loading" and the fixtures._

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
   - v7: all of v6, plus `chronicle` (an array) and `honour` (an object).
   - v8: all of v7, plus `accounts` (an object), `ledger` (an array) and `followers` (an object).
   - v9: the same top-level fields as v8 (the merchant lives inside `followers`).
2. **World:** a v3 save must belong to this world (`worldId`). From 2.7.0 (W-05b, decision D-W2) the world is `sundered_realm`, so every save of the old Border March (`border_march`, every build up to 2.6.0) is refused: on load the game begins a new campaign, says so once, and keeps the old save untouched in `crownless_save_other_world`; an import is refused with the reason. The schema did not change (still v9).
3. **Migrations** (`CL.save.MIGRATIONS`): pure steps from schema n to n + 1, applied in order. v1 → current is `migrateV1` (it builds soldiers from the old counts).
   - **2 → 3 (1.2.0):** adds `worldId: "border_march"` and `contentVersion: "unknown"` (which build wrote a v2 save was never recorded). Nothing else changes.
   - **3 → 4 (1.3.0):** adds `rng`, the named random streams, each seeded from `rngSeed` and the stream's name (so the same save always gets the same streams), and `nextResultId: 1` and `nextEventId: 1`. Nothing used them before. Nothing else changes.
   - **4 → 5 (1.4.0):** every soldier becomes a named person: a name and culture (from the troop's faction, drawn from a `names` stream seeded by the save's own seed, so the same save always gets the same names), `origin: null` and `joined: null` (never recorded), `portrait: null`, an empty record and one note, `veteran` ("served before the company kept records"). Adds `rng.names`. Nothing else changes.
   - **5 → 6 (1.5.0):** adds `troopKnowledge`: every troop in the roster, and the troops they were trained from, as `owned`, and what those can be trained into as `seen`. Nothing else changes.
   - **6 → 7 (1.14.0):** adds `chronicle: [{ day, kind: "begun" }]` (the chronicle begins on the day of the migration) and an empty roll of honour, `honour: { list: [], earlier: { fell: 0, deserted: 0, retired: 0 } }`. Nobody who left before was recorded. Nothing else changes.
   - **7 → 8 (1.15.0):** adds `accounts: { chest: 0, budgets: {} }`, `ledger: []` and `followers: { quartermaster: null }`. The old `gold` stays as it was: it is your purse. Nothing else changes.
   - **8 → 9 (1.16.0):** adds `followers.merchant: null`. Nothing else changes.
   - **14 → 15 (2.17.0, P7-06):** adds `retinue: []`. Nothing else changes.
   - **13 → 14 (2.16.0, P7-05):** adds `detachments: []`. Nothing else changes.
   - **12 → 13 (2.15.0, P7-02):** adds `followers.scout: null`. Nothing else changes.
   - **11 → 12 (2.13.0, P7-03):** adds `followers.blacksmith: null`. Forged gear (`arming_sword+1`) and a soldier's `kit` need no step: nobody had them. Nothing else changes.
   - **10 → 11 (2.12.0, P7-01):** adds `medicine: 0` and `followers.surgeon: null`; the quartermaster's new `medicine` rule is filled in on repair (4). Nothing else changes.
   - **9 → 10 (2.9.0, W-07):** adds `relations: {}`. Repair then fills in every pair of the world's kingdoms as its data starts them (the March pair in tension). Nothing else changes.
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
| `tests/fixtures/saves-1.13/` | 1.13.0 | v6 | The same way | `tests/save-migration.test.js` |
| `tests/fixtures/saves-1.14/` | 1.14.0 | v7 | The same way | `tests/save-migration.test.js` |
| `tests/fixtures/saves-1.15/` | 1.15.0 | v8 | The same way | `tests/save-migration.test.js` |
| `tests/fixtures/saves-2.0/` | 2.0.0 (0415109) | v9 | The same way, made at W-00 (2.1.0) before any Phase W content change. Border March saves: refused from 2.7.0, so their tests run on the March as it was (`tests/helpers/old-march.js`) | `tests/save-migration.test.js`, the browser tests (`tests/browser/load-save.spec.js`) |
| `tests/fixtures/saves-2.7/` | 2.7.0 (W-05b) | v9 | The same way, from the working tree: the first saves of the bigger world; the 9 → 10 step starts from them | `tests/realm-world.test.js`, `tests/world-sim.test.js`, the browser tests |
| `tests/fixtures/saves-2.25/` | 2.25.0 (00d28aa) | v19 | The same way and the same set, from a clean checkout before P8-01: the 19 → 20 step starts from them | `tests/lords.test.js` |
| `tests/fixtures/saves-2.23/` | 2.23.0 (9826a3e) | v18 | The same way, from a clean checkout made before P8-02 changed anything: a fresh game, the day-20 campaign, the story bot's play, Q4 ended for Aurelia through the real parley with a mill at Brackenfield, and a Phase 7 company (four followers, Sigrun, a mill at Birkholm); the 18 → 19 step starts from them | `tests/holdings.test.js` |

Each is imported as a file and, for v2 to v9, also left in storage as the old build would have, then checked against what the old build recorded about it (soldier IDs, troops, XP, gold, day, quests), re-exported, and played on. Never regenerate them casually; they stand for real players' saves.

## The campaign object (schema v20)
Schema v20 is schema v2 (below) plus these fields, less `owners` (v19 replaced it with `holdings`) (v3 added the first two, v4 the next three, v6 `troopKnowledge`, v7 `chronicle` and `honour`, v8 `accounts`, `ledger` and `followers`; v9 adds the merchant inside `followers`; v10 `relations`; v11 `medicine` and the surgeon inside `followers`; v12 the blacksmith inside `followers`; v13 the scout inside `followers`; v14 `detachments`; v15 `retinue`; v16 `happenings`; v17 `tourney`; v18 `businesses`; v19 `people`, `rulers`, `nextPersonId` and `holdings`; v20 `prisoners`), and every `roster` entry is a named soldier (v5, next section).

| Field | Type | Owner module | Notes |
|---|---|---|---|
| `version` | `20` | save | |
| `prisoners` | up to 40 `{ lord, by, since, led, offerDay, offered, checked, release }` | lords | v20 (P8-01). Lords held captive. `by`: `player`, or a realm (off-screen). `led`: soldiers they led (the ransom is 100 + 25 each). `offerDay`: when their kin's next offer comes (yours only). `checked`: the last whole day their escape was rolled. `release`: when a realm's captive comes home (off-screen only). A record for nobody, a ruler, a lord held twice or by their own realm is dropped; a lord with a record is `captive` and has no party; a `captive` with no record is set free |
| `people` | `{ "person:<n>": { id, key, name, gender, realm, home, kin, traits, status, heldBy } }` | realm | v19 (P8-02). The people of the realms (the world data's `nobles`; Merrow, a free city, has none). `key`: their id in the data, or null. `gender`: `male` or `female`. `realm`: a kingdom of the world. `home`: a settlement. `kin`: `[{ person, tie: 'parent' \| 'child' \| 'sibling' \| 'cousin' \| 'spouse' }]`, to people who exist. `traits`: a short line (≤ 80). `status`: `free`, `captive` or `wounded`; `heldBy`: who holds them captive, or null. Rank is never stored: a lord is great, lesser or landless by what they hold. A person of an unknown realm is dropped; missing ones come back from the world data |
| `rulers` | `{ realm: personId }` | realm | v19 (P8-02). Who holds each realm's ruler's office (an office, not a kind of person). A ruler who isn't of that realm falls back to the world data's |
| `nextPersonId` | integer ≥ 1 | realm | v19 (P8-02). The next person's id, above every id in `people` |
| `holdings` | `{ settlementId: { kind, sovereign, holder, controller, seat, administrator, claims } }` | realm | v19 (P8-02). One per settlement of a kingdom. `kind`: `village`, `fort` or `town`. `sovereign`: the realm that claims it. `holder`: a person of that realm (or `player`), never null: the ruler when no lord holds it. `controller`: the kingdom with its gates; a village's is always its seat's. `seat` (villages): the fort or town it follows, from the world data. `administrator`: null until P8-05. `claims`: `[{ by, realm, since, kind: 'granted' \| 'conquest' \| 'old' }]`, once per claimant, never its holder. Bad values fall back to the world data's. **A holding naming a kingdom this build doesn't have refuses the save** (SC-33: kept in `crownless_save_incompatible`, naming the kingdom and place) |
| `businesses` | `{ owned, past }` | business | v18 (P7-10). `owned`: at most one mill `{ kind: 'mill', place, bought, paid, owner (the owner it last saw), manager ('miller' \| 'master'), rules: { maxInput, minOutput } (null or a listed limit), seizeOn (null or the day a Hostile owner seizes it), weeks, profit, log: [{ day, text, bad? }], book: [ledger lines of its own money] }`; its money is `accounts.budgets.mill`. `past`: `[{ kind, place, day, end: 'sold' \| 'seized', by? }]`. A mill in a settlement without a market is dropped |
| `tourney` | `{ hosts, open, bracket, rival }` | tourney | v17 (P7-09). Tournaments. `hosts`: per host town `{ next, wins, entered }` (the next tournament's day, your wins there, the day you last entered). `open`: those taking entries `{ host, start, until, fighters: 7 × { name, culture, skill, rival? } }`. `bracket`: `null` or yours `{ host, start, fee, fighters, rounds (slot lists per round, you are slot 0), round (0–2), bout }`; a `bout` still set on load was left unfinished and counts as lost. `rival`: `null` or `{ name, culture, skill, from, beatYou, beaten }`. A broken bracket is dropped |
| `happenings` | `{ open, past, cool, next, nextId }` | happenings | v16 (P7-08). World events. `open`: up to 3 `{ id, kind, place, start, until, seen, taken, gold?, dest?, partyId? }` (`kind` from `data/world_events.js`; one per place; a courier's `dest`; an infestation's band `partyId`, whose party carries `eventId`, and without which the event is dropped). `past`: the last 20 `{ id, kind, place, day, result, dest? }`, `result` one of that kind's results. `cool`: `"kind|region" → day` before that kind may start again in that region. `next`: the day of the next daily check. Junk is dropped; a band whose event is gone becomes an ordinary band |
| `retinue` | up to 3 `{ id, woundedUntil, equipment, loyalty, unpaid, warned, warnedDay?, why, detached? }` | retinue | v15 (P7-06). Companions of the wider world (see "Schema steps") |
| `detachments` | up to 12 `{ id, captain: { kind: 'soldier' \| 'companion' \| 'none', id }, captainName, soldiers, order, status, since, start, purse, food, unpaid, leg, recallAt, log, tally, report?, ended? }` | detachments | v14 (P7-05). Parts of the company sent off under a captain: `soldiers` are full soldier records (out of `roster`; IDs unique across both), `order` `{ objective: 'hunt' \| 'road', x, y, road, days, until, retreatBelow (0.5, 0.34 or 0), avoidStronger, autonomy: 'judgement' \| 'exact' }`, `status` `out`, `returning` or `back` (the last few kept as reports). Each active one has a world party with `detachment: id` (template `company_detachment`), re-made at the company if missing; their purses together are `accounts.budgets.detachments`. The companion leading one carries `detached: id` |
| `medicine` | integer 0–99 | surgeon | v11 (P7-01). The company's medicine: one saves one soldier the surgeon tends after a battle. Bought at markets; captors take half |
| `worldId` | string | save | The world (content package) the campaign belongs to: `"sundered_realm"` from 2.7.0 (`"border_march"` before). A save from another world is refused (and, on load, kept in `crownless_save_other_world`) |
| `contentVersion` | string | save | The build that last wrote the save, for example `"1.2.0"`; `"unknown"` right after migrating a v2 save. Later content migrations can key off it |
| `rng` | `{ casualties, loot, upkeep, names }`, integers | autoresolve | v4. The named random streams' states (mulberry32). `casualties`: who dies or is wounded after a fought battle (auto-resolve rolls its whole outcome, casualties included, on the world stream, as before); `loot`: battle loot and the item taken on capture; `upkeep`: desertion; `names` (v5): soldiers' names. The world stream stays in `rngSeed` (world parties, contract offers, auto-resolve, retreat). Moment-to-moment rolls inside a fought battle are not seeded |
| `nextResultId` | integer ≥ 1 | encounter | v4. The ID the next encounter result commits under. Each encounter takes it when it opens; the commit goes through only for that ID and then moves it on, so a result is applied exactly once |
| `nextEventId` | integer ≥ 1 | events | v4. The next domain event's ID; event IDs never repeat within a campaign |
| `troopKnowledge` | `{ troopId: 'seen' or 'owned' }` | troops | v6. The troop tree as discovered. `seen`: met in battle or offered for hire (name only); `owned`: hired, trained or upgraded into (full details); its upgrade targets are then at least `seen`. Only grows. Unknown troops and values are dropped on load |
| `chronicle` | up to 80 `{ day, kind, … }`, oldest first | chronicle | v7. The company chronicle. `kind`: `founded` (a new game), `begun` (a migrated save), `recruited` (`place`, `names` ≤ 6, `n`: one entry per place and day), `promoted` (`names`, `n`, `to`: one per troop and day), `battle` (`foe`, `win`, `kills`, `fallen` names ≤ 6, `lost`, `auto`: losses, battles where someone fell, or 8+ enemies defeated), `deserted` and `retired` (`id`, `name`), `quest` (`quest`, `status`: `done` or `failed`). Once full, the oldest go, but the first entry stays. Unknown kinds, quests and troops are dropped on load |
| `honour` | `{ list, earlier }` | chronicle | v7. The roll of honour. `list`: up to 60 `{ id, name, troop, culture, origin, joined, left, how, foe, battles, victories, kills, wounds, wagesPaid }`, oldest first; `how` is `fell`, `deserted` or `retired`; a fallen soldier's last battle is counted. `earlier`: `{ fell, deserted, retired }`, counts of those pushed off the list |
| `accounts` | `{ chest, budgets }`, whole crowns ≥ 0 | accounts | v8. `gold` (v2) is your purse; `chest` is the company chest (wages are paid from it first, then the purse; the quartermaster buys from it; captors take the same share of it as of the purse); `budgets` are followers' own funds by name (`merchant`, from 1.16.0). Every change of money goes through `CL.accounts.transfer` |
| `ledger` | up to 60 `{ day, from, to, amount, why }` | accounts | v8. The newest money transfers. `from` and `to` are `purse`, `chest`, `budget:<name>` or `world`; `amount` is a whole number above 0; `why` is at most 60 characters. Bad entries are dropped on load |
| `relations` | `{ "a|b": { state, since, heat, losses, lastClash, incidentUntil } }` | realm | v10 (W-07). One entry per pair of the world's kingdoms, keyed by their ids in order. `state`: `peace`, `tension` or `war`; `since`: the day it began; `heat`: clashes in tension (four make war), cooling one per 8 quiet days; `losses`: soldiers fallen in this war's clashes; `lastClash`: a day or null; `incidentUntil`: no new border incident before this day. Unknown pairs are dropped and missing ones filled from the world's data on load |
| `followers` | `{ quartermaster }` | quartermaster | v8. `quartermaster` is `null` or `{ name, culture, origin, hired, reserveDays (0–14), budget (null: automatic, from 1.18.0; or 0–1000 a week), coverWages, weekStart, spent, unpaid (0–1), warnedDay, log }` (log: up to 20 `{ day, text }`). A follower without a name is dropped on load. v9: `merchant` is `null` or `{ name, culture, origin, hired, preset ('cautious' or 'bold'), active, stock { good: units }, paid { good: crowns they cost }, since { good: day first bought } (from 1.18.0; an older save counts from the day it loads), prices { settlement: { good: { buy, sell, day } } }, unpaid (0–1), log }` (log: up to 20 `{ day, text }`); its cash is `accounts.budgets.merchant`. Unknown goods and markets are dropped on load |

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
| `notes` | up to 8 `{ day, kind, … }` | `kind` is `joined` (`place`), `veteran`, `wounded` (`foe`), `promoted` (`to`), `captured`, `notable` (`kills`, `foe`) or, from 1.17.0, `feted` (`place`: feasted at home, a V2-Q errand). The joining note stays; the oldest of the rest go first |

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
- ✅ v7 (1.14.0, V2-10): the company chronicle (`chronicle`) and the roll of honour (`honour`).
- ✅ v9 (1.16.0, V2-12): the merchant follower (`followers.merchant`, with its cash in `accounts.budgets.merchant`).
- ✅ v10 (2.9.0, W-07): relations between kingdoms (`relations`).
- ✅ v20 (2.26.0, P8-01): lords on the map. `prisoners` (see the campaign object); a migrated save holds none. Each free lord, not a ruler, rides with one world party in `parties` (template `lord_<realm>`, kind `lord`, `lordId`, `intent`: `patrol` \| `campaign` \| `ride` \| `hunt` \| `clash` \| `home` \| `rest` \| `chase` \| `search`, with `kin` for `ride` and `restUntil` for `rest`): a v19 save gets them on load, formed at each lord's home. A person gains optional `deeds` (`[{ by, kind: 'freed' \| 'ransomed' \| 'held' \| 'held_kin', day }]`, ≤ 12, for P8-07) and `regroup` (back from captivity: rides out with 40% of their ranks); a lord whose home another realm holds now makes a seat of their own, or the capital, their `home`. News kinds `lord_beaten`, `lord_captured`, `lord_ransomed`.
- ✅ v19 (2.24.0, P8-02): holdings (`holdings`), the people of the realms (`people`, `nextPersonId`) and the rulers' offices (`rulers`) replace `owners`. The step is pure: for the Sundered Realm it builds them from constants written into it (the world as 2.24.0 begins it, `V19_SUNDERED` in `js/save.js`), and a fort whose owner had changed (Q4's Greywall) passes to its new kingdom as sovereign and controller, held by its ruler, with its villages; the original holders keep `old` claims. A save of another world (only the tests' worlds) keeps just its owner overrides, and loading completes it from that world's data. `owners` is dropped, and is no longer a field a v19 save must have. Also a chronicle entry `{ kind: 'holding', event: 'gained' \| 'lost' \| 'changed', place, by? }` (only when you are a party to it), a news kind `fief_granted`, and the domain event `HoldingChanged`.
- ✅ v18 (2.21.0, P7-10): businesses (`businesses`, see the campaign object); a migrated save owns none. Also a chronicle entry `{ kind: 'business', event: 'bought' | 'sold' | 'seized', place, by? }`, the trade good `flour` in `markets` (filled from the baseline on load) and the account `budget:mill`.
- ✅ v17 (2.20.0, P7-09): tournaments (`tourney`, see the campaign object); a migrated save has fought none, and each host's next tournament falls on its usual schedule. Also a chronicle entry `{ kind: 'tourney', place, result: 'champion' | 'final' | 'out', foe, round }`.
- ✅ v16 (2.19.0, P7-08): world events (`happenings`, see the campaign object); a migrated save starts with none, its first check the next day. Also optional: a news event's `text` (a line already written, ≤ 300 characters), a world party's `eventId` and a chronicle entry `{ kind: 'happening', event, result, place, dest?, n? }`.
- (2.18.0, P7-07, no schema step) optional fields: a soldier's `trait` (`steadfast`, `cautious` or `impulsive`), a soldier note `{ kind: 'trait', trait }` and a roll-of-honour entry's `trait`; unknown values are dropped on load.
- ✅ v15 (2.17.0, P7-06): companions of the wider world (`retinue`: `[{ id, woundedUntil, equipment, loyalty (0–100), unpaid, warned, warnedDay?, why, detached? }]`); unknown ids, duplicates, Mara and companions whose `<id>_gone` flag is set are dropped; a detachment captain of the retinue is relinked by its `detached`.
- ✅ v14 (2.16.0, P7-05): detachments (`detachments`).
- ✅ v13 (2.15.0, P7-02): the scout (`followers.scout`: `{ name, culture, origin, hired, unpaid (0–1), log }`).
- (2.14.0, P7-04, no schema step) optional fields: `world.hidden` (the Hide stance, only while true), and a party's `lastSeen: { x, y, until }` (where it last saw the company, and until when it searches there) and `seenAt: { x, y, day }` (where the company last saw it); all repaired or dropped on load.
- ✅ v12 (2.13.0, P7-03): the blacksmith (`followers.blacksmith`: `{ name, culture, origin, hired, unpaid (0–1), log }`); forged gear is ordinary item ids (`<item>+1`, `+2`, made from `data/items.js` `forge`), in `equipment` and `inventory`; a soldier may carry `kit: true` (at most five; extras are dropped on load).
- ✅ v11 (2.12.0, P7-01): the surgeon (`followers.surgeon`: `{ name, culture, origin, hired, unpaid (0–1), saved, log }`) and `medicine`; the quartermaster's `medicine` reserve rule (0–20).
- ✅ v8 (1.15.0, V2-11): separate accounts (`accounts`: the company chest and follower budgets; `gold` is your purse), the `ledger`, and camp `followers` (the quartermaster).
- A canonical clock (V2-04): the flat 6-hour battle charge goes away, and saved timers stay valid.
- Holdings (Phase 8): `owners` grows into sovereign, holder, occupier and administrator.
