// P9-08: the pack checker. `npm run check-pack <dir or file> …` checks every .json pack or world in
// the folders and files given, by every rule of the world format (docs/WORLD-FORMAT.md), with the same
// messages the game gives at import: the game's own checks (js/packs.js, js/content.js) run in Node.
// Packs are checked in turn against the official world, each with the ones before it applied (so a
// pack may require another given before it); a whole world (`kind: "world"`) is checked alone, over
// the shared tables. Exit code 1 when anything has a problem.
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('../tests/helpers/load');

/** The .json files of the paths given: a file as it is, a folder's own .json files (sorted). */
function filesOf(paths) {
  const out = [];
  for (const p of paths) {
    const st = fs.statSync(p, { throwIfNoEntry: false });
    if (!st) out.push({ file: p, missing: true });
    else if (st.isDirectory())
      for (const f of fs.readdirSync(p).filter((x) => x.toLowerCase().endsWith('.json')).sort()) out.push({ file: path.join(p, f) });
    else out.push({ file: p });
  }
  return out;
}

/**
 * Check packs and worlds. @returns {{ file: string, ok: boolean, errors: string[], kind?: string, id?: string, entries?: number }[]}
 */
function checkPaths(paths) {
  const { CL } = loadGame({ party: false });
  const results = [];
  const present = [];
  for (const { file, missing } of filesOf(paths)) {
    const name = path.basename(file);
    if (missing) {
      results.push({ file, ok: false, errors: [`${file}: no such file or folder`] });
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    const { pack, errors } = CL.packs.parse(text, { file: name, present: present.slice() });
    if (!pack) {
      results.push({ file, ok: false, errors });
      continue;
    }
    const m = pack.manifest;
    const entries = Object.entries(pack).filter(([t]) => t !== 'manifest' && t !== 'merge').reduce((n, [, v]) => n + Object.keys(v).length, 0);
    if (m.kind !== 'world') {
      CL.packs.use([pack]); // the packs after it see it, as the game applies them in turn
      present.push(m.id);
    }
    results.push({ file, ok: true, errors: [], kind: m.kind || 'pack', id: m.id, entries });
  }
  if (!results.length) results.push({ file: paths.join(' '), ok: false, errors: ['no .json packs found'] });
  return results;
}

if (require.main === module) {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.log('usage: npm run check-pack <dir or file> …');
    process.exit(2);
  }
  let bad = 0;
  for (const r of checkPaths(paths)) {
    if (r.ok) console.log(`ok   ${r.file}: the ${r.kind} ${r.id}, ${r.entries} entries`);
    else {
      bad++;
      console.log(`FAIL ${r.file}: ${r.errors.length} problem${r.errors.length === 1 ? '' : 's'}`);
      for (const e of r.errors) console.log(`  - ${e}`);
    }
  }
  process.exit(bad ? 1 : 0);
}

module.exports = { checkPaths, filesOf };
