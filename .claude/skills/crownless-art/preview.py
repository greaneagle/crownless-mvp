"""Non-destructive export-size previews for Sprite Studio candidates (FLUX or LiliPixel).

Reads a candidate's PNGs from the Studio library (never writes there), and writes
into an output folder (use art-work\\sheets\\<slug>\\):
  <id>-<W>x<H>.png        one sprite per target size, aspect kept, bottom-centred
  <id>-compare.png        Stage 1 | Stage 2 | every size at 1x and enlarged (nearest)
  <id>-game.png           every size on game ground beside existing Crownless art, 1:1 game units, then x3
  <id>-preview.json       method, settings, hashes and a validation per size

Validation uses the Studio's own validator with a profile built for each target size,
because `prepare-flux` always validates against the category default (prop = 96x96).

Usage (Windows Python):
  py preview.py --id <ID> --sizes 32x32 48x48 64x64 --out "D:\\Crownless-MVP\\crownless-mvp\\art-work\\sheets\\<slug>"
Options: --colors 32 (0 = keep), --bg-tolerance 24 (0 = keep background), --method box|nearest,
         --crop L T R B (0-1), --category prop, --neighbors w0012:40x30 w0132:92x97
"""
from __future__ import annotations
import argparse, hashlib, io, json, sys
from pathlib import Path
from PIL import Image, ImageDraw

STUDIO = Path(r'D:\Crownless Sprite generator\crownless-sprite-studio')
REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(STUDIO))
from engine import LIBRARY, remove_flat_background  # noqa: E402  (Studio code, used in place)
from validator import validate_png, rules_from_file  # noqa: E402


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def png(im: Image.Image) -> bytes:
    buf = io.BytesIO(); im.save(buf, 'PNG'); return buf.getvalue()


def size(s: str):
    w, h = s.lower().split('x'); return int(w), int(h)


def fit(src: Image.Image, w: int, h: int, method: str, colors: int, pad: int) -> Image.Image:
    """Uniform scale into w x h (never stretched), binary alpha, optional palette, bottom-centre."""
    iw, ih = w - 2 * pad, h - pad
    k = min(iw / src.width, ih / src.height)
    sw, sh = max(1, round(src.width * k)), max(1, round(src.height * k))
    if method == 'nearest':
        out = src.resize((sw, sh), Image.Resampling.NEAREST)
        alpha = out.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
        rgb = out.convert('RGB')
    else:  # area average: far less speckle than picking 1 of k*k source pixels
        alpha = src.getchannel('A').resize((sw, sh), Image.Resampling.BOX).point(lambda v: 255 if v >= 128 else 0)
        premul = Image.new('RGB', src.size, (0, 0, 0)); premul.paste(src.convert('RGB'), mask=src.getchannel('A'))
        rgb = premul.resize((sw, sh), Image.Resampling.BOX)
        cover = src.getchannel('A').resize((sw, sh), Image.Resampling.BOX)
        px, cv = rgb.load(), cover.load()
        for y in range(sh):
            for x in range(sw):
                a = cv[x, y]
                if a: px[x, y] = tuple(min(255, round(c * 255 / a)) for c in px[x, y])
    if colors:
        rgb = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    sprite = rgb.convert('RGBA'); sprite.putalpha(alpha)
    canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    canvas.alpha_composite(sprite, ((w - sw) // 2, h - pad - sh))
    return canvas


def checker(w, h, cell=8):
    im = Image.new('RGBA', (w, h), (48, 65, 83, 255)); d = ImageDraw.Draw(im)
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            if (x // cell + y // cell) % 2 == 0: d.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(65, 83, 99, 255))
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--id', help='Studio candidate ID (reads library\<ID>-raw.png and -stage1.png)')
    ap.add_argument('--png', help='any other PNG instead of --id, e.g. a hand-drawn fallback sprite (needs --category)')
    ap.add_argument('--ref', nargs='*', default=[], help='Crownless reference crop IDs (refs\crownless-v2) shown beside the candidate for the style check')
    ap.add_argument('--sizes', nargs='+', default=['32x32', '48x48', '64x64'])
    ap.add_argument('--out', required=True)
    ap.add_argument('--category')
    ap.add_argument('--colors', type=int, default=32)
    ap.add_argument('--bg-tolerance', type=int, default=24)
    ap.add_argument('--method', choices=('box', 'nearest'), default='box')
    ap.add_argument('--key-holes', action='store_true', help='also remove enclosed background of the corner colour; check it did not eat the subject')
    ap.add_argument('--padding', type=int, default=1)
    ap.add_argument('--crop', type=float, nargs=4)
    ap.add_argument('--neighbors', nargs='*', default=['w0012:40x30', 'w0132:92x97'])
    a = ap.parse_args()
    out = Path(a.out).resolve()
    if LIBRARY.resolve() in out.parents or out == LIBRARY.resolve() or (REPO / 'assets').resolve() in [out, *out.parents]:
        raise SystemExit('Refusing to write previews into the Studio library or assets/')
    out.mkdir(parents=True, exist_ok=True)
    if bool(a.id) == bool(a.png): raise SystemExit('Give exactly one of --id or --png')
    if a.id:
        rec = json.loads((LIBRARY / (a.id + '.json')).read_text(encoding='cp1252', errors='replace'))
        category = a.category or rec['category']
        raw_b = (LIBRARY / (a.id + '-raw.png')).read_bytes()
        s1_path = LIBRARY / (a.id + '-stage1.png')
        s1_b = s1_path.read_bytes() if s1_path.is_file() else None
    else:
        if not a.category: raise SystemExit('--png needs --category')
        category = a.category; raw_b = Path(a.png).read_bytes(); s1_b = None; a.id = Path(a.png).stem
    manifest = json.loads((STUDIO / 'refs' / 'crownless-v2' / 'manifest.json').read_text(encoding='utf-8'))['items']
    refs = []
    for rid in a.ref:
        item = next((r for r in manifest if r['id'] == rid), None)
        if not item: raise SystemExit('Unknown reference crop: ' + rid)
        refs.append((rid, (STUDIO / item['file']).read_bytes()))
    src = Image.open(io.BytesIO(raw_b)).convert('RGBA')
    if a.crop:
        W, H = src.size; L, T, R, B = a.crop; src = src.crop((round(L * W), round(T * H), round(R * W), round(B * H)))
    if a.bg_tolerance:
        corners = [src.getpixel(p)[:3] for p in ((0, 0), (src.width - 1, 0), (0, src.height - 1), (src.width - 1, src.height - 1))]
        src = remove_flat_background(src, a.bg_tolerance)
        if a.key_holes:  # also clear enclosed background (inside frames, between legs), not only edge-connected
            bg = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
            px = src.load()
            for y in range(src.height):
                for x in range(src.width):
                    p = px[x, y]
                    if p[3] and max(abs(p[i] - bg[i]) for i in range(3)) <= a.bg_tolerance: px[x, y] = (0, 0, 0, 0)
    bbox = src.getchannel('A').getbbox() or (0, 0, *src.size)
    src = src.crop(bbox)
    rules = rules_from_file(); base = rules['categories'][category]
    report = {'candidate_id': a.id, 'raw_sha256': sha(raw_b), 'stage1_sha256': sha(s1_b) if s1_b else None,
              'method': f'trim, uniform {a.method} fit, binary alpha, bottom-centre, padding {a.padding}',
              'bg_tolerance': a.bg_tolerance, 'key_holes': a.key_holes, 'colors': a.colors, 'crop': a.crop, 'trimmed_source_bbox': list(bbox),
              'is_preview_not_approved': True, 'sizes': {}}
    sprites = []
    for s in a.sizes:
        w, h = size(s)
        im = fit(src, w, h, a.method, a.colors, a.padding); b = png(im)
        p = out / f'{a.id}-{w}x{h}.png'; p.write_bytes(b)
        prof = {**base, 'size': [w, h], 'max_colors': 64}
        v = validate_png(b, category, {**rules, 'categories': {**rules['categories'], category: prof}})
        report['sizes'][f'{w}x{h}'] = {'file': str(p), 'sha256': sha(b), 'status': v['status'],
            'errors': [e['code'] for e in v['errors']], 'warnings': [x['code'] for x in v['warnings']],
            'colors': v['metrics'].get('unique_opaque_colors'), 'bounding_box': v['metrics'].get('bounding_box')}
        sprites.append(((w, h), im))
    # comparison sheet: stage 1, stage 2 (both 256 px), then each size at 1x and enlarged to ~256 px
    T = 256; cols = 2 + len(refs) + len(sprites)
    sheet = Image.new('RGBA', (16 + cols * (T + 16), T + 110), (21, 35, 48, 255)); d = ImageDraw.Draw(sheet)
    heads = [('Stage 1 subject', s1_b), ('Stage 2 refined' if s1_b else 'Source', raw_b)] + [('REF ' + rid, b) for rid, b in refs]
    for i, (label, b) in enumerate(heads):
        x = 16 + i * (T + 16)
        if b:
            im = Image.open(io.BytesIO(b)).convert('RGBA')
            f = T / max(im.size)  # display only: fit to the tile, nearest-neighbour so pixels stay visible
            im = im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.Resampling.NEAREST)
            sheet.alpha_composite(im, (x, 16))
        d.text((x, T + 24), label if b else label + ' (none)', fill=(255, 223, 170))
    for j, ((w, h), im) in enumerate(sprites):
        x = 16 + (len(heads) + j) * (T + 16); k = max(1, min(T // w, (T - 60) // h))
        bg = checker(w * k, h * k); bg.alpha_composite(im.resize((w * k, h * k), Image.Resampling.NEAREST))
        sheet.alpha_composite(bg, (x, 16)); one = checker(w, h, 4); one.alpha_composite(im)
        r = report['sizes'][f'{w}x{h}']
        d.text((x, T + 24), f'{w}x{h}  shown x{k}  {r["status"]} {",".join(r["errors"])}', fill=(227, 231, 230))
        d.text((x, T + 40), f'{r["colors"]} colours; 1x:', fill=(227, 231, 230))
        sheet.alpha_composite(one, (x + 110, T + 40))
    sheet.save(out / f'{a.id}-compare.png')
    # game-scale strip: 1:1 game units on the battle ground tile beside current art, then x3 nearest
    gw = 24 + sum(w for (w, _), _ in sprites) + 16 * len(sprites) + 16 * len(a.neighbors) + 24
    nb = []
    for n in a.neighbors:
        key, s = n.split(':'); w, h = size(s); f = REPO / 'assets' / f'{key}.png'
        if f.is_file(): nb.append((key, Image.open(f).convert('RGBA').resize((w, h), Image.Resampling.NEAREST))); gw += w
    gh = 24 + max([h for (_, h), _ in sprites] + [im.height for _, im in nb]) + 24
    ground = Image.new('RGBA', (gw, gh), (88, 110, 62, 255))
    tile_f = REPO / 'assets' / 'w0000.png'
    if tile_f.is_file():
        t = Image.open(tile_f).convert('RGBA').resize((65, 65), Image.Resampling.NEAREST)
        for y in range(0, gh, 65):
            for x in range(0, gw, 65): ground.alpha_composite(t, (x, y))
    x = 24; base_y = gh - 24
    for (w, h), im in sprites: ground.alpha_composite(im, (x, base_y - h)); x += w + 16
    for key, im in nb: ground.alpha_composite(im, (x, base_y - im.height)); x += im.width + 16
    ground.resize((gw * 3, gh * 3), Image.Resampling.NEAREST).save(out / f'{a.id}-game.png')
    report['compare_png'] = str(out / f'{a.id}-compare.png'); report['game_png'] = str(out / f'{a.id}-game.png')
    report['game_note'] = 'Left to right: ' + ', '.join(f'{w}x{h}' for (w, h), _ in sprites) + ' then ' + ', '.join(k for k, _ in nb) + ' as the game draws them; 1 game unit = 3 px'
    (out / f'{a.id}-preview.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    if not a.png and sha((LIBRARY / (a.id + '-raw.png')).read_bytes()) != report['raw_sha256']: raise SystemExit('Raw PNG changed!')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
