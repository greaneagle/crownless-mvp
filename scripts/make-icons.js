// Builds the home-screen icons (icons/*.png) from the art kit's hero (P10-G5, D-P10k): the game's own
// drawing code, run in headless Chromium (Playwright, already a development tool), on the game's dark
// background inside the "maskable" safe zone (Android crops icons to circles and squircles).
//   npm run icons            (node scripts/make-icons.js)
// The hero stands in the default crimson cloak with their banner, on a grass mound, lit from the upper left.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'icons');
const BG = '#101a23'; // the page's theme colour
const SIZES = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };
const SAFE = 0.72; // the scene fits in this share of the icon (the maskable safe zone is 80%)
// Only what the drawing needs: the core namespace, the content the kit reads, and the kit itself.
const SCRIPTS = ['js/core.js', 'data/factions.js', 'data/troops.js', 'data/companions.js', 'js/content.js', 'js/art/kit.js', 'js/art/figures.js'];

/** The drawing, run in the page: the hero, their banner and a mound, in a box `size` px square. */
function paint(size, bg, safe) {
  const CL = window.Crownless;
  const G = CL.gfx;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  // A soft light behind the scene.
  ctx.fillStyle = '#1b2a38';
  ctx.beginPath();
  ctx.arc(size * 0.46, size * 0.44, size * 0.36, 0, Math.PI * 2);
  ctx.fill();
  const s = (size * safe) / 64; // the scene is about 64 units tall
  ctx.save();
  ctx.translate(size / 2, size / 2 + 26 * s);
  ctx.scale(s, s);
  G.ellipse(ctx, 0, 2, 26, 7);
  G.fillLine(ctx, G.PAL.grass);
  G.ellipse(ctx, 4, 3.5, 18, 4);
  ctx.fillStyle = G.PAL.grassDark;
  ctx.fill();
  G.banner(ctx, -14, 0, 1.25, { color: G.fig.CLOAKS.crimson, trim: G.PAL.gold, device: 'coin', edge: G.PAL.gold }, 0.4, 44);
  G.shadow(ctx, 3, 0, 10, 2.6, 6);
  G.fig.figure(ctx, 4, 0, G.fig.heroFor({ cloak: 'crimson', gender: 'unspecified' }), { face: 'down', t: 0, scale: 1.05 });
  ctx.restore();
  return cv.toDataURL('image/png');
}

async function main() {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    for (const src of SCRIPTS) await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, src), 'utf8') });
    fs.mkdirSync(OUT, { recursive: true });
    for (const [name, size] of Object.entries(SIZES)) {
      const url = await page.evaluate(([fn, n, bg, safe]) => new Function(`return (${fn})`)()(n, bg, safe), [paint.toString(), size, BG, SAFE]);
      fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));
      console.log(`icons/${name}: ${size}×${size}`);
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { SIZES, SCRIPTS, paint };
