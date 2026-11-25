# Crownless — World Format

_From build 3.13.0 (P9-07, design §23); the checker, the preview and the second world from 3.14.0 (P9-08). A world, and a pack that adds to one, is one JSON object: a manifest and the content tables by name. Nothing in a world or a pack is ever run; the game reads it as data, checks it, and copies it into its content._

`node scripts/export-world.js [file]` writes the official world (the Sundered Realm, from `data/*.js`) in this format; `tests/packs.test.js` checks that it loads exactly as `data/*.js` does. `--world sundered_coast` writes the second official world (`data/worlds/sundered_coast.js`). The sample pack is `packs/sample/sample.json`.

## The object

```json
{
  "manifest": { "id": "sample", "title": "Highcairn (sample pack)", "author": "Crownless", "version": "1.0.0", "engine": ">=3.13.0 <5.0.0", "requires": [] },
  "troops": { "sample:cairn_herder": { "id": "sample:cairn_herder", "name": "Cairn Herder", "...": "..." } },
  "settlements": { "sample:highcairn": { "id": "sample:highcairn", "name": "Highcairn", "...": "..." } },
  "merge": { "factions": { "valedorn": { "recruits": ["levy", "hunter", "sample:cairn_herder"] } } }
}
```

### The manifest

| Field | What |
|---|---|
| `id` | 1–40 of `a–z`, `0–9` and `_`. The namespace of the pack's new entries. Not the official world's id |
| `title`, `author` | Text, shown in Settings |
| `version` | `major.minor.patch`, such as `1.0.0`. A save records it |
| `engine` | The game versions it works with, as comparators separated by spaces: `>=3.13.0 <4.0.0`, `^3.13.0`, `=3.13.0` or `3.13.0` |
| `requires` | Optional: ids of packs that must be on, and applied, before this one |
| `kind` | Optional: `pack` (the default) adds to a world; `world` is a whole world (see "Making a world"). Settings imports packs only |

### Tables

Every other key except `merge` is a table of new entries, keyed by id. Each entry's `id` field equals its key.

### `merge`

Changes fields of entries that already exist, the official world's or the pack's own: `merge.<table>.<id>` is an object of fields, each replacing the field of that name (a list or object is replaced whole). A field that exists keeps its type (a number stays a number). An entry's `id` cannot change, and a pack never deletes.

## Ids

Ids are namespaced, `world:id`. The official world's ids stay short (`stonebridge`, `levy`); `sundered_realm:stonebridge` reads as `stonebridge` wherever the game looks an id up, so a pack may name either. A pack's new entries are `<pack id>:<name>`, the name of `a–z`, `0–9` and `_` (`sample:highcairn`). Every id check, save key and story tag takes a colon.

## The tables

The official world has these (`js/content.js` `TABLES`, plus `forge` and `realm_palette`). The game checks each at load with the same rules for the official world and for packs; the list below is what an entry holds.

| Table | An entry |
|---|---|
| `factions` | A realm or the outlaws: `name`, `short`, `emblem`, `order`, `culture`, `ruler { male, female }` (the title), `color`, `description`, `initialReputation`, `recruits` (troop ids), `garrison { troop: n }`, `laws` (`power` crown\|league, `share` 0–0.5, `succession` eldest\|kin\|council, `fiefCap` 1–9, `war` ruler\|council), `freeCity` |
| `settlements` | `name`, `placeName`, `type` (village\|town\|fort), `ownerFaction`, `seat` (a village's fort or town of the same realm), `services` (trade, rest, recruit, contracts, leave), `recruits` (from 3.13.0: the place's own troops, beside its owner's; needs the recruit service), `mapX`, `mapY` (inside the world's bounds), `market { good: 0.8–1.4 }` (every trade good, where there is trade), `gear` (items the armoury sells), `garrison` (a fort's), `story`, `explorable` |
| `troops` | `name`, `faction`, `role` (infantry\|archer\|cavalry), `tier` (T1–T3), `hp`, `damage`, `armor`, `speed`, `reach`, `wage`, `recruitCost`, `upgradeTo`, `upgradeCost`, `altUpgradeTo`, `altUpgradeCost`, `shield`, `brace`, `gender`, `culture`, `look` (P10-G1: what the art kit draws, `docs/ART-STYLE.md`; optional for a pack's troop); an archer's `ranged { range, projectileSpeed, cooldown, accuracy }` |
| `items` | `name`, `type`, `slot` (weapon, offhand, head, body, hands, feet, horse, ring), `tier`, `rarity`, `value`, `weight`, `stats` (a weapon needs `damage`), `questItem`. Forged pieces (`id+1` …) are made from `forge` |
| `forge` | The blacksmith's rules: bonuses per slot, `maxLevel`, costs |
| `loot_tables` | `chancePerKill` (0–1), `table [{ item, weight }]` (no quest items) |
| `markets` | Goods: `name`, `basePrice`, `weight`, `tradeGood`, `icon` |
| `quests` | `title`, `giver`, `summary`, `stages`, `rewards`, `endings`, `side` (checked by `js/story.js`) |
| `dialogue` | Conversation trees: `speaker`, `start`, `nodes`, `place`, `visible` (conditions and effects checked by `js/story.js`) |
| `battle_maps` | A drawn map (`ground`, `decor`, `obstacles`, `spawn`) or a generated one (`generate { kind forest\|field\|ford\|hills, scale 1–4, seed }`, `small`) |
| `encounters` | Sites' fights: `name`, `enemyFaction`, `map`, `waves [{ troop: n }]`, `reward`, `loot` |
| `world_map` | The world: `name`, `start`, `bounds { w, h }` (up to 1000), `factions` (the kingdoms), `outlaws`, `relations`, `regions`, `view`, `terrain` (a speed for every kind of ground), `areas`, `waters`, `coast`, `roads`, `river`, `forests`, `hills`, `battleMaps { open, fort, … }`, `sites`, `nobles`, `armies`, `simulation`, `time` |
| `skills`, `origins`, `origin_rules` | The hero's skills; the origins a new hero chooses from (`attribute`, `skill`, `kit`, `start`, `begin`, `quest`, `situation`, `edge`; P10-05, were `backgrounds`), and the band every opening quest ends within |
| `party_templates` | Map parties: `kind` (bandit, patrol, caravan, detachment, lord), `faction`, `count`, `speed`, `troops { troop: [min, max] }`, and by kind `lairs`, `home`, `route`, `goods`, `frontier`, `toll`, `reward`, `lootBySize` |
| `contracts` | `kind` (hunt, escort, delivery), its band, troop pool, limits, distance, time limit and reward |
| `town_hubs` | A walkable town: `settlement` (an `explorable` one), `ground`, `obstacles`, `spawn`, `exitZone`, `npcs` (each with an action, frames and words or a dialogue, and a `role`: innkeeper, merchant, recruiter, elder, official or guard). Every hub needs an innkeeper, a merchant, a recruiter and an elder or official (P10-03) |
| `companions` | Mara and the retinue: `look`, `frames`, `hp`, `weaponFactor`, `skills`, `gearSlots`, `startGear`, wages and loyalty |
| `news` | News kinds: `priority`, `lines` (and by ending) |
| `world_events` | Happenings in places: where, how often, choices and outcomes |
| `tournaments` | Hosts, rounds, fees and prizes |
| `businesses` | The mill: price, input, output, managers, rules |
| `help_topics`, `tips` | How to play, and the first-time tips |
| `cultures` | Name lists (`given`, `givenFemale`, `trades`, `epithets`) and `forms` |
| `realm_palette` | The colours of realms founded in play |

## The checks

A pack is checked before it is kept and again when it is applied. Each problem says which file, which entry and what is wrong, for example `sample.json › sample:cairn_spear: troop sample:cairn_spear: unknown upgrade sample:nobody`.

- **Size and kind:** at most 2 MB, and JSON (parsed, never evaluated). Only strings, numbers, booleans, null, lists and plain objects; no key `__proto__`, `constructor` or `prototype`; nothing nested deeper than 24.
- **No code, no links:** a string that starts `javascript:`, `data:` or `vbscript:`, or holds a `<script`, is refused; so is a path that leaves the pack (`..`, a leading `/`, or a link such as `https://`).
- **The manifest:** as above; the engine range must take this build.
- **Tables and ids:** only the tables above; new ids in the pack's namespace and not already there; `id` fields equal to their keys; text fields (`name`, `title`, `description` …) are text.
- **`merge`:** only entries that exist; no change of `id`; the same type as now.
- **References and rules:** the pack is applied to a copy of the world and the game's own content checks run on it (unknown troops, factions, items and places, places off the map, a village's seat, ranges). Only problems the pack brings are reported.

## In the game

- **Settings → Content packs:** Import a pack (a `.json` file), turn each on or off, or remove it. Packs are kept in this browser (IndexedDB, database `crownless`, store `packs`); the ids of those turned on are kept in `crownless_packs_on`. A change takes effect on a new game or a reload.
- **At boot** the packs turned on are applied in the order they were turned on, before the game reads its content. One that is gone or no longer passes its checks is left out, and the title says so.
- **Saves:** a new save records the packs it began with (`packs: [{ id, version }]`, docs/SAVE-FORMAT.md). A save whose pack is not on is refused, untouched: the title says "This save needs the pack sample (version 1.0.0)", and turning the pack on and reloading opens it. A save of the official world alone opens with packs on or off.

## Making a world

A whole world is the same object with `"kind": "world"` in its manifest. It gives the tables it replaces **whole**; the tables it leaves out are the game's shared ones (items and the blacksmith's rules, goods, loot, skills and origins, contracts, news, world events, businesses, help and tips, battle maps and the companions). `merge` changes fields of those shared tables for this world (for example the retinue's homes and the tournament's hosts). A world must give at least `factions`, `settlements`, `troops` (with `hero`, and the troops the shared tables name: `looter`, `reaver`, `mercenary`, `sellsword`), `encounters`, `party_templates`, `cultures` and its one `world_map` entry, under its manifest's `id`. `quests`, `dialogue` and `town_hubs` may be empty.

- **A sandbox:** `"sandbox": true` on the world map: no story; a new campaign begins as the others are after theirs (the story flag `ending` is `sandbox`), so realms can be founded and the lords' rights are open from day one.
- **Starting relations:** `relations` (peace, tension or war between two kingdoms). The Sundered Realm's coast realms, Ostrand and Saltreach, start at war, so they move at once.
- **Edition:** `edition` (P10-02), a number raised when the world changes shape; saves of an older edition are refused and kept.
- **Lords:** `world_map.nobles` (one `ruler` a realm; `holds`, `kin`, `traits`), as in the Sundered Realm.

**Step by step.**
1. Start from the official world in the format (`node scripts/export-world.js my_world.json`), and give it a new `id`. (The Sundered Coast, a separate world from 3.14.0 to 4.1.0, is now part of the Sundered Realm: P10-02.)
2. Place its settlements, roads, rivers, regions and sites inside its `bounds`.
3. **Check it:** `npm run check-pack <folder or file> …` checks every `.json` pack or world given, with the game's own checks and messages (the same as Settings gives at import). Packs are checked in order, each with the ones before it applied, so a pack may require one given before it. Exit code 1 when anything has a problem, with each problem listed: `w.json › settlement fenwick: seat calder is not a fort or town of ostrand`.
4. **See it:** open `tools/preview.html` from a local server (`npm run serve`, then `http://localhost:8123/tools/preview.html`). Open a `.json` world or pack: it draws the map (land, coast, hills, mountains, marsh, forests, rivers and their crossings, roads, regions, sites, and every settlement in its realm's colour, a pack's new places ringed) and lists what the checks found beside it. The preview uses no game code beyond the content checks (`js/core.js`, `js/content.js`, `js/packs.js`); the story's and the realms' own rules are checked by `npm run check-pack`.
5. **Play it:** a world ships as a classic script in `data/worlds/<id>.js` that sets `CROWNLESS_WORLDS.<id>`, loaded by `index.html` before `js/worlds.js`. The bots take a world: `npm run landed -- 180 3 --world <id>`, `npm run prototype-g -- 8 2 --world <id>`, and `newCampaign(seed, background, { world })`.

## Worlds in the game

- **Which world?** A new game asks, when the build has more than one. Since 4.2.0 (P10-02) it has one, the Sundered Realm, so it never asks. Choosing another world keeps the choice (`crownless_world`) and reloads the page straight into the creator; the world is put in place (`js/worlds.js`) before anything reads the content.
- **Saves:** a save records its world (`worldId`). Opened while another world is chosen, the game opens the save's own world (a reload), and the save is untouched. A save of a world this build does not have is kept aside, as before.
- **Packs** are checked against the world in play; a pack made for one world is left out in the other, and the title says so.

## Not here

A world editor; sharing packs or worlds online; importing a whole world in Settings (the official worlds ship with the game). Packs with code (never).
