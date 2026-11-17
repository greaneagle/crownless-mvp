# Save fixture from build 0.3.x (schema v1)

`crownless_v03_party.json` is the value the 0.3.x build kept in localStorage under `crownless_v03_party`: aggregate troop counts, no soldier IDs. It is hand-written from `docs/BASELINE.md` §6 (the 0.3.0 save format), because that build was a single minified file with no bots to play it. `tests/save-migration.test.js` loads it into every later build.
