# -*- coding: utf-8 -*-
"""生成「清理前 / 清理后」对比图，用于人工复核 clean_figures.py 的裁切结果。

    python _scan/tools/preview_clean.py            # 只输出有文字带剥离的图
    python _scan/tools/preview_clean.py --all      # 所有会被改动的图
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clean_figures as cf  # noqa: E402

OUT_DIR = os.path.join(cf.ROOT, "_scan", "cache", "preview")


def font(sz=20):
    for f in (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\simhei.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--only", default="")
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    names = sorted(f for f in os.listdir(cf.FIG_DIR) if f.lower().endswith(".png"))
    if args.only:
        want = {x.strip() for x in args.only.split(",") if x.strip()}
        names = [n for n in names if n in want]
    qfigs = cf.load_question_figures()

    items = []
    for n in names:
        path = os.path.join(cf.FIG_DIR, n)
        r = cf.process(path, allow_strip=n in qfigs, dry_run=True, want_image=True)
        if not r or not r["changed"]:
            continue
        if not args.all and not r["removed"]:
            continue
        items.append((n, path, r))

    F = font(22)
    cell = (620, 400)
    pad, lab = 10, 34
    per_sheet = 6
    for si in range(0, len(items), per_sheet):
        chunk = items[si:si + per_sheet]
        W = (cell[0] * 2 + pad * 3) * 2
        H = (cell[1] + lab + pad) * ((len(chunk) + 1) // 2) + pad
        canvas = Image.new("RGB", (W, H), "white")
        d = ImageDraw.Draw(canvas)
        for i, (n, path, r) in enumerate(chunk):
            row, col = divmod(i, 2)
            x = pad + col * (cell[0] * 2 + pad * 3)
            y = pad + row * (cell[1] + lab + pad)
            d.text((x, y), f"{n}  原始 {r['size'][0]}x{r['size'][1]}", fill="black", font=F)
            before = Image.open(path).convert("RGB")
            before.thumbnail(cell)
            canvas.paste(before, (x, y + lab))
            d.rectangle([x - 1, y + lab - 1, x + cell[0], y + lab + cell[1]], outline=(180, 180, 180))

            x2 = x + cell[0] + pad
            note = "去掉文字带 " + ",".join(f"{k}{s}-{e}" for k, s, e in r["removed"]) if r["removed"] else "仅去留白"
            d.text((x2, y), f"清理后 {r['new'][0]}x{r['new'][1]}  {note}", fill=(180, 30, 30), font=F)
            after = r["image"].convert("RGB")
            after.thumbnail(cell)
            canvas.paste(after, (x2, y + lab))
            d.rectangle([x2 - 1, y + lab - 1, x2 + cell[0], y + lab + cell[1]], outline=(220, 120, 120))

        out = os.path.join(OUT_DIR, f"cmp{si // per_sheet:02d}.png")
        canvas.save(out)
        print("saved", out, canvas.size)
    print(f"共 {len(items)} 张会改动（其中文字带剥离 {sum(1 for _,_,r in items if r['removed'])} 张）")


if __name__ == "__main__":
    main()
