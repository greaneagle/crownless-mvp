// P9-07: the official world written out in the world format (docs/WORLD-FORMAT.md): one JSON object,
// a manifest and every table of data/*.js as it is. `node scripts/export-world.js [file]` writes it
// (default: dist/<world id>.json); tests/packs.test.js loads it and compares it with data/*.js.
const fs = require('node:fs');
const path = require('node:path');
const { loadContent } = require('../tests/helpers/load');

const ROOT = path.join(__dirname, '..');
const BUILD = /CL\.BUILD = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'js', 'core.js'), 'utf8'))[1];

/** The world in the format: `{ manifest, factions, settlements, … }`, every table as plain JSON. */
function exportWorld(content = loadContent()) {
  const [w] = Object.values(content.world_map || {});
  const out = { manifest: { id: w.id, title: w.name, author: 'Crownless', version: BUILD, engine: `>=${BUILD}`, kind: 'world', requires: [] } };
  for (const [t, v] of Object.entries(content)) out[t] = JSON.parse(JSON.stringify(v));
  return out;
}

if (require.main === module) {
  const world = exportWorld();
  const file = process.argv[2] || path.join(ROOT, 'dist', `${world.manifest.id}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(world, null, 1)}\n`);
  console.log(`${file}: ${Object.keys(world).length - 1} tables, ${Math.round(fs.statSync(file).size / 1024)} KB`);
}

module.exports = { exportWorld };
