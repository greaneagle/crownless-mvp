# Crownless — Save Format v2 (frozen at v1.0)

_Frozen with the v1.0 release (build 1.0.0, 2026-11-17). v2 will introduce schema v3 through explicit migrations (`docs/V2-PLAN.md` V2-01); this page is the reference those migrations start from. The test fixtures in `tests/fixtures/saves-v1.0/` are real saves in this format, and `tests/save-fixtures.test.js` keeps them loading._

## Where saves live
| Key (browser localStorage) | What |
|---|---|
| `crownless_save` | The current campaign (the JSON below) |
| `crownless_save_backup` | The previous save, written before every save; loaded, with a notice, if the current one can't be read |
| `crownless_save_pre_import` | The save that was replaced by the last import (Save & export → Restore) |
| `crownless_v03_party` | A 0.3.x save (schema v1), migrated on first load and left as a further backup |

These live in their own keys and are **not part of a save**: `crownless_settings` (device settings), `crownless_tips_seen` (tips already shown), `crownless_last_export` (export reminders), `crownless_dev` (developer tools).

## Exported file
`Save & export` writes JSON:

| Field | Meaning |
|---|---|
| `format` | Always `"crownless-save"` |
| `version` | The save schema version, `2` |
| `game` | The build that wrote it, for example `"1.0.0"` |
| `exportedAt` | An ISO timestamp |
| `checksum` | FNV-1a (8 hex digits) of `JSON.stringify(campaign)`, which catches damage and hand edits (integrity, not security) |
| `campaign` | The campaign object below |

**Import is strict:** it rejects malformed files, newer versions, checksum mismatches and any unknown ID (troops, items, settlements, factions, quests, goods, contracts, news kinds). The current save is never touched by a failed import. Text pasted from chat apps may carry a BOM, code fences or a note around the JSON; only the JSON object is kept.

## The campaign object (schema v2)
Every field is validated on load by `CL.save.sanitize` and the modules it calls, so unknown or out-of-range values fall back to safe defaults. Older v2 saves that lack later fields get their defaults; there is no separate migration step inside v2.

| Field | Type | Owner module | Notes |
|---|---|---|---|
| `version` | `2` | save | |
| `gold`, `renown`, `battles`, `victories` | integers ≥ 0 | save, party | Capped at 99,999 |
| `day` | number | party | Campaign days elapsed (fractional); 6 game hours = 0.25 |
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

## Things the v3 migration will need to handle (from the v2 plan)
- Named soldiers (V2-03): add a name, origin and service record to every roster entry; existing soldiers get names on load.
- A canonical clock (V2-04): the flat 6-hour battle charge goes away, and saved timers stay valid.
- Accounts (V2-11): split `gold` into the player's purse, the company chest and follower budgets.
- Holdings (Phase 8): `owners` grows into sovereign, holder, occupier and administrator.
- Add `worldId` and `contentVersion`, and structural validation that rejects partial saves (today a near-empty `{ "version": 2 }` is accepted and filled with defaults).
