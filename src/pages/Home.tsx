import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  Layers,
  NotebookPen,
  AlertCircle,
  Star,
  ArrowRight,
  Calculator,
  Clock,
  Images,
  FileDown,
} from 'lucide-react'
import { knowledgeTree, statsFile, years } from '@/lib/data'
import { extMeta } from '@/lib/extMeta'
import { useProgress } from '@/lib/storage'
import { TYPE_ORDER, pct, typeLabel } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** 原 Trae 版导出的 4 册 PDF，已迁入 public/pdfs/，文件名含中文需编码 */
const PDF_BOOKS = [
  { name: '常大855-客观题答案册.pdf', label: '客观题答案册' },
  { name: '常大855-客观题题目册.pdf', label: '客观题题目册' },
  { name: '常大855-简答题记忆版.pdf', label: '简答题记忆版' },
  { name: '常大855-简答题详解.pdf', label: '简答题详解' },
]

export function Home() {
  const progress = useProgress()

  // 不再做首屏空闲预取：刷题页携带 888KB 题库，预取会把它拉回前台。
  // 导航栏 NavLink 的 onMouseEnter 已在用户有意图时预取，足够即时。
  const recs = Object.values(progress)
  const attempts = recs.reduce((s, r) => s + r.attempts, 0)
  const correct = recs.reduce((s, r) => s + r.correctCount, 0)
  const wrongCount = recs.filter((r) => r.inWrongBook).length
  const favCount = recs.filter((r) => r.favorite).length
  const answered = recs.filter((r) => r.attempts > 0).length

  const typeCounts = TYPE_ORDER.map((t) => statsFile.by_type.find((x) => x.type === t)).filter(
    (x): x is NonNullable<typeof x> => Boolean(x),
  )

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Hero */}
      <Card className="hero-surface overflow-hidden border-primary/20 shadow-card">
        <CardContent className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:gap-8">
          <div className="flex-1 space-y-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="default">常州大学</Badge>
              <Badge variant="info">科目代码 855</Badge>
              <Badge variant="secondary">机械设计基础</Badge>
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              855 机械设计基础
              <span className="mt-1 block text-lg font-semibold text-muted-foreground sm:mt-1.5 sm:text-xl">
                历年真题刷题平台
              </span>
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              题库由历年真题 PDF（扫描版）逐页解析整理而成，覆盖选择题、简答题、计算/综合题。
              选择题、判断题点击选项即时判分；填空、简答、计算题点击「显示答案」查看答案、解析与步骤。
              答错的题会自动进入错题本。
            </p>
            <div className="flex flex-wrap gap-2 pt-1.5">
              <Button asChild className="shadow-sm">
                <Link to="/practice">
                  <NotebookPen className="mr-1.5 h-4 w-4" /> 开始刷题
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/practice?mode=wrong">
                  <AlertCircle className="mr-1.5 h-4 w-4" /> 错题重做
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/stats">查看统计</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:w-[360px]">
            <Stat icon={<Layers />} label="题库总题数" value={`${statsFile.total_questions} 题`} />
            <Stat icon={<BookOpen />} label="覆盖年份" value={`${years.length} 年`} />
            <Stat icon={<Clock />} label="考试时长" value={`${knowledgeTree.exam.duration_minutes} 分钟`} />
            <Stat icon={<Calculator />} label="满分" value={`${knowledgeTree.exam.total_score} 分`} />
          </div>
        </CardContent>
      </Card>

      {/* 我的进度 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard label="已作答" value={`${answered}`} sub={`共 ${statsFile.total_questions} 题`} tone="sky" />
        <StatCard
          label="总正确率"
          value={attempts ? `${pct(correct, attempts)}%` : '—'}
          sub={`累计作答 ${attempts} 次`}
          tone="emerald"
        />
        <StatCard label="错题本" value={`${wrongCount}`} sub="答错自动收录" tone="rose" />
        <StatCard label="我的收藏" value={`${favCount}`} sub="手动标记 ★" tone="amber" />
      </div>

      {/* 扩展题库：非真题资料提取的题目，独立板块 */}
      {extMeta.total_questions > 0 && (
        <Section
          title="扩展题库（非真题资料）"
          icon={<Layers className="h-4 w-4" />}
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/practice?bank=ext">
                进入扩展题库 <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/practice?bank=ext"
              className="group rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">全部扩展题</div>
                <Badge variant="warning">{extMeta.total_questions} 题</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                其中真题原题 <span className="font-semibold text-amber-700">{extMeta.tagged_real_exam}</span> 题，
                已标注考过的年份与题号
              </p>
            </Link>
            {extMeta.by_source.map((s) => (
              <div key={s.source} className="rounded-xl border bg-card p-4 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold" title={s.source}>
                    {s.source}
                  </div>
                  <Badge variant="secondary">{s.count} 题</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">非真题补充题库</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 合并迁入资料：整卷双版本答案、导出 PDF、Trae 细分知识点 */}
      <Section
        title="整卷答案与导出资料（原 Trae 版迁入）"
        icon={<Images className="h-4 w-4" />}
      >
        <div className="grid gap-3 lg:grid-cols-3">
          {/* 整卷扫描答案 */}
          <Link
            to="/answers"
            className="group rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/10 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Images className="h-4 w-4 text-primary" />
                历年整卷答案（扫描版）
              </div>
              <Badge variant="info">120 页</Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              老魏版（2009–2024，缺 2023）与考研群资料版（2009–2026）两套扫描答案，按年份浏览；
              两版原样各存、不自动取舍。
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs text-primary opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              进入浏览 <ArrowRight className="h-3 w-3" />
            </div>
          </Link>

          {/* 64 细分知识点 */}
          <Link
            to="/knowledge"
            className="group rounded-xl border bg-card p-4 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/50 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Layers className="h-4 w-4" />
                细分知识点（Trae 版）
              </div>
              <Badge variant="purple">15 章 / 64 点</Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              与考纲章节并存的另一套逐题标注体系（A–O）。按知识点查看真题命中数与自己的正确率，
              再一键进入该知识点刷题。
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs text-primary opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              查看知识点统计 <ArrowRight className="h-3 w-3" />
            </div>
          </Link>

          {/* PDF 下载 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <FileDown className="h-4 w-4" />
                  导出 PDF 资料册
                </div>
                <Badge variant="secondary">4 册</Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {PDF_BOOKS.map((b) => (
                  <a
                    key={b.name}
                    href={`/pdfs/${encodeURIComponent(b.name)}`}
                    download={b.name}
                    title={`下载 ${b.name}`}
                    className="truncate rounded-md border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"
                  >
                    {b.label}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* 年份入口 */}
      <Section
        title="按年份进入"
        icon={<CalendarDays className="h-4 w-4" />}
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/practice">
              全部年份 <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statsFile.by_year.map((y) => (
            <Link
              key={y.year}
              to={`/practice?year=${y.year}`}
              className="group rounded-xl border bg-card p-4 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/50 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{y.year} 年真题</div>
                <Badge variant="info">{y.count} 题</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(y.types).map(([t, c]) => (
                  <Badge key={t} variant="secondary">
                    {typeLabel(t)} {c}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-primary opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                开始刷这一年 <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* 题型入口 */}
      <Section title="按题型进入" icon={<Layers className="h-4 w-4" />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {typeCounts.map((t) => (
            <Link
              key={t.type}
              to={`/practice?type=${t.type}`}
              className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/50 hover:shadow-md"
            >
              <div>
                <div className="font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground">共 {t.count} 题</div>
              </div>
              <div className="text-2xl font-bold text-primary/30">{t.count}</div>
            </Link>
          ))}
        </div>
      </Section>

      {/* 知识点入口 */}
      <Section
        title="按知识点进入（对照考纲章节）"
        icon={<BookOpen className="h-4 w-4" />}
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/knowledge">
              知识点详细统计 <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {knowledgeTree.chapters
            .filter((ch) => ch.questionCount > 0)
            .map((ch) => (
              <Card key={ch.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to={`/practice?chapter=${encodeURIComponent(ch.name)}`}
                      title={`进入本章刷题：${ch.name}（${ch.questionCount} 题）`}
                      className="text-sm font-semibold transition-colors hover:text-primary"
                    >
                      {ch.name}
                    </Link>
                    <Badge variant="purple">{ch.questionCount} 题</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ch.points
                      .filter((p) => p.questionCount > 0)
                      .map((p) => (
                        <Link
                          key={p.id}
                          to={`/practice?kp=${encodeURIComponent(p.name)}`}
                          className="rounded-full border px-2 py-0.5 text-xs transition-colors hover:border-primary/50 hover:bg-accent"
                        >
                          {p.name}
                          <span className="ml-1 text-muted-foreground">{p.questionCount}</span>
                        </Link>
                      ))}
                    {ch.points.every((p) => p.questionCount === 0) && (
                      <span className="text-xs text-muted-foreground">
                        暂无真题命中（后续试卷补充）
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </Section>

      {/* 题库说明 */}
      <Section title="题库与考纲说明" icon={<BookOpen className="h-4 w-4" />}>
        <Card>
          <CardContent className="grid gap-5 p-5 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div className="font-semibold">考试要求</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>· 考试时间 {knowledgeTree.exam.duration_minutes} 分钟，满分 {knowledgeTree.exam.total_score} 分</li>
                <li>· 题型：{knowledgeTree.exam.question_types.join('、')}</li>
                <li>· 考试不能使用计算器</li>
                <li>· 数据来源：{knowledgeTree.outline_source}</li>
              </ul>
            </div>
            <div className="space-y-2 text-sm">
              <div className="font-semibold">主要参考书目</div>
              <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
                {knowledgeTree.exam.references.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      </Section>
    </div>
  )
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
        <span className="flex h-6 w-1 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
        <span className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
          {icon}
          {title}
        </span>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card/80 p-3 shadow-card sm:p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
        <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">{value}</div>
    </div>
  )
}

const TONES: Record<string, string> = {
  sky: 'bg-sky-50/80 text-sky-800 border-sky-200/80 shadow-card',
  emerald: 'bg-emerald-50/80 text-emerald-800 border-emerald-200/80 shadow-card',
  rose: 'bg-rose-50/80 text-rose-800 border-rose-200/80 shadow-card',
  amber: 'bg-amber-50/80 text-amber-800 border-amber-200/80 shadow-card',
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone: keyof typeof TONES
}) {
  return (
    <Card className={TONES[tone]}>
      <CardContent className="p-3.5 sm:p-4">
        <div className="text-[11px] opacity-80 sm:text-xs">{label}</div>
        <div className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{value}</div>
        <div className="mt-0.5 text-[11px] opacity-70">{sub}</div>
      </CardContent>
    </Card>
  )
}
