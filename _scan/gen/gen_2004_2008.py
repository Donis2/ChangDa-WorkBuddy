# -*- coding: utf-8 -*-
"""从「拓展资料包」解析结果生成 2004/2006/2007/2008 年份题源，
并按资料答案增强现有简答题。"""
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DATA = os.path.join(ROOT, "_scan", "data")

jd = json.load(open(os.path.join(DATA, "parsed_jianda.json"), encoding='utf-8'))
oq = json.load(open(os.path.join(DATA, "parsed_objq.json"), encoding='utf-8'))
oa = json.load(open(os.path.join(DATA, "parsed_obja.json"), encoding='utf-8'))

qs = json.load(open(os.path.join(ROOT, "data", "questions.json"), encoding='utf-8'))
lst = qs if isinstance(qs, list) else qs['questions']
by_id = {q['id']: q for q in lst}

# ---------- 资料 kp -> (chapter, knowledge_points) ----------
KP_MAP = {
    'A1': ('绪论', ['本课程的研究对象（机械、机器、机构）']),
    'A2': ('第九章 机械零件设计概论', ['机械设计的基本要求及设计顺序', '机械零件的强度、接触强度、耐磨性']),
    'B1': ('第一章 平面机构的自由度和速度分析', ['平面运动副及其分类']),
    'B4': ('第一章 平面机构的自由度和速度分析', ['平面机构的自由度']),
    'C2': ('第二章 平面连杆机构', ['平面四杆机构的基本特性']),
    'C3': ('第二章 平面连杆机构', ['平面四杆机构的基本特性']),
    'D2': ('第三章 凸轮机构', ['从动件常用运动规律']),
    'E1': ('第四章 齿轮机构', ['渐开线标准直齿圆柱齿轮的基本参数和几何尺寸']),
    'E2': ('第四章 齿轮机构', ['渐开线标准圆柱齿轮传动的啮合']),
    'E3': ('第四章 齿轮机构', ['渐开线标准圆柱齿轮传动的啮合']),
    'E5': ('第四章 齿轮机构', ['平行轴斜齿轮机构']),
    'E8': ('第十一章 齿轮传动', ['齿轮传动的主要失效形式和设计计算准则']),
    'E9': ('第十一章 齿轮传动', ['齿根弯曲和齿面接触疲劳强度计算']),
    'E11': ('第四章 齿轮机构', ['渐开线标准直齿圆柱齿轮的基本参数和几何尺寸']),
    'G2': ('第十三章 带传动和链传动', ['带传动的受力分析']),
    'G3': ('第十三章 带传动和链传动', ['带传动弹性滑动、传动比和打滑现象']),
    'G4': ('第十三章 带传动和链传动', ['带的应力分析']),
    'H2': ('第十三章 带传动和链传动', ['链传动的特点与应用']),
    'I2': ('第十章 连接', ['螺纹连接的基本类型及紧固件']),
    'I4': ('第十章 连接', ['螺纹连接的强度计算']),
    'I6': ('第十章 连接', ['提高螺栓连接强度的措施']),
    'J2': ('第十章 连接', ['键连接和花键连接']),
    'K1': ('第十四章 轴', ['轴的类型与应用']),
    'K2': ('第十四章 轴', ['轴的强度计算']),
    'L1': ('第十六章 滚动轴承', ['滚动轴承的代号']),
    'L2': ('第十六章 滚动轴承', ['滚动轴承的选择计算']),
    'M2': ('第十五章 滑动轴承', ['动压润滑的基本原理']),
}


def kp_split(kp):
    code = kp.split(' ')[0] if kp else ''
    return KP_MAP.get(code, ('第九章 机械零件设计概论', ['机械设计的基本要求及设计顺序']))


def clean_text(s):
    s = re.sub(r'^多选题\s*', '', s or '')
    s = re.sub(r'原卷图$', '', s.strip())
    return s.strip()


def make_question(qid, qtype, stem, answer, explanation, kp, extra_tags, orig):
    ch, kps = kp_split(kp)
    q = {
        'id': qid,
        'type': qtype,
        'difficulty': '中等',
        'stem': stem,
        'answer': answer,
        'explanation': explanation,
        'knowledge_points': kps,
        'chapter': ch,
        'original_numbers': orig,
        'images': [],
        'answer_images': [],
        'tags': ['答案按拓展资料整理'] + extra_tags,
    }
    if qtype in ('single_choice', 'multiple_choice'):
        q['options'] = []
    if qtype == 'true_false':
        q['options'] = [{'key': 'A', 'text': '正确'}, {'key': 'B', 'text': '错误'}]
    return q


def norm_stem(s):
    return re.sub(r'[\s　，。、；：（）()？?：:；;．.,“”"\'（）]', '', s or '')


existing_stems = {}
for q in lst:
    existing_stems.setdefault(norm_stem(q['stem']), q)


def merge_key_for(stem):
    q = existing_stems.get(norm_stem(stem))
    if q and q.get('merge_key'):
        return q['merge_key']
    return None


# ---------- 生成 2004/2006/2007/2008 ----------
NOTES = {
    2004: '仅收录简答/论述题部分（7 题）。卷面客观题与计算题未获资料，暂缺。'
          '题目与答案来自《拓展资料包·简答题详解》（2026-11-04 整理版），答案为分点作答的教材表述。',
    2006: '仅收录简答题部分（12 题）。卷面客观题与计算题未获资料，暂缺。'
          '题目与答案来自《拓展资料包·简答题详解》（2026-11-04 整理版）。',
    2007: '仅收录简答题部分（5 题）。卷面客观题与计算题未获资料，暂缺。'
          '题目与答案来自《拓展资料包·简答题详解》（2026-11-04 整理版）。',
    2008: '仅收录简答题 1 题、选择题 10 题、判断题 5 题（16 题）。卷面计算题未获资料，暂缺。'
          '题目与答案来自《拓展资料包·简答题详解》与《客观题题目册/答案册》（2026-11-04 整理版）。',
}

gen = {}
for it in jd:
    if it['year'] not in NOTES:
        continue
    y = it['year']
    qid = f"{y}-简答-{it['qno']:02d}"
    answer = '\n'.join(it['points'])
    exp = '考点：' + (it['kp'] or '——') + '。' + '本答案按《拓展资料包·简答题详解》分点整理。'
    mk = merge_key_for(it['stem'])
    q = make_question(qid, 'short_answer', it['stem'], answer, exp, it['kp'], [], {str(y): f"{it['section']}、{it['qtype']} 第{it['qno']}题"})
    if mk:
        q['merge_key'] = mk
    gen.setdefault(y, []).append(q)

for it in oq:
    if it['source'] != '真题' or it['year'] != 2008:
        continue
    y = 2008
    ans = oa.get(str(it['no']), '')
    if it['kind'] == '选择题':
        letters = re.findall(r'[A-D]', ans)
        multi = it['stem'].startswith('多选题') or len(letters) > 1
        qtype = 'multiple_choice' if multi else 'single_choice'
        qid = f"{y}-{'多选' if multi else '选择'}-{it['qno']:02d}"
        stem = clean_text(it['stem'])
        options = []
        for o in it['options']:
            m = re.match(r'^([A-D])[\.．、]\s*(.*)$', o)
            if m:
                options.append({'key': m.group(1), 'text': clean_text(m.group(2))})
        answer = letters if multi else [letters[0]]
        exp = '考点：' + (it['kp'] or '——') + '。'
        q = make_question(qid, qtype, stem, answer, exp, it['kp'], [], {str(y): f"一、选择题 第{it['qno']}题"})
        q['options'] = options
    else:  # 判断题
        qid = f"{y}-判断-{it['qno']:02d}"
        truth = ans.strip() in ('√', '对', '正确')
        exp = '考点：' + (it['kp'] or '——') + '。'
        q = make_question(qid, 'true_false', clean_text(it['stem']), [truth], exp, it['kp'], [], {str(y): f"判断题 第{it['qno']}题"})
    gen.setdefault(y, []).append(q)

for y, questions in gen.items():
    questions.sort(key=lambda q: q['id'])
    out = {
        'year': y,
        'source': '拓展资料包（2026-11-04 整理版）',
        'paper_file': f'真题/常大{y}年真题.pdf',
        'answer_file': '资料/拓展资料包',
        'note': NOTES[y],
        'questions': questions,
    }
    json.dump(out, open(f'data/source/{y}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'data/source/{y}.json -> {len(questions)} 题')

# ---------- 增强现有简答题 ----------
TYPE_MAP = {'简答题': '简答', '论述题': '简答'}
updated = []
for it in jd:
    if it['year'] in NOTES:
        continue
    t = TYPE_MAP.get(it['qtype'], '简答')
    qid = f"{it['year']}-{t}-{it['qno']:02d}"
    q = by_id.get(qid)
    if not q:
        continue
    mine = q['answer'] if isinstance(q['answer'], str) else ''.join(map(str, q['answer']))
    theirs = '\n'.join(it['points'])
    if len(theirs) > len(mine) * 1.2:
        q['answer'] = theirs
        if '答案按拓展资料更新' not in q['tags']:
            q['tags'].append('答案按拓展资料更新')
        updated.append((qid, len(mine), len(theirs)))

print()
print(f'答案增强（资料分点更完整，已替换）{len(updated)} 题:')
for u in updated:
    print(f'   {u[0]:14s} {u[1]} → {u[2]} 字')
