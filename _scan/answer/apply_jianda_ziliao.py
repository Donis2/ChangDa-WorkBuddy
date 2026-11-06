# -*- coding: utf-8 -*-
"""阶段 3：把《常大855-简答题详解》的 82 题分点答案写入真题库的「资料版」答案。

- 匹配方式：按 (年份, 大题号, 小题号) 精确连接，不做模糊匹配。
- 写入位置：data/source/<年>.json 对应题目的 answer_versions.ziliao
- 顶层 answer 保持不变（仍是默认展示版），因此统计、搜索、旧逻辑不受影响。
- 覆盖不到的真题简答写进 _scan/data/jianda_gap.md，最终并入根目录清单。
"""
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(ROOT, "data", "source")
DATA = os.path.join(ROOT, "_scan", "data")

SOURCE_LABEL = "《常大855-简答题详解》（按教材整理的分点答案）"

# 《简答详解》没收、但简答汇编/专项训练里有同题的，手工指定（题 id -> 答案正文）
MANUAL_ZILIAO = {
    "2017-简答-05": (
        "非液体摩擦滑动轴承的主要失效形式是磨损和胶合。p 值过大，油膜不易形成，轴瓦易磨损；"
        "pv 值反映单位面积上的摩擦功率（发热量），pv 过大使温升过高，润滑油粘度下降，易发生胶合。"
        "所以验算 p≤[p]、pv≤[pv]（以及 v≤[v]），就是防止过度磨损和胶合的间接条件计算。",
        "《常大855-简答题汇编》第 21 题（原卷标注 2017 年）",
    ),
}

# 本就不是「问答式简答」的题（作图/结构改错），详解不收属正常
NOT_A_SHORT_ANSWER = {
    "2006-计算-01": "极限应力线图作图求解，属计算/作图题",
    "2009-分析-03": "轴系结构改错（作图题）",
    "2010-计算-06": "结构改错（作图题）",
    "2011-计算-05": "齿轮轴系结构改错（作图题）",
    "2026-综合-06": "轴系结构改错（教材原题，作图题）",
}


def load_json(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def dump_json(p, obj):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def key_of(year, num_text):
    m = re.match(r"([一二三四五六七八九十]+)、.*?第\s*(\d+)\s*题", num_text or "")
    return (int(year), m.group(1), m.group(2)) if m else None


def main():
    detail = load_json(os.path.join(DATA, "parsed_jianda.json"))
    index = {}
    for d in detail:
        index[(int(d["year"]), d["section"], str(d["qno"]))] = d

    files = sorted(f for f in os.listdir(SRC) if f.endswith(".json") and f[0].isdigit())
    used, written = set(), 0
    no_detail = []

    for fn in files:
        path = os.path.join(SRC, fn)
        doc = load_json(path)
        changed = False
        for q in doc["questions"]:
            if q.get("type") != "short_answer":
                continue
            keys = [key_of(y, n) for y, n in (q.get("original_numbers") or {}).items()]
            keys = [k for k in keys if k]
            hit = next((index[k] for k in keys if k in index), None)
            if hit is None:
                manual = MANUAL_ZILIAO.get(q["id"])
                if manual:
                    q.setdefault("answer_versions", {})["ziliao"] = {
                        "answer": manual[0], "source": manual[1], "quality": "整理"}
                    changed = True
                    written += 1
                else:
                    no_detail.append(q)
                continue
            used.add(id(hit))
            points = [p.strip() for p in hit["points"] if p and p.strip()]
            if not points:
                no_detail.append(q)
                continue
            versions = q.setdefault("answer_versions", {})
            versions["ziliao"] = {
                "answer": "\n".join("%d. %s" % (i + 1, p) for i, p in enumerate(points)),
                "source": SOURCE_LABEL,
                "quality": "整理",
            }
            changed = True
            written += 1
        if changed:
            dump_json(path, doc)

    unused = [d for d in detail if id(d) not in used]

    lines = ["# 简答题答案缺口清单（阶段 3 结果）", "",
             "生成脚本：`_scan/answer/apply_jianda_ziliao.py`", "",
             "## 一、已补「资料版」答案", "",
             "共 **%d** 道真题简答题写入了 `answer_versions.ziliao`（来源：%s）。" % (written, SOURCE_LABEL),
             "前端答案区会多出一个「资料版」标签，与原有答案并列，可随时切换对照。", ""]
    lines += ["## 二、《简答详解》里没有对应到的真题简答", ""]
    if no_detail:
        lines.append("| 题目 id | 年份 | 题干 | 说明 |")
        lines.append("|---|---|---|---|")
        for q in no_detail:
            why = NOT_A_SHORT_ANSWER.get(q["id"]) or "详解与汇编均未收录，需另行补写"
            lines.append("| `%s` | %s | %s | %s |" %
                         (q["id"], "/".join(map(str, q.get("source_years") or [])),
                          (q.get("stem") or "").replace("|", "\\|")[:80], why))
    else:
        lines.append("无——84 道真题简答题中，82 道由《简答详解》覆盖，其余见下表。")
    lines.append("")

    if unused:
        lines += ["## 三、详解中未能对上真题的条目（供核对）", ""]
        for d in unused:
            lines.append("- %s年 %s 第%s题 %s" % (d["year"], d["section"], d["qno"], d["stem"][:60]))
        lines.append("")

    open(os.path.join(DATA, "jianda_gap.md"), "w", encoding="utf-8").write("\n".join(lines))
    print("写入 ziliao 版答案：%d 题；未覆盖的真题简答 %d 题；详解多余 %d 条" %
          (written, len(no_detail), len(unused)))
    for q in no_detail:
        print("   缺：", q["id"], (q.get("stem") or "")[:44])


if __name__ == "__main__":
    main()
