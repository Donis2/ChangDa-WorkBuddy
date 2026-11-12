import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  X,
  Star,
  Eye,
  Lightbulb,
  BookmarkPlus,
  BookmarkCheck,
  Images,
  Link2,
} from 'lucide-react'
import type { AnswerVersionKey, ExtendedQuestion, ProgressRecord, Question } from '@/lib/types'
import {
  ANSWER_VERSION_LABELS,
  ANSWER_VERSION_ORDER,
  cn,
  formatAnswerValue,
  isObjective,
  typeLabel,
} from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { QuestionFigure } from '@/components/QuestionFigure'
import { KatexBlock, KatexText } from '@/components/KatexText'
import { judgeObjective } from '@/lib/quiz'
import { recordAnswer, setWrongBook, toggleFavorite } from '@/lib/storage'

const DIFF_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  简单: 'success',
  中等: 'warning',
  较难: 'destructive',
}

/** 整卷扫描答案覆盖的年份（两版并集：2009–2015、2017–2026；2016 无原卷、2023 仅考研群版） */
const ANSWER_PAGE_YEARS = new Set([
  2009, 2010, 2011, 2012, 2013, 2014, 2015,
  2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
])

/** 默认展示的答案版本：优先题面指定，否则取固定顺序里第一个有内容的 */
function defaultVersionOf(q: Question): AnswerVersionKey | null {
  const def = q.answer_version_default
  if (def && q.answer_versions?.[def]) return def
  const first = ANSWER_VERSION_ORDER.find(
    (k) => q.answer_versions?.[k as AnswerVersionKey],
  )
  return (first as AnswerVersionKey | undefined) ?? null
}

export const QuestionCard = React.memo(function QuestionCard({
  question: q,
  record,
  onAnswered,
  index,
  forceReveal,
}: {
  question: Question
  record?: ProgressRecord
  /** 带全显示模式的题目序号回传，回调引用稳定才能配合 React.memo */
  onAnswered?: (index?: number) => void
  /** 在「全部展开」模式下的序号（从 0 开始） */
  index?: number
  /** 「全部展开」模式下由上层统一控制是否直接显示答案 */
  forceReveal?: boolean
}) {
  const objective = isObjective(q.type)
  // 原 Trae 版整卷扫描答案按年份归档：为真题题目卡提供跳转年份
  // （扩展题 source_years 为空数组，find 返回 undefined，故不显示该入口）
  const answerPageYear = q.source_years.find((y) => ANSWER_PAGE_YEARS.has(Number(y)))
  const [selected, setSelected] = React.useState<string[]>([])
  const [judged, setJudged] = React.useState(false)
  const [revealed, setRevealed] = React.useState(false)
  const [selfJudged, setSelfJudged] = React.useState(false)

  /** 可用的答案版本（按固定顺序），至少 0 个 */
  const versions = React.useMemo(() => {
    const map = q.answer_versions ?? {}
    return ANSWER_VERSION_ORDER.filter((k) => Boolean(map[k as AnswerVersionKey])).map((k) => ({
      key: k as AnswerVersionKey,
      label: ANSWER_VERSION_LABELS[k] ?? k,
      ...map[k as AnswerVersionKey]!,
    }))
  }, [q])

  // 同步初始化，避免首帧先渲染顶层答案、随后跳到默认版本造成闪烁
  const [versionKey, setVersionKey] = React.useState<AnswerVersionKey | null>(
    () => defaultVersionOf(q),
  )
  React.useEffect(() => {
    setVersionKey(defaultVersionOf(q))
  }, [q])

  const activeVersion = versionKey ? q.answer_versions?.[versionKey] : undefined

  /**
   * 当前显示的答案。判分、正确选项高亮、错误提示与答案文本必须共用这一份，
   * 否则切换到「老魏版 / 考研群版」后会出现「显示 C、按 A 判分」。
   */
  const effectiveAnswer = activeVersion?.answer ?? q.answer

  /** 扩展题标注的真题来源 */
  const realRefs = (q as ExtendedQuestion).real_exam_refs ?? []

  // 展开状态在「全显示」模式下由上层 forceReveal 双向受控；未受控时由用户手动切换
  React.useEffect(() => {
    setRevealed(forceReveal ?? false)
  }, [forceReveal, q.id])

  React.useEffect(() => {
    setSelected([])
    setJudged(false)
    setSelfJudged(false)
  }, [q.id])

  const answerKeys = React.useMemo(() => {
    if (q.type === 'true_false') {
      const b = Boolean(Array.isArray(effectiveAnswer) ? effectiveAnswer[0] : effectiveAnswer)
      return [b ? 'A' : 'B']
    }
    return (Array.isArray(effectiveAnswer) ? effectiveAnswer : [effectiveAnswer]) as string[]
  }, [q.type, effectiveAnswer])

  /** 判断题选项固定 A=正确 / B=错误，把选中项转成布尔再判 */
  const judgeSelection = (sel: string[]) =>
    judgeObjective(q, q.type === 'true_false' ? sel[0] === 'A' : sel, effectiveAnswer)

  const correct = React.useMemo(() => {
    if (!judged) return null
    return judgeSelection(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [judged, selected, effectiveAnswer, q])

  function choose(key: string) {
    if (judged) return
    if (q.type === 'multiple_choice') {
      setSelected((prev) => toggle(prev, key))
      return
    }
    const next = [key]
    setSelected(next)
    if (q.type === 'single_choice' || q.type === 'true_false') {
      const ok = judgeSelection(next)
      setJudged(true)
      recordAnswer(q.id, next, ok)
      onAnswered?.(index)
    }
  }

  function submitMulti() {
    if (!selected.length) return
    const ok = judgeSelection(selected)
    setJudged(true)
    recordAnswer(q.id, selected, ok)
    onAnswered?.(index)
  }

  function reveal() {
    setRevealed(true)
    onAnswered?.(index)
  }

  function selfJudge(ok: boolean) {
    if (selfJudged) return // 防止连点重复累加 attempts / correctCount
    setSelfJudged(true)
    recordAnswer(q.id, null, ok)
    onAnswered?.(index)
  }

  const showAnswerArea = objective ? judged || revealed : revealed
  const answerText = React.useMemo(
    () => formatAnswerValue(q.type, effectiveAnswer),
    [q.type, effectiveAnswer],
  )
  const explanation = activeVersion?.explanation ?? q.explanation
  const answerImages =
    activeVersion?.answer_images?.length ? activeVersion.answer_images : q.answer_images
  const correctAnswerLabel =
    q.type === 'true_false'
      ? answerKeys.includes('A')
        ? '正确'
        : '错误'
      : answerKeys.join('、')

  return (
    <div className="space-y-4">
      {/* 题头 */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default">{typeLabel(q.type)}</Badge>
        {index !== undefined && (
          <Badge variant="outline" className="tabular-nums">
            第 {index + 1} 题
          </Badge>
        )}
        {q.source_years.map((y) => (
          <Badge key={y} variant="info">
            {y}年
          </Badge>
        ))}
        {realRefs.length > 0 && (
          <Badge
            variant="warning"
            title={realRefs.map((r) => `${r.year} 年 ${r.number}`).join('\n')}
          >
            真题原题 · {realRefs.map((r) => r.year).join('/')}
          </Badge>
        )}
        {q.difficulty && (
          <Badge variant={DIFF_VARIANT[q.difficulty] ?? 'secondary'}>{q.difficulty}</Badge>
        )}
        {q.score ? <Badge variant="outline">{q.score} 分</Badge> : null}
        {q.tags.map((t) => (
          <Badge key={t} variant="purple">
            {t}
          </Badge>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleFavorite(q.id)}
            title="收藏本题"
          >
            <Star
              className={cn(
                'h-4 w-4',
                record?.favorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground',
              )}
            />
          </Button>
        </div>
      </div>

      {/* 题干 */}
      <div className="text-[15px] leading-relaxed text-foreground">
        <span className="mr-2 font-semibold text-primary">{q.id}</span>
        <KatexText text={q.stem} />
      </div>

      {/* 题图：同时存在题库版与原卷版时只显示一套，可手动切换 */}
      {q.images.length > 0 && <QuestionFigure sources={q.images} id={q.id} />}

      {/* 选项 / 填空提示 */}
      {q.options.length > 0 && (
        <div className="space-y-2">
          {q.options.map((opt) => {
            const isSel = selected.includes(opt.key)
            const isRight = answerKeys.includes(opt.key)
            const state = !judged
              ? isSel
                ? 'selected'
                : 'idle'
              : isRight
                ? 'right'
                : isSel
                  ? 'wrong'
                  : 'idle'
            return (
              <button
                key={opt.key}
                onClick={() => choose(opt.key)}
                disabled={judged}
                className={cn(
                  'flex w-full items-start gap-3 rounded-md border px-3.5 py-2.5 text-left text-sm transition-colors',
                  state === 'idle' && 'hover:border-primary/50 hover:bg-accent',
                  state === 'selected' && 'border-primary bg-primary/5',
                  state === 'right' && 'border-emerald-400 bg-emerald-50',
                  state === 'wrong' && 'border-rose-400 bg-rose-50',
                  judged && 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    state === 'idle' && 'border-muted-foreground/40 text-muted-foreground',
                    state === 'selected' && 'border-primary bg-primary text-primary-foreground',
                    state === 'right' && 'border-emerald-500 bg-emerald-500 text-white',
                    state === 'wrong' && 'border-rose-500 bg-rose-500 text-white',
                  )}
                >
                  {state === 'right' ? (
                    <Check className="h-3 w-3" />
                  ) : state === 'wrong' ? (
                    <X className="h-3 w-3" />
                  ) : (
                    opt.key
                  )}
                </span>
                <span className="flex-1">
                  <KatexText text={opt.text} />
                </span>
              </button>
            )
          })}
          {q.type === 'multiple_choice' && !judged && (
            <Button size="sm" onClick={submitMulti} disabled={!selected.length}>
              提交答案
            </Button>
          )}
          {correct !== null && (
            <p
              className={cn(
                'text-sm font-medium',
                correct ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {correct ? '✓ 回答正确' : `✗ 回答错误，正确答案：${correctAnswerLabel}`}
            </p>
          )}
        </div>
      )}

      {/* 操作区：错题本按钮常驻；主观题额外提供「显示答案 / 自评」 */}
      <div className="flex flex-wrap items-center gap-2">
        {!objective &&
          (!revealed ? (
            <Button onClick={reveal}>
              <Eye className="mr-1 h-4 w-4" /> 显示答案
            </Button>
          ) : selfJudged ? (
            <span className="text-sm text-muted-foreground">✓ 已记录自评结果</span>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">自评：</span>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() => selfJudge(true)}
              >
                <Check className="mr-1 h-4 w-4" /> 我答对了
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-rose-300 text-rose-700 hover:bg-rose-50"
                onClick={() => selfJudge(false)}
              >
                <X className="mr-1 h-4 w-4" /> 我答错了
              </Button>
            </>
          ))}
        <WrongBookButton questionId={q.id} record={record} />
        {answerPageYear !== undefined && (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/answers?year=${answerPageYear}`} title={`查看 ${answerPageYear} 年整卷扫描答案`}>
              <Images className="mr-1 h-4 w-4" /> 查看整卷扫描答案
            </Link>
          </Button>
        )}
      </div>

      {/* 答案与解析 */}
      {showAnswerArea && (
        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                <Lightbulb className="h-4 w-4" /> 参考答案
              </span>
              {versions.length > 0 && (
                <div className="ml-auto flex flex-wrap items-center gap-1">
                  {versions.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => setVersionKey(v.key)}
                      title={v.source || v.label}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs transition-colors',
                        versionKey === v.key
                          ? 'border-primary bg-primary font-medium text-primary-foreground'
                          : 'text-muted-foreground hover:border-primary/40 hover:bg-accent',
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {activeVersion?.source && (
              <p className="mb-1 text-xs text-muted-foreground">
                来源：{activeVersion.source}
                {activeVersion.quality ? `（${activeVersion.quality}）` : ''}
              </p>
            )}
            {judged && versions.length > 1 && (
              <p className="mb-1 text-xs text-muted-foreground">
                判分与正确答案按当前版本计算；已记录的答题进度、错题本不随版本切换改变。
              </p>
            )}
            {answerText.trim() ? (
              <KatexBlock text={answerText} className="text-sm text-foreground" />
            ) : (
              <p className="text-sm italic text-muted-foreground">
                本题参考答案暂缺（原卷答案未收录该题解答），后续补齐后会自动显示。
              </p>
            )}
          </div>

          {answerImages?.length > 0 && (
            <QuestionFigure sources={answerImages} id={q.id} kind="answer" />
          )}

          {explanation && (
            <div className="border-t border-primary/15 pt-3">
              <div className="mb-1 text-sm font-semibold text-primary">解析 / 考点</div>
              <KatexBlock text={explanation} className="text-sm text-muted-foreground" />
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 border-t border-primary/15 pt-3">
            {q.knowledge_points.map((kp) => (
              <Badge key={kp} variant="secondary">
                {kp}
              </Badge>
            ))}
            {q.chapter && <Badge variant="outline">{q.chapter}</Badge>}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {Object.keys(q.original_numbers || {}).length > 0 && (
              <span className="flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                题号来源：
                {Object.entries(q.original_numbers)
                  .map(([y, n]) => `${y}年 ${n}`)
                  .join('；')}
              </span>
            )}
            {realRefs.length > 0 && (
              <span className="flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                真题出处：
                {realRefs.map((r) => `${r.year}年 ${r.number}`).join('；')}
              </span>
            )}
            {'is_extended' in q && (q as ExtendedQuestion).source_book && (
              <span>扩展题来源：{(q as ExtendedQuestion).source_book}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

function WrongBookButton({
  questionId,
  record,
}: {
  questionId: string
  record?: ProgressRecord
}) {
  const inBook = record?.inWrongBook ?? false
  return (
    <Button
      size="sm"
      variant={inBook ? 'secondary' : 'outline'}
      onClick={() => setWrongBook(questionId, !inBook)}
    >
      {inBook ? (
        <>
          <BookmarkCheck className="mr-1 h-4 w-4 text-rose-500" /> 已加入错题本（点击移除）
        </>
      ) : (
        <>
          <BookmarkPlus className="mr-1 h-4 w-4" /> 加入错题本
        </>
      )}
    </Button>
  )
}

function toggle(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}
