import extendedRaw from '../../data/extended.json'
import { questions } from './questionData'
import type { ExtendedFile, ExtendedQuestion, Question } from './types'

/**
 * 扩展题库整份数据（777KB）。
 * **必须动态 import 本模块**：只在用户切到「扩展题 / 全部」或打开统计页时加载，
 * 静态 import 会让 90% 只刷真题的用户白下载这一份数据。
 */
export const extendedFile = extendedRaw as unknown as ExtendedFile
export const extendedQuestions: ExtendedQuestion[] = extendedFile.questions

/** 真题 + 扩展题；两类 id 前缀不同（EXT- / 年份-），不会冲突 */
export const allQuestions: Question[] = [...extendedQuestions, ...questions]
