# -*- coding: utf-8 -*-
"""题图裁切清理：去掉四周多余留白与混入的题干/页码文字带。

用法：
    python _scan/tools/clean_figures.py --dry-run     # 只看会怎么改
    python _scan/tools/clean_figures.py              # 实际写入（原图备份到 _scan/cache/figures_bak）

规则（保守，宁可不动）：
1. 页面边线：距边缘 3px 内墨迹占比 > 80% 的整行/整列视为扫描页边框，裁掉。
2. 边缘文字带：只处理首/尾band，且同时满足
   - band 高度 <= 65px
   - 横向最长连续墨迹 <= 0.30 * 图宽（正文文字笔画短；图线/尺寸线长）
   - 纵向最长连续墨迹 <= band 高度（排除竖线/边框）
   - 墨迹密度 0.01 ~ 0.45
   - 与相邻 band 间距 >= 14px，且相邻 band 高度 >= 该 band 高度 * 1.3
   - 全图 band 数 >= 2（纯文字答案图不动）
3. 最后按剩余墨迹外接框 + 10px 内边距裁切。
"""
import argparse
import json
import os
import shutil

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
FIG_DIR = os.path.join(ROOT, "public", "images", "questions")
BAK_DIR = os.path.join(ROOT, "_scan", "cache", "figures_bak")

TH = 170
PAD = 10
GAP = 12
MIN_GAIN = 0.06  # 面积缩小不足 6% 的图不重写，避免无意义改动

# 自动识别会误判的图：宁可留着文字，也不能切掉图线。
# 逐张人工看过，原因写在后面。
STRIP_DENY = {
    "2006-分析-01.png": "文字在图形左侧/下方，剥离会切到箱体下缘",
    "2010-计算-01.png": "顶部虚线圆超出裁切框，剥离合切掉图顶",
    "2014-分析-02.png": "底部是「题四（a）（b）」分图题注，保留",
    "2018-1-10.png": "顶部题干只露出一条边，剥离后仍有残字，改人工处理",
    "2025-3-4.png": "底部是「图16-6 例题2图」题注，保留",
    "2025-计算-04.png": "底部是「图16-6 例题2图」题注，保留",
}


def load_question_figures():
    """题库里作「题图」用的文件名集合；答案图（answer_images）不参与文字带剥离。"""
    names = set()
    for fn in ("questions.json", "extended.json"):
        p = os.path.join(ROOT, "data", fn)
        if not os.path.exists(p):
            continue
        with open(p, encoding="utf-8") as f:
            for q in json.load(f)["questions"]:
                for s in q.get("images") or []:
                    names.add(os.path.basename(s))
    return names


def max_run(v):
    best = cur = 0
    for x in v:
        cur = cur + 1 if x else 0
        if cur > best:
            best = cur
    return best


def find_bands(mask, gap=GAP):
    rows = mask.any(axis=1)
    out, start, last = [], None, None
    for i, v in enumerate(rows):
        if v:
            if start is None:
                start = i
            last = i
        elif start is not None and i - last >= gap:
            out.append((start, last))
            start = None
    if start is not None:
        out.append((start, last))
    return out


def band_stats(mask, w, s, e):
    seg = mask[s:e + 1]
    bh = e - s + 1
    dens = float(seg.mean())
    hrun = max(max_run(seg[r]) for r in range(bh))
    vrun = max(max_run(seg[:, c]) for c in range(w))
    cols = seg.any(axis=0)
    # 列方向墨迹块计数（间隔 <=3px 视为同一块），用来区分「一行正文」与「A B C D 标签 / 图1 题注」
    runs = 0
    last = -99
    for i, v in enumerate(cols):
        if v:
            if i - last > 3:
                runs += 1
            last = i
    return dict(s=s, e=e, bh=bh, dens=dens, hrun=int(hrun), vrun=int(vrun), nruns=runs)


def is_text_band(b, w):
    """整行题干文字：高度小、笔画短、无长横线、且由很多个字块组成。

    nruns 门槛用于区分「一行正文」和「A B C D 选项标签 / 图1 题注」——
    后者字块少，必须保留，否则会把选项标签裁掉。
    """
    return (
        b["bh"] <= 60
        and b["dens"] <= 0.45
        and b["dens"] >= 0.01
        and b["hrun"] <= 0.30 * w
        and b["vrun"] <= b["bh"]
        and b["nruns"] >= 10
    )


def strip_page_border(mask):
    """去掉扫描页的黑色边框线（贴边整行/整列）。"""
    h, w = mask.shape
    t = 0
    while t < 4 and mask[t].mean() > 0.8:
        t += 1
    b = 0
    while b < 4 and mask[h - 1 - b].mean() > 0.8:
        b += 1
    l = 0
    while l < 4 and mask[:, l].mean() > 0.8:
        l += 1
    r = 0
    while r < 4 and mask[:, w - 1 - r].mean() > 0.8:
        r += 1
    return t, b, l, r


def process(path, allow_strip=True, dry_run=False, want_image=False):
    im = Image.open(path).convert("L")
    a = np.array(im).astype(int)
    h, w = a.shape
    mask = a < TH
    if not mask.any():
        return None

    top, bot, left, right = strip_page_border(mask)
    if top or bot or left or right:
        a = a[top:h - bot, left:w - right]
        mask = a < TH
        h, w = a.shape
        if not mask.any():
            return None

    bands = find_bands(mask)
    removed = []
    if allow_strip and len(bands) >= 2:
        while len(bands) >= 2:
            first, last = bands[0], bands[-1]
            b_first = band_stats(mask, w, *first)
            b_last = band_stats(mask, w, *last)
            rest_h_first = max(band_stats(mask, w, *x)["bh"] for x in bands[1:])
            rest_h_last = max(band_stats(mask, w, *x)["bh"] for x in bands[:-1])
            if (
                is_text_band(b_first, w)
                and b_first["bh"] * 1.3 <= rest_h_first
                and first[1] - first[0] + 1 <= 0.5 * rest_h_first
            ):
                removed.append(("top", first[0], first[1]))
                bands = bands[1:]
                continue
            if (
                is_text_band(b_last, w)
                and b_last["bh"] * 1.3 <= rest_h_last
                and last[1] - last[0] + 1 <= 0.5 * rest_h_last
            ):
                removed.append(("bottom", last[0], last[1]))
                bands = bands[:-1]
                continue
            break

        if removed:
            keep = np.zeros_like(mask)
            for s, e in bands:
                keep[s:e + 1] = True
            mask = mask & keep
            if not mask.any():
                return None

    ys, xs = np.where(mask)
    y0, y1 = max(ys.min() - PAD, 0), min(ys.max() + PAD + 1, h)
    x0, x1 = max(xs.min() - PAD, 0), min(xs.max() + PAD + 1, w)
    if (y0, y1, x0, x1) == (0, h, 0, w) and not removed:
        return dict(path=path, changed=False, size=(w, h))

    gain = 1 - ((x1 - x0) * (y1 - y0)) / (w * h)
    if not removed and gain < MIN_GAIN:
        return dict(path=path, changed=False, size=(w, h))

    if not dry_run:
        os.makedirs(BAK_DIR, exist_ok=True)
        bak = os.path.join(BAK_DIR, os.path.basename(path))
        if not os.path.exists(bak):
            shutil.copy2(path, bak)
        out = Image.fromarray(a.astype(np.uint8)).crop((x0, y0, x1, y1))
        out.save(path, optimize=True)

    res = dict(
        path=path,
        changed=True,
        size=(w, h),
        new=(x1 - x0, y1 - y0),
        trimmed=(y0, h - y1, x0, w - x1),
        removed=removed,
    )
    if want_image:
        res["image"] = Image.fromarray(a.astype(np.uint8)).crop((x0, y0, x1, y1))
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-strip", action="store_true", help="只去留白，不剥离边缘文字带")
    ap.add_argument("--only", default="", help="逗号分隔的文件名")
    args = ap.parse_args()

    names = sorted(f for f in os.listdir(FIG_DIR) if f.lower().endswith(".png"))
    if args.only:
        want = {x.strip() for x in args.only.split(",") if x.strip()}
        names = [n for n in names if n in want]

    question_figs = load_question_figures()
    changed = 0
    for n in names:
        r = process(
            os.path.join(FIG_DIR, n),
            allow_strip=(n in question_figs) and not args.no_strip and n not in STRIP_DENY,
            dry_run=args.dry_run,
        )
        if not r or not r["changed"]:
            continue
        changed += 1
        (ow, oh), (nw, nh) = r["size"], r["new"]
        pct = 100 * (1 - (nw * nh) / (ow * oh))
        note = ""
        if r["removed"]:
            note = " 去掉文字带:" + ",".join(f"{k}{s}-{e}" for k, s, e in r["removed"])
        print(f"{n:28s} {ow}x{oh} -> {nw}x{nh}  -{pct:4.0f}%{note}")

    print(f"\n{'待处理' if args.dry_run else '已处理'} {changed} / {len(names)} 张")


if __name__ == "__main__":
    main()
