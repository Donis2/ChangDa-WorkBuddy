import sys
from PIL import Image
import numpy as np

def bands(path, min_gap_frac=0.035, ink_thresh=200):
    im = Image.open(path).convert('L')
    a = np.asarray(im)
    h, w = a.shape
    # ink = dark pixels; ignore the bottom-right QR/watermark by trimming columns
    ink = (a < ink_thresh)
    row = ink[:, int(w*0.03):int(w*0.97)].sum(axis=1)
    th = max(3, int(w*0.002))
    has = row > th
    min_gap = int(h*min_gap_frac)
    res = []
    start = None
    gap = 0
    for i, v in enumerate(has):
        if v:
            if start is None:
                start = i
            gap = 0
        else:
            if start is not None:
                gap += 1
                if gap >= min_gap:
                    res.append((start, i-gap))
                    start = None
                    gap = 0
    if start is not None:
        res.append((start, len(has)-1))
    print(f'--- {path}  size={w}x{h}')
    for s, e in res:
        if e - s < h*0.01:
            continue
        print(f'  y {s}-{e}   frac {s/h:.3f}-{e/h:.3f}')

for p in sys.argv[1:]:
    bands(p)
