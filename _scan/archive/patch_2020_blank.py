# -*- coding: utf-8 -*-
"""2020 填空题：多个空的答案补分隔符（原来几空的答案粘在一起，前端显示成一坨）"""
import json

P = 'data/source/2020.json'
d = json.load(open(P, encoding='utf-8'))
qs = {q['id']: q for q in d['questions']}

fix = {
    '2020-填空-01': '$\\theta \\approx 23.5^{\\circ}$；摇杆；$\\gamma = 0^{\\circ}$',
    '2020-填空-02': '大；0（平底从动件的压力角恒为零）',
    '2020-填空-03': '不变；变大；变小',
    '2020-填空-05': '减小；增大',
    '2020-填空-06': '变小；变小',
    '2020-填空-07': '$q=10$；$a=98\\ \\mathrm{mm}$',
    '2020-填空-08': '弯曲；紧边绕上小带轮处（带刚进入小轮处）',
    '2020-填空-09': '保证边界油膜不被破坏（维持边界摩擦状态）；温升（发热量）',
}
for k, v in fix.items():
    qs[k]['answer'] = v

# 填空 06 补一句说明，避免「强度变小 / 应力变大」混淆
qs['2020-填空-06']['explanation'] = (
    "保持传动比与总齿数不变而减小模数，分度圆直径 $d=mz$ 随之减小：齿根厚度减小，齿根弯曲应力 $\\sigma_F$ 增大、弯曲强度降低；"
    "$\\sigma_H\\propto 1/\\sqrt{d_1^{3}}$ 一类的接触应力也随直径减小而增大、接触强度降低。"
    "故两空都填「变小」（指强度；若问应力则为变大）。"
)

json.dump(d, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('2020 填空分隔符已修：', len(fix), '题')
for k in fix:
    print(' ', k, '->', qs[k]['answer'])
