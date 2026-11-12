# -*- coding: utf-8 -*-
"""按「主图块」重新裁切：去掉夹杂在四周的题干文字/大片空白。

思路：先在行方向切 band，取墨迹面积最大的一块；再在列方向按 >=20px 空白切块，
取面积最大的一块作为真正的图形。只有该块占全图墨迹 >= 55% 时才裁，否则保持原样。

    python _scan/tools/recrop_main.py --dry-run
    python _scan/tools/recrop_main.py --only a.png,b.png
"""
import argparse
import json
import os
import shutil

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
FIG_DIR = os.path.join(ROOT, "public", "images", "questions")
BAK_DIR = os.path.join(ROOT, "_scan", "cache", "figures_bak")
PREVIEW = os.path.join(ROOT, "_scan", "cache", "recrop")
TH = 170
PAD = 12

# 需要重裁的图（都是肉眼确认过：图被文字挤到一角 / 混入题干）
TARGETS = [
    "2006-分析-01.png",
    "2009-分析-02.png",
    "2009-计算-01.png",
    "2009-计算-03.png",
    "2004-论述-01.png",
    "2010-计算-01.png",
    "2018-1-10.png",
    "2021-2-1.png",
    "2024-计算-03.png",
    "2025-2-2.png",
]


def row_bands(mask, gap=12):
    rows = mask.any(axis=1)
    out, s, last = [], None, None
    for i, v in enumerate(rows):
        if v:
            if s is None:
                s = i
            last = i
        elif s is not None and i - last >= gap:
            out.append((s, last))
            s = None
    if s is not None:
        out.append((s, last))
    return out


def col_blocks(mask, gap=20):
    cols = mask.any(axis=0)
    out, s, last = [], None, None
    for i, v in enumerate(cols):
        if v:
            if s is None:
                s = i
            last = i
        elif s is not None and i - last >= gap:
            out.append((s, last))
            s = None
    if s is not None:
        out.append((s, last))
    return out


def main_block(path):
    a = np.array(Image.open(path).convert("L")).astype(int)
    mask = a < TH
    if not mask.any():
        return None, None
    h, w = mask.shape

    bands = row_bands(mask)
    # 选墨迹最多的 band（不是最高的：细长文字行也可能很高）
    best_band, best_ink = max(
        ((b, int(mask[b[0]:b[1] + 1].sum())) for b in bands), key=lambda x: x[1]
    )

    sub = mask[best_band[0]:best_band[1] + 1]
    blocks = col_blocks(sub)
    best_block, best_ink2 = max(
        ((b, int(sub[:, b[0]:b[1] + 1].sum())) for b in blocks), key=lambda x: x[1]
    )

    total = int(mask.sum())
    y0, y1 = best_band
    x0, x1 = best_block
    keep = mask[y0:y1 + 1, x0:x1 + 1]
    if keep.sum() < 0.55 * total:
        return None, (total, int(keep.sum()))

    ys, xs = np.where(keep)
    box = (
        max(x0 + xs.min() - PAD, 0),
        max(y0 + ys.min() - PAD, 0),
        min(x0 + xs.max() + PAD + 1, w),
        min(y0 + ys.max() + PAD + 1, h),
    )
    return box, (total, int(keep.sum()))


def font(sz=20):
    return ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", sz)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", default="")
    args = ap.parse_args()

    names = TARGETS
    if args.only:
        want = {x.strip() for x in args.only.split(",") if x.strip()}
        names = [n for n in names if n in want]

    os.makedirs(PREVIEW, exist_ok=True)
    F = font(22)
    items = []
    for n in names:
        path = os.path.join(FIG_DIR, n)
        box, stat = main_block(path)
        im = Image.open(path).convert("RGB")
        if box is None:
            print(f"{n}: 主图块占比不足，跳过 {stat}")
            items.append((n, im, im, "跳过"))
            continue
        crop = im.crop(box)
        print(f"{n}: {im.width}x{im.height} -> {crop.width}x{crop.height} box={box}")
        items.append((n, im, crop, f"{box}"))
        if not args.dry_run:
            os.makedirs(BAK_DIR, exist_ok=True)
            bak = os.path.join(BAK_DIR, n)
            if not os.path.exists(bak):
                shutil.copy2(path, bak)
            crop.save(path, optimize=True)

    cell = (560, 360)
    pad, lab = 10, 32
    cols = 2
    rows = (len(items) + 1) // 2
    W = (cell[0] * 2 + pad * 3) * cols
    H = (cell[1] + lab + pad) * rows + pad
    canvas = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(canvas)
    for i, (n, before, after, note) in enumerate(items):
        r, c = divmod(i, cols)
        x = pad + c * (cell[0] * 2 + pad * 3)
        y = pad + r * (cell[1] + lab + pad)
        d.text((x, y), f"{n} 原图", fill="black", font=F)
        b = before.copy(); b.thumbnail(cell); canvas.paste(b, (x, y + lab))
        d.text((x + cell[0] + pad, y), f"重裁 {note}", fill=(180, 30, 30), font=F)
        a = after.copy(); a.thumbnail(cell); canvas.paste(a, (x + cell[0] + pad, y + lab))
    out = os.path.join(PREVIEW, "after.png")
    canvas.save(out)
    print("preview", out)


if __name__ == "__main__":
    main()
