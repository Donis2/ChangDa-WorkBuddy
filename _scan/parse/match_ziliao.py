# -*- coding: utf-8 -*-
"""把资料解析结果与现有题库比对，输出差异报告。"""
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DATA = os.path.join(ROOT, "_scan", "data")

qs = json.load(open(os.path.join(ROOT, "data", "questions.json"), encoding='utf-8'))
lst = qs if isinstance(qs, list) else qs['questions']
by_id = {q['id']: q for q in lst}

TYPE_MAP = {'选择题': '选择', '填空题': '填空', '判断题': '判断', '简答题': '简答', '论述题': '简答'}


def cur_ans(q):
    a = q['answer']
    if isinstance(a, list):
        return ''.join(map(str, a))
    return str(a)


def norm(s):
    return re.sub(r'[\s　，。、；：（）()￥$\\{}\-_/·．.。]', '', s or '')


jd = json.load(open(os.path.join(DATA, "parsed_jianda.json"), encoding='utf-8'))
oq = json.load(open(os.path.join(DATA, "parsed_objq.json"), encoding='utf-8'))
oa = json.load(open(os.path.join(DATA, "parsed_obja.json"), encoding='utf-8'))

print('=' * 20, '一、简答题匹配')
matched, missing_in_bank, not_in_bank = [], [], []
for it in jd:
    t = TYPE_MAP.get(it['qtype'], '简答')
    qid = f"{it['year']}-{t}-{it['qno']:02d}"
    q = by_id.get(qid)
    if q:
        matched.append((qid, it, q))
    else:
        not_in_bank.append((qid, it))

print(f'资料简答 {len(jd)} 题：匹配上 {len(matched)}，未匹配（库里没有）{len(not_in_bank)}')
from collections import Counter
print('未匹配按年:', dict(sorted(Counter(i[0].split("-")[0] for i in not_in_bank).items())))
for qid, it in not_in_bank:
    print(f'  {qid} | {it["stem"][:44]}')

print()
print('匹配题中，答案差异较大的前 10（按长度比或内容差异）：')
diffs = []
for qid, it, q in matched:
    mine = cur_ans(q)
    theirs = '；'.join(it['points'])
    ratio = len(mine) / max(1, len(theirs))
    same = norm(mine)[:60] == norm(theirs)[:60]
    if not same or not (0.6 < ratio < 1.7):
        diffs.append((qid, len(mine), len(theirs), round(ratio, 2)))
diffs.sort(key=lambda x: abs(x[3] - 1), reverse=True)
for d in diffs[:12]:
    print('  ', d)

print()
print('=' * 20, '二、客观题答案比对')
ans_diff, matched_obj, new_obj = [], 0, []
for it in oq:
    if it['source'] != '真题':
        continue
    t = TYPE_MAP.get(it['kind'], '选择')
    qid = f"{it['year']}-{t}-{it['qno']:02d}"
    q = by_id.get(qid)
    if not q:
        new_obj.append((qid, it))
        continue
    matched_obj += 1
    theirs = oa.get(str(it['no']), '')
    mine = cur_ans(q)
    # 判断题：资料用 √/× 或 正确/错误；题库用 true/false
    if it['kind'] == '判断题':
        mm = {'√': 'true', '正确': 'true', '×': 'false', '错误': 'false'}
        t_norm = mm.get(theirs.strip(), theirs.strip())
        m_norm = 'true' if mine.lower() in ('true', '对', '正确') else 'false'
        if t_norm != m_norm:
            ans_diff.append((qid, mine, theirs, it['stem'][:30]))
    elif it['kind'] == '选择题':
        a = re.sub(r'[^A-D]', '', mine).upper()
        b = re.sub(r'[^A-D]', '', theirs).upper()
        if sorted(a) != sorted(b):
            ans_diff.append((qid, mine, theirs, it['stem'][:30]))

print(f'资料真题客观题 {len([x for x in oq if x["source"]=="真题"])} 条：匹配 {matched_obj}，题库缺失 {len(new_obj)}')
print('缺失按年:', dict(sorted(Counter(i[0].split("-")[0] for i in new_obj).items())))
for qid, it in new_obj[:20]:
    print(f'  {qid} | {it["kind"]} | {it["stem"][:44]}')
print()
print(f'答案不一致 {len(ans_diff)} 处：')
for d in ans_diff:
    print(f'   {d[0]:14s} 现有={d[1]:<6s} 资料={d[2]:<6s} | {d[3]}')
