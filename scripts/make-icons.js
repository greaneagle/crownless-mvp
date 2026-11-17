// Builds the home-screen icons (icons/*.png) from the hero sprite, assets/u0000.png: the owner's own
// Sprite Studio art, scaled up with nearest-neighbour so the pixels stay crisp, centred on the game's
// dark background inside the "maskable" safe zone (Android crops icons to circles and squircles).
//   node scripts/make-icons.js
// No dependencies: PNG decode/encode with node:zlib. Only 8-bit RGBA, non-interlaced sources.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'assets', 'u0000.png');
const OUT = path.join(ROOT, 'icons');
const BG = [16, 26, 35, 255]; // #101a23, the page's theme colour
const SIZES = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };
const SAFE = 0.7; // the figure fits in this share of the icon (the maskable safe zone is 80%)

function decode(file) {
  const b = fs.readFileSync(file);
  const width = b.readUInt32BE(16);
  const height = b.readUInt32BE(20);
  if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0) throw new Error('expected 8-bit RGBA, non-interlaced');
  const idat = [];
  for (let i = 8; i < b.length; ) {
    const len = b.readUInt32BE(i);
    if (b.toString('ascii', i + 4, i + 8) === 'IDAT') idat.push(b.subarray(i + 8, i + 8 + len));
    i += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const up = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y ? px[(y - 1) * stride + x - 4] : 0;
      const p = a + up - c;
      const pred = [0, a, up, (a + up) >> 1, Math.abs(p - a) <= Math.abs(p - up) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - up) <= Math.abs(p - c) ? up : c][f];
      px[y * stride + x] = (v + pred) & 255;
    }
  }
  return { width, height, px };
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function encode(size, px) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) px.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Trim the transparent margin so the figure, not its padding, fills the icon. */
function crop(src) {
  let [x0, y0, x1, y1] = [src.width, src.height, -1, -1];
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (src.px[(y * src.width + x) * 4 + 3] > 16) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }
  }
  const width = x1 - x0 + 1;
  const height = y1 - y0 + 1;
  const px = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) src.px.copy(px, y * width * 4, ((y0 + y) * src.width + x0) * 4, ((y0 + y) * src.width + x1 + 1) * 4);
  return { width, height, px };
}

function icon(full, size) {
  const src = crop(full);
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) px.set(BG, i * 4);
  const scale = Math.max(1, Math.floor((size * SAFE) / Math.max(src.width, src.height)));
  const ox = Math.floor((size - src.width * scale) / 2);
  const oy = Math.floor((size - src.height * scale) / 2);
  for (let y = 0; y < src.height * scale; y++) {
    for (let x = 0; x < src.width * scale; x++) {
      const s = (Math.floor(y / scale) * src.width + Math.floor(x / scale)) * 4;
      const a = src.px[s + 3] / 255;
      if (!a) continue;
      const d = ((oy + y) * size + ox + x) * 4;
      for (let k = 0; k < 3; k++) px[d + k] = Math.round(src.px[s + k] * a + px[d + k] * (1 - a));
    }
  }
  return encode(size, px);
}

if (require.main === module) {
  const src = decode(SOURCE);
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, size] of Object.entries(SIZES)) {
    fs.writeFileSync(path.join(OUT, name), icon(src, size));
    console.log(`icons/${name}: ${size}×${size}`);
  }
}

module.exports = { decode, encode, crop, icon, SIZES };
