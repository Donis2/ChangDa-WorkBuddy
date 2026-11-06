# -*- coding: utf-8 -*-
"""清理两类渲染隐患：
1) 我在校核时写的 markdown 粗体 **xxx** —— 页面不用 markdown 渲染，会原样露出星号，改为「xxx」
2) 两个行内公式首尾相接形成的 $$（如 $a$$b$）—— 会被 KaTeX 误判为块级公式起始，中间补一个空格
"""
import json, os, re, sys

def fix_dollar(s: str) -> str:
    out = []
    i, n = 0, len(s)
    while i < n:
        if s.startswith('$$', i):
            at_line_start = (i == 0) or (s[i-1] == '\n')
            if at_line_start:
                out.append('$$')
                i += 2
                continue
            # 行内公式相邻 -> 补空格，变成 "$ $"（仍会被当两个 $ 处理，但不会成对）
            out.append('$ ')
            i += 2
            continue
        out.append(s[i])
        i += 1
    return ''.join(out)

def fix_bold(s: str) -> str:
    return re.sub(r'\*\*(.+?)\*\*', r'「\1」', s)

changed = []
for f in sorted(os.listdir('data/source')):
    if not f[0].isdigit():
        continue
    path = 'data/source/' + f
    d = json.load(open(path, encoding='utf-8'))
    touched = False
    for q in d['questions']:
        for key in ('stem', 'answer', 'explanation'):
            v = q.get(key)
            if isinstance(v, list):
                v = ''.join(map(str, v))
            if not isinstance(v, str) or not v:
                continue
            nv = fix_bold(fix_dollar(v))
            if nv != v:
                q[key] = nv
                touched = True
                changed.append((q['id'], key))
    if touched:
        json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print('patched', f)

print('共修改字段数：', len(changed))
for c in changed:
    print('  ', c)
