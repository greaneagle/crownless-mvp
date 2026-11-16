/* Crownless canvas rendering and battle HUD text. */
(function (root) {
  'use strict';
  const CL = root.Crownless;
  const { W, H } = CL;

  let ctx = null;

  // [tile index, x, y, w, h] decorative world props on the grass field.
  const PROPS = [
    [91, 40, 70, 49, 57],
    [91, 850, 75, 58, 63],
    [34, 71, 430, 65, 72],
    [50, 864, 411, 65, 72],
    [110, 550, 90, 54, 55],
    [121, 120, 89, 57, 62],
  ];
  const FACE_ANGLE = { up: -Math.PI / 2, right: 0, down: Math.PI / 2, left: Math.PI };

  function init(canvas) {
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
  }

  function drawImage(key, x, y, w, h) {
    const im = CL.assets.imgs[key];
    if (im?.complete && im.naturalWidth) ctx.drawImage(im, Math.round(x), Math.round(y), w, h);
  }

  function drawGround() {
    ctx.fillStyle = '#71904e';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.24;
    for (let y = 0; y < H; y += 64) {
      for (let x = 0; x < W; x += 64) {
        const k = (x * 3 + y * 7) % 5 === 0 ? 'w0001' : (x + y) % 3 === 0 ? 'w0002' : 'w0000';
        drawImage(k, x, y, 65, 65);
      }
    }
    ctx.restore();

    // Dirt arena.
    ctx.fillStyle = '#a28e61';
    ctx.beginPath();
    ctx.ellipse(481, 271, 320, 182, 0, 0, Math.PI * 2);
    ctx.fill();

    // Grass speckles.
    ctx.fillStyle = '#8d9560';
    for (let i = 0; i < 60; i++) {
      ctx.fillRect((i * 167 + 53) % W, (i * 113 + 39) % H, 4, 2);
    }

    ctx.save();
    ctx.globalAlpha = 0.75;
    for (const [i, x, y, w, h] of PROPS) drawImage(CL.assets.key('w', i), x, y, w, h);
    ctx.restore();

    ctx.strokeStyle = '#2c3c2e';
    ctx.lineWidth = 12;
    ctx.strokeRect(12, 12, W - 24, H - 24);
  }

  function unitFrames(u) {
    const { heroFrames, allyArt } = CL.assets;
    if (u.role === 'hero') return heroFrames[u.face];
    if (u.role === 'infantry') return allyArt.infantry;
    if (u.role === 'archer') return allyArt.archer;
    return [u.art || 92];
  }

  function drawUnit(u) {
    if (!u?.alive) return;
    const hero = u.role === 'hero';
    const sh = hero ? 74 : 43;
    const sw = hero ? 58 : 37;
    const x = u.x - sw / 2;
    const y = u.y - sh + 8;

    // Shadow.
    ctx.fillStyle = '#172b1f66';
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + 4, sw * 0.4, 8, 0, 0, 7);
    ctx.fill();

    const frames = unitFrames(u);
    const frame = frames[Math.floor(u.anim) % frames.length];
    if (u.flash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
    }
    drawImage(CL.assets.key('u', frame), x, y, sw, sh);
    if (u.flash > 0) ctx.restore();

    if (u.attack > 0) {
      ctx.strokeStyle = u.team === 'ally' ? '#f9e4b3' : '#f0a18c';
      ctx.lineWidth = 5;
      ctx.beginPath();
      const a = FACE_ANGLE[u.face];
      ctx.arc(u.x, u.y - 18, hero ? 42 : 27, a - 0.45, a + 0.45);
      ctx.stroke();
    }
    if (u.guard) {
      ctx.strokeStyle = '#e5bd83';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(u.x, u.y - 13, 23, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (u.hp < u.maxhp) {
      ctx.fillStyle = '#27191a';
      ctx.fillRect(u.x - 18, y - 9, 36, 5);
      ctx.fillStyle = u.team === 'ally' ? '#8bc3a9' : '#cd6762';
      ctx.fillRect(u.x - 18, y - 9, (36 * u.hp) / u.maxhp, 5);
    }
    if (!hero) {
      // Team marker.
      ctx.fillStyle = u.team === 'ally' ? '#4bc4dc' : '#e76860';
      ctx.fillRect(u.x - 3, y - 13, 6, 3);
    }
  }

  function updateHud() {
    const g = CL.game;
    const $ = CL.ui.$;
    const maxHp = CL.units.STATS.hero.hp;
    $('#hptext').textContent = `Hero HP: ${Math.max(0, Math.ceil(g.hero.hp))} / ${maxHp}`;
    $('#hpfill').style.width = `${(g.hero.hp / maxHp) * 100}%`;
    $('#summary').textContent =
      `Allies ${g.allies.filter((x) => x.alive).length} · ` +
      `Enemies ${g.enemies.filter((x) => x.alive).length} · Wave ${g.wave}/2`;
  }

  function draw() {
    const g = CL.game;
    ctx.clearRect(0, 0, W, H);
    drawGround();

    const chars = [...g.allies, ...g.enemies];
    if (g.hero) chars.push(g.hero);
    chars.sort((a, b) => a.y - b.y); // painter's order by depth
    for (const u of chars) drawUnit(u);

    for (const a of g.arrows) {
      ctx.strokeStyle = a.team === 'ally' ? '#f6e8b4' : '#eec19e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x - a.dx * 17, a.y - a.dy * 17);
      ctx.stroke();
    }
    for (const e of g.effects) {
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 15 * (1 - e.t / 0.4), 0, Math.PI * 2);
      ctx.stroke();
    }

    if (g.mode === 'battle') updateHud();
    if (performance.now() > g.messageUntil) CL.ui.$('#message').textContent = '';

    if (g.paused) {
      ctx.fillStyle = '#06101a99';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f8e9c5';
      ctx.font = 'bold 38px Georgia';
      ctx.fillText('PAUSED', 404, 265);
    }
  }

  CL.render = { init, draw };
})(typeof window !== 'undefined' ? window : globalThis);
