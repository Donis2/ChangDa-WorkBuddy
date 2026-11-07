# -*- coding: utf-8 -*-
"""
题库构建脚本
============
把 data/source/ 下按年份存放的原始题目 JSON 合并为站点使用的数据文件：

    data/questions.json       合并后的结构化题库（含 source_years 与各年题号）
    data/knowledge_tree.json  知识点树（含每知识点/章节的题目数统计）
    data/stats.json           题库统计（题型/知识点/年份/计算题考点/分值）
    data/validation.json      校验报告（缺题号、缺答案、缺选项、重复题等）

新增年份试卷的做法：
  1. 在 data/source/ 下新增 <年份>.json（格式参考现有文件）；
  2. 运行 `python scripts/build_data.py`；
  3. 刷新前端即可，无需改动任何页面代码。
跨年份重复的题目：在题目里加 "merge_key"（同一道题用同一个值），
脚本会自动合并为一条，并把各个年份写进 source_years 与 original_numbers。
"""
from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter, OrderedDict
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "source")
EXT_SRC = os.path.join(SRC, "ext")
OUT = os.path.join(ROOT, "data")

TYPE_LABELS = {
    "single_choice": "单选题",
    "multiple_choice": "多选题",
    "fill_blank": "填空题",
    "true_false": "判断题",
    "short_answer": "简答题",
    "calculation": "计算题",
}

CHOICE_TYPES = {"single_choice", "multiple_choice", "true_false"}

# 多版本答案：老魏版 / 考研群资料版（常大考研之家）/ 教材补写 / 拓展资料包
ANSWER_VERSION_KEYS = ("laowei", "kaoyanqun", "textbook", "ziliao")
ANSWER_VERSION_LABELS = {
    "laowei": "老魏版",
    "kaoyanqun": "考研群版",
    "textbook": "教材版",
    "ziliao": "拓展资料版",
}


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def norm_stem(s: str) -> str:
    return re.sub(r"[\s　，。、（）()？?：:；;．.,]", "", s or "")


def check_answer_versions(q, issues):
    """校验 answer_versions 结构；返回 True 表示结构合法。"""
    versions = q.get("answer_versions")
    if not versions:
        return
    if not isinstance(versions, dict):
        issues["答案版本异常"].append({"id": q["id"], "reason": "answer_versions 不是对象"})
        return
    for key, v in versions.items():
        if key not in ANSWER_VERSION_KEYS:
            issues["答案版本异常"].append({"id": q["id"], "reason": "未知版本键 %s" % key})
            continue
        if not isinstance(v, dict):
            issues["答案版本异常"].append({"id": q["id"], "reason": "%s 不是对象" % key})
            continue
        ans = v.get("answer")
        if ans is None or (isinstance(ans, (list, str)) and len(ans) == 0):
            issues["答案版本异常"].append({"id": q["id"], "reason": "%s 答案为空" % key})
        for img in v.get("answer_images") or []:
            p = os.path.join(ROOT, "public", img.lstrip("/").replace("/", os.sep))
            if not os.path.exists(p):
                issues["图片文件缺失"].append({"id": q["id"], "img": img})
    default = q.get("answer_version_default")
    if default and default not in versions:
        issues["答案版本异常"].append(
            {"id": q["id"], "reason": "默认版本 %s 不存在" % default})


# ---------------------------------------------------------------------------
# 合并 Trae 独有资产（2026-11-07 两项目合并）
#   data/source/trae_figures.json   归档 Trae 原卷插图（卷面号命名）
#   data/source/trae_map.json       确定性映射：WB题 -> 64细分知识点 / A–O章 / 卷面题次
#   data/source/sub_knowledge.json  64 细分知识点 + 15 章定义
# 三份源文件都不存在时脚本仍可按纯 Workbuddy 数据构建（向后兼容）。
# ---------------------------------------------------------------------------

def apply_trae_assets(questions, tree_src):
    """把 Trae 独有资产挂到合并后的题目上，并生成二级知识点树。

    返回 (sub_knowledge_tree, summary)。不改动题干 / 答案 / 考纲章节，
    只追加：images / answer_images（并存）、sub_knowledge / trae_chapters /
    trae_exam_ids（溯源字段）。
    """
    by_id = {q["id"]: q for q in questions}
    fig_path = os.path.join(SRC, "trae_figures.json")
    map_path = os.path.join(SRC, "trae_map.json")
    sub_path = os.path.join(SRC, "sub_knowledge.json")

    # 1) 原卷插图：卷面号命名的图与 WB 原有 <题ID>.png 并存，不去重、不取舍
    n_img = n_ans = n_img_q = 0
    if os.path.exists(fig_path):
        for wid, v in (load_json(fig_path).get("questions") or {}).items():
            q = by_id.get(wid)
            if not q:
                continue
            touched = False
            for f in v.get("images") or []:
                p = "/images/questions/" + str(f).lstrip("/")
                if p not in q["images"]:
                    q["images"].append(p)
                    n_img += 1
                    touched = True
            for f in v.get("answer_images") or []:
                p = "/images/questions/" + str(f).lstrip("/")
                if p not in q["answer_images"]:
                    q["answer_images"].append(p)
                    n_ans += 1
                    touched = True
            if touched:
                n_img_q += 1

    # 2) 细分知识点 + 卷面题次映射（溯源）
    sub_codes = {}
    n_map_q = 0
    if os.path.exists(map_path):
        for wid, v in (load_json(map_path).get("questions") or {}).items():
            q = by_id.get(wid)
            if not q:
                continue
            q["sub_knowledge"] = v.get("sub_codes", [])
            q["trae_chapters"] = v.get("chapter_codes", [])
            q["trae_exam_ids"] = v.get("trae_exam_ids", [])
            sub_codes[wid] = v.get("sub_codes", [])
            n_map_q += 1

    # 3) 二级知识点树（结构与 knowledge_tree.json 对齐，供前端 lazy 加载）
    sub_tree = None
    n_points = n_chapters = 0
    if os.path.exists(sub_path):
        src = load_json(sub_path)
        cnt = Counter()
        qids = {}
        for wid, codes in sub_codes.items():
            for c in codes:
                cnt[c] += 1
                qids.setdefault(c, []).append(wid)
        chapters = []
        for c in src.get("chapters", []):
            pts = []
            for p in src.get("points", []):
                if p.get("chapter") != c["code"]:
                    continue
                pts.append({
                    "code": p["code"],
                    "name": p["name"],
                    "questionCount": cnt.get(p["code"], 0),
                    "questionIds": sorted(qids.get(p["code"], [])),
                })
            n_points += len(pts)
            chapters.append({
                "code": c["code"],
                "name": c["name"],
                "questionCount": sum(pp["questionCount"] for pp in pts),
                "points": pts,
            })
        n_chapters = len(chapters)
        sub_tree = {
            "subject": tree_src.get("subject", ""),
            "school": tree_src.get("school", ""),
            "note": "Trae 版 64 个细分知识点（二级知识点）与 A–O 共 15 章；"
                    "与考纲章节体系并存，不替代。",
            "total_questions": len(questions),
            "chapters": chapters,
        }

    return sub_tree, {
        "figure_questions": n_img_q,
        "figure_images": n_img,
        "figure_answer_images": n_ans,
        "mapped_questions": n_map_q,
        "sub_chapters": n_chapters,
        "sub_points": n_points,
    }


def check_answer_pages(issues):
    """核对 public/answers/manifest.json 里引用的整卷扫描答案图全部存在。"""
    mf = os.path.join(ROOT, "public", "answers", "manifest.json")
    if not os.path.exists(mf):
        issues["整卷答案图缺失"].append({"reason": "public/answers/manifest.json 不存在"})
        return 0
    doc = load_json(mf)
    base = os.path.join(ROOT, "public", "answers")
    n = 0
    for ver in ("laowei", "kaoyanqun"):
        for year, files in (doc.get(ver) or {}).items():
            for f in files:
                n += 1
                if not os.path.exists(os.path.join(base, ver, f)):
                    issues["整卷答案图缺失"].append(
                        {"version": ver, "year": year, "file": f})
    return n


def build_extended(questions, tree_src, kp_chapter):
    """合并 data/source/ext/*.json -> data/extended.json + data/ext_stats.json

    ext 目录下每个文件的格式：
        {
          "source_book": "青蛙弟弟选择题题库",
          "source_file": "题目资料来源/Trae/题库来源/选择题/常大855-青蛙弟弟选择题题库.pdf",
          "note": "……",
          "questions": [ { id, type, stem, options, answer, ... } ]
        }
    """
    if not os.path.isdir(EXT_SRC):
        print("未找到 data/source/ext/，跳过扩展题构建")
        return None

    files = sorted(f for f in os.listdir(EXT_SRC) if f.endswith(".json"))
    if not files:
        print("data/source/ext/ 为空，跳过扩展题构建")
        return None

    real_ids = {q["id"]: q for q in questions}
    merged: "OrderedDict[str, dict]" = OrderedDict()
    book_counts = Counter()
    issues = {
        "扩展题 id 重复": [], "扩展题缺答案": [], "扩展题缺选项": [],
        "扩展题真题引用不存在": [], "扩展题缺题干": [], "扩展题缺知识点": [],
        "扩展题答案不在选项内": [], "扩展题缺章节": [],
    }

    for fn in files:
        doc = load_json(os.path.join(EXT_SRC, fn))
        book = doc.get("source_book") or os.path.splitext(fn)[0]
        src_file = doc.get("source_file", "")
        for raw in doc.get("questions", []):
            q = dict(raw)
            q.setdefault("options", [])
            q.setdefault("images", [])
            q.setdefault("answer_images", [])
            q.setdefault("tags", [])
            q.setdefault("knowledge_points", [])
            q.setdefault("original_numbers", {})
            q.setdefault("source_years", [])
            q["is_extended"] = True
            q["source_book"] = book
            q["source_file"] = q.get("source_file") or src_file
            q.setdefault("source", book)
            refs = q.setdefault("real_exam_refs", [])
            # 用真题 ref 反推 source_years（前端年份筛选依赖它）
            if refs:
                q["source_years"] = sorted({int(r["year"]) for r in refs if r.get("year")})
            q.pop("merge_key", None)

            if q["id"] in merged:
                issues["扩展题 id 重复"].append(q["id"])
                continue
            if not (q.get("stem") or "").strip():
                issues["扩展题缺题干"].append(q["id"])
            ans = q.get("answer")
            if ans is None or (isinstance(ans, (list, str)) and len(ans) == 0):
                issues["扩展题缺答案"].append(q["id"])
            if q["type"] in CHOICE_TYPES and len(q["options"]) < 2:
                issues["扩展题缺选项"].append(q["id"])
            if q["type"] in CHOICE_TYPES:
                keys = {o.get("key") for o in q["options"]}
                got = ans if isinstance(ans, list) else [ans]
                for a in got:
                    if a and a not in keys:
                        issues["扩展题答案不在选项内"].append({"id": q["id"], "answer": a})
            if not q.get("chapter"):
                issues["扩展题缺章节"].append(q["id"])
            if not q["knowledge_points"]:
                issues["扩展题缺知识点"].append(q["id"])
            for r in refs:
                qid = r.get("question_id")
                if qid and qid not in real_ids:
                    issues["扩展题真题引用不存在"].append({"id": q["id"], "ref": qid})
            merged[q["id"]] = q
            book_counts[book] += 1

    ext = list(merged.values())
    type_c = Counter(q["type"] for q in ext)
    tagged = [q for q in ext if q.get("real_exam_refs")]
    ch_c = Counter()
    kp_c = Counter()
    for q in ext:
        chs = set()
        if q.get("chapter"):
            chs.add(q["chapter"])
        for kp in q["knowledge_points"]:
            kp_c[kp] += 1
            ch = kp_chapter.get(kp)
            if ch:
                chs.add(ch)
        for ch in chs:
            ch_c[ch] += 1

    year_c = Counter()
    for q in tagged:
        for r in q["real_exam_refs"]:
            year_c[int(r["year"])] += 1

    now = datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds")
    payload = {
        "meta": {
            "generated_at": now,
            "total_questions": len(ext),
            "by_source": [{"source": s, "count": c} for s, c in book_counts.most_common()],
            "by_type": [
                {"type": t, "label": TYPE_LABELS.get(t, t), "count": type_c[t]}
                for t in TYPE_LABELS if type_c[t]
            ],
            "tagged_real_exam": len(tagged),
            "type_labels": TYPE_LABELS,
        },
        "questions": ext,
    }
    ext_stats = {
        "generated_at": now,
        "total_questions": len(ext),
        "tagged_real_exam": len(tagged),
        "pure_supplement": len(ext) - len(tagged),
        "by_source": payload["meta"]["by_source"],
        "by_type": payload["meta"]["by_type"],
        "by_chapter": [{"chapter": c, "count": n} for c, n in ch_c.most_common()],
        "knowledge_point_ranking": [
            {"name": n, "chapter": kp_chapter.get(n, ""), "count": c}
            for n, c in kp_c.most_common()
        ],
        "real_exam_year_distribution": [
            {"year": y, "count": year_c[y]} for y in sorted(year_c)
        ],
        "issue_counts": {k: len(v) for k, v in issues.items()},
    }
    dump_json(os.path.join(OUT, "extended.json"), payload)
    # 只含 meta 的小文件：首页/统计页用它，避免把整份扩展题打进首屏 chunk
    dump_json(os.path.join(OUT, "ext_meta.json"), payload["meta"])
    dump_json(os.path.join(OUT, "ext_stats.json"), ext_stats)
    print("扩展题构建完成：共 %d 题（其中真题原题 %d 题），来源 %s" % (
        len(ext), len(tagged), "、".join("%s %d" % (s, c) for s, c in book_counts.most_common())))
    print("扩展题校验：", {k: len(v) for k, v in issues.items()})
    return {"count": len(ext), "issues": issues, "books": payload["meta"]["by_source"]}


def main():
    tree_src = load_json(os.path.join(SRC, "knowledge_tree.json"))

    # 知识点 -> 章节 索引
    kp_chapter = {}
    kp_order = []
    for ch in tree_src["chapters"]:
        for p in ch["points"]:
            kp_chapter[p["name"]] = ch["name"]
            kp_order.append(p["name"])

    year_files = sorted(
        f for f in os.listdir(SRC) if re.fullmatch(r"\d{4}\.json", f)
    )
    if not year_files:
        print("未找到任何年份文件（data/source/<年份>.json）")
        sys.exit(1)

    merged: "OrderedDict[str, dict]" = OrderedDict()
    merge_index: dict[str, str] = {}
    year_meta = []

    for yf in year_files:
        doc = load_json(os.path.join(SRC, yf))
        year = doc["year"]
        year_meta.append({
            "year": year,
            "source": doc["source"],
            "paper_file": doc.get("paper_file", ""),
            "answer_file": doc.get("answer_file", ""),
            "note": doc.get("note", ""),
            "count": len(doc["questions"]),
        })
        for q in doc["questions"]:
            q = dict(q)
            q.setdefault("source_years", [year])
            q.setdefault("source", doc["source"])
            q.setdefault("original_numbers", {})
            q.setdefault("options", [])
            q.setdefault("images", [])
            q.setdefault("answer_images", [])
            q.setdefault("tags", [])
            q.setdefault("knowledge_points", [])
            key = q.get("merge_key")
            if key and key in merge_index:
                base = merged[merge_index[key]]
                for y in q["source_years"]:
                    if y not in base["source_years"]:
                        base["source_years"].append(y)
                base["source_years"].sort()
                base["original_numbers"].update(q["original_numbers"])
                base["source"] = "、".join(
                    "%d年855机械设计基础真题" % y for y in base["source_years"]
                )
                if "跨年份重复" not in base["tags"]:
                    base["tags"].append("跨年份重复")
                # 答案更长的优先保留
                if len(str(q.get("answer", ""))) > len(str(base.get("answer", ""))):
                    base["answer"] = q["answer"]
                    base["explanation"] = q.get("explanation") or base["explanation"]
                # 多版本答案：缺的补上，同键取更长的一份
                if q.get("answer_versions"):
                    bv = base.setdefault("answer_versions", {})
                    for vk, vv in q["answer_versions"].items():
                        if vk not in bv or len(str(vv.get("answer", ""))) > len(
                            str(bv[vk].get("answer", ""))
                        ):
                            bv[vk] = vv
                if not base.get("answer_version_default") and q.get("answer_version_default"):
                    base["answer_version_default"] = q["answer_version_default"]
            else:
                q["source_years"].sort()
                if len(q["source_years"]) > 1:
                    q["source"] = "、".join(
                        "%d年855机械设计基础真题" % y for y in q["source_years"]
                    )
                merged[q["id"]] = q
                if key:
                    merge_index[key] = q["id"]

    questions = list(merged.values())

    # ---------------- 合并 Trae 独有资产（在校验之前追加，确保图片文件存在性被校验） ----------------
    sub_tree, trae_summary = apply_trae_assets(questions, tree_src)

    # ---------------- 校验 ----------------
    issues = {
        "缺题号": [], "缺答案": [], "缺选项": [], "重复题": [],
        "年份不明": [], "知识点未标注": [], "知识点不在考纲": [], "图片文件缺失": [],
        "答案版本异常": [], "整卷答案图缺失": [],
    }
    answer_page_count = check_answer_pages(issues)
    for q in questions:
        if not q["original_numbers"]:
            issues["缺题号"].append(q["id"])
        ans = q.get("answer")
        if ans is None or (isinstance(ans, (list, str)) and len(ans) == 0):
            issues["缺答案"].append(q["id"])
        if q["type"] in CHOICE_TYPES and len(q["options"]) < 2:
            issues["缺选项"].append(q["id"])
        if not q["source_years"]:
            issues["年份不明"].append(q["id"])
        if not q["knowledge_points"]:
            issues["知识点未标注"].append(q["id"])
        for kp in q["knowledge_points"]:
            if kp not in kp_chapter:
                issues["知识点不在考纲"].append({"id": q["id"], "kp": kp})
        for img in list(q["images"]) + list(q["answer_images"]):
            p = os.path.join(ROOT, "public", img.lstrip("/").replace("/", os.sep))
            if not os.path.exists(p):
                issues["图片文件缺失"].append({"id": q["id"], "img": img})
        check_answer_versions(q, issues)

    seen = {}
    for q in questions:
        k = norm_stem(q["stem"])
        seen.setdefault(k, []).append(q["id"])
    for k, ids in seen.items():
        if len(ids) > 1:
            issues["重复题"].append(ids)

    # ---------------- 知识点树（带统计） ----------------
    kp_count = Counter()
    ch_count = Counter()
    kp_questions = {}
    for q in questions:
        for kp in q["knowledge_points"]:
            kp_count[kp] += 1
            kp_questions.setdefault(kp, []).append(q["id"])
        # 章节归属：主章节 + 该题所涉及知识点所属章节（跨章综合题在多个章节各计一次）
        # 与前端 src/lib/quiz.ts 的 inChapter() 判定口径一致
        chs = set()
        if q["chapter"]:
            chs.add(q["chapter"])
        for kp in q["knowledge_points"]:
            ch = kp_chapter.get(kp)
            if ch:
                chs.add(ch)
        for ch in chs:
            ch_count[ch] += 1

    tree = json.loads(json.dumps(tree_src, ensure_ascii=False))
    for ch in tree["chapters"]:
        for p in ch["points"]:
            p["questionCount"] = kp_count.get(p["name"], 0)
            p["questionIds"] = kp_questions.get(p["name"], [])
        ch["questionCount"] = ch_count.get(ch["name"], 0)
    tree["generated_from"] = year_meta
    tree["total_questions"] = len(questions)

    # ---------------- 统计 ----------------
    def count_by(fn):
        c = Counter()
        s = Counter()
        for q in questions:
            k = fn(q)
            if k is None:
                continue
            c[k] += 1
            s[k] += q.get("score", 0) or 0
        return c, s

    type_c, type_s = count_by(lambda q: q["type"])
    diff_c, _ = count_by(lambda q: q.get("difficulty", "未标注"))
    year_c = Counter()
    for q in questions:
        for y in q["source_years"]:
            year_c[y] += 1

    calc = [q for q in questions if q["type"] == "calculation"]
    calc_kp = Counter()
    for q in calc:
        for kp in q["knowledge_points"]:
            calc_kp[kp] += 1

    stats = {
        "generated_at": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "subject": tree_src["subject"],
        "total_questions": len(questions),
        "total_score": sum(q.get("score", 0) or 0 for q in questions),
        "by_year": [
            {"year": y, "count": year_c[y],
             "types": dict(Counter(q["type"] for q in questions if y in q["source_years"]))}
            for y in sorted(year_c)
        ],
        "by_type": [
            {"type": t, "label": TYPE_LABELS.get(t, t), "count": type_c[t], "score": type_s[t]}
            for t in TYPE_LABELS if type_c[t]
        ],
        "by_difficulty": [
            {"difficulty": d, "count": c} for d, c in
            sorted(diff_c.items(), key=lambda x: ["简单", "中等", "较难", "未标注"].index(x[0])
                   if x[0] in ["简单", "中等", "较难", "未标注"] else 99)
        ],
        "by_chapter": [
            {"chapter": ch["name"], "count": ch["questionCount"]}
            for ch in tree["chapters"] if ch["questionCount"] > 0
        ],
        "knowledge_point_ranking": [
            {"name": name, "chapter": kp_chapter.get(name, ""), "count": cnt}
            for name, cnt in kp_count.most_common()
        ],
        "calculation_analysis": {
            "total": len(calc),
            "score": sum(q.get("score", 0) or 0 for q in calc),
            "by_knowledge_point": [
                {"name": name, "chapter": kp_chapter.get(name, ""), "count": cnt}
                for name, cnt in calc_kp.most_common()
            ],
            "by_type_shape": [
                {"shape": "机构自由度计算",
                 "count": sum(1 for q in calc if "平面机构的自由度" in q["knowledge_points"])},
                {"shape": "轮系传动比计算",
                 "count": sum(1 for q in calc if any("轮系" in k for k in q["knowledge_points"]))},
                {"shape": "螺栓组强度计算",
                 "count": sum(1 for q in calc if "螺纹连接的强度计算" in q["knowledge_points"])},
                {"shape": "齿轮几何尺寸计算",
                 "count": sum(1 for q in calc if any("几何尺寸" in k for k in q["knowledge_points"]))},
                {"shape": "平衡（回转件）计算",
                 "count": sum(1 for q in calc if "刚性回转件的平衡（静平衡、动平衡）" in q["knowledge_points"])},
                {"shape": "结构改错（轴系）",
                 "count": sum(1 for q in calc if "结构改错" in q["tags"])},
                {"shape": "传动系统受力分析",
                 "count": sum(1 for q in calc if "受力分析" in q["tags"])},
            ],
        },
        "accuracy_stats": {
            "note": "正确率无法从题库静态计算，由前端根据本地答题记录（localStorage）实时统计。"
        },
        "source_distribution": [
            {"source": "、".join(str(y) for y in q["source_years"]), "year": q["source_years"][0]}
            for q in questions
        ],
    }

    # ---------------- 输出 ----------------
    payload = {
        "meta": {
            "subject": tree_src["subject"],
            "school": tree_src["school"],
            "generated_at": stats["generated_at"],
            "years": year_meta,
            "total_questions": len(questions),
            "type_labels": TYPE_LABELS,
        },
        "questions": questions,
    }
    dump_json(os.path.join(OUT, "questions.json"), payload)
    dump_json(os.path.join(OUT, "knowledge_tree.json"), tree)
    dump_json(os.path.join(OUT, "stats.json"), stats)
    if sub_tree is not None:
        dump_json(os.path.join(OUT, "sub_knowledge_tree.json"), sub_tree)

    ext_result = build_extended(questions, tree_src, kp_chapter)

    dump_json(os.path.join(OUT, "validation.json"), {
        "generated_at": stats["generated_at"],
        "total_questions": len(questions),
        "issue_counts": {k: len(v) for k, v in issues.items()},
        "issues": issues,
        "trae_assets": dict(trae_summary, answer_pages=answer_page_count),
        "extended": None if ext_result is None else {
            "total_questions": ext_result["count"],
            "by_source": ext_result["books"],
            "issue_counts": {k: len(v) for k, v in ext_result["issues"].items()},
            "issues": ext_result["issues"],
        },
    })

    print("题库构建完成：共 %d 题，年度 %s" % (
        len(questions), "、".join(str(m["year"]) for m in year_meta)))
    print("题型分布：", dict(type_c))
    print("Trae 资产：", trae_summary, "整卷答案图", answer_page_count)
    print("校验：", {k: len(v) for k, v in issues.items()})


if __name__ == "__main__":
    main()
