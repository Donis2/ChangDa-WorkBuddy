# -*- coding: utf-8 -*-
"""把两版答案 PDF 渲染成 PNG，供人工识读转录。

用法：
    python _scan/answer/render_answers.py laowei 2013        # 老魏版 2013 全部页
    python _scan/answer/render_answers.py kaoyanqun 2022     # 考研群版 2022
    python _scan/answer/render_answers.py laowei 2013 --half # 每页切上下两半（双栏手写页用）

产物：_scan/cache/ans/<版本>/<年份>_p<页码>.png
"""
import os
import sys
import pymupdf

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "_scan", "cache", "ans")

DIRS = {
    "laowei": os.path.join(ROOT, "题目资料来源", "Workbuddy", "真题答案", "老魏版本的2009-2024答案"),
    "kaoyanqun": os.path.join(ROOT, "题目资料来源", "Workbuddy", "真题答案", "考研群资料版本2009-2026答案"),
}
PAT = {"laowei": "%d年参考答案.pdf", "kaoyanqun": "%d年答案.pdf"}


def main():
    ver = sys.argv[1]
    year = int(sys.argv[2])
    half = "--half" in sys.argv
    dpi = 150
    for i, a in enumerate(sys.argv):
        if a == "--dpi":
            dpi = int(sys.argv[i + 1])

    src = os.path.join(DIRS[ver], PAT[ver] % year)
    if not os.path.exists(src):
        # 老魏 2017 文件名带后缀
        alt = [f for f in os.listdir(DIRS[ver]) if f.startswith(str(year))]
        if alt:
            src = os.path.join(DIRS[ver], alt[0])
        else:
            print("找不到文件:", src)
            return

    od = os.path.join(OUT, ver)
    os.makedirs(od, exist_ok=True)
    doc = pymupdf.open(src)
    print("源文件:", os.path.relpath(src, ROOT), "页数", len(doc), "dpi", dpi)
    for i, pg in enumerate(doc):
        if half:
            r = pg.rect
            boxes = [pymupdf.Rect(r.x0, r.y0, r.x1, r.y0 + r.height / 2),
                     pymupdf.Rect(r.x0, r.y0 + r.height / 2, r.x1, r.y1)]
        else:
            boxes = [pg.rect]
        for j, box in enumerate(boxes):
            pix = pg.get_pixmap(dpi=dpi, clip=box)
            suffix = "" if not half else ("a" if j == 0 else "b")
            out = os.path.join(od, "%d_p%02d%s.png" % (year, i + 1, suffix))
            pix.save(out)
            print("  ", os.path.relpath(out, ROOT), pix.width, "x", pix.height)
    doc.close()


if __name__ == "__main__":
    main()
