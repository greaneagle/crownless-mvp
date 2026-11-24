// P9-07: the official world written out in the world format (docs/WORLD-FORMAT.md): one JSON object,
// a manifest and every table of data/*.js as it is. `node scripts/export-world.js [file]` writes it
// (default: dist/<world id>.json); tests/packs.test.js loads it and compares it with data/*.js.
// P9-08: `--world <id>` writes another official world's package (data/worlds/*.js) instead.
const fs = require('node:fs');
const path = require('node:path');
const { loadContent, loadWorlds } = require('../tests/helpers/load');

const ROOT = path.join(__dirname, '..');
const BUILD = /CL\.BUILD = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'js', 'core.js'), 'utf8'))[1];

/** The world in the format: `{ manifest, factions, settlements, … }`, every table as plain JSON. */
function exportWorld(content = loadContent()) {
  const [w] = Object.values(content.world_map || {});
  const out = { manifest: { id: w.id, title: w.name, author: 'Crownless', version: BUILD, engine: `>=${BUILD}`, kind: 'world', requires: [] } };
  for (const [t, v] of Object.entries(content)) out[t] = JSON.parse(JSON.stringify(v));
  return out;
}

/** P9-08: another official world (data/worlds/*.js) as its package: its own tables and merge, as they are. */
function exportPackage(id) {
  const w = loadWorlds()[id];
  if (!w) throw new Error(`no world ${id} in data/worlds (there are: ${Object.keys(loadWorlds()).join(', ')})`);
  return w;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--world');
  const world = at >= 0 ? exportPackage(args.splice(at, 2)[1]) : exportWorld();
  const file = args[0] || path.join(ROOT, 'dist', `${world.manifest.id}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(world, null, 1)}\n`);
  console.log(`${file}: ${Object.keys(world).length - 1} tables, ${Math.round(fs.statSync(file).size / 1024)} KB`);
}

module.exports = { exportWorld, exportPackage };
