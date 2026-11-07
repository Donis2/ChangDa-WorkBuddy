import questionsRaw from '../../data/questions.json'
import type { Question, QuestionsFile } from './types'

/**
 * 完整真题库（888KB）：只被刷题页 / 统计页的 lazy chunk 引用。
 * 首页不要 import 本模块，否则这份数据会回到首屏。
 */
export const questionsFile = questionsRaw as unknown as QuestionsFile
export const questions: Question[] = questionsFile.questions
