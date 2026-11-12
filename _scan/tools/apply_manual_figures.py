# -*- coding: utf-8 -*-
"""人工复核后重裁的题图（一次性清单，可重复执行）。

每项写明来源页与裁切框，方便日后追溯：
- from_pdf: 从原卷 PDF 重新渲染裁切（dpi=200），坐标是渲染像素
- from_current: 在现有 png 上再裁一刀
"""
import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
FIG = os.path.join(ROOT, "public", "images", "questions")
PAGES = os.path.join(ROOT, "_scan", "cache", "pages")

# (目标文件, 来源, 参数, 说明)
JOBS = [
    # 2007 真题第2页「二、计算分析题」下方：轴+大圆弧整图（原裁切把大圆弧切掉一半）
    ("2007-二-1.png", "pdf", ("真题/常大2007年真题.pdf", 1, (425, 732, 2145, 1600), 200),
     "原卷 p2：轴+带轮圆弧完整图"),
    # 2023 真题第2页上部：轮系图（原裁切把两根轴下端切掉）
    ("2023-3-3.png", "pdf", ("真题/常大2023年真题.pdf", 1, (1490, 258, 2050, 772), 200),
     "原卷 p2：轮系图完整"),
    ("2023-计算-03.png", "pdf", ("真题/常大2023年真题.pdf", 1, (1490, 258, 2050, 772), 200),
     "同上（题库版与卷面版共用同一张图）"),
    # 2023 真题第2页下部：一对角接触球轴承支承的轴（原裁切只剩一条窄带）
    ("2023-3-2.png", "pdf", ("真题/常大2023年真题.pdf", 1, (295, 1240, 1161, 1612), 200),
     "原卷 p2：轴承支承轴系图完整（含上方 1/2 标注）"),
    ("2023-计算-02.png", "pdf", ("真题/常大2023年真题.pdf", 1, (295, 1240, 1161, 1612), 200),
     "同上"),
    # 2018 真题第1页 第10题：四个 V 带轮槽剖面 + A/B/C/D（原裁切把字母切掉一半）
    ("2018-1-10.png", "pdf", ("真题/常大2018年真题.pdf", 0, (275, 1930, 906, 2118), 200),
     "原卷 p1：V带轮槽四选项图完整"),
    # 2011 真题第2页 第2题：齿轮系图（原裁切只剩上半截，蜗杆与「右旋」被切掉）
    ("2011-4-2.png", "pdf", ("真题/常大2011年真题.pdf", 1, (525, 280, 1095, 715), 200),
     "原卷 p2：齿轮系图完整（含蜗杆/右旋）"),
    # 以下为在现有 png 上二次裁切（去掉题干文字/大片空白）
    ("2009-计算-01.png", "current", (491, 0, 888, 295), "去掉右侧大片空白，只留四杆机构"),
    ("2009-计算-03.png", "current", (511, 0, 782, 325), "去掉右侧大片空白，只留齿轮箱"),
    ("2009-分析-02.png", "current", (940, 0, 1377, 280), "切掉左侧题干文字，只留右侧两幅小图"),
    ("2010-计算-01.png", "current", (0, 79, 466, 321), "切掉顶部「工作情况（15分）」"),
    ("2004-计算-01.png", "current", (0, 44, 1017, 800), "切掉顶部残行「…图不应出现缝隙图」与底部页码"),
    ("2006-分析-01.png", "current", (0, 0, 744, 575), "切掉底部三行题干/说明文字"),
]


def render_page(pdf_rel, page_idx, dpi):
    import pymupdf

    doc = pymupdf.open(os.path.join(ROOT, pdf_rel))
    pix = doc[page_idx].get_pixmap(dpi=dpi)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def main():
    for job in JOBS:
        name, kind = job[0], job[1]
        dst = os.path.join(FIG, name)
        if kind == "pdf":
            pdf_rel, page_idx, box, dpi = job[2]
            src = render_page(pdf_rel, page_idx, dpi)
            out = src.crop(box)
            note = job[3]
        else:
            box = job[2]
            note = job[3]
            cur = Image.open(dst).convert("RGB")
            want = (box[2] - box[0], box[3] - box[1])
            if cur.size == want:
                print(f"{name:24s} 已是目标尺寸 {want}，跳过（--force 可强制重裁）")
                continue
            out = cur.crop(box)
        out.save(dst, optimize=True)
        print(f"{name:24s} -> {out.width}x{out.height}  {note}")


if __name__ == "__main__":
    main()
