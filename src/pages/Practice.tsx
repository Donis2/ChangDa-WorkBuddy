import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Shuffle, ListOrdered, Sparkles, Star, AlertCircle, Layers, Square, Eye, EyeOff, ArrowUp, X, SlidersHorizontal } from 'lucide-react'
import { questions } from '@/lib/questionData'
import { extMeta } from '@/lib/extMeta'
import type { ExtendedQuestion, Question } from '@/lib/types'
import { filterQuestions, modeLabel } from '@/lib/quiz'
import {
  defaultSession,
  loadSession,
  saveSession,
  useProgress,
  type SessionState,
} from '@/lib/storage'
import { cn, typeLabel } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FilterSidebar } from '@/components/FilterSidebar'
import { QuestionCard } from '@/components/QuestionCard'
import { AnswerSheet } from '@/components/AnswerSheet'
import { StatsPanel } from '@/components/StatsPanel'

/** 全显示模式每页题目数：避免一次渲染 956 张卡、数千次公式解析 */
const PAGE_SIZE = 20

export function Practice() {
  const progress = useProgress()
  const [params, setParams] = useSearchParams()
  const [session, setSession] = React.useState<SessionState>(() => loadSession())
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  // 记住已处理过的查询串，而不是布尔锁：同一实例内前进/后退再次带参跳转仍能生效
  const appliedSearchRef = React.useRef<string | null>(null)

  // 会话统一在 effect 里持久化，避免 StrictMode 下 setState updater 被双调用产生重复副作用
  React.useEffect(() => {
    saveSession(session)
  }, [session])

  // 从首页入口跳转时带上筛选参数
  React.useEffect(() => {
    const search = params.toString()
    if (!search || appliedSearchRef.current === search) return
    appliedSearchRef.current = search
    const year = params.get('year')
    const type = params.get('type')
    const kp = params.get('kp')
    const chapter = params.get('chapter')
    const mode = params.get('mode')
    const bank = params.get('bank')
    // 沿用当前的显示方式（单题 / 全显示），只替换筛选条件
    setSession((prev) => {
      const next: SessionState = {
        ...defaultSession,
        view: prev.view,
        revealAll: prev.revealAll,
        multiSelect: prev.multiSelect,
        // 首页入口都是真题维度。不沿用 localStorage 里上次的扩展题库：
        // 585 道扩展题中 470 道没有 source_years，带年份进入会得到空列表。
        bank: 'real',
      }
      if (bank === 'ext' || bank === 'all' || bank === 'real') next.bank = bank
      if (year) next.yearFilter = year.split(',').map(Number)
      if (type) next.typeFilter = type.split(',')
      if (chapter) next.chapterFilter = chapter.split(',')
      if (kp) next.kpFilter = kp.split(',')
      if (mode === 'wrong') next.wrongOnly = true
      if (mode === 'favorite') next.favoriteOnly = true
      if (mode === 'random') next.order = 'random'
      return next
    })
    setParams({}, { replace: true })
    appliedSearchRef.current = null
  }, [params, setParams])

  const patch = React.useCallback((p: Partial<SessionState>) => {
    setSession((prev) => ({ ...prev, ...p }))
  }, [])

  // 稳定引用：配合 QuestionCard 的 React.memo，答一题不再让整页卡片重渲染
  const handleAnswered = React.useCallback(
    (i?: number) => {
      if (i !== undefined) patch({ index: i })
    },
    [patch],
  )

  // 扩展题 777KB 只在用户切到「扩展题 / 全部」时动态加载；默认真题库完全不下载
  const needExt = session.bank !== 'real'
  const [extQuestions, setExtQuestions] = React.useState<ExtendedQuestion[] | null>(null)
  React.useEffect(() => {
    if (!needExt || extQuestions) return
    let alive = true
    void import('@/lib/extData').then((m) => {
      if (alive) setExtQuestions(m.extendedQuestions)
    })
    return () => { alive = false }
  }, [needExt, extQuestions])
  const extLoading = needExt && !extQuestions

  const pool: Question[] = React.useMemo(() => {
    if (!needExt) return questions
    if (!extQuestions) return []
    return session.bank === 'ext' ? extQuestions : [...extQuestions, ...questions]
  }, [needExt, extQuestions, session.bank])

  const list = React.useMemo(
    () => filterQuestions(session, progress, pool),
    [session, progress, pool],
  )

  const index = Math.min(session.index, Math.max(0, list.length - 1))
  const current = list[index]
  const isAll = session.view === 'all'

  // 全显示模式分页；筛选条件变化时回到第一页（不要依赖整个 session，
  // 否则每答一题 patch(index) 都会把用户踢回第一页）
  const [page, setPage] = React.useState(0)
  const filterKey = [
    session.bank,
    session.yearFilter.join(','),
    session.typeFilter.join(','),
    session.chapterFilter.join(','),
    session.kpFilter.join(','),
    session.order,
    session.wrongOnly,
    session.favoriteOnly,
  ].join('|')
  React.useEffect(() => { setPage(0) }, [filterKey])
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const visibleList = React.useMemo(
    () => (isAll ? list.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE) : list),
    [isAll, list, safePage],
  )

  React.useEffect(() => {
    if (index !== session.index) patch({ index })
  }, [index, session.index, patch])

  const jump = (i: number) => {
    const target = Math.max(0, Math.min(list.length - 1, i))
    patch({ index: target })
    if (session.view === 'all') {
      setPage(Math.floor(target / PAGE_SIZE))
      // 跨页跳转时目标卡片要等新页渲染出来才存在，延后一帧再滚动
      window.setTimeout(() => {
        const el = document.getElementById(`q-${list[target]?.id}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // 手机筛选抽屉：打开时锁住背景滚动，支持 Esc 关闭
  React.useEffect(() => {
    if (!drawerOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  return (
    <div className={cn('space-y-4', !isAll && 'pb-24 lg:pb-0')}>
      {/* 顶部模式条：第一行状态 + 视图切换，第二行可横向滚动的快捷按钮 */}
      <div className="sticky top-14 z-20 -mx-3 border-b bg-background/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="shrink-0 text-xs">
            {modeLabel(session)}
          </Badge>
          {session.bank !== 'real' && (
            <Badge variant="warning" className="shrink-0 text-xs">
              {session.bank === 'ext' ? '扩展题库' : '真题+扩展'}
            </Badge>
          )}
          {extLoading && (
            <Badge variant="outline" className="shrink-0 text-xs">
              扩展题库加载中…
            </Badge>
          )}
          <span className="shrink-0 text-sm text-muted-foreground">
            {isAll ? (
              <>
                共 <span className="font-semibold text-foreground tabular-nums">{list.length}</span> 题（全部展开）
              </>
            ) : (
              <>
                第{' '}
                <span className="font-semibold text-foreground tabular-nums">
                  {list.length ? index + 1 : 0}
                </span>{' '}
                / {list.length} 题
              </>
            )}
          </span>

          {/* 手机：打开筛选抽屉 */}
          <button
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-label="打开筛选"
            className="ml-auto flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent lg:hidden"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /> 筛选
            {(session.yearFilter.length + session.typeFilter.length + session.chapterFilter.length + session.kpFilter.length) > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {session.yearFilter.length + session.typeFilter.length + session.chapterFilter.length + session.kpFilter.length}
              </span>
            )}
          </button>

          {/* 桌面：上一题 / 下一题 */}
          {!isAll && (
            <div className="ml-auto hidden items-center gap-1 lg:flex">
              <Button variant="outline" size="sm" onClick={() => jump(index - 1)} disabled={index <= 0}>
                <ChevronLeft className="mr-0.5 h-4 w-4" /> 上一题
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => jump(index + 1)}
                disabled={index >= list.length - 1}
              >
                下一题 <ChevronRight className="ml-0.5 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* 第二行：快捷按钮，手机/窄屏横向滚动，桌面自动换行 */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-visible">
          {/* 题库切换：真题 / 扩展题 / 全部 */}
          <div className="flex shrink-0 items-center gap-1 rounded-full border p-0.5">
            {(
              [
                { k: 'real', label: '真题', title: `真题 ${questions.length} 题` },
                { k: 'ext', label: '扩展题', title: `扩展题 ${extMeta.total_questions} 题` },
                { k: 'all', label: '全部', title: `真题 + 扩展题 共 ${questions.length + extMeta.total_questions} 题` },
              ] as const
            ).map(({ k, label, title }) => (
              <button
                key={k}
                title={title}
                onClick={() =>
                  patch({
                    bank: k,
                    index: 0,
                    wrongOnly: false,
                    favoriteOnly: false,
                    // 两个题库的年份/题型/知识点集合不同，残留筛选叠加必然出空结果
                    yearFilter: [],
                    typeFilter: [],
                    chapterFilter: [],
                    kpFilter: [],
                  })
                }
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs transition-colors',
                  session.bank === k
                    ? 'bg-primary font-medium text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Preset
            icon={<ListOrdered className="h-3.5 w-3.5" />}
            label="顺序练习"
            active={!session.order || (session.order === 'order' && !session.wrongOnly && !session.favoriteOnly)}
            onClick={() =>
              patch({
                ...defaultSession,
                order: 'order',
                index: 0,
                view: session.view,
                multiSelect: session.multiSelect,
                bank: session.bank,
              })
            }
          />
          <Preset
            icon={<Shuffle className="h-3.5 w-3.5" />}
            label="随机练习"
            active={session.order === 'random'}
            onClick={() => patch({ order: 'random', index: 0 })}
          />
          <Preset
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            label="错题重做"
            active={session.wrongOnly}
            onClick={() => patch({ wrongOnly: true, favoriteOnly: false, index: 0 })}
          />
          <Preset
            icon={<Star className="h-3.5 w-3.5" />}
            label="我的收藏"
            active={session.favoriteOnly}
            onClick={() => patch({ favoriteOnly: true, wrongOnly: false, index: 0 })}
          />
          <Preset
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="按题型"
            active={session.typeFilter.length > 0}
            onClick={() => patch({ typeFilter: ['single_choice'], index: 0 })}
          />

          {/* 显示方式切换 */}
          <div className="flex shrink-0 items-center gap-1 rounded-full border p-0.5">
            <button
              onClick={() => patch({ view: 'single', revealAll: false })}
              className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors',
                !isAll ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
              )}
              title="一次只看一题"
            >
              <Square className="h-3.5 w-3.5" /> 单题模式
            </button>
            <button
              onClick={() => patch({ view: 'all' })}
              className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors',
                isAll ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
              )}
              title="本页列出全部题目"
            >
              <Layers className="h-3.5 w-3.5" /> 全显示
            </button>
          </div>

          {isAll && (
            <button
              onClick={() => patch({ revealAll: !session.revealAll })}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
                session.revealAll
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:border-primary/40 hover:bg-accent',
              )}
            >
              {session.revealAll ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> 隐藏全部答案
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" /> 显示全部答案
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 手机：筛选抽屉 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="筛选条件">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">筛选条件</span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="关闭筛选"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <FilterSidebar
                session={session}
                patch={patch}
                progress={progress}
                pool={pool}
                onReset={() => patch({ ...defaultSession, bank: session.bank, view: session.view, multiSelect: session.multiSelect })}
              />
            </div>
            <div className="border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button className="w-full" onClick={() => setDrawerOpen(false)}>
                查看 {list.length} 题
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* 左：筛选（桌面侧栏；手机走抽屉） */}
        <aside className="hidden lg:order-1 lg:block">
          <FilterSidebar
            session={session}
            patch={patch}
            progress={progress}
            pool={pool}
            onReset={() => patch({ ...defaultSession, bank: session.bank, view: session.view, multiSelect: session.multiSelect })}
          />
        </aside>

        {/* 中：题目 */}
        <section className="order-1 lg:order-2">
          {isAll ? (
            list.length ? (
              <div className="space-y-3">
                {visibleList.map((q, i) => {
                  const globalIndex = safePage * PAGE_SIZE + i
                  return (
                    <div
                      key={q.id}
                      id={`q-${q.id}`}
                      className={cn(
                        'scroll-mt-32 rounded-lg border bg-card p-4 shadow-sm transition-shadow sm:scroll-mt-28 sm:p-5',
                        globalIndex === index && 'ring-2 ring-primary/40',
                      )}
                    >
                      <QuestionCard
                        question={q}
                        record={progress[q.id]}
                        index={globalIndex}
                        forceReveal={session.revealAll}
                        onAnswered={handleAnswered}
                      />
                    </div>
                  )
                })}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 0}
                      onClick={() => { setPage(safePage - 1); window.scrollTo({ top: 0 }) }}
                    >
                      <ChevronLeft className="mr-0.5 h-4 w-4" /> 上一页
                    </Button>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      第 {safePage + 1} / {totalPages} 页 · 共 {list.length} 题
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages - 1}
                      onClick={() => { setPage(safePage + 1); window.scrollTo({ top: 0 }) }}
                    >
                      下一页 <ChevronRight className="ml-0.5 h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center justify-between pb-2 text-xs text-muted-foreground">
                  <span>—— 本页 {visibleList.length} 题 / 共 {list.length} 题 ——</span>
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <ArrowUp className="h-3.5 w-3.5" /> 回到顶部
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState session={session} onReset={() => patch({ ...defaultSession, bank: session.bank, view: session.view, multiSelect: session.multiSelect })} />
            )
          ) : current ? (
            <>
              <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
                <QuestionCard
                  key={current.id}
                  question={current}
                  record={progress[current.id]}
                />
              </div>

              {list.length > 1 && (
                <div className="mt-3 hidden items-center justify-between lg:flex">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => jump(index - 1)}
                    disabled={index <= 0}
                  >
                    <ChevronLeft className="mr-0.5 h-4 w-4" /> 上一题
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {current.source_years.map((y) => `${y}年`).join(' / ')} ·{' '}
                    {typeLabel(current.type)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => jump(index + 1)}
                    disabled={index >= list.length - 1}
                  >
                    下一题 <ChevronRight className="ml-0.5 h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <EmptyState session={session} onReset={() => patch({ ...defaultSession, bank: session.bank, view: session.view, multiSelect: session.multiSelect })} />
          )}
        </section>

        {/* 右：答题卡 + 统计（手机上排在题目下方） */}
        <aside className="order-2 space-y-3 lg:order-3">
          <AnswerSheet
            list={list}
            currentIndex={index}
            progress={progress}
            onJump={jump}
          />
          <StatsPanel
            list={list}
            allAnswered={pool}
            progress={progress}
            currentIndex={index}
            session={session}
          />
        </aside>
      </div>

      {/* 手机：底部翻页条 */}
      {!isAll && current && list.length > 1 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-2">
            <Button
              variant="outline"
              className="h-10 flex-1"
              onClick={() => jump(index - 1)}
              disabled={index <= 0}
            >
              <ChevronLeft className="mr-0.5 h-4 w-4" /> 上一题
            </Button>
            <span className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground">
              {index + 1}/{list.length}
            </span>
            <Button
              variant="outline"
              className="h-10 flex-1"
              onClick={() => jump(index + 1)}
              disabled={index >= list.length - 1}
            >
              下一题 <ChevronRight className="ml-0.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({
  session,
  onReset,
}: {
  session: SessionState
  onReset: () => void
}) {
  return (
    <div className="rounded-lg border bg-card p-10 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">
        {session.wrongOnly
          ? '错题本还是空的 —— 去刷题吧，答错的题会自动收进这里。'
          : session.favoriteOnly
            ? '还没有收藏任何题目，点击题目右上角的 ★ 即可收藏。'
            : '当前筛选条件下没有题目，试试放宽筛选。'}
      </p>
      <Button className="mt-4" variant="outline" onClick={onReset}>
        重置筛选
      </Button>
    </div>
  )
}

function Preset({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-primary bg-primary/10 font-medium text-primary'
          : 'text-muted-foreground hover:border-primary/40 hover:bg-accent',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
