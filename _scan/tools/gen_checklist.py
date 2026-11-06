# -*- coding: utf-8 -*-
"""由题库产物自动生成《待核实清单.md》"""
import json, io, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
qs = json.load(io.open(os.path.join(ROOT, "data", "questions.json"), encoding="utf-8"))["questions"]

def txt(v):
    if isinstance(v, list):
        return "、".join(str(x) for x in v)
    return v or ""

def one(s, n=170):
    s = re.sub(r"\s+", " ", txt(s)).strip()
    return s[:n] + ("…" if len(s) > n else "")

sus = [q for q in qs if "答案存疑" in q.get("tags", [])]
fixed = [q for q in qs if ("已修正原答案" in q.get("tags", []) or "答案为按教材补写" in q.get("tags", []))]
miss = [q for q in qs if not txt(q.get("answer")).strip()]

L = []
L.append("# 待核实清单（需人工查书 / 查原卷核对）\n")
L.append("> 生成时间：2026-10-31 ｜ 题库 %d 题 ｜ 参考书在 `资料/`（扫描件，无文本层，只能人工翻）\n" % len(qs))
L.append("> 核对完直接告诉我要改哪几题、正确答案是什么，我改 `data/source/<年份>.json` 后重跑 `npm run build:data` 即可，页面零改动。\n")
L.append("> 本文件可用 `python _scan/tools/gen_checklist.py` 由题库数据重新生成。\n")

L.append("\n## 一、答案存疑（%d 题，题库已按教材/标准方法给出答案，请复核）\n" % len(sus))
for q in sus:
    L.append("\n### %s（%s｜%s｜%s 分）\n" % (q["id"], q["type"], q.get("chapter") or "—", q.get("score", "")))
    L.append("- 题干：%s\n" % one(q.get("stem")))
    L.append("- 题库当前答案：%s\n" % one(q.get("answer")))
    L.append("- **疑点 / 依据**：%s\n" % one(q.get("explanation"), 420))

L.append("\n## 二、缺答案（%d 题，原卷答案未作答，页面显示「参考答案暂缺」）\n" % len(miss))
L.append("\n主要是各年**简答题**与作图题。你查到后把答案发我，我一次性补进去。\n")
cur = None
for q in sorted(miss, key=lambda x: (x["source_years"][0] if x.get("source_years") else 0, x["id"])):
    y = q["source_years"][0] if q.get("source_years") else "?"
    if y != cur:
        cur = y
        L.append("\n### %s 年\n" % y)
    L.append("- **%s**：%s\n" % (q["id"], one(q.get("stem"), 110)))

L.append("\n## 三、已按教材补写 / 按标准方法修正（%d 处，供抽查，非存疑）\n" % len(fixed))
L.append("\n| 题号 | 处理说明 |\n| --- | --- |\n")
for q in fixed:
    tag = "按教材补写" if "答案为按教材补写" in q.get("tags", []) else "已修正"
    L.append("| %s | %s：%s |\n" % (q["id"], tag, one(q.get("explanation"), 150).replace("|", "／")))

io.open(os.path.join(ROOT, "docs", "待核实清单.md"), "w", encoding="utf-8").write("".join(L))
print("存疑 %d ｜ 缺答案 %d ｜ 修正 %d ｜ 共 %d 题" % (len(sus), len(miss), len(fixed), len(qs)))
