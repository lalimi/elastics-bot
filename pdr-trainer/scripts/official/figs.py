# Вирізає ділянки з малюнками до питань (для категорії B) зі сторінок PDF у WebP
import json, sys, os, subprocess
from PIL import Image
src_pdf, parsed, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
SECS = set([str(i) for i in range(1, 40)] + ['8.1', '8.2', '16.1', '16.2'] + [str(i) for i in range(44, 48)])
d = json.load(open(parsed)); os.makedirs(outdir, exist_ok=True)
R = 2.5  # 180 dpi: 1pt → 2.5px
FIX_IMG_ONLY = {('45', 16)}
pages = {}
res = {}
for q in d['questions']:
    if q['sec'] not in SECS or not q['fig']: continue
    boxes = q['fig']
    if (q['sec'], q['n']) in FIX_IMG_ONLY: boxes = boxes[:1]
    pg = boxes[0]['page']
    if any(b['page'] != pg for b in boxes):          # малюнок на двох сторінках — беремо найбільшу частину
        by = {}
        for b in boxes: by.setdefault(b['page'], []).append(b)
        pg = max(by, key=lambda p: sum((b['x1']-b['x0'])*(b['y1']-b['y0']) for b in by[p])); boxes = by[pg]
    x0 = min(b['x0'] for b in boxes) - 2; y0 = min(b['y0'] for b in boxes) - 2
    x1 = max(b['x1'] for b in boxes) + 2; y1 = max(b['y1'] for b in boxes) + 2
    # не залазити на рядки питання й варіантів на тій самій сторінці
    qt = [b for b in q['qbox'] if b['page'] == pg and b['y1'] <= min(bb['y1'] for bb in boxes)]
    if qt: y0 = max(y0, max(b['y1'] for b in qt) + 0.5)
    ot = [b for b in q['obox'] if b['page'] == pg and b['y0'] >= max(bb['y0'] for bb in boxes)]
    if ot: y1 = min(y1, min(b['y0'] for b in ot) - 0.5)
    if pg not in pages:
        png = f'{outdir}/_p{pg}'
        subprocess.run(['pdftoppm', '-r', str(int(72 * R)), '-f', str(pg), '-l', str(pg), '-png', '-singlefile', src_pdf, png], check=True)
        pages[pg] = Image.open(png + '.png').convert('RGB')
    im = pages[pg].crop((int(x0 * R), int(y0 * R), int(x1 * R), int(y1 * R)))
    if im.width > 900: im = im.resize((900, round(im.height * 900 / im.width)), Image.LANCZOS)
    name = f"{q['sec'].replace('.', '_')}-{q['n']}.webp"
    im.save(f'{outdir}/{name}', 'WEBP', quality=72, method=6)
    res[f"{q['sec']}/{q['n']}"] = [name, im.width, im.height]
for f in os.listdir(outdir):
    if f.startswith('_p'): os.remove(os.path.join(outdir, f))
json.dump(res, open(os.path.join(os.path.dirname(outdir), 'figs.json'), 'w'))
tot = sum(os.path.getsize(os.path.join(outdir, f)) for f in os.listdir(outdir))
print('figures', len(res), 'total KB', tot // 1024)
