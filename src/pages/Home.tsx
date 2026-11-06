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
} from 'lucide-react'
import { knowledgeTree, questions, statsFile, years } from '@/lib/data'
import { extMeta } from '@/lib/extMeta'
import { useProgress } from '@/lib/storage'
import { TYPE_ORDER, pct, typeLabel } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function Home() {
  const progress = useProgress()

  // 首屏渲染完成后，空闲时预取刷题页代码块，点击「开始刷题」即点即开
  React.useEffect(() => {
    const idle =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500))
    const t = idle(() => {
      void import('@/pages/Practice')
    })
    return () => {
      const cancel = (window as unknown as { cancelIdleCallback?: (h: number) => void })
        .cancelIdleCallback
      if (cancel) cancel(t as number)
      else window.clearTimeout(t as number)
    }
  }, [])

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
    <div className="space-y-5">
      {/* Hero */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">常州大学</Badge>
              <Badge variant="info">科目代码 855</Badge>
              <Badge variant="secondary">机械设计基础</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              855 机械设计基础 · 历年真题刷题平台
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              题库由历年真题 PDF（扫描版）逐页解析整理而成，覆盖选择题、简答题、计算/综合题。
              选择题、判断题点击选项即时判分；填空、简答、计算题点击「显示答案」查看答案、解析与步骤。
              答错的题会自动进入错题本。
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild>
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

          <div className="grid grid-cols-2 gap-3 lg:w-[360px]">
            <Stat icon={<Layers />} label="题库总题数" value={`${questions.length} 题`} />
            <Stat icon={<BookOpen />} label="覆盖年份" value={`${years.length} 年`} />
            <Stat icon={<Clock />} label="考试时长" value={`${knowledgeTree.exam.duration_minutes} 分钟`} />
            <Stat icon={<Calculator />} label="满分" value={`${knowledgeTree.exam.total_score} 分`} />
          </div>
        </CardContent>
      </Card>

      {/* 我的进度 */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="已作答" value={`${answered}`} sub={`共 ${questions.length} 题`} tone="sky" />
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
              className="group rounded-lg border border-amber-200 bg-amber-50/50 p-4 transition-colors hover:border-amber-400 hover:bg-amber-50"
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
              <div key={s.source} className="rounded-lg border bg-card p-4">
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

      {/* 年份入口 */}
      <Section
        title="按年份进入"
        icon={<CalendarDays className="h-4 w-4" />}
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/practice?year=2024,2025">
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
              className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/50"
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
              <div className="mt-3 flex items-center gap-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
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
              className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/50"
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
            <Link to="/stats">
              知识点频次排行 <ArrowRight className="ml-1 h-3.5 w-3.5" />
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
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-base font-semibold">
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
    <div className="rounded-lg border bg-card/80 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

const TONES: Record<string, string> = {
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
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
      <CardContent className="p-4">
        <div className="text-xs opacity-80">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-[11px] opacity-70">{sub}</div>
      </CardContent>
    </Card>
  )
}
