import extendedRaw from '../../data/extended.json'
import { questions } from './data'
import type { ExtendedFile, ExtendedQuestion, Question } from './types'

/** 扩展题库（整份数据，只被刷题页按需加载，不进首屏 chunk） */
export const extendedFile = extendedRaw as unknown as ExtendedFile
export const extendedQuestions: ExtendedQuestion[] = extendedFile.questions

/** 真题 + 扩展题；两类 id 前缀不同（EXT- / 年份-），不会冲突 */
export const allQuestions: Question[] = [...extendedQuestions, ...questions]
