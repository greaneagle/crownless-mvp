// P10-04: choose your kingdom, and the main story from anywhere. The story keeps its shape and beats;
// its places, realms and people are cast from the map around the kingdom you begin in (js/story.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./helpers/load');
const { newCampaign } = require('../scripts/simulate-campaign');

const plain = (x) => JSON.parse(JSON.stringify(x));

/** Every string in the story's data (quests, dialogue, the news that names it). */
function storyStrings(CL) {
  const out = [];
  const walk = (x) => {
    if (typeof x === 'string') out.push(x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  walk(CL.content.table('quests'));
  walk(CL.content.table('dialogue'));
  walk(CL.content.table('news'));
  return out;
}

const say = (CL, conv, re) => {
  const o = conv.options.find((x) => re.test(x.text));
  assert.ok(o, `no option ${re} in ${conv.options.map((x) => x.text).join(' | ')}`);
  return CL.story.choose(conv, o.index);
};

test('every realm can be chosen, and its cast resolves to its own places, a neighbour and its people', () => {
  const { CL } = loadGame({ party: false });
  const S = CL.content.table('settlements');
  const realms = Array.from(CL.story.startRealms());
  assert.deepEqual(realms, ['valedorn', 'aurelian', 'hrothmark', 'vessaro', 'ostrand', 'saltreach'], 'every realm, no free city');
  for (const realm of realms) {
    const k = CL.story.castFor(realm);
    assert.ok(k, realm);
    assert.equal(k.crown, realm);
    assert.notEqual(k.rival, realm);
    assert.ok(realms.includes(k.rival), `${realm}: the rival is a realm`);
    const own = (id, f, type) => S[id]?.ownerFaction === f && S[id].type === type;
    assert.ok(own(k.home, realm, 'town'), `${realm}: home is its town`);
    assert.ok(own(k.village, realm, 'village') && own(k.border, realm, 'village'), `${realm}: its villages`);
    assert.ok(own(k.fort, realm, 'fort'), `${realm}: the contested fort is its own`);
    assert.ok(own(k.rival_fort, k.rival, 'fort') && own(k.rival_town, k.rival, 'town'), `${realm}: the rival's fort and town`);
    assert.equal(S[k.fence_town].type, 'village');
    assert.notEqual(k.fence_town, k.village);
    assert.ok(CL.world.map().sites[k.camp]?.encounter, `${realm}: an outlaws' lair to clear`);
    // The people: the start town's elder and recruiter by role, and both realms' envoys and the caravan master.
    CL.campaign.story.cast = k;
    for (const role of ['elder', 'recruiter', 'crown_agent', 'rival_agent', 'caravan']) {
      const p = CL.story.person(role);
      assert.ok(p?.name && p.short, `${realm}: ${role}`);
    }
    assert.equal(CL.story.person('elder').npc, CL.town.cast(k.home, 'elder').id);
  }
  // Begun in Valedorn, the cast is the Border March's, as the story was written.
  assert.deepEqual(plain(CL.story.castFor('valedorn')), {
    crown: 'valedorn', rival: 'aurelian', home: 'stonebridge', village: 'oakford', border: 'brackenfield', fort: 'greywall_fort',
    rival_fort: 'ashgate_fort', rival_town: 'eastwatch', fence_town: 'highmere', camp: 'looter_camp',
  });
  assert.equal(CL.story.defaultRealm(), 'valedorn', 'the realm holding the world’s start');
  assert.deepEqual(Array.from(CL.content.validate()), []);
});

test('no story text is left uncast, from any kingdom', () => {
  const { CL } = loadGame({ party: false });
  const strings = storyStrings(CL).filter((t) => /\{[Cc]ast:/.test(t));
  assert.ok(strings.length > 100, 'the story is written by role');
  for (const realm of CL.story.startRealms()) {
    CL.campaign.story.cast = CL.story.castFor(realm);
    for (const t of strings) {
      const out = CL.story.format(t, CL.campaign);
      assert.doesNotMatch(out, /\{[Cc]ast:|undefined|null/, `${realm}: ${t}`);
      assert.doesNotMatch(out, /\b(crown_agent|rival_agent|rival_town|rival_fort|fence_town|recruiter\.|elder\.)\b/, `${realm}: ${out}`);
    }
  }
  // A few words, begun in Hrothmark.
  CL.campaign.story.cast = CL.story.castFor('hrothmark');
  const f = (t) => CL.story.format(t, CL.campaign);
  assert.equal(f('{cast:fort.place}'), 'Skarnwall');
  assert.equal(f('{Cast:crown.banner} and {cast:rival.a} column'), 'The Mark and an Aurelian column');
  assert.equal(f('{cast:rival_agent}, {cast:rival_agent.title}, {cast:rival_agent.his}'), 'Magistrate Vell, the magistrate, her');
  assert.equal(f('{cast:elder}'), 'Gudrun Lawspeaker', 'no elder in Hrothgard: its official');
});

test('a new game begins in the chosen kingdom’s start town, its story cast and its common quest begun', () => {
  const { CL } = newCampaign(3, 'farmhand', { realm: 'ostrand' });
  const c = CL.campaign;
  assert.equal(c.startRealm, 'ostrand');
  assert.equal(c.world.location, 'harrowgate');
  const k = c.story.cast;
  assert.equal(k.rival, 'saltreach');
  // The common quest is under way: the journal points at the elder.
  assert.equal(CL.story.questStatus(c, 'q1'), 'active');
  assert.equal(CL.story.currentQuest(c).objective, 'Find work: talk to Steward Liv in Harrowgate.');
  // The story's two realms are held in tension (begun at war on the coast), and its forts are locked.
  assert.equal(CL.realm.relation(c, 'ostrand', 'saltreach'), 'tension');
  assert.equal(CL.realm.storyHeld(c, 'ostrand', 'saltreach'), true);
  assert.equal(CL.realm.storyHeld(c, 'valedorn', 'aurelian'), false, 'the March pair is not the story’s now');
  assert.equal(CL.realm.locked(c, 'coldkeep'), true);
  assert.equal(CL.realm.locked(c, 'rookmoor'), true);
  assert.equal(CL.realm.locked(c, 'greywall_fort'), false);
  // The story's land is where its places are: the gentler bands and the "Beyond" tip follow it.
  const at = (sid) => CL.world.regionAt(CL.content.get('settlements', sid).mapX, CL.content.get('settlements', sid).mapY, c);
  assert.equal(at('harrowgate').home, true);
  assert.equal(at('calder').home, true);
  assert.equal(at('stonebridge').home, false);
  // Saved and loaded, the cast is the same.
  CL.save.write();
  const back = CL.save.load();
  assert.equal(back.startRealm, 'ostrand');
  assert.deepEqual(plain(back.story.cast), plain(k));
  // A save without a known realm begins where the world does.
  const junk = CL.save.sanitize({ ...plain(c), startRealm: 'merrow' });
  assert.equal(junk.startRealm, 'valedorn');
});

test('in the start town’s streets the elder and recruiter speak the story; the envoy and Mara stand at its spots', () => {
  const { CL } = newCampaign(4, 'farmhand', { realm: 'hrothmark' });
  const c = CL.campaign;
  const people = Array.from(CL.town.peopleOf('hrothgard'));
  const by = (id) => people.find((n) => n.id === id);
  assert.equal(by(CL.town.cast('hrothgard', 'elder').id).dialogue, 'story_elder');
  assert.equal(by(CL.town.cast('hrothgard', 'recruiter').id).dialogue, 'story_recruiter');
  const agent = by('crown_agent');
  assert.equal(agent.name, 'Thane Eyvind');
  assert.deepEqual([agent.x, agent.y], [CL.town.hubFor('hrothgard').spots[0].x, CL.town.hubFor('hrothgard').spots[0].y]);
  // Stonebridge is no one's start here: its people keep to their own trades.
  assert.equal(CL.town.peopleOf('stonebridge').some((n) => n.dialogue), false);
  // The rival's envoy and caravan master stand in its town, and are on its menu too.
  const east = plain(CL.town.streetPeople('eastwatch').map((p) => p.id).sort());
  assert.deepEqual(east, ['caravan_master', 'rival_agent']);
  assert.equal(CL.town.peopleOf('eastwatch').find((n) => n.id === 'caravan_master').name, 'Caravan Master Oswin');
  // The elder speaks the story's opening, in Hrothgard's words.
  let v = CL.story.talk('story_elder', c);
  assert.equal(v.speaker, 'Gudrun Lawspeaker');
  assert.match(v.text, /^Welcome to Hrothgard/);
  v = say(CL, v, /work for me/);
  assert.match(v.text, /A grain wagon waits at Eldmoor/);
  assert.match(v.text, /Reavers out of the Raider Steading/);
  assert.ok(v.options.some((o) => o.text === 'I’ll help Halvar Axehand.'));
});

test('Q1 from another kingdom: the wagon from its own village, the ambush on its own road, its realm’s thanks', () => {
  const { CL } = newCampaign(5, 'farmhand', { realm: 'saltreach' });
  const c = CL.campaign;
  const k = c.story.cast;
  let v = say(CL, CL.story.talk('story_elder', c), /work for me/);
  say(CL, v, /grain wagon from Marlow/);
  assert.equal(CL.story.state(c).quests.q1.stage, 'q1_wagon_go');
  CL.story.emit('enter', { settlement: 'marlow' }, c);
  assert.equal(CL.story.state(c).quests.q1.stage, 'q1_wagon_back');
  const band = c.parties.find((p) => p.questTag === 'q1_ambush');
  const [a, b] = ['marlow', 'calder'].map((id) => CL.content.get('settlements', id));
  assert.ok(Math.abs(band.x - (a.mapX + b.mapX) / 2) < 0.01 && Math.abs(band.y - (a.mapY + b.mapY) / 2) < 0.01, 'on the road home');
  CL.story.emit('battle', { win: true, tag: 'q1_ambush' }, c);
  assert.equal(CL.story.state(c).quests.q1.stage, 'q1_report');
  const rep = c.reputation.saltreach;
  v = CL.story.talk('story_elder', c);
  assert.equal(v.node, 'q1_report');
  v = say(CL, v, /What is it/);
  assert.equal(CL.story.questStatus(c, 'q1'), 'done');
  assert.equal(c.reputation.saltreach, rep + 10, 'the reward goes to your own realm');
  assert.match(v.text, /A caravan master in Harrowgate/);
  // The journal says where the story goes on, and that it can be left.
  const row = CL.story.journal(c).find((r) => r.id === 'q1');
  assert.match(row.notes.join(' '), /The story goes on with Caravan Master Arne in Harrowgate, if you want it\. Or leave it/);
  assert.equal(k.rival_town, 'harrowgate');
});

test('the story’s columns and hosts are the cast realms’ own soldiers; the parley sits at the contested fort', () => {
  const { CL } = newCampaign(6, 'farmhand', { realm: 'vessaro' });
  const c = CL.campaign;
  const s = CL.story.state(c);
  s.quests.q3 = { status: 'active', stage: 'q3_choose', notes: [], startedDay: 0, stageDay: 0 };
  CL.story.setStage(c, 'q3', 'q3_strike_rival');
  const col = c.parties.find((p) => p.questTag === 'q3_column');
  assert.equal(col.template, 'valedorn_patrol', 'the rival is Valedorn');
  assert.deepEqual(plain(col.troops), { footman: 4, hunter: 3, levy: 3 });
  CL.parties.open(col.id);
  assert.equal(CL.parties.current().name, 'Valedorn Supply Column');
  CL.game.partyId = null;
  s.quests.q3.status = 'done';
  s.quests.q4 = { status: 'active', stage: 'q4_declare', notes: [], startedDay: 0, stageDay: 0 };
  CL.story.setStage(c, 'q4', 'q4_field_rival');
  const host = c.parties.find((p) => p.questTag === 'q4_host');
  assert.equal(host.template, 'vessaro_patrol', 'for the rival you face your own realm’s host');
  assert.equal(Object.values(host.troops).reduce((a, b) => a + b, 0), 17);
  CL.story.setStage(c, 'q4', 'q4_terms');
  assert.deepEqual(plain(CL.story.peopleAt('torre_salina', c).map((t) => t.id)), ['story_parley']);
  // The ending sets the fort and the two realms' relation.
  s.flags.q4_side = 'rival';
  const v = CL.story.talk('story_parley', c);
  assert.equal(v.speaker, 'The Parley at Salina');
  say(CL, v, /passes to the Crown/);
  assert.equal(CL.realm.owner('torre_salina', c), 'valedorn');
  assert.equal(s.flags.ending, 'rival');
  assert.equal(CL.realm.relation(c, 'vessaro', 'valedorn'), 'war');
  assert.equal(CL.realm.locked(c, 'torre_salina'), false, 'after the ending the usual rules take over');
});
