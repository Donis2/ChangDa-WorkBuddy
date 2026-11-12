#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""按专题生成题答同册 PDF（默认输出到 public/pdfs/）。

专题（--topic，默认 gear）：
  gear     齿轮专题，拆成两册
           齿轮专题-非计算题（含答案）.pdf   选择 / 判断 / 填空 / 简答，答案统一放册末
           齿轮专题-计算作图题（含答案）.pdf 计算（含受力作图、轮系传动比），一题一页，
                                             作答区占满本页剩余空间，答案另起一页
  balance  回转件的平衡专题，合成一册（该章只有 1 道计算题，再拆册没有意义）
           回转件的平衡专题（含答案）.pdf    全部题型；计算题给整页作答区；答案放册末

数据来源：data/questions.json（真题）+ data/extended.json（扩展题库）。
用法：python scripts/build_topic_pdfs.py [--topic gear|balance] [--out DIR]
"""
from __future__ import annotations

import argparse
import json
import shutil

import numpy as np
import os
import re
import sys
from typing import Any

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Flowable,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)          # Workbuddy版本/
PUBLIC = os.path.join(ROOT, "public")
TMP_IMG = os.path.join(ROOT, "_tmp_pdf_img")

# 并排会把图缩得太小时是否允许改成上下堆叠（计算册要保「题奇页/答偶页」，故关掉）
IMG_STACK_MIXED = True

GEAR_CHAPTERS = ["第四章 齿轮机构", "第五章 轮系", "第十一章 齿轮传动", "第十二章 蜗杆传动"]
NON_CALC_TYPES = ["single_choice", "multiple_choice", "true_false", "fill_blank", "short_answer"]
ALL_TYPES = NON_CALC_TYPES + ["calculation"]

TOPICS: dict[str, dict] = {
    "gear": {
        "chapters": GEAR_CHAPTERS,
        "title": "齿轮专题",
        "coverage": "齿轮机构 / 轮系 / 齿轮传动 / 蜗杆传动",
        "split": True,
    },
    "balance": {
        "chapters": ["第八章 回转件的平衡"],
        "title": "回转件的平衡专题",
        "coverage": "静平衡 / 动平衡 / 质径积 / 平衡精度",
        "split": False,
    },
}

TYPE_LABEL = {
    "single_choice": "单项选择题",
    "multiple_choice": "多项选择题",
    "true_false": "判断题",
    "fill_blank": "填空题",
    "short_answer": "简答题",
    "calculation": "计算题",
}
CN_NUM = ["一", "二", "三", "四", "五", "六"]

# ---------------------------------------------------------------- 字体

FONT_DIR = r"C:\Windows\Fonts"


def register_fonts() -> tuple[str, str, str]:
    body = os.path.join(FONT_DIR, "simsun.ttc")
    bold = os.path.join(FONT_DIR, "simhei.ttf")
    mono = os.path.join(FONT_DIR, "simhei.ttf")
    pdfmetrics.registerFont(TTFont("Song", body, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("Hei", bold))
    pdfmetrics.registerFont(TTFont("HeiMono", mono))
    return "Song", "Hei", "HeiMono"


# ---------------------------------------------------------------- LaTeX → 排版标记

GREEK = {
    r"\alpha": "α", r"\beta": "β", r"\gamma": "γ", r"\delta": "δ",
    r"\sigma": "σ", r"\tau": "τ", r"\omega": "ω", r"\pi": "π",
    r"\mu": "μ", r"\theta": "θ", r"\varphi": "φ", r"\rho": "ρ",
    r"\eta": "η", r"\varepsilon": "ε", r"\psi": "ψ", r"\lambda": "λ",
    r"\Delta": "Δ", r"\Sigma": "Σ", r"\Omega": "Ω",
}
SYMBOL = {
    r"\circ": "°", r"\pm": "±", r"\mp": "∓", r"\times": "×", r"\div": "÷", r"\cdot": "·",
    r"\le": "≤", r"\leq": "≤", r"\ge": "≥", r"\geq": "≥", r"\ne": "≠", r"\neq": "≠",
    r"\approx": "≈", r"\sim": "∼", r"\propto": "∝", r"\therefore": "∴", r"\because": "∵",
    r"\Rightarrow": "⇒", r"\rightarrow": "→", r"\to": "→",
    r"\otimes": "⊗", r"\odot": "⊙", r"\prod": "∏",
    r"\qquad": "   ", r"\quad": "  ",
    r"\sum": "Σ", r"\int": "∫", r"\infty": "∞", r"\angle": "∠",
    r"\perp": "⊥", r"\parallel": "∥", r"\cong": "≅", r"\equiv": "≡",
    r"\ll": "≪", r"\gg": "≫", r"\degree": "°", r"\prime": "′",
}
FUNC = [r"\arctan", r"\arccos", r"\arcsin", r"\cos", r"\sin", r"\tan",
        r"\min", r"\max", r"\ln", r"\log"]


def _read_group(s: str, pos: int) -> tuple[str | None, int]:
    """s[pos] == '{' → (内容, 右括号之后的索引)，支持嵌套。"""
    if pos >= len(s) or s[pos] != "{":
        return None, -1
    depth = 0
    for i in range(pos, len(s)):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                return s[pos + 1:i], i + 1
    return None, -1


def _simple(x: str) -> bool:
    return bool(x) and len(x) <= 8 and not re.search(r"[+\-*/=<>()\s]", x)


def _wrap(x: str) -> str:
    return x if _simple(x) else f"({x})"


def _frac(s: str) -> str:
    while True:
        hit = False
        for cmd in (r"\dfrac", r"\frac", r"\tfrac"):
            idx = s.find(cmd + "{")
            if idx < 0:
                continue
            num, j = _read_group(s, idx + len(cmd))
            if j < 0:
                continue
            den, k = _read_group(s, j)
            if k < 0:
                continue
            s = s[:idx] + _wrap(num) + "/" + _wrap(den) + s[k:]
            hit = True
            break
        if not hit:
            return s


SUB_CHARS = {
    "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5",
    "₆": "6", "₇": "7", "₈": "8", "₉": "9", "ₐ": "a", "ₑ": "e",
    "ₕ": "h", "ᵢ": "i", "ⱼ": "j", "ₖ": "k", "ₗ": "l", "ₘ": "m",
    "ₙ": "n", "ₒ": "o", "ₚ": "p", "ᵣ": "r", "ₛ": "s", "ₜ": "t",
    "ᵤ": "u", "ᵥ": "v", "ₓ": "x",
}
SUP_CHARS = {
    "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5",
    "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-",
    "⁼": "=", "⁽": "(", "⁾": ")", "ⁿ": "n", "ⁱ": "i",
}


def _unicode_scripts(s: str) -> str:
    """把 ₁ 这类 Unicode 上下标字符转成 <sub>/<super>（SimSun 无这些字形）。"""
    def sub(m: re.Match) -> str:
        return "<sub>" + "".join(SUB_CHARS[c] for c in m.group(0)) + "</sub>"

    def sup(m: re.Match) -> str:
        return "<super>" + "".join(SUP_CHARS[c] for c in m.group(0)) + "</super>"

    s = re.sub("[" + "".join(SUB_CHARS) + "]+", sub, s)
    s = re.sub("[" + "".join(SUP_CHARS) + "]+", sup, s)
    return s


def _unwrap_cmd(s: str, cmds: tuple[str, ...]) -> str:
    """去掉 \\cmd{...} 外壳、保留花括号内容；支持内容里再套花括号。"""
    pattern = re.compile(r"\\(?:" + "|".join(cmds) + r")\{")
    while True:
        m = pattern.search(s)
        if not m:
            return s
        body, j = _read_group(s, m.end() - 1)
        if j < 0:
            return s
        s = s[:m.start()] + body + s[j:]


def _conv_math(src: str) -> str:
    s = _unicode_scripts(src)
    s = s.replace(r"\left", "").replace(r"\right", "")
    s = s.replace(r"^{\circ}", "°").replace(r"^\circ", "°")
    s = s.replace("^{*}", "*").replace("^*", "*")
    s = _frac(s)
    # \sqrt{...}
    while True:
        idx = s.find(r"\sqrt{")
        if idx < 0:
            break
        body, j = _read_group(s, idx + len(r"\sqrt"))
        if j < 0:
            break
        s = s[:idx] + "√" + _wrap(body) + s[j:]
    # \mathrm{...} / \text{...} / \mathbf{...}
    s = _unwrap_cmd(s, ("mathrm", "text", "mathbf", "boldsymbol", "mathit", "mathcal"))
    # 重音/装饰命令：去掉外壳保留内容（\overline{AB} → AB），避免排进 PDF 变成原文命令
    s = _unwrap_cmd(s, ("overline", "underline", "hat", "widehat", "bar", "vec", "tilde", "dot", "ddot"))
    for k, v in sorted(SYMBOL.items(), key=lambda kv: -len(kv[0])):
        s = s.replace(k, v)
    for k, v in sorted(GREEK.items(), key=lambda kv: -len(kv[0])):
        s = s.replace(k, v)
    for k in FUNC:
        s = s.replace(k, k[1:])
    s = s.replace(r"\ ", " ").replace(r"\,", " ").replace(r"\;", " ").replace(r"\:", " ")
    s = s.replace("\\{", "{").replace("\\}", "}").replace("\\_", "_")
    s = s.replace("'", "′")
    # 上下标
    s = re.sub(r"\^\{([^{}]*)\}", r"<super>\1</super>", s)
    s = re.sub(r"\^([A-Za-z0-9+\-])", r"<super>\1</super>", s)
    s = re.sub(r"_\{([^{}]*)\}", r"<sub>\1</sub>", s)
    s = re.sub(r"_([A-Za-z0-9+\-])", r"<sub>\1</sub>", s)
    return s


def rich(text: Any) -> str:
    """把纯文本（含 $...$ LaTeX、换行）转成 reportlab Paragraph 标记。"""
    if text is None:
        return ""
    if isinstance(text, (list, tuple)):
        text = "\n".join(str(x) for x in text if x is not None)
    elif not isinstance(text, str):
        text = str(text)
    if not text:
        return ""
    # 先转义 HTML，再按 $...$ 切分；整段都过一遍 LaTeX 转换，
    # 因为原始数据里有一部分公式没有写 $ 定界符。
    parts = re.split(r"\$([^$]*)\$", _escape(text))
    out: list[str] = []
    for i, part in enumerate(parts):
        out.append(_conv_math(part))
    s = "".join(out)
    s = s.replace("$", "")  # 兜底：清掉不成对的定界符
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = s.replace("\n", "<br/>")
    return s


def _escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ---------------------------------------------------------------- 数据

def load_data() -> tuple[list[dict], list[dict]]:
    with open(os.path.join(ROOT, "data", "questions.json"), encoding="utf-8") as f:
        real = json.load(f)["questions"]
    with open(os.path.join(ROOT, "data", "extended.json"), encoding="utf-8") as f:
        ext = json.load(f)["questions"]
    return real, ext


def gear_sets(real: list[dict], ext: list[dict]):
    rg = [q for q in real if q.get("chapter") in GEAR_CHAPTERS]
    eg = [q for q in ext if q.get("chapter") in GEAR_CHAPTERS]
    return rg, eg


def year_of(q: dict) -> str:
    ys = q.get("source_years") or []
    if ys:
        return "、".join(str(y) for y in sorted(set(ys)))
    return "扩展"


def source_label(q: dict) -> str:
    if q.get("is_extended"):
        return f"扩展题库 · {q.get('source') or q.get('source_book') or ''}".strip(" ·")
    return f"{year_of(q)} 年真题"


def sorted_real(qs: list[dict]) -> list[dict]:
    return sorted(qs, key=lambda q: (str(q.get("id", "")),))


# ---------------------------------------------------------------- 样式

def make_styles(body: str, hei: str) -> dict[str, ParagraphStyle]:
    st: dict[str, ParagraphStyle] = {}
    st["cover_title"] = ParagraphStyle("cover_title", fontName=hei, fontSize=26, leading=36,
                                       alignment=TA_CENTER, textColor=colors.HexColor("#0F172A"))
    st["cover_sub"] = ParagraphStyle("cover_sub", fontName=body, fontSize=13, leading=22,
                                     alignment=TA_CENTER, textColor=colors.HexColor("#475569"))
    st["cover_meta"] = ParagraphStyle("cover_meta", fontName=body, fontSize=10.5, leading=18,
                                      alignment=TA_CENTER, textColor=colors.HexColor("#64748B"))
    st["H1"] = ParagraphStyle("H1", fontName=hei, fontSize=17, leading=24, spaceBefore=6,
                              spaceAfter=10, textColor=colors.HexColor("#0F172A"))
    st["H2"] = ParagraphStyle("H2", fontName=hei, fontSize=12.5, leading=18, spaceBefore=10,
                              spaceAfter=6, textColor=colors.HexColor("#1E3A8A"))
    # 与 H1 同样式，但不进目录（用于「目录」标题本身）
    st["H1NoToc"] = ParagraphStyle("H1NoToc", parent=st["H1"])
    # 计算册的逐题标题：不进目录
    st["Q"] = ParagraphStyle("Q", fontName=hei, fontSize=11.5, leading=17, spaceBefore=4,
                             spaceAfter=5, textColor=colors.HexColor("#1E3A8A"))
    st["body"] = ParagraphStyle("body", fontName=body, fontSize=10.5, leading=17,
                                alignment=TA_JUSTIFY, textColor=colors.HexColor("#1F2937"),
                                wordWrap="CJK")
    st["stem"] = ParagraphStyle("stem", parent=st["body"], fontSize=10.8, leading=18.5)
    st["opt"] = ParagraphStyle("opt", parent=st["body"], fontSize=10.5, leading=17,
                               leftIndent=16, firstLineIndent=-16)
    st["meta"] = ParagraphStyle("meta", fontName=body, fontSize=8.6, leading=13,
                                textColor=colors.HexColor("#94A3B8"))
    st["ans"] = ParagraphStyle("ans", parent=st["body"], fontSize=10.5, leading=18)
    st["small"] = ParagraphStyle("small", parent=st["body"], fontSize=9.2, leading=15,
                                 textColor=colors.HexColor("#64748B"))
    st["toc0"] = ParagraphStyle("toc0", fontName=hei, fontSize=11.5, leading=20,
                                textColor=colors.HexColor("#0F172A"))
    st["toc1"] = ParagraphStyle("toc1", fontName=body, fontSize=10, leading=17, leftIndent=14,
                                textColor=colors.HexColor("#475569"))
    return st


# ---------------------------------------------------------------- 绘图小件

class WritingArea(Flowable):
    """占满本页剩余高度的虚线作答区。"""

    def __init__(self, label: str = "作答区"):
        super().__init__()
        self.label = label
        self.width = 0.0
        self.height = 0.0

    def wrap(self, aw: float, ah: float) -> tuple[float, float]:
        self.width = aw
        self.height = max(ah, 0.0)
        return aw, self.height

    def draw(self) -> None:
        c = self.canv
        c.saveState()
        c.setStrokeColor(colors.HexColor("#CBD5E1"))
        c.setLineWidth(0.6)
        c.setDash(1.2, 3)
        c.roundRect(0, 0, self.width, self.height, 3 * mm, stroke=1, fill=0)
        c.setFillColor(colors.HexColor("#94A3B8"))
        c.setFont("Song", 8)
        c.drawString(4 * mm, self.height - 11, self.label)
        c.restoreState()


def _crop_scan_border(im: PILImage.Image) -> PILImage.Image:
    """裁掉原卷扫描件边缘的黑裁切线（细而贯穿整幅，排进 PDF 会像表格线）。"""
    a = np.asarray(im.convert("L"), dtype=np.uint8)
    h, w = a.shape
    dark = a < 140
    col_ratio = dark.mean(axis=0)
    row_ratio = dark.mean(axis=1)
    box = [0, 0, w, h]
    band_c = max(2, int(w * 0.04))
    for x in range(w - 1, w - band_c - 1, -1):
        if col_ratio[x] > 0.5:
            # 暗线通常有 2~4 px 宽，继续往内走，把整条线一起裁掉
            x0 = x
            while x0 - 1 >= 0 and col_ratio[x0 - 1] > 0.35:
                x0 -= 1
            box[2] = max(x0 - 3, int(w * 0.8))
            break
    for x in range(0, band_c):
        if col_ratio[x] > 0.5:
            x1 = x
            while x1 + 1 < w and col_ratio[x1 + 1] > 0.35:
                x1 += 1
            box[0] = min(x1 + 4, int(w * 0.2))
            break
    band_r = max(2, int(h * 0.04))
    for y in range(h - 1, h - band_r - 1, -1):
        if row_ratio[y] > 0.5:
            y0 = y
            while y0 - 1 >= 0 and row_ratio[y0 - 1] > 0.35:
                y0 -= 1
            box[3] = max(y0 - 3, int(h * 0.8))
            break
    for y in range(0, band_r):
        if row_ratio[y] > 0.5:
            y1 = y
            while y1 + 1 < h and row_ratio[y1 + 1] > 0.35:
                y1 += 1
            box[1] = min(y1 + 4, int(h * 0.2))
            break
    if box == [0, 0, w, h]:
        return im
    # 裁线之后往往还留一条极淡的扫描边影：把贴边的非纯白列/行一并削掉（最多 2%）
    gray = a.astype(np.int16)
    col_mean = gray.mean(axis=0)
    row_mean = gray.mean(axis=1)
    cap_x, cap_y = int(w * 0.02), int(h * 0.02)
    while box[2] > w - cap_x and col_mean[box[2] - 1] < 250:
        box[2] -= 1
    while box[0] < cap_x and col_mean[box[0]] < 250:
        box[0] += 1
    while box[3] > h - cap_y and row_mean[box[3] - 1] < 250:
        box[3] -= 1
    while box[1] < cap_y and row_mean[box[1]] < 250:
        box[1] += 1
    return im.crop(tuple(box))


def image_flow(path: str, max_w: float, max_h: float) -> Image | None:
    if not os.path.exists(path):
        return None
    with PILImage.open(path) as im:
        im.load()
        cropped = _crop_scan_border(im)
        iw, ih = cropped.size
        if iw <= 0 or ih <= 0:
            return None
        scale = min(max_w / iw, max_h / ih)
        if cropped is im:
            return Image(path, width=iw * scale, height=ih * scale)
        # 裁过边的图先落到临时目录，reportlab 的 Image 只认文件名或文件对象
        os.makedirs(TMP_IMG, exist_ok=True)
        out = os.path.join(TMP_IMG, os.path.basename(path).replace(".png", "_c.png"))
        cropped.save(out)
        return Image(out, width=iw * scale, height=ih * scale)


def images_row(paths: list[str], max_w: float, max_h: float) -> Flowable | None:
    paths = [p for p in paths if os.path.exists(p)]
    if not paths:
        return None
    n = len(paths)
    cols = 1 if n == 1 else 2
    # 多图时必须按「每列可用宽度」缩放，否则横长图会撑出文本框
    per_w = max_w if cols == 1 else (max_w - 4 * mm) / cols
    flows = [f for f in (image_flow(p, per_w, max_h) for p in paths) if f is not None]
    if not flows:
        return None
    if len(flows) == 1:
        return flows[0]

    def _aspect(p: str) -> float:
        with PILImage.open(p) as im:
            w, h = im.size
        return w / h if h else 0.0

    # 并排会把图缩得太小时改为上下堆叠、每张占满宽度：
    # ① 全是横长图（宽高比 ≥ 2.8）；② 两张图比例相差悬殊（>2 倍）
    aspects = [_aspect(p) for p in paths]
    stacked_needed = all(a >= 2.8 for a in aspects) or (
        IMG_STACK_MIXED and len(aspects) > 1
        and max(aspects) / max(min(aspects), 0.01) > 2.0)
    if stacked_needed:
        stacked: list[list[Flowable]] = []
        for p in paths:
            f = image_flow(p, max_w, max_h)
            if f is not None:
                stacked.append([f])
        if stacked:
            t = Table(stacked, colWidths=[max_w], hAlign="CENTER")
            t.setStyle(TableStyle([
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]))
            return t

    cols = min(len(flows), 2)
    rows = [flows[i:i + cols] for i in range(0, len(flows), cols)]
    # 等宽列：两张图宽高比差很多时也能居中排齐
    table = Table(rows, colWidths=[max_w / cols] * cols, hAlign="CENTER")
    table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return table


def fmt_answer(q: dict) -> str:
    t = q.get("type")
    a = q.get("answer")
    if t in ("single_choice", "multiple_choice"):
        if isinstance(a, list):
            return "、".join(str(x) for x in a)
        return str(a or "")
    if t == "true_false":
        if isinstance(a, list):
            a = a[0] if a else ""
        return "正确" if a is True or str(a) in ("True", "true", "正确", "A") else "错误"
    if isinstance(a, list):
        return "；".join(str(x) for x in a)
    return str(a or "")


# ---------------------------------------------------------------- 文档骨架

class GearDoc(BaseDocTemplate):
    def __init__(self, filename: str, title: str, footer: str = "齿轮专题", **kw: Any):
        super().__init__(filename, pagesize=A4, title=title,
                         leftMargin=20 * mm, rightMargin=20 * mm,
                         topMargin=18 * mm, bottomMargin=18 * mm, **kw)
        self.doc_title = title
        self.footer = footer
        frame = Frame(self.leftMargin, self.bottomMargin,
                      self.width, self.height, id="body")
        self.addPageTemplates([PageTemplate(id="body", frames=[frame], onPage=self._decorate)])

    def _decorate(self, canv, doc) -> None:
        canv.saveState()
        canv.setFont("Song", 8)
        canv.setFillColor(colors.HexColor("#94A3B8"))
        canv.drawString(20 * mm, 11 * mm, f"常大 855 机械专硕 · {self.footer}")
        canv.drawRightString(A4[0] - 20 * mm, 11 * mm, f"第 {doc.page} 页")
        canv.setStrokeColor(colors.HexColor("#E2E8F0"))
        canv.setLineWidth(0.5)
        canv.line(20 * mm, 15 * mm, A4[0] - 20 * mm, 15 * mm)
        canv.restoreState()

    def afterFlowable(self, flowable) -> None:
        if isinstance(flowable, Paragraph):
            name = flowable.style.name
            if name == "H1":
                self.notify("TOCEntry", (0, flowable.getPlainText(), self.page))
            elif name == "H2":
                self.notify("TOCEntry", (1, flowable.getPlainText(), self.page))


def cover(st: dict, title: str, subtitle: str, lines: list[str]) -> list[Flowable]:
    out: list[Flowable] = [Spacer(1, 42 * mm),
                           Paragraph(title, st["cover_title"]),
                           Spacer(1, 4 * mm),
                           Paragraph(subtitle, st["cover_sub"]),
                           Spacer(1, 16 * mm)]
    for ln in lines:
        out.append(Paragraph(ln, st["cover_meta"]))
    out.append(PageBreak())
    return out


def toc_page(st: dict) -> list[Flowable]:
    toc = TableOfContents()
    toc.levelStyles = [st["toc0"], st["toc1"]]
    toc.dotsMinLevel = 0
    return [Paragraph("目　录", st["H1NoToc"]), Spacer(1, 2 * mm), toc, PageBreak()]


def question_block(st: dict, no: int, q: dict, show_meta: bool = True,
                   numbered: bool = True) -> list[Flowable]:
    head = f"<b>{no}.</b> " if numbered else ""
    flows: list[Flowable] = [Paragraph(head + rich(q.get("stem") or ""), st["stem"])]
    opts = q.get("options") or []
    if opts:
        lines = []
        for o in opts:
            key = o.get("key", "")
            lines.append(Paragraph(f"{key}．{rich(o.get('text') or '')}", st["opt"]))
        flows.append(Spacer(1, 1.2 * mm))
        if len(opts) >= 4:
            half = (len(opts) + 1) // 2
            left, right = lines[:half], lines[half:]
            rows = []
            for i in range(half):
                rows.append([left[i], right[i] if i < len(right) else ""])
            t = Table(rows, colWidths=["50%", "50%"])
            t.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 0.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0.5),
            ]))
            flows.append(t)
        else:
            flows.extend(lines)
    imgs = q.get("images") or []
    if imgs:
        row = images_row([os.path.join(PUBLIC, p.lstrip("/")) for p in imgs],
                         max_w=150 * mm, max_h=62 * mm)
        if row is not None:
            flows.append(Spacer(1, 2 * mm))
            flows.append(row)
    if show_meta:
        flows.append(Spacer(1, 1.2 * mm))
        flows.append(Paragraph(
            f"{source_label(q)}　·　{q.get('chapter', '')}", st["meta"]))
    return flows


def answer_block(st: dict, no: int, q: dict, numbered: bool = True) -> list[Flowable]:
    flows: list[Flowable] = []
    tag = f"<b>{no}.</b> " if numbered else ""
    t = q.get("type")
    if t in ("single_choice", "multiple_choice", "true_false", "fill_blank"):
        if numbered:
            flows.append(Paragraph(f"<b>{no}.</b>", st["ans"]))
            tag = ""
        flows.append(Paragraph(tag + "答案：" + rich(fmt_answer(q)), st["ans"]))
        expl = (q.get("explanation") or "").strip()
        if expl:
            flows.append(Paragraph("解析：" + rich(expl), st["ans"]))
    else:
        body = rich(q.get("answer") or "（暂无答案）")
        flows.append(Paragraph(tag + body, st["ans"]))
        expl = (q.get("explanation") or "").strip()
        if expl:
            flows.append(Spacer(1, 1.5 * mm))
            flows.append(Paragraph("解析：" + rich(expl), st["small"]))
    imgs = q.get("answer_images") or []
    if imgs:
        row = images_row([os.path.join(PUBLIC, p.lstrip("/")) for p in imgs],
                         max_w=140 * mm, max_h=60 * mm)
        if row is not None:
            flows.append(Spacer(1, 2 * mm))
            flows.append(row)
    return flows


# ---------------------------------------------------------------- 组装

def _collect(real, ext, chapters, types):
    rg = [q for q in real if q.get("chapter") in chapters and q.get("type") in types]
    eg = [q for q in ext if q.get("chapter") in chapters and q.get("type") in types]
    return rg, eg


def _answer_flow(st: dict, ch_groups: list[dict]) -> list[Flowable]:
    """把一组已编号的答案渲染成流水：选择题表格 / 填空逐条 / 其余整段解析。"""
    out: list[Flowable] = []
    for grp in ch_groups:
        t, items = grp["type"], grp["items"]
        out.append(Paragraph(grp["label"], st["small"]))
        if t in ("single_choice", "multiple_choice", "true_false"):
            cells = [f"{grp['start'] + i}. {fmt_answer(q)}" for i, q in enumerate(items)]
            rows = [cells[i:i + 6] for i in range(0, len(cells), 6)]
            tb = Table(rows, colWidths=[None] * 6, hAlign="LEFT")
            tb.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (-1, -1), "Song"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#1F2937")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            out.append(tb)
            out.append(Spacer(1, 3 * mm))
        elif t == "fill_blank":
            for i, q in enumerate(items):
                out.append(Paragraph(
                    f"{grp['start'] + i}. {rich(fmt_answer(q))}", st["ans"]))
            out.append(Spacer(1, 3 * mm))
        else:
            for i, q in enumerate(items):
                out += answer_block(st, grp["start"] + i, q)
                out.append(Spacer(1, 3.5 * mm))
    return out


def build_noncalc(real: list[dict], ext: list[dict], out: str, st: dict,
                  topic: dict) -> dict:
    chapters = topic["chapters"]
    rg, eg = _collect(real, ext, chapters, NON_CALC_TYPES)

    story: list[Flowable] = []
    story += cover(st, f"{topic['title']} · 非计算题",
                   f"{topic['coverage']}　·　常大 855 机械设计专业硕士",
                   [f"共 {len(rg) + len(eg)} 题　·　真题 {len(rg)} 题　·　扩展题 {len(eg)} 题",
                    "题、答同册；答案与解析统一放在本册末尾"])
    story += toc_page(st)

    groups: list[dict] = []
    no = 0
    for ch in chapters:
        ch_flow: list[Flowable] = [Paragraph(ch, st["H1"])]
        ch_groups = []
        seq = 0
        for t in NON_CALC_TYPES:
            items = [q for q in rg if q.get("chapter") == ch and q.get("type") == t]
            items += [q for q in eg if q.get("chapter") == ch and q.get("type") == t]
            if not items:
                continue
            items = sorted_real(items)
            label = f"{CN_NUM[seq]}、{TYPE_LABEL[t]}（{len(items)} 题）"
            seq += 1
            head = Paragraph(label, st["H2"])
            start = no + 1
            for i, q in enumerate(items):
                no += 1
                blk = question_block(st, no, q)
                if i == 0:
                    # 小节标题不能单独留在页底：和第一题绑在一起
                    ch_flow.append(KeepTogether([head] + blk))
                elif q.get("images"):
                    # 带图的题整块不拆页，避免「题干在页底、图跑到下一页」
                    ch_flow.append(KeepTogether(blk))
                else:
                    ch_flow += blk
                ch_flow.append(Spacer(1, 18 * mm if t == "short_answer" else 3.2 * mm))
            ch_groups.append({"type": t, "label": TYPE_LABEL[t], "items": items, "start": start})
        story += ch_flow
        story.append(PageBreak())
        groups.append({"chapter": ch, "groups": ch_groups})

    story.append(Paragraph("参考答案与解析", st["H1"]))
    for g in groups:
        story.append(Paragraph(g["chapter"], st["H2"]))
        story += _answer_flow(st, g["groups"])

    doc = GearDoc(out, f"{topic['title']} · 非计算题", footer=topic["title"])
    doc.multiBuild(story)
    return {"file": out, "questions": no, "real": len(rg), "ext": len(eg)}


def build_calc(real: list[dict], ext: list[dict], out: str, st: dict,
               topic: dict) -> dict:
    global IMG_STACK_MIXED
    IMG_STACK_MIXED = False   # 一题固定两页，堆叠会打破奇偶配对
    chapters = topic["chapters"]
    rg, eg = _collect(real, ext, chapters, ["calculation"])
    items = sorted_real(rg + eg)
    by_ch = {ch: [q for q in items if q.get("chapter") == ch] for ch in chapters}

    story: list[Flowable] = []
    story += cover(st, f"{topic['title']} · 计算作图",
                   f"{topic['coverage']}　·　常大 855 机械设计专业硕士",
                   [f"共 {len(items)} 题　·　真题 {len(rg)} 题　·　扩展题 {len(eg)} 题",
                    "每题一页作答区，答案另起一页，便于自测"])
    story += toc_page(st)

    no = 0
    for ch in chapters:
        ch_items = by_ch.get(ch) or []
        if not ch_items:
            continue
        story.append(Paragraph(f"{ch}（共 {len(ch_items)} 题）", st["H1"]))
        for q in ch_items:
            no += 1
            story.append(Paragraph(f"第 {no} 题", st["Q"]))
            story += question_block(st, no, q, numbered=False)
            story.append(CondPageBreak(55 * mm))
            story.append(WritingArea("作答区（翻页查看答案）"))
            story.append(PageBreak())

            story.append(Paragraph(f"第 {no} 题 · 答案", st["Q"]))
            story += answer_block(st, no, q, numbered=False)
            story.append(PageBreak())

    doc = GearDoc(out, f"{topic['title']} · 计算作图", footer=topic["title"])
    doc.multiBuild(story)
    return {"file": out, "questions": no, "real": len(rg), "ext": len(eg)}


def build_single(real: list[dict], ext: list[dict], out: str, st: dict,
                 topic: dict) -> dict:
    """一册装：全部题型；计算题给整页作答区；答案统一在册末。"""
    chapters = topic["chapters"]
    rg, eg = _collect(real, ext, chapters, ALL_TYPES)
    all_items = sorted_real(rg + eg)

    story: list[Flowable] = []
    story += cover(st, topic["title"],
                   f"{topic['coverage']}　·　常大 855 机械设计专业硕士",
                   [f"共 {len(all_items)} 题　·　真题 {len(rg)} 题　·　扩展题 {len(eg)} 题",
                    "题、答同册；答案与解析统一放在本册末尾"])
    story += toc_page(st)

    groups: list[dict] = []
    no = 0
    for ch in chapters:
        ch_items = [q for q in all_items if q.get("chapter") == ch]
        if not ch_items:
            continue
        story.append(Paragraph(ch, st["H1"]))
        ch_groups = []
        seq = 0
        for t in ALL_TYPES:
            items = [q for q in ch_items if q.get("type") == t]
            if not items:
                continue
            label = f"{CN_NUM[seq]}、{TYPE_LABEL[t]}（{len(items)} 题）"
            seq += 1
            head = Paragraph(label, st["H2"])
            start = no + 1
            for i, q in enumerate(items):
                no += 1
                blk = question_block(st, no, q)
                if i == 0:
                    story.append(KeepTogether([head] + blk))
                elif q.get("images"):
                    story.append(KeepTogether(blk))
                else:
                    story += blk
                if t == "calculation":
                    story.append(CondPageBreak(50 * mm))
                    story.append(WritingArea("作答区（答案见册末）"))
                    story.append(PageBreak())
                elif t == "short_answer":
                    story.append(Spacer(1, 18 * mm))
                else:
                    story.append(Spacer(1, 3.2 * mm))
            ch_groups.append({"type": t, "label": TYPE_LABEL[t], "items": items, "start": start})
        story.append(PageBreak())
        groups.append({"chapter": ch, "groups": ch_groups})

    story.append(Paragraph("参考答案与解析", st["H1"]))
    for g in groups:
        story.append(Paragraph(g["chapter"], st["H2"]))
        story += _answer_flow(st, g["groups"])

    doc = GearDoc(out, topic["title"], footer=topic["title"])
    doc.multiBuild(story)
    return {"file": out, "questions": no, "real": len(rg), "ext": len(eg)}


# ---------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic", default="gear", choices=sorted(TOPICS))
    ap.add_argument("--out", default=os.path.join(PUBLIC, "pdfs"))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    topic = TOPICS[args.topic]
    body, hei, _ = register_fonts()
    st = make_styles(body, hei)
    real, ext = load_data()

    results: list[dict] = []
    if topic["split"]:
        results.append(build_noncalc(
            real, ext, os.path.join(args.out, f"{topic['title']}-非计算题（含答案）.pdf"), st, topic))
        results.append(build_calc(
            real, ext, os.path.join(args.out, f"{topic['title']}-计算作图题（含答案）.pdf"), st, topic))
    else:
        results.append(build_single(
            real, ext, os.path.join(args.out, f"{topic['title']}（含答案）.pdf"), st, topic))

    for r in results:
        print(f"{os.path.basename(r['file'])}: {r['questions']} 题（真题 {r['real']} / 扩展 {r['ext']}）"
              f"  {os.path.getsize(r['file']) / 1024 / 1024:.2f} MB")
    shutil.rmtree(TMP_IMG, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
