// Economy report (V2-T1): where the money comes from and goes, across seeded campaigns played by the
// campaign bot, from every transfer in the ledger. For tuning passes.
//   node scripts/economy-report.js [days=60] [seeds=12] [--roam]   (--roam, W-08: the bot tours the realm)
const path = require('node:path');
const ROOT = process.env.CL_ROOT || path.join(__dirname, '..');
const { loadGame } = require(path.join(ROOT, 'tests/helpers/load'));
const { makeBot, headlessUi } = require(path.join(ROOT, 'tests/helpers/campaign-bot'));
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const nums = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
const days = Number(nums[0] || 60), seeds = Number(nums[1] || 12);
const roam = process.argv.includes('--roam'); // W-08: the bot tours every capital's board
const cat = (why) => {
  if (/^spoils/.test(why)) return 'spoils';
  if (/contract/.test(why)) return 'contracts';
  if (/^quest|^story/.test(why)) return 'quests/story';
  if (/^market: sold|^sold /.test(why)) return 'sales (goods, loot)';
  if (/^market: bought/.test(why)) return 'trade goods';
  if (/^armoury/.test(why)) return 'gear';
  if (/rations/.test(why)) return 'food';
  if (/^hiring a (?!quartermaster|merchant)/.test(why)) return 'hiring';
  if (/training/.test(why)) return 'training';
  if (/wages/.test(why)) return 'wages';
  if (/captors/.test(why)) return 'captors';
  if (/^toll/.test(why)) return 'tolls';
  return why;
};
const tot = { in: {}, out: {} };
const marks = { gold15: [], gold30: [], gold60: [], renown30: [], renown60: [], level60: [], soldiers60: [], t3share60: [], starvedMsgs: 0, unpaid: 0, desert: 0, deaths: 0, wins: 0, losses: 0 };
for (let seed = 1; seed <= seeds; seed++) {
  const msgs = [];
  const { CL } = loadGame({ party: false, random: mulberry(seed * 7919), seed });
  CL.ui = headlessUi(CL, msgs); CL.game.newGame = true; CL.character.begin({ name: 'B', origin: 'farmhand', plain: true });
  const c = CL.campaign; c.rngSeed = seed; c.parties = []; c.partySpawns = {}; c.nextPartyId = 1; CL.parties.ensure(c, true);
  if (CL.accounts) {
    c.ledger = [];
    c.ledger.push = function (e) { if (e.from === 'world') tot.in[cat(e.why)] = (tot.in[cat(e.why)] || 0) + e.amount; if (e.to === 'world') tot.out[cat(e.why)] = (tot.out[cat(e.why)] || 0) + e.amount; return Array.prototype.push.call(this, e); };
  }
  const bot = makeBot(CL, { roam });
  let s = { wins: 0, losses: 0 };
  for (const [upto, key] of [[15, 'gold15'], [30, 'gold30'], [days, 'gold60']].filter(([u], i) => u < days || i === 2)) {
    const r = bot.play(upto - Math.floor(c.day));
    s = r;
    marks[key].push(c.gold + (c.accounts?.chest || 0));
    if (upto === 30) marks.renown30.push(c.renown);
  }
  marks.renown60.push(c.renown); marks.level60.push(c.character.level); marks.soldiers60.push(c.roster.length);
  marks.t3share60.push(c.roster.length ? c.roster.filter((x) => CL.content.troop(x.troop).tier === 'T3').length / c.roster.length : 0);
  marks.starvedMsgs += msgs.filter((m) => /run out of food/.test(m)).length;
  marks.unpaid += msgs.filter((m) => /Wages short/.test(m)).length;
  marks.desert += CL.diag.events.filter((e) => e.msg === 'Desertion').length;
  marks.deaths += (c.honour?.list || []).filter((h) => h.how === 'fell').length + (c.honour?.earlier?.fell || 0);
  marks.wins += s.wins; marks.losses += s.losses;
}
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const per = (n) => Math.round(n / seeds / days * 10) / 10;
console.log(`${seeds} campaigns × ${days} days`);
console.log('income per campaign-day:', Object.entries(tot.in).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${per(v)}`).join(', '));
console.log('spending per campaign-day:', Object.entries(tot.out).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${per(v)}`).join(', '));
console.log(`money (median): day 15 ${med(marks.gold15)}, ${days > 30 ? `day 30 ${med(marks.gold30)}, ` : ""}day ${days} ${med(marks.gold60)}; renown ${days > 30 ? `day 30 ${med(marks.renown30)}, ` : ""}day ${days} ${med(marks.renown60)}; level ${med(marks.level60)}; soldiers ${med(marks.soldiers60)} (T3 share ${Math.round(med(marks.t3share60) * 100)}%)`);
console.log(`per campaign: wins ${(marks.wins / seeds).toFixed(1)}, losses ${(marks.losses / seeds).toFixed(1)}, soldiers fallen ${(marks.deaths / seeds).toFixed(1)}, wages short ${(marks.unpaid / seeds).toFixed(1)}, ran out of food ${(marks.starvedMsgs / seeds).toFixed(1)}, desertions ${(marks.desert / seeds).toFixed(1)}`);
