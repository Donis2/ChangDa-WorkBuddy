# _scan —— 扫描件处理与题库生成工具链

把「扫描版 PDF + 两版答案册 + 拓展资料包」变成结构化题库的脚本都放在这里。
**本目录不参与前端构建**，只在更新题库数据时手动运行。

## 目录

| 目录 | 文件 | 作用 |
|---|---|---|
| `core/` | `imgtool.py` | 墨迹行列分析：`ink_mask / row_runs / col_runs / main_figure / trim / crop`。按墨迹定位图块，不靠目测坐标 |
| | `render.py` | PyMuPDF 把 PDF 逐页渲染成 PNG，输出 `cache/render/` |
| | `check_katex.mjs` | 用项目自带 katex 编译题库全部公式，报告解析失败项 |
| `gen/` | `gen_<年份>.py` | 各年份题源生成脚本，产出 `data/source/<年份>.json` |
| `parse/` | `parse_ziliao.py` | 解析「拓展资料包」题库与详解 → `data/parsed_*.json` |
| | `parse_ext.py` | 解析扩展题原文 → `data/ext_raw.json` |
| | `match_ziliao.py` | 资料解析结果与现有题库比对，输出差异报告 |
| `answer/` | `render_answers.py` | 两版答案 PDF → PNG（`cache/ans/<版本>/`），供人工识读 |
| | `merge_answer_versions.py` | `data/ans_json/<版本>-<年>.json` → 合并进 `data/source/*.json` 的 `answer_versions` |
| | `apply_jianda_ziliao.py` | 按（年份, 大题号, 小题号）把《简答详解》写进 `answer_versions.ziliao` |
| `tools/` | `build_ext_src.py` | 扩展题去重 / 归章 / 真题标注 → `data/source/ext/*.json` |
| | `gen_checklist.py` | 由题库生成 `docs/待核实清单.md` |
| `data/` | 中间数据 | 解析结果 JSON + `ans_json/`（人工转录的版本答案，**不可再生**） |
| `text/` | PDF 文本提取 | `raw/`（资料包）、`ext/`（扩展题来源）、`qs/`（各年题目文本） |
| `cache/` | 可再生缓存 | 渲染页、裁图草稿；可随时删除，`.gitignore` 已忽略 |

> 已执行完的 `patch_*.py` 与早期工具 `bands.py` / `crop.py` 已移出项目，
> 归档在 `../_归档_20261107/20261107_清理/scan_archive/`，
> 也可 `git restore --source=787496d -- _scan/archive` 找回。

## 常用命令

```bash
# 题库改了之后（唯一入口，会同时刷新统计与校验）
npm run build:data

# 公式校验：全部通过才可提交
node _scan/core/check_katex.mjs

# 重新生成《待核实清单》
python _scan/tools/gen_checklist.py

# 渲染某年答案页供人工识读 → _scan/cache/ans/laowei/2013_p1.png
python _scan/answer/render_answers.py laowei 2013
python _scan/answer/render_answers.py kaoyanqun 2022 --half
```

## 数据流

```
真题/*.pdf ────────┐
真题答案/*.pdf ────┼─→ render.py / render_answers.py → cache/*.png → 人工识读 → gen/*.py ─┐
资料/拓展资料包 ───┴─→ parse_ziliao.py → data/parsed_*.json ──────────────────────────────┤
题目资料来源/ ───────→ parse_ext.py → data/ext_raw.json → build_ext_src.py → source/ext/*.json ─┤
                                                                                             ├→ build_data → data/*.json → 前端
答案册扫描件 → 人工转录 → data/ans_json/*.json → merge_answer_versions.py ───────────────────┘
```

## 约定

- 所有脚本的 `ROOT` 由 `__file__` 向上两级得到（脚本位于 `_scan/<子目录>/`），
  **从任何目录运行都可以**，不必先 `cd` 到项目根。
- 原始扫描件、参考书、`cache/` 都在 `.gitignore` 中，不入库。
- `data/ans_json/` 是人工逐页转录的成果，**删了不可恢复**，已纳入 git。
- `cache/` 里的渲染页体积大且可再生产，需要时重跑对应脚本即可。
