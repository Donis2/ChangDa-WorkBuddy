# -*- coding: utf-8 -*-
"""可选：从资料母库 PDF 重建两套整卷答案图片与 public/answers/manifest.json。

移植自归档 Trae 版 _build/build_answers.py，改为本仓库相对路径。
本脚本【不参与】一键启动 / Netlify 构建：public/answers/ 下的 120 张 webp
与 manifest.json 已随仓库落地，站点运行时只需读静态文件。仅当需要
「用更新后的答案 PDF 重新渲染图片」时，在有 Python + PyMuPDF + Pillow 的
本机手动执行：

    python scripts/build_answer_pages.py

依赖（仅此脚本需要，站点本身零依赖）：
    pip install PyMuPDF Pillow

输入（相对 Workbuddy版本/）：
    题目资料来源/Trae/题库来源/真题/答案原件/老魏版本的2009-2024答案/
    题目资料来源/Workbuddy/真题答案/考研群资料版本2009-2026答案/
输出：
    public/answers/laowei/*.webp
    public/answers/kaoyanqun/*.webp
    public/answers/manifest.json
"""
import io
import json
import os

# 可选依赖：缺失时 main() 会给出中文提示并安全退出，站点运行不依赖本脚本
try:
    import fitz  # PyMuPDF
    from PIL import Image
    _RENDER_DEPS_OK = True
    _RENDER_DEPS_ERR = ""
except ImportError as exc:  # pragma: no cover
    _RENDER_DEPS_OK = False
    _RENDER_DEPS_ERR = str(exc)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "题目资料来源")
LW_DIR = os.path.join(SRC, "Trae", "题库来源", "真题", "答案原件", "老魏版本的2009-2024答案")
KQ_DIR = os.path.join(SRC, "Workbuddy", "真题答案", "考研群资料版本2009-2026答案")
OUT = os.path.join(ROOT, "public", "answers")
MANIFEST_PATH = os.path.join(OUT, "manifest.json")

# 资料母库 PDF 文件名映射（与 Trae 版 build_answers.py 一致）
LW = {
    2009: "常大2009年答案.pdf", 2010: "常大2010年答案.pdf", 2011: "常大2011年答案.pdf",
    2012: "常大2012年答案.pdf", 2013: "常大2013年答案.pdf", 2014: "常大2014年答案.pdf",
    2015: "常大2015年答案.pdf", 2017: "常大2017年答案.pdf", 2018: "常大2018年答案.pdf",
    2019: "常大2019年答案.pdf", 2020: "常大2020年答案.pdf", 2021: "常大2021年答案.pdf",
    2022: "常大2022年答案.pdf", 2024: "常大2024年答案.pdf",
}
KQ = {
    2009: "2009年答案.pdf", 2010: "2010年答案.pdf", 2011: "2011年答案.pdf",
    2012: "2012年答案.pdf", 2013: "2013年答案.pdf", 2014: "2014年答案.pdf",
    2015: "2015年答案.pdf", 2017: "2017年答案.pdf", 2018: "2018年答案.pdf",
    2019: "2019年答案.pdf", 2020: "2020年答案.pdf", 2021: "2021年答案.pdf",
    2022: "2022年答案.pdf", 2023: "2023年答案.pdf", 2024: "2024年答案.pdf",
    2025: "2025年答案.pdf", 2026: "2026年答案.pdf",
}

# 与 public/answers/manifest.json 现有结构保持一致
VERSION_META = {
    "laowei": {"label": "老魏版", "range": "2009–2024"},
    "kaoyanqun": {"label": "考研群资料版", "range": "2009–2026"},
}


def render(pdf, version, year, dpi=150):
    """把一整份答案 PDF 逐页渲染为 webp，返回该年份文件名列表。"""
    outdir = os.path.join(OUT, version)
    os.makedirs(outdir, exist_ok=True)
    doc = fitz.open(pdf)
    names = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=dpi, alpha=False)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        name = f"{year}-{i + 1}.webp"
        img.save(os.path.join(outdir, name), "WEBP", quality=80, method=6)
        names.append(name)
    doc.close()
    return names


def build_manifest(pages):
    """生成前端 answerData.ts 期望的清单结构。

    versions.<ver>.years 与顶层 <ver> 为同一份年份→文件列表（顶层扁平结构
    兼容 Trae 版 manifest 读法），两版原样各存、不擅自取舍。
    """
    manifest = {
        "default": "kaoyanqun",
        "labels": {v: m["label"] for v, m in VERSION_META.items()},
        "versions": {},
    }
    for ver, meta in VERSION_META.items():
        manifest["versions"][ver] = {
            "label": meta["label"],
            "range": meta["range"],
            "years": pages[ver],
        }
        manifest[ver] = pages[ver]  # Trae 原扁平结构兼容
    return manifest


def main():
    if not _RENDER_DEPS_OK:
        raise SystemExit(
            "缺少依赖：本脚本需要 PyMuPDF 与 Pillow。请先执行 "
            "`pip install PyMuPDF Pillow` 后重试。\n"
            "（站点运行不依赖本脚本；public/answers/ 已落地，无需重建。）\n"
            f"原始错误：{_RENDER_DEPS_ERR}"
        )

    pages = {"laowei": {}, "kaoyanqun": {}}
    missing = []
    for ver, table, folder in (("laowei", LW, LW_DIR), ("kaoyanqun", KQ, KQ_DIR)):
        for year, fname in sorted(table.items()):
            path = os.path.join(folder, fname)
            if not os.path.exists(path):
                missing.append(f"{ver}/{year}: {path}")
                continue
            pages[ver][str(year)] = render(path, ver, year)
            print(f"{ver} {year} -> {len(pages[ver][str(year)])} 页")

    if missing:
        print("以下 PDF 缺失（已跳过，不虚构、不删除已有图片）：")
        for m in missing:
            print("  MISSING", m)

    os.makedirs(OUT, exist_ok=True)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(build_manifest(pages), f, ensure_ascii=False, indent=1)

    for ver in ("laowei", "kaoyanqun"):
        n_years = len(pages[ver])
        n_pages = sum(len(v) for v in pages[ver].values())
        print(f"{ver}: {n_years} 年 / {n_pages} 页")
    print(f"已写入 {MANIFEST_PATH}")
    print("提示：两版答案冲突时请原样各存，把差异登记到 docs/答案版本覆盖与差异报告.md，交人工核对。")


if __name__ == "__main__":
    main()
