import * as React from 'react'
import { Link } from 'react-router-dom'
import { knowledgeTree } from '@/lib/data'
import { subKnowledgeTree, SUB_TOTAL_POINTS, SUB_TOTAL_CHAPTERS } from '@/lib/subKnowledgeData'
import { useProgress } from '@/lib/storage'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { pct } from '@/lib/utils'

/**
 * 知识点统计（独立页）。
 *
 * 数据全部来自本地：两套知识点树都自带 questionIds，因此可以直接用题号
 * 去 localStorage 的 progress 里取作答记录算正确率，**不需要加载 888KB 题库**。
 *
 * 页面不带任何图表库（recharts 只留在 Stats 页），条形图用 Progress 纯 CSS 画，
 * 保证本页 chunk 只有十几 KB。
 */

type Sys = 'outline' | 'sub'
type SortKey = 'chapter' | 'count' | 'weak'

interface PointRow {
  key: string
  code?: string
  name: string
  chapter: string
  questionCount: number
  /** 该知识点命中的真题 id，用于汇总本页总体正确率（不加载题库） */
  questionIds: string[]
  href: string
  attempts: number
  correct: number
  wrong: number
  touched: boolean
  rate: number | null
}

interface ChapterRow {
  name: string
  questionCount: number
  points: PointRow[]
  touchedPoints: number
  attempts: number
  correct: number
  rate: number | null
}

/** 某组题号的作答汇总；touched 表示「动过的题数」，与 attempts 区分 */
function aggregate(ids: string[], progress: ReturnType<typeof useProgress>) {
  let attempts = 0
  let correct = 0
  let wrong = 0
  let touched = 0
  for (const id of ids) {
    const r = progress[id]
    if (!r || r.attempts <= 0) continue
    attempts += r.attempts
    correct += r.correctCount
    wrong += r.wrongCount
    touched += 1
  }
  return { attempts, correct, wrong, touched }
}

function rateOf(attempts: number, correct: number): number | null {
  if (!attempts) return null
  return pct(correct, attempts)
}

function rateColor(rate: number | null) {
  if (rate === null) return undefined
  if (rate >= 80) return 'bg-emerald-500'
  if (rate >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
}

export function Knowledge() {
  const progress = useProgress()
  const [sys, setSys] = React.useState<Sys>('outline')
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<SortKey>('chapter')
  const [onlyWeak, setOnlyWeak] = React.useState(false)

  const isSub = sys === 'sub'

  /** 两套树字段名不同（id / code），先归一成同一形状再算统计 */
  const chapters = React.useMemo<ChapterRow[]>(() => {
    const src = isSub
      ? subKnowledgeTree.chapters.map((c) => ({
          name: c.name,
          questionCount: c.questionCount,
          points: c.points.map((p) => ({
            key: p.code,
            code: p.code,
            name: p.name,
            questionCount: p.questionCount,
            questionIds: p.questionIds,
            href: `/practice?subkp=${encodeURIComponent(p.code)}`,
          })),
        }))
      : knowledgeTree.chapters.map((c) => ({
          name: c.name,
          questionCount: c.questionCount,
          points: c.points.map((p) => ({
            key: p.id,
            code: undefined as string | undefined,
            name: p.name,
            questionCount: p.questionCount,
            questionIds: p.questionIds,
            href: `/practice?kp=${encodeURIComponent(p.name)}`,
          })),
        }))

    return src.map((c) => {
      const allIds = Array.from(new Set(c.points.flatMap((p) => p.questionIds)))
      const agg = aggregate(allIds, progress)
      const points: PointRow[] = c.points.map((p) => {
        const a = aggregate(p.questionIds, progress)
        return {
          key: p.key,
          code: p.code,
          name: p.name,
          chapter: c.name,
          questionCount: p.questionCount,
          questionIds: p.questionIds,
          href: p.href,
          attempts: a.attempts,
          correct: a.correct,
          wrong: a.wrong,
          touched: a.touched > 0,
          rate: rateOf(a.attempts, a.correct),
        }
      })
      return {
        name: c.name,
        questionCount: c.questionCount,
        points,
        touchedPoints: points.filter((p) => p.touched).length,
        attempts: agg.attempts,
        correct: agg.correct,
        rate: rateOf(agg.attempts, agg.correct),
      }
    })
  }, [isSub, progress])

  const allPoints = React.useMemo(() => chapters.flatMap((c) => c.points), [chapters])
  const totalPoints = allPoints.length
  const touchedPoints = allPoints.filter((p) => p.touched).length
  /** 待加强 = 有真题可练（questionCount > 0），且没练过或正确率 < 60% */
  const weakPoints = allPoints.filter(
    (p) => p.questionCount > 0 && (p.rate === null || p.rate < 60),
  )

  const overallIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const c of chapters) for (const p of c.points) for (const id of p.questionIds) ids.add(id)
    return Array.from(ids)
  }, [chapters])
  const overall = React.useMemo(() => aggregate(overallIds, progress), [overallIds, progress])
  const overallRate = rateOf(overall.attempts, overall.correct)

  const q = query.trim().toLowerCase()

  const visible = React.useMemo(() => {
    const sorter = (a: PointRow, b: PointRow) => {
      if (sort === 'count') return b.questionCount - a.questionCount
      if (sort === 'weak') {
        // 未练习的排在最后：没有数据不等于薄弱
        if (a.rate === null && b.rate === null) return b.questionCount - a.questionCount
        if (a.rate === null) return 1
        if (b.rate === null) return -1
        return a.rate - b.rate
      }
      return 0
    }
    return chapters
      .map((c) => ({
        ...c,
        points: c.points
          .filter((p) => {
            // 没有真题可练的点不算「待加强」，与顶部速览口径一致
            if (onlyWeak && !(p.questionCount > 0 && (p.rate === null || p.rate < 60))) return false
            if (!q) return true
            return `${p.code ?? ''} ${p.name} ${p.chapter}`.toLowerCase().includes(q)
          })
          .sort(sorter),
      }))
      .filter((c) => c.points.length > 0)
  }, [chapters, onlyWeak, q, sort])

  const shownPoints = visible.reduce((n, c) => n + c.points.length, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">知识点统计</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          两套知识点体系逐点统计：真题命中分布，以及你在每个知识点上的作答题数与正确率。
        </p>
      </div>

      {/* 概览 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="考纲知识点"
          value={`${knowledgeTree.chapters.length} 章 / ${knowledgeTree.chapters.reduce((n, c) => n + c.points.length, 0)} 点`}
          sub="教材章节口径"
        />
        <StatCard
          label="细分知识点"
          value={`${SUB_TOTAL_CHAPTERS} 章 / ${SUB_TOTAL_POINTS} 点`}
          sub="逐题标注口径"
        />
        <StatCard
          label="我的覆盖"
          value={`${touchedPoints} / ${totalPoints}`}
          sub={`已练 ${pct(touchedPoints, totalPoints)}% 的知识点`}
        />
        <StatCard
          label="总体正确率"
          value={overallRate === null ? '—' : `${overallRate}%`}
          sub={overall.attempts ? `${overall.correct}/${overall.attempts} 次作答` : '暂无作答记录'}
        />
      </div>

      {/* 体系切换 + 工具条 */}
      <Card>
        <CardContent className="space-y-3 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="知识点体系" className="flex rounded-lg border bg-secondary/50 p-0.5">
              <SysTab active={sys === 'outline'} onClick={() => setSys('outline')}>
                考纲知识点
              </SysTab>
              <SysTab active={isSub} onClick={() => setSys('sub')}>
                细分知识点
              </SysTab>
            </div>
            <span className="text-xs text-muted-foreground">
              {isSub
                ? '来自 Trae 版逐题标注，与考纲并存；同一题可命中多个点'
                : '对照教材章节，同一题可跨章命中'}
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isSub ? '搜索知识点码 / 名称 / 章名' : '搜索知识点 / 章节'}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:max-w-xs"
            />
            <div className="flex items-center gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="排序方式"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="chapter">按章序</option>
                <option value="count">按命中题数</option>
                <option value="weak">按正确率低→高</option>
              </select>
              <button
                type="button"
                onClick={() => setOnlyWeak((v) => !v)}
                aria-pressed={onlyWeak}
                className={
                  onlyWeak
                    ? 'h-9 rounded-md border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-primary'
                    : 'h-9 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-accent'
                }
              >
                只看待加强
                {onlyWeak ? `（${weakPoints.length}）` : ''}
              </button>
            </div>
            <span className="text-xs text-muted-foreground sm:ml-auto">
              共 {totalPoints} 个知识点，当前显示 {shownPoints} 个
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 待加强速览 */}
      {weakPoints.length > 0 && !onlyWeak && !q && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">需要加强的知识点</CardTitle>
            <p className="text-xs text-muted-foreground">
              正确率低于 60% 或尚未练习的点，最多列 6 个（点绿色「刷题」直接进入该知识点）
            </p>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {weakPoints
              .slice()
              .sort((a, b) => {
                if (a.rate === null && b.rate === null) return b.questionCount - a.questionCount
                if (a.rate === null) return 1
                if (b.rate === null) return -1
                return a.rate - b.rate
              })
              .slice(0, 6)
              .map((p) => (
                <PointRowItem key={`weak-${p.key}`} p={p} />
              ))}
          </CardContent>
        </Card>
      )}

      {/* 章节明细 */}
      {visible.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground sm:p-10">
            没有匹配的知识点，换个关键词或取消「只看待加强」试试。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <Card key={c.name}>
              <CardHeader className="gap-2 pb-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-5 w-1 shrink-0 rounded-full bg-primary/70" />
                    <CardTitle className="truncate text-sm">{c.name}</CardTitle>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      真题 {c.questionCount} 题
                    </Badge>
                    <Badge variant="info" className="text-[10px]">
                      覆盖 {c.touchedPoints}/{c.points.length} 点
                    </Badge>
                    {c.rate !== null && (
                      <Badge
                        variant={c.rate >= 80 ? 'success' : c.rate >= 60 ? 'warning' : 'destructive'}
                        className="text-[10px]"
                      >
                        正确率 {c.rate}%
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-1.5">
                {c.points.map((p) => (
                  <PointRowItem key={p.key} p={p} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="pb-2 text-center text-xs text-muted-foreground">
        正确率来自本机答题记录（localStorage），换设备或清缓存后重新累计；真题命中数来自题库标注。
      </p>
    </div>
  )
}

function SysTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? 'rounded-[6px] bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm sm:text-sm'
          : 'rounded-[6px] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm'
      }
    >
      {children}
    </button>
  )
}

function PointRowItem({ p }: { p: PointRow }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-card/60 px-2.5 py-2 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between sm:px-3">
      <div className="flex min-w-0 items-center gap-2">
        {p.code && (
          <Badge variant="info" className="w-9 shrink-0 justify-center font-mono text-[10px]">
            {p.code}
          </Badge>
        )}
        <Link
          to={p.href}
          title={`进入刷题：${p.name}`}
          className="truncate text-sm font-medium transition-colors hover:text-primary"
        >
          {p.name}
        </Link>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {p.questionCount} 题
        </span>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        {p.rate === null ? (
          <span className="text-[11px] text-muted-foreground">未练习</span>
        ) : (
          <>
            <Progress value={p.rate} className="h-1.5 w-16" indicatorClassName={rateColor(p.rate)} />
            <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
              {p.rate}%
            </span>
            <span className="w-14 shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {p.attempts} 次
            </span>
          </>
        )}
        <Link
          to={p.href}
          className="shrink-0 rounded-md border bg-card px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          刷题
        </Link>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-3.5 sm:p-4">
        <div className="text-[11px] text-muted-foreground sm:text-xs">{label}</div>
        <div className="mt-1 text-base font-bold tabular-nums sm:text-lg">{value}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  )
}
