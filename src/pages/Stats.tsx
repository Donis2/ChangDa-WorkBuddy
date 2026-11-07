import * as React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { statsFile } from '@/lib/data'
import { questions } from '@/lib/questionData'
import { extStats } from '@/lib/extMeta'
import type { Question } from '@/lib/types'
import { useProgress } from '@/lib/storage'
import { TYPE_ORDER, pct, typeLabel } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

const PALETTE = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']

export function Stats() {
  const progress = useProgress()

  // 扩展题只在统计页异步载入，避免把 777KB 题库拖进首屏或阻塞首屏统计
  const [extQuestions, setExtQuestions] = React.useState<Question[]>([])
  React.useEffect(() => {
    let alive = true
    void import('@/lib/extData').then((m) => {
      if (alive) setExtQuestions(m.extendedQuestions)
    })
    return () => { alive = false }
  }, [])

  /** 真题 + 扩展题的 id 索引：之前只用 questions.find，EXT-* 作答会被整批漏统计 */
  const questionById = React.useMemo(() => {
    const m = new Map<string, Question>()
    for (const q of questions) m.set(q.id, q)
    for (const q of extQuestions) m.set(q.id, q)
    return m
  }, [extQuestions])
  const poolSize = questions.length + extStats.total_questions

  const typeData = React.useMemo(
    () =>
      TYPE_ORDER.filter((t) => statsFile.by_type.some((x) => x.type === t)).map((t) => {
        const row = statsFile.by_type.find((x) => x.type === t)!
        return { name: row.label, value: row.count, score: row.score, type: t }
      }),
    [],
  )

  const yearData = statsFile.by_year.map((y) => ({
    name: `${y.year}年`,
    value: y.count,
  }))

  const kpTop = statsFile.knowledge_point_ranking.slice(0, 15).map((k) => ({
    name: k.name.length > 14 ? k.name.slice(0, 13) + '…' : k.name,
    full: k.name,
    value: k.count,
  }))

  const calcKp = statsFile.calculation_analysis.by_knowledge_point.map((k) => ({
    name: k.name.length > 14 ? k.name.slice(0, 13) + '…' : k.name,
    full: k.name,
    value: k.count,
  }))

  const calcShape = statsFile.calculation_analysis.by_type_shape.filter((s) => s.count > 0)

  // 本地作答统计
  const recs = Object.entries(progress)
  const attempts = recs.reduce((s, [, r]) => s + r.attempts, 0)
  const correct = recs.reduce((s, [, r]) => s + r.correctCount, 0)
  const answered = recs.filter(([, r]) => r.attempts > 0).length
  const wrongBook = recs.filter(([, r]) => r.inWrongBook).length
  const favorites = recs.filter(([, r]) => r.favorite).length

  const byTypeAccuracy = React.useMemo(() => {
    const m: Record<string, { attempts: number; correct: number }> = {}
    for (const [id, r] of recs) {
      const q = questionById.get(id)
      if (!q) continue
      m[q.type] ??= { attempts: 0, correct: 0 }
      m[q.type].attempts += r.attempts
      m[q.type].correct += r.correctCount
    }
    return TYPE_ORDER.filter((t) => m[t]).map((t) => ({
      name: typeLabel(t),
      value: pct(m[t].correct, m[t].attempts),
      attempts: m[t].attempts,
    }))
  }, [progress, questionById])

  const weakKp = React.useMemo(() => {
    const m: Record<string, { attempts: number; wrong: number }> = {}
    for (const [id, r] of recs) {
      const q = questionById.get(id)
      if (!q) continue
      for (const kp of q.knowledge_points) {
        m[kp] ??= { attempts: 0, wrong: 0 }
        m[kp].attempts += r.attempts
        m[kp].wrong += r.wrongCount
      }
    }
    return Object.entries(m)
      .filter(([, v]) => v.attempts > 0)
      .map(([name, v]) => ({ name, ...v, rate: pct(v.attempts - v.wrong, v.attempts) }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 10)
  }, [progress, questionById])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">题库统计</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          题型数量、知识点频次、年份分布与计算题考点统计（题库维度）；正确率来自本地答题记录。
        </p>
      </div>

      {/* 概览 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniCard label="题库题量" value={`${statsFile.total_questions}`} sub={`合计 ${statsFile.total_score} 分`} />
        <MiniCard label="已作答" value={`${answered}`} sub={`覆盖 ${pct(answered, poolSize)}% 题库`} />
        <MiniCard
          label="总正确率"
          value={attempts ? `${pct(correct, attempts)}%` : '—'}
          sub={`${correct}/${attempts} 次`}
        />
        <MiniCard label="错题 / 收藏" value={`${wrongBook} / ${favorites}`} sub="来自错题本" />
      </div>

      {/* 题型 + 年份 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="题型数量分布" desc="饼图 / 柱状图">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="68%"
                    innerRadius="34%"
                    paddingAngle={2}
                    label={({ name, value }) => `${name} ${value}`}
                    labelLine={false}
                  >
                    {typeData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [`${v} 题`, '数量']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {typeData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {statsFile.by_type.map((t) => (
              <Badge key={t.type} variant="secondary">
                {t.label} {t.count} 题 / {t.score} 分
              </Badge>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="年份分布" desc="按试卷年份统计题量">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearData} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [`${v} 题`, '题量']} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={70} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid gap-1.5">
            {statsFile.by_year.map((y) => (
              <div key={y.year} className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{y.year} 年：</span>
                {Object.entries(y.types).map(([t, c]) => (
                  <span key={t}>
                    {typeLabel(t)} {c}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* 知识点频次排行 */}
      <ChartCard title="知识点频次排行 TOP 15" desc="同一题可命中多个知识点">
        <div style={{ height: Math.max(320, kpTop.length * 30) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={kpTop}
              layout="vertical"
              margin={{ top: 4, right: 30, bottom: 4, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={128}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v: number) => [`${v} 题`, '命中题数']}
                labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''}
              />
              <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* 计算题专项 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="计算题考点频次"
          desc={`共 ${statsFile.calculation_analysis.total} 道计算/综合题，合计 ${statsFile.calculation_analysis.score} 分`}
        >
          <div style={{ height: Math.max(280, calcKp.length * 32) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={calcKp}
                layout="vertical"
                margin={{ top: 4, right: 30, bottom: 4, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => [`${v} 题`, '题数']}
                  labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="计算题题型统计" desc="按解题套路归类">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={calcShape} outerRadius="70%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="shape" tick={{ fontSize: 11 }} />
                <Radar
                  name="题数"
                  dataKey="count"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.35}
                />
                <Tooltip formatter={(v: number) => [`${v} 题`, '题数']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {calcShape.map((s) => (
              <Badge key={s.shape} variant="warning">
                {s.shape} {s.count}
              </Badge>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* 正确率统计 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="正确率统计（本地记录）" desc={statsFile.accuracy_stats.note}>
          <div className="space-y-3">
            <div className="rounded-lg bg-secondary/60 p-4">
              <div className="flex items-end justify-between">
                <span className="text-sm text-muted-foreground">总体正确率</span>
                <span className="text-2xl font-bold tabular-nums">
                  {attempts ? `${pct(correct, attempts)}%` : '—'}
                </span>
              </div>
              <Progress className="mt-2" value={attempts ? pct(correct, attempts) : 0} />
            </div>
            {byTypeAccuracy.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">暂无作答记录</p>
            ) : (
              byTypeAccuracy.map((t) => (
                <div key={t.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{t.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {t.value}%（作答 {t.attempts} 次）
                    </span>
                  </div>
                  <Progress value={t.value} className="h-1.5" />
                </div>
              ))
            )}
          </div>
        </ChartCard>

        <ChartCard title="薄弱知识点（正确率最低 10 项）" desc="依据本地作答记录实时计算">
          {weakKp.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              还没有作答记录，去刷题页做几道题后再回来看。
            </p>
          ) : (
            <div className="space-y-2.5">
              {weakKp.map((k) => (
                <div key={k.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{k.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      正确率 {k.rate}%（错 {k.wrong} 次）
                    </span>
                  </div>
                  <Progress
                    value={k.rate}
                    className="h-1.5"
                    indicatorClassName={
                      k.rate >= 80 ? 'bg-emerald-500' : k.rate >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* 章节分布 */}
      <ChartCard title="章节题量分布（对照考纲）" desc="仅显示有真题命中的章节">
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={statsFile.by_chapter.map((c) => ({
                name: c.chapter.replace(/第(.*?)章\s*/, '$1章 '),
                value: c.count,
                full: c.chapter,
              }))}
              layout="vertical"
              margin={{ top: 4, right: 30, bottom: 4, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => [`${v} 题`, '题量']}
                labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''}
              />
              <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* 扩展题库统计（与真题口径隔离） */}
      {extStats.total_questions > 0 && (
        <ChartCard
          title="扩展题库（不与真题统计混算）"
          desc="非真题资料提取的题目；其中命中真题的已在题目卡片上标注年份与题号"
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <MiniCard
              label="扩展题总量"
              value={`${extStats.total_questions}`}
              sub="来自选择题题库与简答题资料"
            />
            <MiniCard
              label="其中真题原题"
              value={`${extStats.tagged_real_exam}`}
              sub="已标注考过的年份与题号"
            />
            <MiniCard
              label="纯补充题"
              value={`${extStats.pure_supplement}`}
              sub="非真题，用于拓展练习"
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">来源分布</p>
              <div className="space-y-2">
                {extStats.by_source.map((s, i) => (
                  <div key={s.source} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate">{s.source}</span>
                      <span className="tabular-nums text-muted-foreground">{s.count} 题</span>
                    </div>
                    <Progress
                      value={pct(s.count, extStats.total_questions)}
                      className="h-1.5"
                      indicatorClassName="bg-amber-500"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">题型分布</p>
              <div className="space-y-2">
                {extStats.by_type.map((t) => (
                  <div key={t.type} className="flex items-center justify-between text-xs">
                    <span>{t.label}</span>
                    <span className="tabular-nums text-muted-foreground">{t.count} 题</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ChartCard>
      )}
    </div>
  )
}

function MiniCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  )
}

function ChartCard({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
