# fig_map_*.png + fig_pie_*.png → 게시물 커버 이미지 (16:9)
import os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = os.path.join(HERE, 'cache')
SITE = os.path.dirname(os.path.dirname(HERE))
DEST = os.path.join(SITE, 'assets', 'img', 'flood-basement-cover.jpg')
src = sys.argv[1] if len(sys.argv) > 1 else 'mois'

W, H, PAD = 1600, 900, 24
canvas = Image.new('RGB', (W, H), 'white')

m = Image.open(os.path.join(SCRATCH, f'fig_map_{src}.png')).convert('RGB')
p = Image.open(os.path.join(SCRATCH, f'fig_pie_{src}.png')).convert('RGB')

mh = H - PAD * 2
mw = int(m.width * mh / m.height)
m = m.resize((mw, mh), Image.LANCZOS)
canvas.paste(m, (PAD, PAD))

px = PAD + mw + PAD
pw = W - px - PAD
ph = int(p.height * pw / p.width)
if ph > mh:
    ph = mh; pw = int(p.width * ph / p.height)
p = p.resize((pw, ph), Image.LANCZOS)
canvas.paste(p, (px, (H - ph) // 2))

canvas.save(DEST, quality=88, optimize=True)
print('saved', DEST, os.path.getsize(DEST) // 1024, 'KB')
