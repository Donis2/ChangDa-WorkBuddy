# -*- coding: utf-8 -*-
"""修复 5 处因清理脚本误伤而断裂的行内公式（两个相邻公式被拆开后丢了定界符）"""
import json

def patch(path, qid, key, old, new):
    d = json.load(open(path, encoding='utf-8'))
    q = [x for x in d['questions'] if x['id'] == qid][0]
    v = q[key]
    assert old in v, (qid, key, old[:60])
    q[key] = v.replace(old, new)
    json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('fixed', qid, key)

# 1) 2017-计算-02：链条式公式相邻
patch('data/source/2017.json', '2017-计算-02', 'explanation',
      r"3（内齿圈）$\rightarrow$4（内啮合，取 +）$\rightarrow$ 4'$（同轴）$\rightarrow$5（外啮合，取 $-$）",
      r"3（内齿圈）$\rightarrow 4$（内啮合，取 +）$\rightarrow 4'$（同轴）$\rightarrow 5$（外啮合，取 $-$）")

# 2) 2020-计算-04：块级公式起始被拆
patch('data/source/2020.json', '2020-计算-04', 'answer',
      "（2）$ L_{10}=", "（2）$$L_{10}=")

# 3) 2022-计算-04：两个行内公式相邻
patch('data/source/2022.json', '2022-计算-04', 'answer',
      r"\le [\sigma]$ F_0 \le", r"\le [\sigma]$，$F_0 \le")

# 4) 2022-计算-06：两个行内公式相邻
patch('data/source/2022.json', '2022-计算-06', 'answer',
      r"3300\ \mathrm{N}$ F_{a2} = 0$", r"3300\ \mathrm{N}$，$F_{a2} = 0$")

# 5) 2024-计算-07：两个行内公式相邻
patch('data/source/2024.json', '2024-计算-07', 'answer',
      r"14.7\ \mathrm{r/min}$$n_H$", r"14.7\ \mathrm{r/min}$，$n_H$")

print('done')
