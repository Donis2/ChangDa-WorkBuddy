# -*- coding: utf-8 -*-
"""题图裁切工具：按墨迹行/列分析定位图形区域，避免目测坐标。"""
from PIL import Image
import numpy as np


def ink_mask(im, th=170):
    a = np.array(im.convert('L'))
    return a < th, a


def row_runs(mask, min_len=6):
    """返回连续有墨迹的行段 [(y0,y1)]"""
    ink = mask.sum(axis=1)
    runs, start = [], None
    for i, v in enumerate(ink):
        if v > 0 and start is None:
            start = i
        elif v == 0 and start is not None:
            if i - start >= min_len:
                runs.append((start, i))
            start = None
    if start is not None and len(ink) - start >= min_len:
        runs.append((start, len(ink)))
    return runs


def col_runs(mask, min_len=6):
    ink = mask.sum(axis=0)
    runs, start = [], None
    for i, v in enumerate(ink):
        if v > 0 and start is None:
            start = i
        elif v == 0 and start is not None:
            if i - start >= min_len:
                runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(ink)))
    return runs


def main_figure(im, th=170, pad=12, merge_gap=14):
    """整页只有一张主图 + 图题时，取行投影中最长的一段（主图），自动排除图题。
    与主图间隙 <= merge_gap 的相邻段（如紧贴的图注、被分行切开的标签）一并并入。"""
    mask, _ = ink_mask(im, th)
    runs = row_runs(mask)
    if not runs:
        return im
    idx = max(range(len(runs)), key=lambda i: runs[i][1] - runs[i][0])
    y0, y1 = runs[idx]
    # 向上合并
    i = idx - 1
    while i >= 0 and y0 - runs[i][1] <= merge_gap:
        y0 = runs[i][0]
        i -= 1
    # 向下合并
    i = idx + 1
    while i < len(runs) and runs[i][0] - y1 <= merge_gap:
        y1 = runs[i][1]
        i += 1
    sub = mask[y0:y1]
    cols = col_runs(sub)
    if not cols:
        return im.crop((0, max(y0 - pad, 0), im.width, min(y1 + pad, im.height)))
    x0, x1 = cols[0][0], cols[-1][1]
    box = (max(x0 - pad, 0), max(y0 - pad, 0),
           min(x1 + pad, im.width), min(y1 + pad, im.height))
    return im.crop(box)


def trim(im, th=170, pad=10):
    mask, _ = ink_mask(im, th)
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if len(rows) == 0:
        return im
    return im.crop((max(cols[0] - pad, 0), max(rows[0] - pad, 0),
                    min(cols[-1] + pad, im.width), min(rows[-1] + pad, im.height)))


def crop(im, box, th=170, pad=8):
    """按给定区域裁切后自动去白边"""
    return trim(im.crop(box), th=th, pad=pad)


def save(im, name, scale=1.0, maxw=None):
    if scale != 1.0:
        im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    if maxw and im.width > maxw:
        k = maxw / im.width
        im = im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)
    im.convert('RGB').save(f'public/images/questions/{name}.png')
    print(name, im.size)
