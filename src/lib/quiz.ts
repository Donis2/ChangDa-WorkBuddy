import { kpToChapter } from './data'
import type { ProgressMap, SessionState } from './storage'
import type { Question } from './types'

/**
 * 章节归属判定：题目的主章节命中，或其任一知识点所属章节命中。
 * 与 scripts/build_data.py 中章节题量的统计口径保持一致（跨章综合题会在多章计入）。
 */
export function inChapter(q: Question, chapter: string): boolean {
  if (q.chapter === chapter) return true
  return q.knowledge_points.some((k) => kpToChapter[k] === chapter)
}

/**
 * 客观题判分：选择 / 多选 / 判断。
 *
 * `answer` 传入「当前正在显示的答案版本」，不传则用题面默认答案。
 * 答案版本切换时判分、正确选项高亮与错误提示必须共用同一份答案，
 * 否则会出现「参考答案显示 C、却按 A 判分」。
 *
 * 判断题的选项固定为 A=正确 / B=错误，题库答案存的是布尔值；
 * 这里统一把选中项映射成布尔再比，避免 `Boolean(['A'])` 恒为 true 的坑。
 */
export function judgeObjective(
  q: Question,
  selected: string[] | boolean,
  answer: Question['answer'] = q.answer,
): boolean {
  if (q.type === 'true_false') {
    const ansBool = Boolean(Array.isArray(answer) ? answer[0] : answer)
    const selBool =
      typeof selected === 'boolean'
        ? selected
        : Array.isArray(selected)
          ? selected[0] === 'A'
          : Boolean(selected)
    return ansBool === selBool
  }
  const correct = (Array.isArray(answer) ? answer : [answer]) as string[]
  const sel = (Array.isArray(selected) ? selected : [selected]) as string[]
  if (sel.length !== correct.length) return false
  const a = [...correct].sort().join(',')
  const b = [...sel].sort().join(',')
  return a === b
}

/** 按当前筛选条件过滤题目 */
export function filterQuestions(
  session: SessionState,
  progress: ProgressMap,
  all: Question[],
): Question[] {
  let list = all.filter((q) => {
    if (session.yearFilter.length && !q.source_years.some((y) => session.yearFilter.includes(y))) {
      return false
    }
    if (session.typeFilter.length && !session.typeFilter.includes(q.type)) return false
    if (
      session.chapterFilter.length &&
      !session.chapterFilter.some((ch) => inChapter(q, ch))
    ) {
      return false
    }
    if (
      session.kpFilter.length &&
      !q.knowledge_points.some((k) => session.kpFilter.includes(k))
    ) {
      return false
    }
    const rec = progress[q.id]
    if (session.wrongOnly && !(rec?.inWrongBook ?? false)) return false
    if (session.favoriteOnly && !(rec?.favorite ?? false)) return false
    return true
  })

  if (session.order === 'random') {
    list = shuffle(list, seedOf(session))
  }
  return list
}

/** 用筛选条件做种子，保证同一筛选下随机顺序稳定（刷新不乱） */
function seedOf(s: SessionState) {
  return (
    s.yearFilter.join('-') +
    '|' +
    s.typeFilter.join('-') +
    '|' +
    s.kpFilter.join('-') +
    '|' +
    s.chapterFilter.join('-') +
    '|' + (s.wrongOnly ? 'w' : '') + (s.favoriteOnly ? 'f' : '')
  )
}

function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function shuffle<T>(arr: T[], seed: string): T[] {
  const a = [...arr]
  let s = hash(seed) || 1
  const rnd = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 会话模式定义（用于左侧入口与顶部模式显示） */
export const PRESET_MODES = [
  { key: 'sequence', label: '顺序练习' },
  { key: 'random', label: '随机练习' },
  { key: 'wrong', label: '错题重做' },
  { key: 'favorite', label: '我的收藏' },
] as const

export function modeLabel(session: SessionState): string {
  if (session.wrongOnly) return '错题重做'
  if (session.favoriteOnly) return '我的收藏'
  const parts: string[] = []
  if (session.yearFilter.length) parts.push(session.yearFilter.map((y) => `${y}年`).join('/'))
  if (session.typeFilter.length) parts.push(`${session.typeFilter.length}种题型`)
  if (session.chapterFilter.length) parts.push(`${session.chapterFilter.length}个章节`)
  if (session.kpFilter.length) parts.push(`${session.kpFilter.length}个知识点`)
  if (!parts.length) return session.order === 'random' ? '随机练习' : '顺序练习'
  return parts.join(' · ')
}
