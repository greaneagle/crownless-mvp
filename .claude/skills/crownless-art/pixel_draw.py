"""Fallback: render a hand-authored pixel-art sprite (written by Claude as text) to a PNG.

Used only when both Sprite Studio attempts for an asset failed (see SKILL.md, "Fallback").
Claude has no image-generation model in Claude Code; this draws the sprite pixel by pixel
from a text grid, at native size, with an explicit palette.

Spec (JSON):
{
  "name": "Camp weapon rack", "category": "prop",
  "palette": {"o": "#2b1b12", "w": "#7a5233", "W": "#9c6d45", "g": "#8a8f93"},
  "rows": [
    "....oo....",
    "...owwo...",
    ...
  ]
}
'.' and ' ' are transparent. Every row must have the same length. At most 64 colours.

Usage: py pixel_draw.py --spec art-work\\recipes\\<slug>-hand-v1.json --out art-work\\sheets\\<slug>\\<slug>-hand-v1.png
Writes the PNG (exactly len(row) x len(rows)), an 8x nearest enlargement, and <png>.json (spec + hashes).
Then run preview.py --png <file> --category <cat> --bg-tolerance 0 --method nearest --colors 0 for the sheets.
"""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parents[3]


def hexrgb(v: str):
    v = v.lstrip('#')
    if len(v) != 6: raise SystemExit(f'Bad colour {v!r}; use #rrggbb')
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--spec', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    out = Path(a.out).resolve()
    if (REPO / 'assets').resolve() in out.parents:
        raise SystemExit('Write drafts to art-work\\, not assets\\ (copy the chosen file in when integrating)')
    if out.exists(): raise SystemExit('Refusing to overwrite ' + str(out) + '; bump the version suffix')
    spec_b = Path(a.spec).read_bytes(); spec = json.loads(spec_b)
    rows, pal = spec['rows'], {k: hexrgb(v) for k, v in spec['palette'].items()}
    if len(pal) > 64: raise SystemExit('More than 64 colours')
    w = len(rows[0])
    if any(len(r) != w for r in rows): raise SystemExit('Rows differ in length: ' + str(sorted({len(r) for r in rows})))
    im = Image.new('RGBA', (w, len(rows)), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in '. ': continue
            if ch not in pal: raise SystemExit(f'Unknown palette key {ch!r} at {x},{y}')
            im.putpixel((x, y), (*pal[ch], 255))
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    im.resize((w * 8, len(rows) * 8), Image.Resampling.NEAREST).save(out.with_name(out.stem + '-x8.png'))
    meta = {'name': spec.get('name'), 'category': spec.get('category'), 'size': [w, len(rows)],
            'backend': 'claude-hand-drawn (text grid rendered by pixel_draw.py; no image model)',
            'spec_file': str(Path(a.spec).resolve()), 'spec_sha256': hashlib.sha256(spec_b).hexdigest(),
            'png': str(out), 'png_sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'colors': len(pal)}
    Path(str(out) + '.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
    print(json.dumps(meta, indent=2))


if __name__ == '__main__':
    main()
