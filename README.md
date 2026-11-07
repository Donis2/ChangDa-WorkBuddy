# 常大 855 机械设计基础 · 考研真题刷题平台（MVP）

参考「研可岸」刷题体验实现的真题刷题网站：选择题/判断题点击选项即时判分，填空/简答/计算题点击「显示答案」查看答案与解析，自动记录错题，并支持按年份、题型、知识点、错题、收藏筛选与统计。

> **项目状态（2026-11-07 合并）**：本目录是两项目合并后的**唯一活跃站点**。原 Trae 版本地归档已删除（合并时曾短暂归档以核对），历史见远端 `https://github.com/Donis2/ChangDa-Trae.git`；其独有资产（整卷双版本答案扫描图、64 个细分知识点、4 册导出 PDF、原卷插图）已迁入本站。两仓库 HEAD / remote 与迁移清单见工作区根 `归档说明.md`；逐项数字核对见 [`合并差异核对报告.md`](./docs/合并差异核对报告.md)。合并详情见本文第九节。

- 院校 / 科目：常州大学 **855 机械设计基础**（机械工程）
- 当前题库：**2004 ~ 2026 年共 21 个年份（2016 年无真题），合计 371 题**（跨年重复题已合并；题型：单选 99 / 多选 1 / 填空 57 / 判断 15 / 简答 84 / 计算 115）。有真题 PDF 的年份卷面题目已全部录入（2023/2025/2026 为官方回忆版，卷面本身缺题）
- 各年题数与录入完备性、题目/答案来源文件、答案质量标记、待补清单，**统一见 [`题目来源与统计说明.md`](./docs/题目来源与统计说明.md)**
- **扩展题库：585 题**（非真题资料提取，独立板块，不混入真题统计口径）。其中 115 道标注了真题出处（`real_exam_refs`，多年考过会列出全部年份与卷面题号）
- **答案多版本：** 支持「老魏版 / 考研群版 / 资料版」切换查看。已入库 557 条版本答案（老魏 278 / 考研群 268 / 资料版 77），两版冲突原样保留、未做取舍，差异与缺口见 [`答案版本覆盖与差异报告.md`](./docs/答案版本覆盖与差异报告.md)
- 待人工核对的点（答案存疑 / 缺答案）列在 `docs/待核实清单.md`
- 数据来源：`真题/`、`真题答案/` 下的扫描版 PDF（逐页图像识别转录）+ `资料/常州大学考试大纲.docx` + 两版答案册扫描件
- 参考书目（本地 `资料/`，仅人工查阅用，均为无文本层扫描件）：杨可桢《机械设计基础》、濮良贵《机械设计》、郑文纬《机械原理》
- **需要人肉核对的点**（答案存疑 / 缺答案）统一列在 `docs/待核实清单.md`，核对后告诉我即可改 `data/source/*.json`

---

## 一、快速开始（本地运行）

### 方式 1：一键启动（推荐，Windows）

双击项目根目录下的 **`一键启动.bat`**，它会自动完成：检查/安装前端依赖 → 校验并构建题库数据 → 启动服务并打开浏览器。
（若服务已在运行，它会直接打开页面，不会重复启动。）

### 方式 2：命令行

环境要求：Node.js ≥ 18，npm。

```bash
# 1. 安装依赖
npm install
# 国内网络慢可加镜像：npm install --registry=https://registry.npmmirror.com

# 2. 启动开发服务器（默认 http://localhost:5173，会自动打开浏览器）
npm run dev

# 3. 生产构建 + 本地预览
npm run build
npm run preview
```

浏览器访问 `http://localhost:5173` 即可开始刷题。

> Windows 下若 `python` 命令不可用，可用完整解释器路径执行数据构建脚本。

---

## 二、目录结构

```
ChangDa-WorkBuddy/
├─ data/                        # 站点数据（JSON）
│  ├─ questions.json            # 合并后的真题库（前端直接引用）
│  ├─ extended.json             # 扩展题库（585 题，独立文件，按需加载）
│  ├─ ext_meta.json ext_stats.json  # 扩展题元信息与统计（进首屏，轻量）
│  ├─ knowledge_tree.json       # 知识点树（含各知识点/章节题量）
│  ├─ sub_knowledge_tree.json   # 【合并新增】Trae 版 64 细分知识点 / A–O 15 章（第二套知识点视图）
│  ├─ stats.json                # 题库统计（题型/知识点/年份/计算题考点/分值）
│  ├─ validation.json           # 校验报告（机器可读，含 trae_assets 段与「整卷答案图缺失」校验项）
│  └─ source/                   # 【原始数据】唯一手工维护入口
│     ├─ 2022.json ...          # 每年一份真题（2004~2026 共 21 份）
│     ├─ ext/                   # 扩展题源（按来源书分文件）
│     ├─ knowledge_tree.json    # 考纲知识点树（人工维护）
│     ├─ sub_knowledge.json     # 【合并新增】64 细分知识点 + A–O 15 章定义
│     ├─ trae_map.json          # 【合并新增】371 题 ↔ Trae 386 卷面题次的确定性映射
│     └─ trae_figures.json      # 【合并新增】109 题挂载 121 张题图 + 5 张答案图
├─ scripts/
│  ├─ build_data.py             # 合并 + 校验 + 生成统计（数据构建唯一入口）
│  └─ build_answer_pages.py     # 【合并新增·可选】手动重建 120 张答案 webp + manifest（不进一键启动/Netlify）
├─ public/
│  ├─ favicon.svg
│  ├─ answers/                  # 【合并新增】整卷扫描答案 120 张 webp（laowei/kaoyanqun）+ manifest.json
│  ├─ pdfs/                     # 【合并新增】4 册导出 PDF
│  └─ images/questions/         # 题目/答案图形（122 张原有 + 126 张 Trae 迁入，共 248 张，另含 trae_figs.json 清单）
├─ src/
│  ├─ components/               # 组件（ui/ 为 shadcn/ui 风格基础组件）
│  ├─ lib/                      # 数据加载、本地存储、判分与筛选逻辑
│  │  ├─ data.ts                # 轻量元数据（知识点树 / 统计，进首屏）
│  │  ├─ questionData.ts        # 完整真题库（只在刷题页 / 统计页加载）
│  │  └─ extData.ts             # 扩展题库（切到扩展题库时动态 import）
│  ├─ pages/                    # 首页 / 刷题页 / 知识点页 / 统计页 / 整卷答案页
│  ├─ App.tsx  main.tsx  index.css
├─ docs/                        # 项目文档
│  ├─ 需求.md                    # 最初的产品需求
│  ├─ 题目来源与统计说明.md      # 每道题从哪来、缺什么（统计口径以此为准）
│  ├─ 待核实清单.md              # 答案存疑 / 待补清单（由脚本生成，人工核对用）
│  ├─ 实现计划-扩展题与双版本答案.md  # 实施记录（已完成）
│  └─ 答案版本覆盖与差异报告.md  # 双版本答案的覆盖、冲突与缺口
├─ 真题/  真题答案/  资料/        # 原始 PDF（扫描件）与参考书、考纲（.gitignore 已忽略，不入库）
│  └─ 资料/常州大学考试大纲.docx   # 考纲（知识点树的唯一来源）
├─ 题目资料来源/                 # 两项目资料汇总（471MB，.gitignore 已忽略）
├─ _scan/                       # 扫描件处理与题库生成工具链（详见 _scan/README.md）
│  ├─ core/                     # 通用工具（imgtool 墨迹定位 / render 页面渲染 / check_katex 公式校验）
│  ├─ gen/                      # 各年份题源生成脚本（gen_2004_2008.py … gen_2026.py）
│  ├─ parse/                    # 资料解析（parse_ziliao / parse_ext / match_ziliao）
│  ├─ answer/                   # 答案版本处理（渲染 / 人工转录合并 / 简答详解连接）
│  ├─ tools/                    # 汇总工具（build_ext_src 扩展题入库 / gen_checklist 清单生成）
│  ├─ data/                     # 中间数据（解析结果 JSON、ans_json 人工转录答案）
│  ├─ text/                     # PDF 文本提取结果（raw / ext / qs）
│  └─ cache/                    # 可再生缓存（渲染页、裁图草稿，.gitignore 忽略）
├─ 一键启动.bat                  # Windows 一键启动（安装依赖+构建数据+启动服务）
├─ 一键推送.bat                  # Windows 一键提交并推送到 GitHub
└─ README.md
```

> 过时的历史文档、已执行完的一次性脚本、构建产物与渲染缓存已移出项目；原 Trae 版本地归档已删除（合并时曾短暂归档以核对），历史见远端 `https://github.com/Donis2/ChangDa-Trae.git`。
> 两仓库 HEAD / remote 记录与迁移清单见工作区根 `归档说明.md`。

**数据加载约定（改前端时别破坏）**：首屏只加载 `data.ts`（知识点树 + 统计，约 90KB，首屏 chunk 233KB / gzip 76KB）。
`questions.json`（888KB）经 `questionData.ts` 进入刷题页 / 统计页的 lazy chunk，
`extended.json`（777KB）只在用户切到「扩展题 / 全部」或打开统计页时动态加载。
**不要把这两份 JSON 静态 import 回首页或 `data.ts`**，否则首屏会退回 629KB。

合并后新增的两处数据同样遵守首屏约束（首屏 chunk 目标仍为 233KB / gzip 76KB）：
- `data/sub_knowledge_tree.json`（27KB）只允许被 `src/lib/subKnowledgeData.ts` 静态 import，且该文件只被 lazy chunk（刷题页 / 统计页 / `FilterSidebar`）引用，不得从首页或 `data.ts` 引入；
- `public/answers/manifest.json` 走运行时 `fetch`（`src/lib/answerData.ts`），不进首屏 chunk；整卷答案扫描图与 `public/pdfs/` 的 PDF 均为静态文件按需请求。

**Netlify 部署提醒**：`public/answers/`、`public/pdfs/`、`data/*.json` 必须是已落地文件随仓库提交；部署环境无 Python、不重建数据，站点直接读静态文件。`netlify.toml` 无需改动（SPA 回退只对不存在的路径生效，已存在的静态文件正常返回）。

---

## 三、功能清单

**首页**
- 题库总览（题量、年份、考纲信息）、我的进度（已作答 / 正确率 / 错题 / 收藏）
- 年份入口、题型入口、知识点入口（对照考纲章节），点击即带筛选条件进入刷题页；**点章节标题**进入该章全部题目
- **【合并新增】整卷扫描答案入口**：跳转 `/answers`「历年整卷答案（扫描版）」，按版本 / 年份切换 + 灯箱查看
- **【合并新增】4 册导出 PDF 下载**：`public/pdfs/`（客观题题目册 / 客观题答案册 / 简答题记忆版 / 简答题详解）
- **【合并新增】第二套知识点入口**：Trae 版 64 个细分知识点（A–O 共 15 章），示例链接 `?subkp=G3`

**刷题页**
- 左侧：年份、题型、知识点（按考纲章节分组、可搜索）、错题本、收藏筛选
- **章节 / 知识点两级筛选**：点**章节名** = 直接看本章全部题目（同时自动展开知识点）；再点下面的**知识点** = 收窄到该知识点；章节名右侧箭头只负责展开 / 收起知识点，不改变筛选。已选章节 / 知识点以可点掉的标签显示在顶部
- **单选 / 多选切换（知识点卡片右上角「筛选」勾选框）**：
  - 默认**不勾选 = 单选**：点知识点 1 只看 1 的题，再点知识点 2 只看 2 的题（新的替换旧的）；再点已选中的那一个 = 取消，退回**本章全部**；章节名同理（再点一次回到全部题目）
  - **勾选「筛选」= 多选叠加**：点知识点 1 再点知识点 2，两处题目一起显示（章节、知识点各自累加，题目取并集）
  - 该开关与「单题 / 全显示」一样会被记住（刷新、「清空筛选」都不会把它重置）
- 中间：题目卡片 + 题图 + 选项 + `显示答案` + 上一题 / 下一题
- 右侧：答题卡（题号网格 + 状态色）、进度、正确率、按题型正确率、全库统计
- 顶部：当前模式、题号、顺序练习 / 随机练习 / 错题重做 / 我的收藏 / 按题型快捷切换
- **两种显示方式**：`单题模式`（一次一题，上一题 / 下一题翻页）与 `全显示`（当前筛选条件下的题目全部纵向展开，每题带「第 N 题」序号，可一键`显示全部答案 / 隐藏全部答案`，适合打印式过题）
- **单选题 / 判断题**：点击选项立即判分，标出正确项与错误项，展开答案与解析，自动记录对错
- **多选题**：选完点「提交答案」判分
- **填空 / 简答 / 计算题**：默认只显示题目，点「显示答案」后展开答案、解析/考点、知识点标签、年份来源；并可用「我答对了 / 我答错了」自评
- **题库切换：真题 / 扩展题 / 全部**（刷题页顶部）——扩展题是独立题库，带「真题原题 · 2012 一、选择题第7题」徽标，多年考过会列出全部年份
- **答案多版本切换**：答案区顶部的「老魏版 / 考研群版 / 资料版」标签，只显示有内容的版本；切换不记忆（每次进题默认版）
- **【合并新增】查看整卷扫描答案**：题目卡新增「查看整卷扫描答案」跳转，带 `?year=<年份>` 进入 `/answers`；答案页用 `useSearchParams` 读取 `year` 参数并优先选中该年份
- **【合并新增】第二套知识点筛选**：左侧筛选与统计页同时接入 Trae 版 64 个细分知识点（A–O 共 15 章），与考纲章节并存、不替代；支持 URL 参数 `?subkp=G3` 直达
- **【合并新增】题图并存**：`public/images/questions/` 从 122 张增至 248 张（迁入 Trae 独有 126 张，零覆盖），清单 `public/images/questions/trae_figs.json`；Trae 卷面号图与 Workbuddy 题型 id 图为两套独立裁切，按「两者并存、不取舍」全量挂载
- **错题本**：答错自动收录；可按年份/题型/知识点组合筛选重做；每题可手动「加入 / 移除错题本」
- 刷题进度、筛选条件、显示方式（单题 / 全显示）、答题记录全部写入 `localStorage`，刷新不丢

**知识点页（`/knowledge`）**
- 两套知识点体系逐点统计：**考纲知识点**（17 章 / 88 点，教材章节口径）与**细分知识点**（15 章 / 64 点，Trae 逐题标注口径），顶部 tab 切换
- 页首统计卡：每套体系的章 / 点数、我的覆盖（已练过的点数 / 总数）、总体正确率（按去重后的真题 id 汇总）
- 每个知识点显示：知识点码（细分体系）、名称、命中的真题数、我的作答次数与正确率进度条（**未练习**标灰）；点名称或「刷题」按钮带 `?kp=<名称>` / `?subkp=<码>` 直达刷题页
- 工具条：搜索（知识点名 / 章名 / 知识点码）、三种排序（按章序 / 按命中题数 / 按正确率低→高）、「只看待加强」过滤（待加强 = 有真题可练且没练过或正确率 < 60%，无真题的点不计入）
- 顶部「需要加强的知识点」速览（最多 6 个，按命中题数降序），下方按章节分组展开全部明细
- **零额外数据加载**：直接用两套知识点树自带的 `questionIds` 与本机 `localStorage` 作答记录计算正确率，不加载 `questions.json`、不引图表库；页面为独立 lazy chunk（8.7KB / gzip 3.4KB），首屏 chunk 不变

**统计页**
- 题型数量（饼图 + 柱状图）、年份分布、知识点频次排行 TOP15
- 计算题专项：考点频次 + 按解题套路归类（机构自由度 / 轮系传动比 / 螺栓组强度 / 齿轮几何 / 平衡 / 结构改错 / 传动受力分析）
- 正确率统计：总体正确率、按题型正确率、薄弱知识点（正确率最低 10 项）
- 章节题量分布（对照考纲；跨章综合题会在其涉及的每个章节各计一次，故各章之和大于总题数）
- 扩展题库单独一块（题量、来源书分布），**不与真题合并统计口径**

---

## 四、如何添加新试卷（重点：不需要改任何页面代码）

1. **放入原始文件**：把新的真题 / 答案 PDF 放到 `真题/`、`真题答案/`。
2. **新增年份数据文件**：复制 `data/source/2024.json` 为 `data/source/<新年份>.json`，修改 `year` / `source` / `paper_file` / `answer_file`，
   在 `questions` 数组里按同一字段结构补全题目。
3. **（可选）补充知识点**：如果出现考纲里还没有的知识点，先在 `data/source/knowledge_tree.json` 对应章节的 `points` 里加一条。
4. **（可选）补充题图**：把无法文本化的图形存为 `public/images/questions/<questionId>.png`，并在题目的 `images` / `answer_images` 里填写该路径。
5. **重新构建数据**：

   ```bash
   npm run build:data      # 等价于 python scripts/build_data.py
   ```

   脚本会：合并各年份题目 → 处理跨年重复题（`merge_key`）→ 校验（含新增的「整卷答案图缺失」项）→ 重新生成
   `data/questions.json`、`data/knowledge_tree.json`、`data/stats.json`、`data/validation.json`。
   同时读取 `data/source/{sub_knowledge.json,trae_map.json,trae_figures.json}` 追加题图与细分知识点字段，
   生成 `data/sub_knowledge_tree.json`（数据链路详见第九节）。
   合并后的数据与静态资产（`public/answers/`、`public/pdfs/`）均已落地，运行 `npm run build:data` 即可重建，无需改前端代码。
6. 刷新浏览器即可。首页年份入口、筛选器、统计图表都会自动带上新试卷，**无需改前端代码**。

### 跨年份重复题怎么合并

同一道题在不同年份重复出现时，在这些年份的数据文件里给题目加上**相同的 `merge_key`**。
构建脚本会自动合并为一条，并把各个年份写入 `source_years` 与 `original_numbers`（保留各年题号）。
例如「弹性滑动与打滑的区别」这道简答题在 2024、2025 两年都考了：

```json
{
  "id": "2024-简答-01",
  "merge_key": "elastic-slip-vs-slip",
  "source_years": [2024, 2025],
  "original_numbers": { "2024": "二、简答题 第1题", "2025": "一、简答题 第1题" }
}
```

---

## 五、维护扩展题与答案版本

### 加扩展题

扩展题不写进 `data/source/<年>.json`，而是单独放在 `data/source/ext/<来源>.json`：

1. 按 `questions` 数组追加条目（id 用 `EXT-xxxx`，字段见下节）。
2. 如果这道题考过真题，填 `real_exam_refs`（`year` + 卷面 `number` + 对应真题 `question_id`），多年考过的全部列出。
3. 重跑 `npm run build:data` → 生成 `data/extended.json` / `ext_meta.json` / `ext_stats.json`。

构建脚本会校验：id 唯一、选项 ≥2、答案必须在选项内、`real_exam_refs` 指向的真题必须存在、
章节与知识点必须非空。任一不满足会写进 `data/validation.json`。

> 扩展题与真题**各自独立存在**：同一道题既是真题又是扩展题时，两边都会显示，只是扩展题带出处徽标。

### 加 / 改答案版本

在题目里加 `answer_versions`，键名可扩展（当前用 `laowei` / `kaoyanqun` / `ziliao`）。
前端只显示有 `answer` 内容的版本标签，故缺哪版不显示哪版、不需要改代码。

**两版答案冲突时不要擅自取舍**——原文各存一份，把差异写进 `答案版本覆盖与差异报告.md`，交人工核对。

---

## 六、题目数据字段

```jsonc
{
  "id": "2024-选择-01",              // 唯一 ID：年份-题型-序号
  "source_years": [2024],            // 来源年份（可多个）
  "source": "2024年855机械设计基础真题",
  "type": "single_choice",           // single_choice | multiple_choice | fill_blank
                                     // | true_false | short_answer | calculation
  "stem": "题干（支持 $LaTeX$）",
  "options": [{ "key": "A", "text": "选项A" }],
  "answer": ["B"],                   // 选择/多选：数组；判断：[true|false]
                                     // 填空：数组；简答：字符串；计算：步骤数组
  "explanation": "解析（支持 $LaTeX$）",
  "knowledge_points": ["知识点1"],
  "chapter": "第十四章 轴",
  "difficulty": "简单 | 中等 | 较难",
  "score": 2,
  "images": ["/images/questions/2024-选择-01.png"],
  "answer_images": [],
  "original_numbers": { "2024": "一、选择题 第1题" },
  "tags": ["答案存疑"],

  // ---- 以下为后加字段，全部可选、向后兼容 ----
  "answer_versions": {               // 多版本答案（前端可切换查看）
    "laowei":    { "answer": "老魏版答案", "source": "老魏机械团队 2019 年参考答案", "quality": "原文转录" },
    "kaoyanqun": { "answer": "考研群版答案", "source": "考研群资料版本 2019 年答案", "quality": "原文转录·手写识读" },
    "ziliao":    { "answer": "资料版答案", "source": "《常大855-简答题详解》", "quality": "整理" }
  },

  // ---- 以下为合并后新增字段，全部可选、向后兼容（见第九节） ----
  "sub_knowledge": ["G3"],            // Trae 版二级知识点码（64 个，A–O）
  "trae_chapters": ["G"],             // Trae 版 A–O 章码
  "trae_exam_ids": ["2012-一-7"]      // 该题对应的 Trae 卷面题次（可多个）
}
```

### 扩展题字段（`data/source/ext/*.json`）

```jsonc
{
  "id": "EXT-0001",                  // 扩展题统一前缀 EXT-，与真题 id 不冲突
  "type": "single_choice",
  "stem": "题干",
  "options": [{ "key": "A", "text": "选项A" }],
  "answer": ["B"],
  "explanation": "解析",
  "chapter": "第十一章 齿轮传动",
  "knowledge_points": ["齿轮传动的主要失效形式和设计计算准则"],
  "source_book": "青蛙弟弟选择题题库",  // 来源资料名（统计按它分组）
  "real_exam_refs": [                // 若该题是考过的真题，列出全部年份与卷面题号
    { "year": 2012, "number": "一、选择题 第7题", "question_id": "2012-选择-07" }
  ],
  "tags": []
}
```

公式优先转 LaTeX，前端用 **KaTeX** 渲染（`$...$` 行内、`$$...$$` 独立行）。

---

## 七、技术栈

Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui 风格组件 +
Recharts（统计图）+ KaTeX（公式）+ react-router-dom。
数据为 JSON 文件；答题记录、收藏、错题本使用 `localStorage`；无后端、无登录。
后续如需多端同步，可平滑接入 Supabase / 云服务替换 `src/lib/storage.ts`。

---

## 八、常见问题

**Q：为什么题目里有些图形是图片，不是文字？**
A：机构运动简图、轮系图、轴系结构图、螺栓组受力图等工程图无法用文字表达，按需求「只在无法文本提取时用图片」的原则，从原始扫描件中裁切保留。纯文字与公式题目均为文本 + LaTeX。

**Q：答题记录存在哪里？换浏览器会丢吗？**
A：存在浏览器 `localStorage`（进度键 `cdu-mech-progress-v1`、筛选/会话键 `cdu-mech-session-v1`），换浏览器或清缓存会丢。刷题页左侧「清空筛选」只重置筛选，如需清空答题记录可在浏览器控制台执行 `localStorage.clear()`。
合并后**不迁移**原 Trae 静态站的答题进度：其 `localStorage` 键为 `cx855_quiz_v1`，与本项目的键互不通用，本站不读取、不导入该进度。

**Q：分值是怎么定的？**
A：2022 年为打印版真题，卷面有明确分值（选择 2 分/题、简答 5 分/题、计算题 14~16 分/题，满分 150），按卷面录入。
2024/2025 年卷面未标注，按 单选 2 分 / 简答 10 分 / 计算 15 分 标注；2023 年按卷面总分均摊（选择、简答各 10 分，计算题按 100/3 ≈ 33 分估计）。后三年均为**估计值**，仅供统计参考。

**Q：为什么 2023 年的计算题从第 2 题开始？**
A：2023 年卷面注明「常大不公开初试真题，只回忆到部分题目」，计算题第 1 题未回忆出（内容缺失）。
已回忆出的题目保留卷面原始题号，故编号从 `2023-计算-02` 起，未虚构缺失题目。

**Q：双击 bat 后窗口一闪而过/报错怎么办？**
A：bat 需要 Node.js 与 Python 在环境里可用（Python 优先使用 `C:\Users\HUAWEI\.workbuddy\binaries\python\envs\default\Scripts\python.exe`，不存在则回退系统 `python`）。
若依赖安装卡住，可在 bat 里把 `https://registry.npmmirror.com` 换成你可用的镜像源，或先手动执行 `npm install` 再双击。

---

## 九、两项目合并说明（2026-11-07）

本目录为合并后的**唯一活跃站点**；原 Trae 版本地归档已删除（合并时曾短暂归档以核对），历史见远端 `https://github.com/Donis2/ChangDa-Trae.git`。两仓库 HEAD / remote、迁移清单见工作区根 `归档说明.md`；逐项数字的机读核对见 [`合并差异核对报告.md`](./docs/合并差异核对报告.md)。两版题干经逐题比对为同一套题，确定性键 =(年份, 规范化卷面号)，映射 386/386 全匹配、未匹配 0、模糊兜底 0。

### 9.1 新增入口与功能

| 入口 / 功能 | 内容 | 数据来源 |
| --- | --- | --- |
| `/answers`「历年整卷答案（扫描版）」 | 老魏版 2009–2024（缺 2023）60 页 + 考研群资料版 2009–2026（缺 2016）60 页，共 120 张 webp；按版本 / 年份切换 + 灯箱 | `public/answers/manifest.json`（运行时 fetch，不进首屏 chunk） |
| 4 册导出 PDF 下载（首页入口） | 常大855-客观题答案册 / 客观题题目册 / 简答题记忆版 / 简答题详解 | `public/pdfs/` |
| 64 个 Trae 二级知识点（A–O 共 15 章） | 接入刷题筛选与统计页，URL 参数 `?subkp=G3`；题面新增 `sub_knowledge` / `trae_chapters` / `trae_exam_ids` 三个可选字段 | `data/sub_knowledge_tree.json`、`data/source/sub_knowledge.json` |
| 题图补齐 | `public/images/questions/` 从 122 张增至 248 张（迁入 Trae 独有 126 张，零覆盖），清单 `public/images/questions/trae_figs.json`；两套裁切图并存、不取舍 | `data/source/trae_figures.json` |
| 题目卡「查看整卷扫描答案」 | 跳转 `/answers?year=<年份>`；答案页 `AnswerPages.tsx` 用 `useSearchParams` 读取 `year` 并优先选中该年份 | `src/components/QuestionCard.tsx`、`src/pages/AnswerPages.tsx` |

### 9.2 新增数据链路（`scripts/build_data.py` 已改造，运行 `npm run build:data` 即可重建，无需改前端）

- `data/source/sub_knowledge.json`：15 章 / 64 细分点定义
- `data/source/trae_map.json`：371 题 ↔ Trae 386 卷面题次的确定性映射
- `data/source/trae_figures.json`：109 题挂载 121 张题图 + 5 张答案图
- 产物新增 `data/sub_knowledge_tree.json`（27KB）；`data/validation.json` 新增 `trae_assets` 段（`figure_questions: 109`、`figure_images: 121`、`figure_answer_images: 5`、`mapped_questions: 371`、`sub_chapters: 15`、`sub_points: 64`、`answer_pages: 120`）与「整卷答案图缺失」校验项
- **可选手动脚本** `scripts/build_answer_pages.py`（`npm run build:answers`）：从资料母库 PDF 重新渲染 120 张 webp 并重建 `public/answers/manifest.json`，仅本机需 `pip install PyMuPDF Pillow`。**该脚本不参与 `一键启动.bat`，也不参与 Netlify 构建**——`public/answers/` 下的静态文件已随仓库落地，日常启动与部署都不需要它

### 9.3 数据口径（不要混用）

- 真题 **371 条唯一题 / 386 个卷面题次**：9 组跨年重复合并，涉及 24 个卷面题次；`validation.json` 的 `total_questions` 为 371
- 扩展题 **585 道**：以 WB 为主体，Trae 540 不整批并入；Trae 独有 11 条题干均与 WB 近似（>=0.85），无 WB 无近似的真空缺
- `2017-简答-05` 等补题均在 WB（Trae 无对应卷面题）
- 题型映射：Trae 中文 7 类（分析 / 计算 / 结构 → `calculation`），卷面号保留 `original_numbers`；64 细分知识点与 A–O 章码作为「第二套知识点视图」并存引入，不替代 WB 考纲章节

### 9.4 已知缺口与不虚构项

- `2015-分析-03`（Trae 的 `2015-五-1`）螺纹联接作图改错**两边都缺文字答案**；`validation.json` 当前仅此 1 条「缺答案」issue
- 老魏版整卷答案缺 2023 年、无 2025 / 2026；考研群资料版覆盖至 2026
- 两版同名页面 42 对中内容相同 19、内容不同 23；差异**原样各存、交人工核对，不自动取舍**。文字版答案覆盖 `{laowei: 278, kaoyanqun: 268, ziliao: 77}`（340/371 题有 `answer_versions`）
- 沿用第五节冲突原则原文：「**两版答案冲突时不要擅自取舍**——原文各存一份，把差异写进 `答案版本覆盖与差异报告.md`，交人工核对。」缺口与差异清单见 [`合并差异核对报告.md`](./docs/合并差异核对报告.md)、`docs/答案版本覆盖与差异报告.md`、`docs/待核实清单.md`；**保留为已知缺口，不虚构、不补写**

### 9.5 资料母库与工作副本（不要删）

- 唯一**权威**母库：`Workbuddy版本/题目资料来源/`（124 个文件，约 470 MB，被 `.gitignore` 排除，不入库）
- 合并时归档副本内原本也有一份 `题目资料来源/`（全量 SHA256 比对 0 mismatches、逐字节一致）；2026-11-07 收尾清理时已删除该副本以回收约 470 MB，删除前重新校验哈希一致，且整个归档目录此后也已删除，均不影响站点运行与任何 git 历史
- `资料/`、`真题/`、`真题答案/` 是 `_scan/` 工具链输入路径的母库**工作副本**，与权威母库并存，不要删
- 收尾清理同时删除了可再生产物：`dist/`（`npm run build` 再生）、`node_modules/`（`npm install` 再生）、合并时归档副本内 `_build/archive/`、`.trae-html-share-packages/`、`.screenshots/.tmp/` 等中间产物，以及空的 `_scan/cache/`（保留 `.gitkeep`）；此后整个归档目录也已删除，Trae 版本地归档已删除、历史见远端仓库，站点、数据与两仓库 git 历史均未受影响

### 9.6 部署与性能约束

- 首屏性能硬约束见第二节原文：`questions.json`（888KB）、`extended.json`（777KB）不得静态 import 回首页或 `data.ts`；新增的 `sub_knowledge_tree.json`（27KB）只允许被 `src/lib/subKnowledgeData.ts` 静态 import 且该文件只被 lazy chunk（Practice / Stats / FilterSidebar）引用；`answers/manifest.json` 走运行时 fetch。首屏 chunk 目标仍为 233KB / gzip 76KB
- `localStorage` 键 `cdu-mech-progress-v1` / `cdu-mech-session-v1` 不变，不迁移 Trae 的 `cx855_quiz_v1` 进度
- Netlify：`public/answers/`、`public/pdfs/`、`data/*.json` 必须是已落地文件随仓库提交，部署时无 Python、不重建；`netlify.toml` 无需改动（SPA 回退对已存在的静态文件不生效）

### 9.7 验收结果（2026-11-07）

- `npm run typecheck`：零错误
- `npm run build`：成功。首屏 index chunk 237.21 KB / gzip 76.48 KB，AnswerPages 独立 lazy chunk 7.75 KB，未把大 JSON 拉进首屏
- `python scripts/build_data.py`：成功。`validation.json` 仅 1 条已知缺答案 issue（`2015-分析-03`）；`trae_assets` 汇总 `figure_questions: 109`、`figure_images: 121`、`figure_answer_images: 5`、`mapped_questions: 371`、`sub_chapters: 15`、`sub_points: 64`、`answer_pages: 120`
- `dist/` 构建时已包含 `answers/`（120 webp + manifest）、`pdfs/`（4 册）、`images/questions/`（249 项）；收尾清理时删除该可再生产物，需要时用 `npm run build` 重建，Netlify 部署按 `npm run build` 自动生成
- 浏览器手测通过：导航第 4 项「整卷答案」、`/answers` 两版本切换、`?year=2009` 优先选中、`?subkp=G3` 筛出 6 题且 64 个知识点全展示、题目卡「查看整卷扫描答案」跳转 `/answers?year=2009` 生效
