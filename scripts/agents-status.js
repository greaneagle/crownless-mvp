// D-AG1 (docs/AGENTS-WORKFLOW.md): who is working on what. Every local branch but `main`: its agent and
// task (from `<agent>/<task-id>-<slug>`), its worktree and uncommitted files, how far it is ahead of and
// behind `main`, its last commit, the files it changed; then, for each pair of branches, the files both
// changed (an overlap means: stop and ask before building further).
//   npm run agents            (or: node scripts/agents-status.js [--json])
const { execFileSync } = require('node:child_process');

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);

function worktrees() {
  const out = {};
  let path = null;
  for (const l of lines(git('worktree', 'list', '--porcelain'))) {
    if (l.startsWith('worktree ')) path = l.slice(9);
    if (l.startsWith('branch refs/heads/')) out[l.slice(18)] = path;
  }
  return out;
}

function status() {
  const wt = worktrees();
  const branches = lines(git('for-each-ref', '--format=%(refname:short)', 'refs/heads')).filter((b) => b !== 'main');
  return branches.map((b) => {
    const [behind, ahead] = git('rev-list', '--left-right', '--count', `main...${b}`).split(/\s+/).map(Number);
    const m = b.match(/^([^/]+)\/([a-z0-9]+-[a-z0-9]+)(?:-(.*))?$/i);
    const dirty = wt[b] ? lines(git('-C', wt[b], 'status', '--porcelain')).length : 0;
    return {
      branch: b,
      agent: m ? m[1] : '?',
      task: m ? m[2].toUpperCase() : '?',
      worktree: wt[b] || null,
      ahead,
      behind,
      uncommitted: dirty,
      last: git('log', '-1', '--format=%cr · %s', b),
      files: lines(git('diff', '--name-only', `main...${b}`)),
    };
  });
}

if (require.main === module) {
  const rows = status();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(rows, null, 2));
  } else if (!rows.length) console.log('No agent branches: everything is on main. Start one: docs/AGENTS-WORKFLOW.md §2.');
  else {
    for (const r of rows) {
      console.log(`${r.branch}  [${r.agent} · ${r.task}]  ${r.ahead} ahead, ${r.behind} behind main${r.uncommitted ? `, ${r.uncommitted} uncommitted` : ''}`);
      console.log(`  worktree: ${r.worktree || '(none)'}`);
      console.log(`  last: ${r.last}`);
      console.log(`  files: ${r.files.length ? r.files.join(', ') : '(none yet)'}`);
    }
    // Two branches of the same task, or two branches changing the same file.
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const [a, b] = [rows[i], rows[j]];
        if (a.task !== '?' && a.task === b.task) console.log(`\n!! ${a.branch} and ${b.branch} are both ${a.task}`);
        const both = a.files.filter((f) => b.files.includes(f) && !f.startsWith('docs/changes/'));
        if (both.length) console.log(`\n!! ${a.branch} and ${b.branch} both change: ${both.join(', ')}`);
      }
    }
  }
}

module.exports = { status };
