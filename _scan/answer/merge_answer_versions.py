# -*- coding: utf-8 -*-
"""把转录好的答案片段合并进 data/source/<年>.json 的 answer_versions。

片段目录：_scan/data/ans_json/<版本>-<年份>.json，格式：
{
  "year": 2013,
  "version": "laowei" | "kaoyanqun",
  "source_label": "老魏机械团队 2013 年参考答案",
  "quality_default": "原文转录",
  "items": [
    {"question_id": "2013-选择-01", "answer": ["B"], "note": "原卷记作 (2)"},
    {"question_id": "2013-计算-01", "answer": "d1=mz1=..."}
  ]
}

合并规则：
- 题目必须存在于该年份源文件里，否则记为错误；
- 同一题同一版本重复出现只保留第一条；
- 不覆盖顶层 answer（默认展示版），只加/覆盖对应版本；
- 空答案跳过并记账。
"""
import json
import os
import sys
from collections import Counter

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(ROOT, "data", "source")
FRAG = os.path.join(ROOT, "_scan", "data", "ans_json")
VALID_VERSIONS = {"laowei", "kaoyanqun"}


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def dump(p, obj):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    if not os.path.isdir(FRAG):
        print("没有", FRAG)
        return 1

    files = sorted(f for f in os.listdir(FRAG) if f.endswith(".json"))
    if only:
        files = [f for f in files if only in f]

    total_ok = total_skip = 0
    errors = []
    touched = Counter()

    for fn in files:
        frag = load(os.path.join(FRAG, fn))
        year = int(frag["year"])
        version = frag["version"]
        if version not in VALID_VERSIONS:
            errors.append("%s: 版本非法 %s" % (fn, version))
            continue
        path = os.path.join(SRC, "%d.json" % year)
        if not os.path.exists(path):
            errors.append("%s: 缺源文件 %s" % (fn, path))
            continue

        doc = load(path)
        by_id = {q["id"]: q for q in doc["questions"]}
        label = frag.get("source_label") or version
        quality = frag.get("quality_default") or "原文转录"
        seen = set()

        for it in frag.get("items", []):
            qid = it.get("question_id")
            ans = it.get("answer")
            if not qid or qid not in by_id:
                errors.append("%s: 题目不存在 %s" % (fn, qid))
                continue
            if qid in seen:
                total_skip += 1
                continue
            if ans is None or (isinstance(ans, (list, str)) and len(ans) == 0):
                total_skip += 1
                continue
            seen.add(qid)
            q = by_id[qid]
            versions = q.setdefault("answer_versions", {})
            entry = {
                "answer": ans,
                "source": label,
                "quality": it.get("quality") or quality,
            }
            if it.get("note"):
                entry["note"] = it["note"]
            versions[version] = entry
            total_ok += 1
            touched[year] += 1

        dump(path, doc)

    print("合并完成：写入 %d 条，跳过 %d 条" % (total_ok, total_skip))
    for y in sorted(touched):
        print("   %d 年：%d 题" % (y, touched[y]))
    if errors:
        print("错误 %d 条：" % len(errors))
        for e in errors[:40]:
            print("   ✗", e)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
