# -*- coding: utf-8 -*-
"""把 真题/ 与 真题答案/ 下的 PDF 逐页渲染为高清 PNG（中间产物）。"""
import os

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.dirname(os.path.abspath(__file__))

JOBS = [
    ("真题/常大2026年真题.pdf", "paper2026"),
    ("真题答案/2026年答案.pdf", "ans2026"),
]


def main(scale: float = 2.2) -> None:
    for src, pref in JOBS:
        doc = pymupdf.open(os.path.join(ROOT, src))
        for i, page in enumerate(doc):
            pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale))
            pix.save(os.path.join(OUT, f"{pref}_p{i + 1}.png"))
        print(f"{pref}: {doc.page_count} 页 -> {pref}_p1..{doc.page_count}.png")


if __name__ == "__main__":
    main()
