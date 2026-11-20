// P7-T: the Phase 7 exit (design §26.3) as a scripted 90-day scenario. "An independent player builds a
// lasting company with non-combat roles, delegates, earns through trade or property, and meets dynamic
// consequences, without needing a title." The expert bot (tests/helpers/campaign-bot.js) plays 90 days
// of the real campaign with the world's events running, saving at day 45 and playing on from the
// reloaded save (scripts/prototype-g.js). Two seeds; about two minutes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../../scripts/prototype-g');

for (const seed of [1, 2]) {
  test(`the Phase 7 exit holds over 90 days (seed ${seed})`, () => {
    const r = run(seed, 'expert', 90);
    // A lasting company: still there at day 90, resumed from its save, never stuck or starving.
    assert.equal(r.resumed, true, 'resumed from the day-45 save');
    assert.ok(r.day >= 90 - 1e-6);
    assert.ok(r.soldiers >= 10, `soldiers: ${r.soldiers}`);
    assert.equal(r.stuck, 0);
    assert.ok(r.warnings <= 6, `hardship warnings: ${r.warnings}`);
    // Non-combat roles.
    assert.ok(r.roles >= 4, `roles kept at day 90: ${r.followers}`);
    for (const who of ['surgeon', 'scout', 'blacksmith', 'quartermaster']) assert.ok(r.hired.includes(who), `${who} hired (${r.hired})`);
    // It delegates: a quartermaster buys, detachments go out under their captains and come back.
    assert.ok(r.detachments >= 3 && r.detachmentsBack >= 1, `detachments sent ${r.detachments}, back ${r.detachmentsBack}`);
    // It earns through trade or property: a mill that has run and made money, or a merchant up on its stake.
    assert.ok((r.millWeeks >= 1 && r.mill > 0) || r.merchantWorth > 150, `mill ${r.mill} over ${r.millWeeks} weeks; merchant ${r.merchantWorth}`);
    assert.ok(r.money > 500, `money: ${r.money}`);
    // It meets dynamic consequences: the world's events, the news, and a chronicle of its own.
    assert.ok(r.eventsSeen >= 3 && r.events >= 1, `events seen ${r.eventsSeen}, joined ${r.events}`);
    assert.ok(r.news > 0 && r.chronicle > 0);
    // Without a title: it holds no land.
    assert.equal(r.titled, false);
  });
}
