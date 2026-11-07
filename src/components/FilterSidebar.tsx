import * as React from 'react'
import { RotateCcw, Search, Filter, ChevronDown } from 'lucide-react'
import { knowledgeTree } from '@/lib/data'
import { subKnowledgeTree, SUB_TOTAL_POINTS, SUB_TOTAL_CHAPTERS } from '@/lib/subKnowledgeData'
import type { ProgressMap, SessionState } from '@/lib/storage'
import type { Question } from '@/lib/types'
import { TYPE_ORDER, cn, typeLabel } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** 计数按「当前题库」算，切到扩展题库时不能再显示真题的年份与题型口径 */
function useCounts(pool: Question[]) {
  return React.useMemo(() => {
    const byType: Record<string, number> = {}
    const byYear: Record<string, number> = {}
    const byKp: Record<string, number> = {}
    // 先把全部细分知识点码预置为 0：切换扩展题库时（无题带 sub_knowledge）
    // 仍能命中该 key 并显示 0，而不是回退到树里的静态题量。
    const bySubKp: Record<string, number> = {}
    for (const ch of subKnowledgeTree.chapters) {
      for (const p of ch.points) bySubKp[p.code] = 0
    }
    for (const q of pool) {
      byType[q.type] = (byType[q.type] ?? 0) + 1
      for (const y of q.source_years) byYear[y] = (byYear[y] ?? 0) + 1
      for (const k of q.knowledge_points) byKp[k] = (byKp[k] ?? 0) + 1
      for (const c of q.sub_knowledge ?? []) bySubKp[c] = (bySubKp[c] ?? 0) + 1
    }
    return { byType, byYear, byKp, bySubKp }
  }, [pool])
}

export function FilterSidebar({
  session,
  patch,
  onReset,
  progress,
  pool,
}: {
  session: SessionState
  patch: (p: Partial<SessionState>) => void
  onReset: () => void
  progress: ProgressMap
  /** 当前题库的题目池（真题 / 扩展题 / 全部） */
  pool: Question[]
}) {
  const counts = useCounts(pool)
  const [kpQuery, setKpQuery] = React.useState('')
  const [subQuery, setSubQuery] = React.useState<string>('')
  const [openChapters, setOpenChapters] = React.useState<string[]>([])

  const wrongCount = React.useMemo(
    () => Object.values(progress).filter((r) => r.inWrongBook).length,
    [progress],
  )
  const favCount = React.useMemo(
    () => Object.values(progress).filter((r) => r.favorite).length,
    [progress],
  )

  const years = React.useMemo(
    () => Array.from(new Set(pool.flatMap((q) => q.source_years))).sort((a, b) => a - b),
    [pool],
  )

  const filteredChapters = React.useMemo(() => {
    if (!kpQuery.trim()) return knowledgeTree.chapters
    const kw = kpQuery.trim()
    return knowledgeTree.chapters
      .map((ch) => ({
        ...ch,
        points: ch.points.filter(
          (p) => p.name.includes(kw) || ch.name.includes(kw),
        ),
      }))
      .filter((ch) => ch.points.length > 0)
  }, [kpQuery])

  /** 当前题库是否根本没有带细分知识点标注的题目（即纯扩展题库） */
  const noSubInPool = React.useMemo(
    () => !pool.some((q) => (q.sub_knowledge ?? []).length > 0),
    [pool],
  )

  /** 按章分组 + 按 name / code / 章 name 搜索过滤后的细分知识点 */
  const filteredSubChapters = React.useMemo(() => {
    const kw = subQuery.trim()
    if (!kw) return subKnowledgeTree.chapters
    return subKnowledgeTree.chapters
      .map((ch) => ({
        ...ch,
        points: ch.points.filter(
          (p) => p.name.includes(kw) || p.code.includes(kw) || ch.name.includes(kw),
        ),
      }))
      .filter((ch) => ch.points.length > 0)
  }, [subQuery])

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4" /> 筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 错题 / 收藏 */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => patch({ wrongOnly: !session.wrongOnly, favoriteOnly: false, index: 0 })}
              className={cn(
                'rounded-md border px-2 py-2 text-xs font-medium shadow-sm transition-colors',
                session.wrongOnly
                  ? 'border-rose-400 bg-rose-50 text-rose-700'
                  : 'hover:bg-accent',
              )}
            >
              错题本 {wrongCount}
            </button>
            <button
              onClick={() => patch({ favoriteOnly: !session.favoriteOnly, wrongOnly: false, index: 0 })}
              className={cn(
                'rounded-md border px-2 py-2 text-xs font-medium shadow-sm transition-colors',
                session.favoriteOnly
                  ? 'border-amber-400 bg-amber-50 text-amber-700'
                  : 'hover:bg-accent',
              )}
            >
              收藏 {favCount}
            </button>
          </div>

          {/* 年份 */}
          <Section title="年份">
            <div className="flex flex-wrap gap-1.5">
              {years.map((y) => (
                <Chip
                  key={y}
                  active={session.yearFilter.includes(y)}
                  onClick={() =>
                    patch({ yearFilter: toggle(session.yearFilter, y), index: 0 })
                  }
                >
                  {y}年 <span className="opacity-60">{counts.byYear[y] ?? 0}</span>
                </Chip>
              ))}
            </div>
          </Section>

          {/* 题型 */}
          <Section title="题型">
            <div className="flex flex-wrap gap-1.5">
              {TYPE_ORDER.filter((t) => counts.byType[t]).map((t) => (
                <Chip
                  key={t}
                  active={session.typeFilter.includes(t)}
                  onClick={() =>
                    patch({ typeFilter: toggle(session.typeFilter, t), index: 0 })
                  }
                >
                  {typeLabel(t)} <span className="opacity-60">{counts.byType[t]}</span>
                </Chip>
              ))}
            </div>
          </Section>

          <Button variant="ghost" size="sm" className="w-full" onClick={onReset}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> 清空筛选
          </Button>
        </CardContent>
      </Card>

      {/* 知识点 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">
              知识点（按考纲章节）
              {(session.chapterFilter.length > 0 || session.kpFilter.length > 0) && (
                <span className="ml-2 text-xs font-normal text-primary">
                  已选 {session.chapterFilter.length + session.kpFilter.length}
                </span>
              )}
            </CardTitle>
            {/* 「筛选」：勾选 = 同一维度内可多选（并集）；章节与知识点之间始终是交集 */}
            <label
              className="flex shrink-0 cursor-pointer select-none items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:font-medium has-[:checked]:text-primary"
              title={
                session.multiSelect
                  ? '多选模式：同一维度内可多选（并集）；章节与知识点之间需同时满足'
                  : '单选模式：点新的章节 / 知识点会替换上一个'
              }
            >
              <input
                type="checkbox"
                className="h-3 w-3 cursor-pointer accent-[hsl(var(--primary))]"
                checked={session.multiSelect}
                onChange={(e) => patch({ multiSelect: e.target.checked, index: 0 })}
              />
              筛选
            </label>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            点<b className="font-medium text-foreground">章节名</b>=看本章全部题目；
            再点<b className="font-medium text-foreground">知识点</b>=只看该知识点。
            {session.multiSelect ? (
              <>
                已勾选「筛选」：同一维度可<b className="font-medium text-foreground">多选（并集）</b>，
                章节与知识点之间需同时满足。
              </>
            ) : (
              <>
                默认<b className="font-medium text-foreground">单选</b>，再点会替换上一个；勾选「筛选」可多选。
              </>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={kpQuery}
              onChange={(e) => setKpQuery(e.target.value)}
              placeholder="搜索知识点 / 章节"
              className="h-9 w-full rounded-md border border-input bg-background pl-7 pr-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {(session.chapterFilter.length > 0 || session.kpFilter.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {session.chapterFilter.map((ch) => (
                <Badge
                  key={ch}
                  variant="purple"
                  className="cursor-pointer"
                  onClick={() =>
                    patch({ chapterFilter: session.chapterFilter.filter((x) => x !== ch), index: 0 })
                  }
                >
                  {ch} ✕
                </Badge>
              ))}
              {session.kpFilter.map((k) => (
                <Badge
                  key={k}
                  variant="info"
                  className="cursor-pointer"
                  onClick={() =>
                    patch({ kpFilter: session.kpFilter.filter((x) => x !== k), index: 0 })
                  }
                >
                  {k} ✕
                </Badge>
              ))}
            </div>
          )}

          <div className="max-h-[380px] space-y-1 overflow-y-auto pr-1">
            {filteredChapters.map((ch) => {
              const chSelected = session.chapterFilter.includes(ch.name)
              const open = openChapters.includes(ch.id) || !!kpQuery.trim()
              const selectedInCh = ch.points.filter((p) =>
                session.kpFilter.includes(p.name),
              ).length
              return (
                <div
                  key={ch.id}
                  className={cn(
                    'rounded-md border',
                    chSelected && 'border-primary/60 bg-primary/5',
                  )}
                >
                  <div className="flex items-stretch">
                    {/* 章节名：点击 = 筛选本章全部题目（同时展开知识点便于继续细化） */}
                    <button
                      className={cn(
                        'flex flex-1 items-center gap-2 px-2.5 py-2 text-left text-xs font-medium hover:bg-accent',
                        chSelected && 'text-primary',
                      )}
                      aria-pressed={chSelected}
                      title={chSelected ? '取消本章筛选' : `显示「${ch.name}」全部 ${ch.questionCount} 题`}
                      onClick={() => {
                        // 单选（未勾「筛选」）：本章已在筛选里就取消（回到全部），否则只留本章
                        const next = session.multiSelect
                          ? toggle(session.chapterFilter, ch.name)
                          : singlePick(session.chapterFilter, ch.name)
                        patch({
                          chapterFilter: next,
                          // 单选下切章即「看本章全部」，清掉上一章残留的知识点避免空结果
                          kpFilter: session.multiSelect ? session.kpFilter : [],
                          index: 0,
                        })
                        setOpenChapters((prev) =>
                          next.includes(ch.name)
                            ? prev.includes(ch.id)
                              ? prev
                              : [...prev, ch.id]
                            : prev,
                        )
                      }}
                    >
                      <span className="flex-1">{ch.name}</span>
                      {selectedInCh > 0 && <Badge variant="info">{selectedInCh}</Badge>}
                      <Badge variant={ch.questionCount ? 'secondary' : 'outline'}>
                        {ch.questionCount}
                      </Badge>
                    </button>
                    {/* 箭头：仅展开 / 收起知识点，不改变筛选 */}
                    <button
                      aria-label={`${open ? '收起' : '展开'}「${ch.name}」的知识点`}
                      aria-expanded={open}
                      className="shrink-0 border-l px-1.5 text-muted-foreground hover:bg-accent"
                      onClick={() =>
                        setOpenChapters((prev) =>
                          prev.includes(ch.id)
                            ? prev.filter((x) => x !== ch.id)
                            : [...prev, ch.id],
                        )
                      }
                    >
                      <ChevronDown
                        className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
                      />
                    </button>
                  </div>
                  {open && ch.points.length > 0 && (
                    <div className="space-y-0.5 border-t px-1.5 py-1.5">
                      {ch.points.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (session.multiSelect) {
                              // 多选：叠加 / 取消该知识点
                              patch({
                                kpFilter: toggle(session.kpFilter, p.name),
                                index: 0,
                              })
                            } else if (
                              session.kpFilter.length === 1 &&
                              session.kpFilter[0] === p.name
                            ) {
                              // 单选下再点一次 = 取消该知识点，退回本章全部
                              patch({
                                kpFilter: [],
                                chapterFilter: [ch.name],
                                index: 0,
                              })
                            } else {
                              // 单选：只看该知识点（替换上一个）
                              patch({
                                kpFilter: [p.name],
                                chapterFilter: [],
                                index: 0,
                              })
                            }
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs',
                            session.kpFilter.includes(p.name)
                              ? 'bg-primary/10 font-medium text-primary'
                              : 'hover:bg-accent',
                            p.questionCount === 0 && 'opacity-60',
                          )}
                        >
                          <span className="flex-1">{p.name}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {p.questionCount}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 细分知识点（Trae 版 A–O 15 章 / 64 点） */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              细分知识点（Trae 版）
              <Badge variant="secondary" className="text-[10px]">
                {SUB_TOTAL_CHAPTERS} 章 / {SUB_TOTAL_POINTS} 点
              </Badge>
            </CardTitle>
            {session.subKpFilter.length > 0 && (
              <span className="shrink-0 text-xs font-normal text-primary">
                已选 {session.subKpFilter.length}
              </span>
            )}
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            与考纲章节并存的另一套细分体系，来自 Trae 版逐题标注；点击知识点码筛选，可多选（并集）。扩展题未标注细分知识点。
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {noSubInPool && (
            <p className="text-[11px] text-muted-foreground">
              当前为扩展题库，真题的细分知识点标注不适用
            </p>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={subQuery}
              onChange={(e) => setSubQuery(e.target.value)}
              placeholder="搜索细分知识点码 / 名称 / 章名"
              className="h-9 w-full rounded-md border border-input bg-background pl-7 pr-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {session.subKpFilter.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {session.subKpFilter.map((code) => (
                <Badge
                  key={code}
                  variant="info"
                  className="cursor-pointer"
                  onClick={() =>
                    patch({
                      subKpFilter: session.subKpFilter.filter((x) => x !== code),
                      index: 0,
                    })
                  }
                >
                  {code} ✕
                </Badge>
              ))}
            </div>
          )}

          <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
            {filteredSubChapters.map((ch) => (
              <div key={ch.code}>
                <div className="flex items-center gap-2 py-1 text-xs font-medium text-muted-foreground">
                  <span>{ch.code} · {ch.name}</span>
                  <Badge variant="outline" className="text-[10px]">{ch.questionCount}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {ch.points.map((p) => {
                    const count = counts.bySubKp[p.code] ?? p.questionCount
                    const active = session.subKpFilter.includes(p.code)
                    return (
                      <Chip
                        key={p.code}
                        active={active}
                        onClick={() =>
                          patch({
                            subKpFilter: toggle(session.subKpFilter, p.code),
                            index: 0,
                          })
                        }
                      >
                        {p.code} {p.name} · {count}
                      </Chip>
                    )
                  })}
                </div>
              </div>
            ))}
            {filteredSubChapters.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                无匹配的细分知识点
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-muted-foreground">{title}</div>
      {children}
    </div>
  )
}

function Chip({
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
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-[11px] shadow-sm transition-colors sm:text-xs',
        active
          ? 'border-primary bg-primary/10 font-medium text-primary'
          : 'hover:border-primary/40 hover:bg-accent',
      )}
    >
      {children}
    </button>
  )
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

/** 单选：点新的替换旧的；再点同一个（当前唯一选中）则取消 */
function singlePick(arr: string[], v: string): string[] {
  return arr.length === 1 && arr[0] === v ? [] : [v]
}
