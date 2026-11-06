# -*- coding: utf-8 -*-
"""扩展题解析：把「题目资料来源」里的非真题资料解析成结构化题目。

产物：_scan/data/ext_raw.json （未去重、未分类的原始记录，供检查）

来源：
  1. 青蛙弟弟选择题题库      244 题（题干 + 4 选项 + 答案 + 解析 + 板块）
  2. 客观题册「补充题库」     191 题（与上者大量重合，取并集）
  3. 简答题汇编·第二部分预测  110 题
  4. 简答题专项训练（一~六）  180 题
  5. 简答题（30题）.docx       30 题（与专项训练一重合）
"""
import json
import os
import re
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
TXT = os.path.join(ROOT, "_scan", "text", "ext")
SRC = os.path.join(ROOT, "题目资料来源", "Trae", "题库来源")


def read_txt(name):
    return open(os.path.join(TXT, name + ".txt"), encoding="utf-8").read()


def split_pages(txt):
    parts = re.split(r"<page (\d+)>", txt)
    return {int(parts[i]): parts[i + 1] for i in range(1, len(parts), 2)}


def clean_lines(text):
    """按行切分并去掉页脚/页眉/页码等噪声。"""
    out = []
    for raw in text.split("\n"):
        s = raw.strip()
        if not s:
            continue
        if s.startswith("<page"):
            continue
        if s.startswith("常州大学 855 机械设计基础"):
            continue
        if re.match(r"^常州大学\s*855.*第\s*\d+\s*页", s):
            continue
        if re.match(r"^第\s*\d+\s*页\s*/\s*共\s*\d+\s*页$", s):
            continue
        out.append(s)
    return out


# ---------------------------------------------------------------- 青蛙弟弟
FROG_SECTION_CHAPTER = {
    "机械设计总论与机械零件设计": "第九章 机械零件设计概论",
    "平面机构与自由度": "第一章 平面机构的自由度和速度分析",
    "凸轮机构": "第三章 凸轮机构",
    "齿轮机构与齿轮传动": "第四章 齿轮机构",
    "蜗杆传动": "第十二章 蜗杆传动",
    "轮系": "第五章 轮系",
    "螺纹联接与螺旋传动": "第十章 连接",
    "键、花键、销联接": "第十章 连接",
    "带传动": "第十三章 带传动和链传动",
    "链传动": "第十三章 带传动和链传动",
    "轴的设计": "第十四章 轴",
    "滚动轴承": "第十六章 滚动轴承",
    "滑动轴承": "第十五章 滑动轴承",
    "联轴器与离合器": "第十七章 联轴器、离合器与制动器",
    "弹簧与其他": "第九章 机械零件设计概论",
}


def parse_frog():
    pages = split_pages(read_txt("frog"))
    # 题目区 p2~p13，答案区 p14~p19
    qtext = "".join(pages[p] for p in sorted(pages) if 2 <= p <= 13)
    atext = "".join(pages[p] for p in sorted(pages) if p >= 14)

    lines = clean_lines(qtext)
    items, cur, section = [], None, ""
    for s in lines:
        m = re.match(r"^([一二三四五六七八九十]+)、(.+)$", s)
        if m and m.group(1) in "一二三四五六七八九十":
            section = m.group(2).strip()
            continue
        m = re.match(r"^(\d{1,3})[.．、]\s*(.+)$", s)
        if m and int(m.group(1)) == len(items) + 1:
            cur = {"no": int(m.group(1)), "section": section, "lines": [m.group(2)]}
            items.append(cur)
            continue
        if cur is not None:
            cur["lines"].append(s)

    for it in items:
        block = "".join(it.pop("lines"))
        parts = re.split(r"(?<![A-Za-z])([ABCD])[.．、]\s*", block)
        it["stem"] = parts[0].strip()
        opts = []
        for i in range(1, len(parts) - 1, 2):
            key, text = parts[i], parts[i + 1].strip()
            # 「C. C、D均可能」这类选项文本自带字母，会被多切一刀，合并回去
            if opts and opts[-1]["key"] == key:
                opts[-1]["text"] = (opts[-1]["text"] + key + "、" + text).strip("、")
                continue
            opts.append({"key": key, "text": text})
        it["options"] = opts

    ans = {}
    for s in clean_lines(atext):
        m = re.match(r"^(\d{1,3})[.．、]\s*([ABCD])\s*(.*)$", s)
        if m:
            ans[int(m.group(1))] = (m.group(2), m.group(3).strip())

    out = []
    for it in items:
        a = ans.get(it["no"])
        if not a:
            continue
        it["answer"] = [a[0]]
        it["explanation"] = a[1]
        it["chapter"] = FROG_SECTION_CHAPTER.get(it["section"], "")
        out.append(it)
    return out


# ---------------------------------------------------------------- 客观题册补充题库
OBJ_CHAPTER = {
    "机械设计总论": "第九章 机械零件设计概论",
    "机构组成与自由度": "第一章 平面机构的自由度和速度分析",
    "凸轮机构": "第三章 凸轮机构",
    "齿轮传动": "第十一章 齿轮传动",
    "轮系": "第五章 轮系",
    "带传动": "第十三章 带传动和链传动",
    "链传动": "第十三章 带传动和链传动",
    "螺纹联接": "第十章 连接",
    "键联接与其他联接": "第十章 连接",
    "轴与轴系结构": "第十四章 轴",
    "滚动轴承": "第十六章 滚动轴承",
    "滑动轴承": "第十五章 滑动轴承",
    "联轴器与离合器": "第十七章 联轴器、离合器与制动器",
    "机械平衡与运转": "第七章 机器的运转速度波动的调节",
}


def parse_obj_supplement():
    objq = json.load(open(os.path.join(ROOT, "_scan", "data", "parsed_objq.json"), encoding="utf-8"))
    obja = json.load(open(os.path.join(ROOT, "_scan", "data", "parsed_obja.json"), encoding="utf-8"))
    out = []
    for q in objq:
        if q.get("source") != "补充题库":
            continue
        letter = obja.get(str(q["no"]))
        opts = []
        for o in q.get("options") or []:
            m = re.match(r"^([ABCD])[.．、]\s*(.+)$", o)
            if m:
                opts.append({"key": m.group(1), "text": m.group(2).strip()})
        out.append({
            "no": q["no"],
            "stem": q["stem"].strip(),
            "options": opts,
            "answer": [letter] if letter else [],
            "explanation": "",
            "chapter": OBJ_CHAPTER.get(q["chapter"], ""),
            "section": q["chapter"],
        })
    return out


# ---------------------------------------------------------------- 简答题汇编
def parse_compil():
    lines = clean_lines(read_txt("jianda_compil"))
    start2 = next(i for i, s in enumerate(lines) if s.startswith("第二部分"))
    start1 = next(i for i, s in enumerate(lines) if s.startswith("第一部分"))

    def parse_block(seg, part):
        items, cur = [], None
        for s in seg:
            m = re.match(r"^(\d{1,3})[.．、]\s*(.+)$", s)
            if m and int(m.group(1)) == len(items) + 1:
                cur = {"no": int(m.group(1)), "lines": [], "answer_lines": [],
                       "in_answer": False, "part": part}
                items.append(cur)
                cur["lines"].append(m.group(2))
                continue
            if cur is None:
                continue
            if s.startswith("【参考答案】"):
                cur["in_answer"] = True
                rest = s[len("【参考答案】"):].strip()
                if rest:
                    cur["answer_lines"].append(rest)
                continue
            if s.startswith("【本质】"):
                cur["answer_lines"].append("本质：" + s[len("【本质】"):].strip())
                continue
            if cur["in_answer"]:
                cur["answer_lines"].append(s)
            else:
                cur["lines"].append(s)
        out = []
        for it in items:
            stem = "".join(it.pop("lines")).strip()
            ans = "\n".join(it["answer_lines"]).strip()
            out.append({
                "no": it["no"], "stem": stem, "answer_text": ans,
                "chapter": "", "part": it["part"], "options": [],
            })
        return out

    return parse_block(lines[start1 + 1:start2], "历年真题"), parse_block(lines[start2 + 1:], "预测")


# ---------------------------------------------------------------- 专项训练
TRAIN_TITLE = {
    "一": "平面机构、四杆机构与凸轮机构",
    "二": "齿轮传动",
    "三": "蜗杆传动、带传动与链传动",
    "四": "滑动轴承与滚动轴承",
    "五": "螺纹连接、键连接与轴",
    "六": "联轴器离合器、平衡、轮系与综合",
}


def parse_training():
    out = []
    for key in ["一", "二", "三", "四", "五", "六"]:
        lines = clean_lines(read_txt("train_" + key))
        items, cur = [], None
        for s in lines:
            m = re.match(r"^(\d{1,3})[.．、]\s*(.+)$", s)
            if m and int(m.group(1)) == len(items) + 1:
                cur = {"no": int(m.group(1)), "stem_lines": [m.group(2)],
                       "answer_lines": [], "in_answer": False}
                items.append(cur)
                continue
            if cur is None:
                continue
            m = re.match(r"^答[：:]\s*(.*)$", s)
            if m:
                cur["in_answer"] = True
                if m.group(1):
                    cur["answer_lines"].append(m.group(1))
                continue
            (cur["answer_lines"] if cur["in_answer"] else cur["stem_lines"]).append(s)
        for it in items:
            out.append({
                "no": it["no"],
                "stem": "".join(it["stem_lines"]).strip(),
                "answer_text": "\n".join(it["answer_lines"]).strip(),
                "options": [],
                "chapter": "",
                "section": TRAIN_TITLE[key],
                "train": key,
            })
    return out


# ---------------------------------------------------------------- 30 题 docx
def parse_docx30():
    p = os.path.join(SRC, "简答题", "简答题（30题）.docx")
    z = zipfile.ZipFile(p)
    xml = z.read("word/document.xml").decode("utf-8")
    xml = re.sub(r"</w:p>", "\n", xml)
    txt = re.sub(r"<[^>]+>", "", xml)
    lines = [s.strip() for s in txt.split("\n") if s.strip()]
    if lines and lines[0] == "简答题":
        lines = lines[1:]

    items, cur, idx = [], None, 0
    for s in lines:
        m = re.match(r"^(\d{1,3})[.．、]\s*(.+)$", s)
        if m:
            cur = {"no": int(m.group(1)), "stem": m.group(2).strip(),
                   "answer_lines": [], "numbered": True}
            items.append(cur)
            idx = int(m.group(1))
            continue
        # 无编号题干：上一题已经有答案了，且本行以问号结尾
        if (cur is None or cur["answer_lines"]) and s.endswith(("？", "?")):
            idx += 1
            cur = {"no": idx, "stem": s, "answer_lines": [], "numbered": False}
            items.append(cur)
            continue
        if cur is not None:
            cur["answer_lines"].append(s)

    out = []
    for it in items:
        out.append({
            "no": it["no"],
            "stem": it["stem"],
            "answer_text": "\n".join(it["answer_lines"]).strip(),
            "options": [],
            "chapter": "",
            "section": "30题文档",
            "numbered": it["numbered"],
        })
    return out


def main():
    data = {
        "frog": parse_frog(),
        "obj": parse_obj_supplement(),
        "compil_real": None,
        "compil_predict": None,
        "training": parse_training(),
        "docx30": parse_docx30(),
    }
    real, predict = parse_compil()
    data["compil_real"] = real
    data["compil_predict"] = predict

    json.dump(data, open(os.path.join(ROOT, "_scan", "data", "ext_raw.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    for k, v in data.items():
        if v is None:
            print(k, "None")
            continue
        bad_opt = sum(1 for q in v if q.get("options") and len(q["options"]) != 4)
        no_ans = sum(1 for q in v
                     if not (q.get("answer") or q.get("answer_text")))
        print("%-14s %4d 题  选项异常 %d  缺答案 %d" % (k, len(v), bad_opt, no_ans))


if __name__ == "__main__":
    main()
