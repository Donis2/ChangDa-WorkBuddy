import { useSyncExternalStore } from 'react'
import type { ProgressRecord } from './types'

const KEY = 'cdu-mech-progress-v1'
const SESSION_KEY = 'cdu-mech-session-v1'

export type ProgressMap = Record<string, ProgressRecord>

function emptyRecord(questionId: string): ProgressRecord {
  return {
    questionId,
    attempts: 0,
    correctCount: 0,
    wrongCount: 0,
    inWrongBook: false,
    favorite: false,
    lastCorrect: null,
    lastUserAnswer: null,
    lastTs: 0,
  }
}

function read(): ProgressMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ProgressMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

let state: ProgressMap = typeof window === 'undefined' ? {} : read()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

function setState(next: ProgressMap) {
  state = { ...next }
  persist()
  emit()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useProgress(): ProgressMap {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  )
}

export function getProgress(): ProgressMap {
  return state
}

/** 记录一次作答 */
export function recordAnswer(
  questionId: string,
  userAnswer: unknown,
  correct: boolean,
) {
  const prev = state[questionId] ?? emptyRecord(questionId)
  const next: ProgressRecord = {
    ...prev,
    attempts: prev.attempts + 1,
    correctCount: prev.correctCount + (correct ? 1 : 0),
    wrongCount: prev.wrongCount + (correct ? 0 : 1),
    lastCorrect: correct,
    lastUserAnswer: userAnswer,
    lastTs: Date.now(),
    // 答错自动进错题本；答对不自动移除（由用户手动移除，避免"蒙对"漏掉）
    inWrongBook: correct ? prev.inWrongBook : true,
  }
  setState({ ...state, [questionId]: next })
}

/** 主观题自评（不含自动判分） */
export function selfEvaluate(questionId: string, correct: boolean) {
  recordAnswer(questionId, null, correct)
}

export function setWrongBook(questionId: string, inWrongBook: boolean) {
  const prev = state[questionId] ?? emptyRecord(questionId)
  setState({ ...state, [questionId]: { ...prev, inWrongBook } })
}

export function toggleFavorite(questionId: string) {
  const prev = state[questionId] ?? emptyRecord(questionId)
  setState({ ...state, [questionId]: { ...prev, favorite: !prev.favorite } })
}

export function resetQuestion(questionId: string) {
  const next = { ...state }
  delete next[questionId]
  setState(next)
}

export function resetAll() {
  setState({})
}

/** ---------- 刷题会话（记住进度，刷新不丢） ---------- */
export type BankKey = 'real' | 'ext' | 'all'

export interface SessionState {
  mode: string
  /** 当前题库：real = 真题，ext = 扩展题，all = 两者合并 */
  bank: BankKey
  yearFilter: number[]
  typeFilter: string[]
  /** 章节筛选（存章节名，如「第五章 轮系」）；点章节名即可看该章全部题目 */
  chapterFilter: string[]
  kpFilter: string[]
  /**
   * 知识点/章节是否多选叠加。
   * false（默认）= 单选：点新的会替换旧的，即「点知识点 1 只看 1，再点知识点 2 只看 2」。
   * true（勾选「筛选」）= 多选叠加：点知识点 1 再点 2，两处题目一起显示。
   */
  multiSelect: boolean
  wrongOnly: boolean
  favoriteOnly: boolean
  order: 'order' | 'random'
  index: number
  /** 显示方式：single = 一题一题；all = 全部展开 */
  view: 'single' | 'all'
  /** 全部展开模式下是否默认展开答案 */
  revealAll: boolean
}

export const defaultSession: SessionState = {
  mode: 'sequence',
  bank: 'real',
  yearFilter: [],
  typeFilter: [],
  chapterFilter: [],
  kpFilter: [],
  multiSelect: false,
  wrongOnly: false,
  favoriteOnly: false,
  order: 'order',
  index: 0,
  view: 'single',
  revealAll: false,
}

export function loadSession(): SessionState {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return { ...defaultSession }
    return { ...defaultSession, ...(JSON.parse(raw) as Partial<SessionState>) }
  } catch {
    return { ...defaultSession }
  }
}

export function saveSession(s: SessionState) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}
