# -*- coding: utf-8 -*-
"""解析「拓展资料包」中的简答题详解与客观题题目/答案册，输出结构化 JSON。"""
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DATA = os.path.join(ROOT, "_scan", "data")

BASE = os.path.join(ROOT, "_scan", "text", "raw") + os.sep

HEADERS = ('常州大学 855 机械设计基础', '简答题 ∙ 按章节知识排序', '客观题 ∙ 按章节专题排序')


def clean_lines(txt):
    out = []
    for ln in txt.split('\n'):
        s = ln.strip().replace('\xa0', ' ')
        if not s:
            continue
        if re.match(r'^<page \d+>$', s):
            out.append(('PAGE', s))
            continue
        if s in HEADERS or re.match(r'^第 \d+ 页 / 共 \d+ 页$', s):
            continue
        out.append(('T', s))
    return [s for k, s in out if k == 'T']


def is_chapter(s):
    return bool(re.match(r'^[A-O]\s{1,3}\S', s)) and '∙' not in s


def is_section(s):
    return bool(re.match(r'^[一二三四五六七八九十]、', s))


SRC_RE = re.compile(r'^(真题|补充题库)\s*∙')


def split_src(line):
    """拆来源行：真题 ∙ 2012 年 ∙ 一、选择题 第 7 题 ∙ A1 机器、机构与零件"""
    parts = [p.strip() for p in line.split('∙')]
    src = parts[0]
    year = None
    qno = 0
    qtype = ''
    sec = ''
    kp = ''
    for p in parts[1:]:
        m = re.match(r'^(\d{4})\s*年$', p)
        if m:
            year = int(m.group(1))
            continue
        m = re.search(r'([一二三四五六七八九十]+)、(\S+?)\s*第\s*(\d+)\s*题', p)
        if m:
            sec, qtype, qno = m.group(1), m.group(2), int(m.group(3))
            continue
        m = re.match(r'^([A-O]\d+)\s+(.+)$', p)
        if m:
            kp = p
            continue
    return src, year, sec, qtype, qno, kp


# ---------- 简答题详解 ----------
def parse_jianDa():
    lines = clean_lines(open(BASE + 'jianDa.txt', encoding='utf-8').read())
    items, i, n, chapter = [], 0, len(lines), ''
    while i < n:
        s = lines[i]
        if is_chapter(s):
            chapter = re.sub(r'^\S+\s+', '', s)
            i += 1
            continue
        if re.match(r'^\d+\.$', s) and i + 1 < n and SRC_RE.match(lines[i + 1]):
            num = int(s[:-1])
            src, year, sec, qtype, qno, kp = split_src(lines[i + 1])
            i += 2
            if i < n and lines[i].startswith('∙'):
                kp = re.sub(r'^∙\s*', '', lines[i])
                i += 1
            stem = []
            while i < n and lines[i] != '参考答案':
                stem.append(lines[i]); i += 1
            i += 1
            body = []
            while i < n:
                t = lines[i]
                if re.match(r'^\d+\.$', t) and i + 1 < n and SRC_RE.match(lines[i + 1]):
                    break
                if is_chapter(t):
                    break
                body.append(t); i += 1
            points = []
            for t in body:
                if t.startswith('•'):
                    points.append(t.lstrip('• ').strip())
                elif points:
                    points[-1] += t
                else:
                    points.append(t)
            items.append({
                'no': num, 'chapter': chapter, 'kp': kp, 'source': src,
                'year': year, 'section': sec, 'qtype': qtype, 'qno': qno,
                'stem': ''.join(stem), 'points': points,
            })
            continue
        i += 1
    return items


# ---------- 客观题题目册 ----------
def parse_objQ():
    raw = clean_lines(open(BASE + 'objQ.txt', encoding='utf-8').read())
    # 合并「N.」单独成行 + 下一行是来源 的情况
    lines = []
    i = 0
    while i < len(raw):
        s = raw[i]
        if re.match(r'^\d+\.$', s) and i + 1 < len(raw) and SRC_RE.match(raw[i + 1]):
            lines.append(s + ' ' + raw[i + 1]); i += 2
        else:
            lines.append(s); i += 1

    items, kind, chapter = [], '选择题', ''
    for s in lines:
        if is_section(s) and ('选择' in s or '填空' in s or '判断' in s):
            if '选择' in s: kind = '选择题'
            elif '填空' in s: kind = '填空题'
            else: kind = '判断题'
            continue
        if is_chapter(s):
            chapter = re.sub(r'^\S+\s+', '', s)
            continue
        m = re.match(r'^(\d+)\.\s+(.*)$', s)
        if not m or not SRC_RE.match(m.group(2)):
            continue
        num = int(m.group(1))
        src, year, sec, qtype, qno, kp = split_src(m.group(2))
        items.append({
            'no': num, 'kind': kind, 'chapter': chapter, 'kp': kp,
            'source': src, 'year': year, 'section': sec, 'qtype': qtype, 'qno': qno,
            'stem': '', 'options': [],
        })
    # 第二遍：填充题干与选项（每个 block 从题号行到下一题号行）
    by_no = {it['no']: it for it in items}
    idx = []
    for k, s in enumerate(lines):
        m = re.match(r'^(\d+)\.\s+(真题|补充题库)', s)
        if m:
            idx.append((k, int(m.group(1))))
    for j, (start, num) in enumerate(idx):
        end = idx[j + 1][0] if j + 1 < len(idx) else len(lines)
        if num not in by_no:
            continue
        body = []
        for s in lines[start + 1:end]:
            if is_section(s) or is_chapter(s):
                break
            body.append(s)
        stem_lines, options = [], []
        for t in body:
            if re.match(r'^[A-D][\.．、]', t):
                options.append(t)
            elif options:
                options[-1] += t
            else:
                stem_lines.append(t)
        by_no[num]['stem'] = ''.join(stem_lines)
        by_no[num]['options'] = options
    return items


# ---------- 客观题答案册 ----------
def parse_objA():
    raw = clean_lines(open(BASE + 'objA.txt', encoding='utf-8').read())
    # 定位「一、选择题答案」之后；到「二、」/“逐题详解”章节结束
    start = 0
    for k, s in enumerate(raw):
        if s.startswith('一、选择') and '答案' in s:
            start = k + 1
            break
    ans = {}
    cur = None
    section = None          # 'choice' / 'fill' / 'judge'
    ans_re = re.compile(r'^([A-D](?:、[A-D])*|√|×|正确|错误)\s*(\d+)?$')
    pair_re = re.compile(r'^(\d+)\s+([A-D](?:、[A-D])*)$')
    for s in raw[start:]:
        if re.match(r'^二、填空', s):
            section, cur = 'fill', None
            continue
        if re.match(r'^三、判断', s):
            section, cur = 'judge', None
            continue
        if re.match(r'^二、|^三、', s):
            break
        if '逐题详解' in s and len(s) < 20:
            break
        if section in ('fill', 'judge'):
            if re.fullmatch(r'\d+', s):
                cur = int(s)
                ans.setdefault(cur, '')
                continue
            if cur is not None:
                ans[cur] = (ans[cur] + s) if ans[cur] else s
            continue
        if re.fullmatch(r'\d+', s):
            cur = int(s)
            ans.setdefault(cur, '')
            continue
        m = pair_re.match(s)
        if m:
            ans[int(m.group(1))] = m.group(2)
            cur = int(m.group(1))
            continue
        m = ans_re.match(s)
        if m:
            if cur is not None:
                ans[cur] = m.group(1)
            if m.group(2):
                cur = int(m.group(2))
                ans.setdefault(cur, '')
            continue
    return {k: v for k, v in ans.items() if v}


if __name__ == '__main__':
    jd = parse_jianDa()
    oq = parse_objQ()
    oa = parse_objA()
    json.dump(jd, open(os.path.join(DATA, "parsed_jianda.json"), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(oq, open(os.path.join(DATA, "parsed_objq.json"), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(oa, open(os.path.join(DATA, "parsed_obja.json"), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('简答:', len(jd), '客观题:', len(oq), '答案速查:', len(oa))
    print('简答年份:', sorted({x['year'] for x in jd if x['year']}))
    print('客观题年份:', sorted({x['year'] for x in oq if x['year']}))
    print('真题客观题数:', len([x for x in oq if x['source'] == '真题']))
    from collections import Counter
    print('真题客观题按年:', dict(sorted(Counter(x['year'] for x in oq if x['source'] == '真题' and x['year']).items())))
    print('无答案题号:', [k for k in range(1, 370) if k not in oa][:20])
